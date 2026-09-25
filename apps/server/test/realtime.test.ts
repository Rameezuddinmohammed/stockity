import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { blocks, calls, reportEvidence, reports } from "../src/db/schema";
import { createHarness, type Harness } from "./harness";
import { TestClient } from "./ws-client";

let h: Harness;
let url: string;
beforeAll(async () => {
  h = await createHarness();
  url = await h.listen();
});
beforeEach(async () => {
  await h.reset();
});
afterAll(async () => {
  await h.close();
});

const MIN = 60_000;
let n = 0;
const unis = ["iitb.ac.in", "kyoto-u.ac.jp", "uonbi.ac.ke", "mit.edu", "ox.ac.uk"];

/** Signs up a fresh student and opens a live connection for them. */
async function student(name = `Student${++n}`) {
  const email = `${name.toLowerCase()}@${unis[n % unis.length]}`;
  const cookie = await h.signUp(email, name);
  await h.ctx.redis.del(`cd:otp:${email}`);
  const client = h.track(await TestClient.connect(url, cookie));
  await client.next("hello");
  return { client, cookie, name, email };
}

async function pair(mode: "video" | "text" = "video") {
  const a = await student();
  const b = await student();
  a.client.send({ t: "queue.join", mode });
  await a.client.next("queue.waiting");
  b.client.send({ t: "queue.join", mode });
  const ma = await a.client.next("match");
  const mb = await b.client.next("match");
  return { a, b, ma, mb };
}

describe("connecting", () => {
  it("needs a signed-in, onboarded student from our own origin", async () => {
    const anon = await TestClient.connect(url);
    expect(await anon.waitClosed()).toBe(4401);

    const { cookie } = await student();
    const evil = await TestClient.connect(url, cookie, "https://evil.example");
    expect(await evil.waitClosed()).toBe(4400);

    const pending = await h.signIn("pending@mit.edu");
    const early = await TestClient.connect(url, pending);
    expect(await early.waitClosed()).toBe(4403);
  });

  it("counts people online", async () => {
    await student();
    const b = await student();
    b.client.messages.length = 0;
    expect((await h.get("/api/stats")).json().online).toBe(2);
  });

  it("keeps only the newest connection per person", async () => {
    const a = await student();
    const second = h.track(await TestClient.connect(url, a.cookie));
    await second.next("hello");
    expect((await a.client.next("kicked")).reason).toBe("replaced");
    expect(await a.client.waitClosed()).toBe(4409);
  });
});

describe("matching", () => {
  it("pairs two waiting students and introduces them", async () => {
    const { a, b, ma, mb } = await pair();
    expect(ma.callId).toBe(mb.callId);
    expect(ma.role).toBe("offerer");
    expect(mb.role).toBe("answerer");
    expect(ma.peer.displayName).toBe(b.name);
    expect(mb.peer.displayName).toBe(a.name);
    expect(ma.peer.university).toBeTruthy();
    expect(ma.ice.iceTransportPolicy).toBe("all");
    const [row] = await h.ctx.db.select().from(calls).where(eq(calls.id, ma.callId));
    expect(row?.mode).toBe("video");
  });

  it("keeps video and text queues apart", async () => {
    const a = await student();
    const b = await student();
    a.client.send({ t: "queue.join", mode: "video" });
    b.client.send({ t: "queue.join", mode: "text" });
    expect(await a.client.nothing("match")).toBe(true);
  });

  it("doesn't rematch the person you just skipped, but finds someone new", async () => {
    const { a, b } = await pair();
    a.client.send({ t: "call.next" });
    expect(await a.client.next("call.ended")).toMatchObject({ reason: "next", by: "you" });
    expect(await b.client.next("call.ended")).toMatchObject({ reason: "left", by: "them" });

    a.client.send({ t: "queue.join", mode: "video" });
    b.client.send({ t: "queue.join", mode: "video" });
    expect(await a.client.nothing("match")).toBe(true);

    const c = await student();
    c.client.send({ t: "queue.join", mode: "video" });
    const mc = await c.client.next("match");
    expect([a.name, b.name]).toContain(mc.peer.displayName);
  });

  it("allows a repeat match after the cooldown when nobody else is around", async () => {
    const { a, b } = await pair();
    a.client.send({ t: "call.next" });
    await a.client.next("call.ended");
    await b.client.next("call.ended");
    h.advance(3 * MIN);
    a.client.send({ t: "queue.join", mode: "video" });
    await a.client.next("queue.waiting");
    b.client.send({ t: "queue.join", mode: "video" });
    expect((await b.client.next("match")).peer.displayName).toBe(a.name);
  });

  it("never matches people who blocked each other", async () => {
    const { a, b, ma } = await pair();
    a.client.send({ t: "call.block" });
    expect(await a.client.next("call.ended")).toMatchObject({ reason: "blocked" });
    expect(await b.client.next("call.ended")).toMatchObject({ reason: "left" });
    const rows = await h.ctx.db.select().from(blocks);
    expect(rows).toHaveLength(1);
    expect(ma.callId).toBeTruthy();

    h.advance(24 * 60 * MIN);
    a.client.send({ t: "queue.join", mode: "video" });
    b.client.send({ t: "queue.join", mode: "video" });
    expect(await b.client.nothing("match", 500)).toBe(true);
  });

  it("ends the call when someone disconnects", async () => {
    const { a, b } = await pair();
    await a.client.close();
    expect(await b.client.next("call.ended")).toMatchObject({ reason: "disconnected", by: "them" });
  });
});

describe("in a call", () => {
  it("relays WebRTC signals and camera/mic state", async () => {
    const { a, b } = await pair();
    a.client.send({ t: "signal", data: { sdp: { type: "offer", sdp: "v=0 test" } } });
    expect((await b.client.next("signal")).data).toEqual({
      sdp: { type: "offer", sdp: "v=0 test" },
    });
    b.client.send({ t: "media.state", audio: false, video: true });
    expect(await a.client.next("media.state")).toMatchObject({ audio: false, video: true });
  });

  it("relays chat, masks slurs and holds back links for 5 minutes", async () => {
    const { a, b } = await pair("text");
    a.client.send({ t: "chat.send", clientId: "c1", text: "hey! what do you study?" });
    expect((await a.client.next("chat.ack")).clientId).toBe("c1");
    expect((await b.client.next("chat.msg")).text).toBe("hey! what do you study?");

    b.client.send({ t: "chat.send", clientId: "c2", text: "add me @riya.s" });
    expect(await b.client.next("chat.rejected")).toMatchObject({ reason: "links_locked" });
    expect(await a.client.nothing("chat.msg")).toBe(true);

    b.client.send({ t: "chat.send", clientId: "c3", text: "show me your tits" });
    expect((await a.client.next("chat.msg")).text).not.toContain("tits");

    h.advance(6 * MIN);
    b.client.send({ t: "chat.send", clientId: "c4", text: "add me @riya.s" });
    expect((await a.client.next("chat.msg")).text).toBe("add me @riya.s");
  });

  it("rate limits chat floods", async () => {
    const { a } = await pair("text");
    for (let i = 0; i < 21; i++) a.client.send({ t: "chat.send", clientId: `m${i}`, text: "spam" });
    expect(await a.client.next("chat.rejected")).toMatchObject({ reason: "rate_limited" });
  });
});

describe("reporting", () => {
  it("files a report with context, blocks the person and ends the chat", async () => {
    const { a, b, ma } = await pair();
    b.client.send({ t: "chat.send", clientId: "x", text: "you're ugly lol" });
    await a.client.next("chat.msg");
    const frame = `data:image/jpeg;base64,${Buffer.from("fake-jpeg-bytes").toString("base64")}`;
    a.client.send({ t: "call.report", category: "harassment", note: "rude", frame });

    expect((await a.client.next("report.received")).callId).toBe(ma.callId);
    expect(await a.client.next("call.ended")).toMatchObject({ reason: "reported", by: "you" });
    expect(await b.client.next("call.ended")).toMatchObject({ reason: "left", by: "them" });

    const [report] = await h.ctx.db.select().from(reports);
    expect(report).toMatchObject({ category: "harassment", note: "rude", status: "open" });
    expect(report?.chatExcerpt).toEqual([
      expect.objectContaining({ from: "reported", text: "you're ugly lol" }),
    ]);
    const [evidence] = await h.ctx.db.select().from(reportEvidence);
    expect(evidence?.frame.toString()).toBe("fake-jpeg-bytes");
    expect(await h.ctx.db.select().from(blocks)).toHaveLength(1);
  });
});

describe("enforcement", () => {
  it("disconnects someone the moment an admin suspends them", async () => {
    const admin = await h.signUp("admin@mit.edu", "Admin");
    const { a, b } = await pair();
    const bId = (await h.get("/api/me", b.cookie)).json().id;
    await h.post(`/api/admin/users/${bId}/suspend`, { hours: 24, reason: "Harassment" }, admin);
    expect((await b.client.next("kicked")).reason).toBe("suspended");
    expect(await a.client.next("call.ended")).toMatchObject({ by: "them" });
    const me = (await h.get("/api/me", b.cookie)).json();
    expect(me.notices[0].kind).toBe("suspension");
  });

  it("auto-suspends after nudity flags from three different people", async () => {
    const subject = await student("Subject");
    for (let i = 0; i < 3; i++) {
      const viewer = await student();
      subject.client.send({ t: "queue.join", mode: "video" });
      viewer.client.send({ t: "queue.join", mode: "video" });
      await viewer.client.next("match");
      await subject.client.next("match");
      viewer.client.send({ t: "nsfw.flag", score: 0.93 });
      if (i < 2) {
        viewer.client.send({ t: "call.next" });
        await subject.client.next("call.ended");
        h.advance(3 * MIN);
      }
    }
    expect((await subject.client.next("kicked")).reason).toBe("suspended");
    const [auto] = await h.ctx.db.select().from(reports).where(eq(reports.automatic, true));
    expect(auto).toMatchObject({ category: "nudity", status: "open" });
  });
});
