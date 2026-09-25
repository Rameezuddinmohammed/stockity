import { randomUUID } from "node:crypto";
import {
  type CallMode,
  type ClientMessage,
  clientMessageSchema,
  type EndReason,
  INTERESTS,
  LANGUAGES,
  LINK_LOCK_SECONDS,
  MAX_EVIDENCE_BYTES,
  type PeerCard,
  REPORT_CATEGORIES,
  type ServerMessage,
  WS_CLOSE,
} from "@quad/shared";
import { and, countDistinct, eq, gt } from "drizzle-orm";
import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { AuthUser } from "../auth";
import type { Ctx } from "../context";
import {
  blocks,
  calls,
  moderationEvents,
  profiles,
  reportEvidence,
  reports,
  universities,
  users,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { enforce as enforceRateLimit } from "../lib/rate-limit";
import { enforce, type Kicker } from "../safety/enforce";
import { BOT_CARD, BOT_ID, type BotReply, botOpener, botReply, botTypingMs } from "./bot";
import { censorText, containsContactInfo } from "./filter";
import { Matchmaker } from "./matchmaker";
import { dropPresence, onlineCount, touchPresence } from "./presence";
import { iceConfigFor } from "./turn";

type Conn = {
  userId: string;
  socket: WebSocket;
  card: PeerCard;
  state: "idle" | "queued" | "in_call";
  mode: CallMode | null;
  joinedAt: number;
  callId: string | null;
  alive: boolean;
  /** Serializes this connection's message handling. */
  chain: Promise<void>;
  chatWindowStart: number;
  chatCount: number;
};

type ChatLine = { from: string; text: string; at: string };

type Call = {
  id: string;
  mode: CallMode;
  a: string;
  b: string;
  linksUnlockAt: number;
  /** Kept in memory only, so a report can include context. Never written to the database otherwise. */
  messages: ChatLine[];
  nsfwFlaggedBy: Set<string>;
  /** Present when the partner is Quad Bot (no second person, no WebRTC). */
  bot?: { timers: NodeJS.Timeout[]; rickrolled: boolean };
};

const SWEEP_MS = 2_000;
const PRESENCE_MS = 10_000;
const HEARTBEAT_MS = 20_000;
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_PER_WINDOW = 20;
const KEEP_MESSAGES = 50;
/** Nudity flags from this many different people within a day suspend an account pending review. */
export const NSFW_AUTO_SUSPEND_OBSERVERS = 3;

const interestLabel = new Map<string, string>(INTERESTS.map((i) => [i.id, i.label]));
const languageName = new Map<string, string>(LANGUAGES.map((l) => [l.code, l.name]));
const categoryLabel = new Map<string, string>(REPORT_CATEGORIES.map((c) => [c.id, c.label]));

export class Hub implements Kicker {
  private readonly conns = new Map<string, Conn>();
  private readonly calls = new Map<string, Call>();
  private readonly mm: Matchmaker;
  private readonly timers: NodeJS.Timeout[] = [];
  private lastOnline = -1;
  private sweeping = false;

  constructor(
    private readonly ctx: Ctx,
    private readonly log: FastifyBaseLogger,
  ) {
    this.mm = new Matchmaker(ctx.redis, ctx.db);
  }

  start() {
    this.timers.push(setInterval(() => void this.sweep(), SWEEP_MS));
    this.timers.push(setInterval(() => void this.broadcastPresence(), PRESENCE_MS));
    this.timers.push(setInterval(() => this.heartbeat(), HEARTBEAT_MS));
  }

  async stop() {
    for (const t of this.timers) clearInterval(t);
    for (const conn of this.conns.values()) conn.socket.close(1001, "server shutting down");
    this.conns.clear();
    this.calls.clear();
  }

  // ---------- connections ----------

  async accept(socket: WebSocket, req: FastifyRequest) {
    // Browsers always send Origin on WebSocket upgrades; reject other sites (cross-site WebSocket hijacking).
    if (req.headers.origin !== this.ctx.config.APP_ORIGIN) {
      socket.close(WS_CLOSE.badOrigin, "bad origin");
      return;
    }
    if (!req.auth) {
      socket.close(WS_CLOSE.unauthenticated, "sign in first");
      return;
    }
    const user = req.auth.user;
    if (user.status !== "active") {
      socket.close(WS_CLOSE.forbidden, user.status);
      return;
    }

    // Buffer messages that arrive while we load the profile card.
    const early: unknown[] = [];
    const onEarly = (raw: unknown) => early.push(raw);
    socket.on("message", onEarly);

    const card = await this.loadCard(user);
    const existing = this.conns.get(user.id);
    if (existing) {
      this.send(existing, { t: "kicked", reason: "replaced" });
      await this.drop(existing);
      existing.socket.close(WS_CLOSE.replaced, "opened elsewhere");
    }

    const conn: Conn = {
      userId: user.id,
      socket,
      card,
      state: "idle",
      mode: null,
      joinedAt: 0,
      callId: null,
      alive: true,
      chain: Promise.resolve(),
      chatWindowStart: 0,
      chatCount: 0,
    };
    this.conns.set(user.id, conn);
    await touchPresence(this.ctx.redis, user.id, this.ctx.now());
    this.send(conn, { t: "hello", online: await onlineCount(this.ctx.redis, this.ctx.now()) });

    socket.off("message", onEarly);
    const onMessage = (raw: unknown) => {
      conn.chain = conn.chain
        .then(() => this.onRaw(conn, raw))
        .catch((err) => {
          this.log.error({ err }, "realtime message failed");
          this.send(conn, {
            t: "error",
            code: "INTERNAL",
            message: "Something went wrong. Try again?",
          });
        });
    };
    socket.on("message", onMessage);
    socket.on("pong", () => {
      conn.alive = true;
    });
    socket.on("close", () => {
      if (this.conns.get(user.id) === conn) {
        conn.chain = conn.chain.then(() => this.drop(conn)).catch((err) => this.log.error({ err }));
      }
    });
    for (const raw of early) onMessage(raw);
  }

  /** Removes a connection: leaves the queue, ends any call, clears presence. */
  private async drop(conn: Conn) {
    if (this.conns.get(conn.userId) !== conn) return;
    this.conns.delete(conn.userId);
    await this.mm.leave(conn.userId);
    const call = conn.callId ? this.calls.get(conn.callId) : undefined;
    if (call) await this.endCall(call, conn.userId, "disconnected");
    await dropPresence(this.ctx.redis, conn.userId);
  }

  kick(userId: string, reason: "suspended" | "banned" | "signed_out") {
    const conn = this.conns.get(userId);
    if (!conn) return;
    this.send(conn, { t: "kicked", reason });
    conn.chain = conn.chain
      .then(() => this.drop(conn))
      .then(() => conn.socket.close(WS_CLOSE.forbidden, reason))
      .catch((err) => this.log.error({ err }, "kick failed"));
  }

  isOnline = (userId: string) => this.conns.has(userId);

  private send(conn: Conn, msg: ServerMessage) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(msg));
  }

  private error(conn: Conn, code: string, message: string) {
    this.send(conn, { t: "error", code, message });
  }

  private async onRaw(conn: Conn, raw: unknown) {
    let json: unknown;
    try {
      json = JSON.parse(String(raw));
    } catch {
      return this.error(conn, "VALIDATION", "Malformed message.");
    }
    const parsed = clientMessageSchema.safeParse(json);
    if (!parsed.success) {
      return this.error(conn, "VALIDATION", parsed.error.issues[0]?.message ?? "Invalid message.");
    }
    try {
      await this.handle(conn, parsed.data);
    } catch (err) {
      if (err instanceof AppError) return this.error(conn, err.code, err.message);
      throw err;
    }
  }

  private async handle(conn: Conn, msg: ClientMessage) {
    const call = conn.callId ? this.calls.get(conn.callId) : undefined;
    switch (msg.t) {
      case "queue.join":
        return this.join(conn, msg.mode);
      case "bot.start":
        return this.startBotCall(conn, msg.mode);
      case "queue.leave":
        if (conn.state === "queued") {
          conn.state = "idle";
          await this.mm.leave(conn.userId);
        }
        return;
      case "signal":
        if (call?.mode === "video") this.relay(call, conn, { t: "signal", data: msg.data });
        return;
      case "media.state":
        if (call) this.relay(call, conn, { t: "media.state", audio: msg.audio, video: msg.video });
        return;
      case "chat.typing":
        if (call) this.relay(call, conn, { t: "chat.typing" });
        return;
      case "chat.send":
        return this.chat(conn, call, msg.clientId, msg.text);
      case "call.next":
        if (!call) return;
        await enforceRateLimit(this.ctx.redis, {
          key: `next:${conn.userId}`,
          max: 120,
          windowSeconds: 3600,
        });
        return this.endCall(call, conn.userId, "next");
      case "call.end":
        if (call) await this.endCall(call, conn.userId, "left");
        return;
      case "call.block":
        if (!call) return;
        if (call.bot) return this.endCall(call, conn.userId, "next");
        await this.block(conn.userId, this.partnerOf(call, conn.userId));
        return this.endCall(call, conn.userId, "blocked");
      case "call.report":
        if (!call) return this.error(conn, "NOT_IN_CALL", "The chat already ended.");
        if (call.bot) return this.endCall(call, conn.userId, "left");
        return this.report(conn, call, msg);
      case "nsfw.flag":
        if (call?.mode === "video" && !call.bot) await this.nsfwFlag(conn, call, msg.score);
        return;
    }
  }

  // ---------- matching ----------

  private async join(conn: Conn, mode: CallMode) {
    if (conn.state === "in_call")
      return this.error(conn, "IN_CALL", "Leave your current chat first.");
    conn.state = "queued";
    conn.mode = mode;
    conn.joinedAt = this.ctx.now().getTime();
    await this.mm.loadBlocks(conn.userId);
    this.send(conn, { t: "queue.waiting", mode });
    await this.attemptMatch(conn);
  }

  private async attemptMatch(conn: Conn, depth = 0): Promise<void> {
    if (conn.state !== "queued" || !conn.mode || this.conns.get(conn.userId) !== conn) return;
    const partnerId = await this.mm.tryMatch(
      conn.userId,
      conn.mode,
      conn.joinedAt,
      this.ctx.now().getTime(),
    );
    if (!partnerId) return;
    const other = this.conns.get(partnerId);
    if (other?.state !== "queued" || other.mode !== conn.mode) {
      // A stale queue entry (they left); the script already removed it, so look again.
      if (depth < 20) return this.attemptMatch(conn, depth + 1);
      return;
    }
    // Whoever waited longer makes the WebRTC offer.
    await this.startCall(other, conn, conn.mode);
  }

  private async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const waiting = [...this.conns.values()]
        .filter((c) => c.state === "queued")
        .sort((a, b) => a.joinedAt - b.joinedAt);
      for (const conn of waiting) await this.attemptMatch(conn);
    } catch (err) {
      this.log.error({ err }, "matchmaking sweep failed");
    } finally {
      this.sweeping = false;
    }
  }

  private async startCall(offerer: Conn, answerer: Conn, mode: CallMode) {
    const now = this.ctx.now();
    offerer.state = "in_call";
    answerer.state = "in_call";
    const [row] = await this.ctx.db
      .insert(calls)
      .values({ userA: offerer.userId, userB: answerer.userId, mode, startedAt: now })
      .returning({ id: calls.id });
    if (!row) throw new Error("could not create call");
    const call: Call = {
      id: row.id,
      mode,
      a: offerer.userId,
      b: answerer.userId,
      linksUnlockAt: now.getTime() + LINK_LOCK_SECONDS * 1000,
      messages: [],
      nsfwFlaggedBy: new Set(),
    };
    this.calls.set(call.id, call);
    offerer.callId = call.id;
    answerer.callId = call.id;
    await this.mm.rememberPair(offerer.userId, answerer.userId, now.getTime());

    // Someone may have disconnected while the call row was being written.
    for (const side of [offerer, answerer]) {
      if (this.conns.get(side.userId) !== side) {
        return this.endCall(call, side.userId, "disconnected");
      }
    }
    const linksUnlockAt = new Date(call.linksUnlockAt).toISOString();
    for (const [me, them, role] of [
      [offerer, answerer, "offerer"],
      [answerer, offerer, "answerer"],
    ] as const) {
      this.send(me, {
        t: "match",
        callId: call.id,
        mode,
        role,
        peer: them.card,
        ice: iceConfigFor(this.ctx.config, me.userId, now),
        linksUnlockAt,
      });
    }
  }

  private partnerOf(call: Call, userId: string) {
    return call.a === userId ? call.b : call.a;
  }

  private relay(call: Call, from: Conn, msg: ServerMessage) {
    const other = this.conns.get(this.partnerOf(call, from.userId));
    if (other && other.callId === call.id) this.send(other, msg);
  }

  /** Ends a call for both sides. The other person only learns that the chat ended, never why. */
  private async endCall(call: Call, byUserId: string, reason: EndReason) {
    if (!this.calls.delete(call.id)) return;
    for (const t of call.bot?.timers ?? []) clearTimeout(t);
    for (const userId of [call.a, call.b]) {
      const conn = this.conns.get(userId);
      if (!conn || conn.callId !== call.id) continue;
      conn.state = "idle";
      conn.callId = null;
      const mine = userId === byUserId;
      this.send(conn, {
        t: "call.ended",
        callId: call.id,
        reason: mine ? reason : reason === "disconnected" ? "disconnected" : "left",
        by: mine ? "you" : "them",
      });
    }
    await this.ctx.db
      .update(calls)
      .set({ endedAt: this.ctx.now(), endedBy: byUserId, endReason: reason })
      .where(eq(calls.id, call.id));
  }

  // ---------- chat ----------

  private async chat(conn: Conn, call: Call | undefined, clientId: string, raw: string) {
    if (!call) return this.send(conn, { t: "chat.rejected", clientId, reason: "not_in_call" });
    const now = this.ctx.now().getTime();
    if (now - conn.chatWindowStart > CHAT_WINDOW_MS) {
      conn.chatWindowStart = now;
      conn.chatCount = 0;
    }
    if (++conn.chatCount > CHAT_MAX_PER_WINDOW) {
      return this.send(conn, { t: "chat.rejected", clientId, reason: "rate_limited" });
    }
    if (now < call.linksUnlockAt && containsContactInfo(raw)) {
      return this.send(conn, { t: "chat.rejected", clientId, reason: "links_locked" });
    }
    const text = censorText(raw);
    const id = randomUUID();
    const at = new Date(now).toISOString();
    call.messages.push({ from: conn.userId, text, at });
    if (call.messages.length > KEEP_MESSAGES) call.messages.shift();
    this.relay(call, conn, { t: "chat.msg", id, text, at });
    this.send(conn, { t: "chat.ack", clientId, id, text, at });
    if (call.bot) this.botSay(call, botReply(text));
  }

  // ---------- Quad Bot ----------

  /** Starts a practice chat with Quad Bot. It's a separate, clearly-labelled mode, never a stand-in for a student. */
  private async startBotCall(conn: Conn, mode: CallMode) {
    if (conn.state === "in_call")
      return this.error(conn, "IN_CALL", "Leave your current chat first.");
    if (conn.state === "queued") await this.mm.leave(conn.userId);
    conn.state = "in_call";
    const now = this.ctx.now();
    const [row] = await this.ctx.db
      .insert(calls)
      .values({ userA: conn.userId, userB: null, mode, startedAt: now })
      .returning({ id: calls.id });
    if (!row) throw new Error("could not create call");
    const call: Call = {
      id: row.id,
      mode,
      a: conn.userId,
      b: BOT_ID,
      linksUnlockAt: now.getTime() + LINK_LOCK_SECONDS * 1000,
      messages: [],
      nsfwFlaggedBy: new Set(),
      bot: { timers: [], rickrolled: false },
    };
    this.calls.set(call.id, call);
    conn.callId = call.id;
    this.send(conn, {
      t: "match",
      callId: call.id,
      mode,
      role: "answerer",
      peer: BOT_CARD,
      ice: { iceServers: [], iceTransportPolicy: "all" },
      linksUnlockAt: new Date(call.linksUnlockAt).toISOString(),
    });
    this.botSay(call, { text: botOpener(), scene: "robot" });
    // In video chats, one unprompted rickroll per call. Tradition.
    if (mode === "video") {
      call.bot?.timers.push(
        setTimeout(() => {
          if (call.bot && !call.bot.rickrolled) {
            this.botSay(call, {
              text: "brb, sending you my favourite video 📺",
              scene: "rickroll",
            });
          }
        }, 45_000),
      );
    }
  }

  /** Shows "typing…", then sends the bot's message (and camera scene) if the chat is still going. */
  private botSay(call: Call, reply: BotReply) {
    const bot = call.bot;
    const conn = this.conns.get(call.a);
    if (!bot || !conn || conn.callId !== call.id) return;
    this.send(conn, { t: "chat.typing" });
    bot.timers.push(
      setTimeout(() => {
        const live = this.conns.get(call.a);
        if (!this.calls.has(call.id) || !live || live.callId !== call.id) return;
        const at = this.ctx.now().toISOString();
        call.messages.push({ from: BOT_ID, text: reply.text, at });
        if (call.messages.length > KEEP_MESSAGES) call.messages.shift();
        this.send(live, { t: "chat.msg", id: randomUUID(), text: reply.text, at });
        if (reply.scene) {
          if (reply.scene === "rickroll") bot.rickrolled = true;
          this.send(live, { t: "bot.scene", scene: reply.scene });
        }
      }, botTypingMs(reply.text)),
    );
  }

  // ---------- safety ----------

  private async block(blockerId: string, blockedId: string) {
    await this.ctx.db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
    await this.mm.addBlock(blockerId, blockedId);
  }

  private async report(conn: Conn, call: Call, msg: Extract<ClientMessage, { t: "call.report" }>) {
    await enforceRateLimit(this.ctx.redis, {
      key: `report:${conn.userId}`,
      max: 10,
      windowSeconds: 86_400,
    });
    const reportedId = this.partnerOf(call, conn.userId);
    const excerpt = call.messages.slice(-30).map((m) => ({
      from: m.from === conn.userId ? ("reporter" as const) : ("reported" as const),
      text: m.text,
      at: m.at,
    }));

    let frame: { mime: string; data: Buffer } | null = null;
    const match = msg.frame?.match(/^data:(image\/(?:jpeg|webp));base64,(.+)$/);
    if (match?.[1] && match[2]) {
      const data = Buffer.from(match[2], "base64");
      if (data.length > 0 && data.length <= MAX_EVIDENCE_BYTES) frame = { mime: match[1], data };
    }

    await this.ctx.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(reports)
        .values({
          callId: call.id,
          reporterId: conn.userId,
          reportedId,
          category: msg.category,
          note: msg.note || null,
          chatExcerpt: excerpt,
        })
        .returning({ id: reports.id });
      if (row && frame) {
        await tx
          .insert(reportEvidence)
          .values({ reportId: row.id, mime: frame.mime, frame: frame.data });
      }
    });
    // Reporting someone also means never seeing them again.
    await this.block(conn.userId, reportedId);
    await this.endCall(call, conn.userId, "reported");
    this.send(conn, { t: "report.received", callId: call.id });
  }

  private async nsfwFlag(conn: Conn, call: Call, score: number) {
    if (call.nsfwFlaggedBy.has(conn.userId)) return;
    call.nsfwFlaggedBy.add(conn.userId);
    const subjectId = this.partnerOf(call, conn.userId);
    const now = this.ctx.now();
    await this.ctx.db.insert(moderationEvents).values({
      subjectId,
      observerId: conn.userId,
      callId: call.id,
      kind: "nsfw_flag",
      score,
    });

    const [row] = await this.ctx.db
      .select({ observers: countDistinct(moderationEvents.observerId) })
      .from(moderationEvents)
      .where(
        and(
          eq(moderationEvents.subjectId, subjectId),
          eq(moderationEvents.kind, "nsfw_flag"),
          gt(moderationEvents.createdAt, new Date(now.getTime() - 86_400_000)),
        ),
      );
    const observers = Number(row?.observers ?? 0);
    if (observers < NSFW_AUTO_SUSPEND_OBSERVERS) return;

    const [subject] = await this.ctx.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, subjectId));
    if (subject?.status !== "active") return;

    await this.ctx.db.insert(reports).values({
      callId: call.id,
      reportedId: subjectId,
      category: "nudity",
      note: `Automatic: ${observers} different people's devices detected nudity in the last 24 hours.`,
      automatic: true,
    });
    await enforce(this.ctx, this, {
      userId: subjectId,
      action: "suspend_24h",
      reason: "Nudity was detected in your video by several people. Our team will review it",
      adminId: null,
      countsAsStrike: false,
    });
  }

  // ---------- presence ----------

  private async broadcastPresence() {
    try {
      const now = this.ctx.now();
      for (const conn of this.conns.values()) await touchPresence(this.ctx.redis, conn.userId, now);
      const online = await onlineCount(this.ctx.redis, now);
      if (online === this.lastOnline) return;
      this.lastOnline = online;
      for (const conn of this.conns.values()) {
        if (conn.state !== "in_call") this.send(conn, { t: "presence", online });
      }
    } catch (err) {
      this.log.error({ err }, "presence broadcast failed");
    }
  }

  private heartbeat() {
    for (const conn of this.conns.values()) {
      if (!conn.alive) {
        conn.socket.terminate();
        continue;
      }
      conn.alive = false;
      conn.socket.ping();
    }
  }

  private async loadCard(user: AuthUser): Promise<PeerCard> {
    const [row] = await this.ctx.db
      .select({ profile: profiles, university: universities })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .innerJoin(universities, eq(universities.id, users.universityId))
      .where(eq(profiles.userId, user.id));
    return {
      displayName: row?.profile.displayName ?? "Student",
      university: row?.university.name ?? "",
      countryCode: row?.university.countryCode ?? "",
      course: row?.profile.course ?? "",
      year: row?.profile.year ?? null,
      interests: (row?.profile.interests ?? []).map((i) => interestLabel.get(i) ?? i),
      languages: (row?.profile.languages ?? []).map((l) => languageName.get(l) ?? l),
      avatarColor: (row?.profile.avatarColor ?? "grape") as PeerCard["avatarColor"],
    };
  }

  /** Human-readable category, for admin views. */
  static categoryLabel = (id: string) => categoryLabel.get(id) ?? id;
}
