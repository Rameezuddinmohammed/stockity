import { z } from "zod";
import type { AvatarColor } from "./constants";

/** Realtime protocol spoken over the /api/ws WebSocket. Client → server messages are validated with zod. */

export const CALL_MODES = ["video", "text"] as const;
export type CallMode = (typeof CALL_MODES)[number];

export const REPORT_CATEGORIES = [
  { id: "nudity", label: "Nudity or sexual content" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "underage", label: "Seems under 18" },
  { id: "spam", label: "Spam or selling something" },
  { id: "other", label: "Something else" },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["id"];
const REPORT_CATEGORY_IDS = REPORT_CATEGORIES.map((c) => c.id) as unknown as readonly [
  ReportCategory,
  ...ReportCategory[],
];

export const MAX_CHAT_LENGTH = 500;
/** Links, emails, handles and phone numbers are held back for this long at the start of a chat. */
export const LINK_LOCK_SECONDS = 5 * 60;
/** Evidence frames are small JPEGs captured by the reporter's device. */
export const MAX_EVIDENCE_BYTES = 150 * 1024;

const signalData = z.union([
  z.object({ sdp: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().max(20_000) }) }),
  z.object({
    candidate: z
      .object({
        candidate: z.string().max(1000),
        sdpMid: z.string().max(64).nullable().optional(),
        sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
        usernameFragment: z.string().max(256).nullable().optional(),
      })
      .nullable(),
  }),
]);
export type SignalData = z.infer<typeof signalData>;

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("queue.join"), mode: z.enum(CALL_MODES) }),
  z.object({ t: z.literal("queue.leave") }),
  z.object({ t: z.literal("signal"), data: signalData }),
  z.object({
    t: z.literal("chat.send"),
    clientId: z.string().min(1).max(40),
    text: z.string().trim().min(1).max(MAX_CHAT_LENGTH),
  }),
  z.object({ t: z.literal("chat.typing") }),
  z.object({ t: z.literal("media.state"), audio: z.boolean(), video: z.boolean() }),
  z.object({ t: z.literal("call.next") }),
  z.object({ t: z.literal("call.end") }),
  z.object({ t: z.literal("call.block") }),
  z.object({
    t: z.literal("call.report"),
    category: z.enum(REPORT_CATEGORY_IDS),
    note: z.string().trim().max(500).optional(),
    /** data:image/jpeg;base64,… of the remote video when the report sheet opened. */
    frame: z
      .string()
      .max(Math.ceil((MAX_EVIDENCE_BYTES * 4) / 3) + 64)
      .regex(/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
      .optional(),
  }),
  z.object({ t: z.literal("nsfw.flag"), score: z.number().min(0).max(1) }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type PeerCard = {
  displayName: string;
  university: string;
  countryCode: string;
  course: string;
  year: number | null;
  interests: string[];
  languages: string[];
  avatarColor: AvatarColor;
};

export type IceConfig = { iceServers: RTCIceServerLike[]; iceTransportPolicy: "all" | "relay" };
export type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

export type EndReason = "next" | "left" | "disconnected" | "reported" | "blocked" | "removed";

export type ServerMessage =
  | { t: "hello"; online: number }
  | { t: "presence"; online: number }
  | { t: "queue.waiting"; mode: CallMode }
  | {
      t: "match";
      callId: string;
      mode: CallMode;
      /** The offerer creates the WebRTC offer; the answerer waits for it. */
      role: "offerer" | "answerer";
      peer: PeerCard;
      ice: IceConfig;
      /** When links and numbers unlock (ISO time). */
      linksUnlockAt: string;
    }
  | { t: "signal"; data: SignalData }
  | { t: "chat.msg"; id: string; text: string; at: string }
  | { t: "chat.ack"; clientId: string; id: string; text: string; at: string }
  | {
      t: "chat.rejected";
      clientId: string;
      reason: "links_locked" | "rate_limited" | "not_in_call";
    }
  | { t: "chat.typing" }
  | { t: "media.state"; audio: boolean; video: boolean }
  | { t: "call.ended"; callId: string; reason: EndReason; by: "you" | "them" }
  | { t: "report.received"; callId: string }
  | { t: "kicked"; reason: "suspended" | "banned" | "signed_out" | "replaced" }
  | { t: "error"; code: string; message: string };

/** WebSocket close codes used by the server. */
export const WS_CLOSE = {
  unauthenticated: 4401,
  forbidden: 4403,
  badOrigin: 4400,
  replaced: 4409,
} as const;
