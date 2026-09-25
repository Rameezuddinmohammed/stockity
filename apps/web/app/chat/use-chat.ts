"use client";

import type { CallMode, PeerCard, ReportCategory, ServerMessage } from "@quad/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { watchForNudity } from "@/lib/nsfw";
import { RealtimeClient } from "@/lib/realtime";
import { captureFrame, getCamera, Peer } from "@/lib/rtc";

export type ChatLine = {
  key: string;
  mine: boolean;
  text: string;
  at: string;
  pending?: boolean;
  rejected?: "links_locked" | "rate_limited" | "not_in_call";
};

type Phase = "setup" | "waiting" | "in_call" | "reported" | "kicked";

type State = {
  phase: Phase;
  mode: CallMode;
  online: number | null;
  callId: string | null;
  peer: PeerCard | null;
  remote: MediaStream | null;
  peerMedia: { audio: boolean; video: boolean };
  lines: ChatLine[];
  peerTyping: boolean;
  linksUnlockAt: number;
  connection: RTCPeerConnectionState | "none";
  blurred: boolean;
  toast: string | null;
  kicked: "suspended" | "banned" | "signed_out" | "replaced" | null;
};

type Action =
  | { type: "set"; patch: Partial<State> }
  | { type: "line"; line: ChatLine }
  | { type: "ack"; clientId: string; id: string; text: string; at: string }
  | { type: "rejected"; clientId: string; reason: ChatLine["rejected"] };

const initial: State = {
  phase: "setup",
  mode: "video",
  online: null,
  callId: null,
  peer: null,
  remote: null,
  peerMedia: { audio: true, video: true },
  lines: [],
  peerTyping: false,
  linksUnlockAt: 0,
  connection: "none",
  blurred: false,
  toast: null,
  kicked: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "line":
      return { ...state, lines: [...state.lines, action.line].slice(-200), peerTyping: false };
    case "ack":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.key === action.clientId
            ? { ...l, key: action.id, text: action.text, pending: false }
            : l,
        ),
      };
    case "rejected":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.key === action.clientId ? { ...l, pending: false, rejected: action.reason } : l,
        ),
      };
  }
}

/** Runs one person's side of Just Chat: queue, WebRTC, text chat and safety actions. */
export function useChat() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const client = useRef<RealtimeClient | null>(null);
  const peer = useRef<Peer | null>(null);
  const local = useRef<MediaStream | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((patch: Partial<State>) => dispatch({ type: "set", patch }), []);
  const toast = useCallback(
    (text: string) => {
      set({ toast: text });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => set({ toast: null }), 3500);
    },
    [set],
  );

  const teardownCall = useCallback(() => {
    stopWatch.current?.();
    stopWatch.current = null;
    peer.current?.close();
    peer.current = null;
    set({
      callId: null,
      remote: null,
      connection: "none",
      blurred: false,
      peerTyping: false,
      peerMedia: { audio: true, video: true },
    });
  }, [set]);

  const join = useCallback(() => {
    set({ phase: "waiting", lines: [], peer: null });
    client.current?.send({ t: "queue.join", mode: stateRef.current.mode });
  }, [set]);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      const s = stateRef.current;
      switch (msg.t) {
        case "hello":
        case "presence":
          set({ online: msg.online });
          return;
        case "queue.waiting":
          set({ phase: "waiting" });
          return;
        case "match": {
          teardownCall();
          set({
            phase: "in_call",
            callId: msg.callId,
            peer: msg.peer,
            lines: [],
            linksUnlockAt: Date.parse(msg.linksUnlockAt),
            connection: msg.mode === "video" ? "new" : "none",
          });
          if (msg.mode === "video") {
            const p = new Peer(
              msg.ice,
              msg.role,
              local.current,
              (data) => client.current?.send({ t: "signal", data }),
              (stream) => set({ remote: stream }),
              (connection) => set({ connection }),
            );
            peer.current = p;
            void p.start();
            const audio = local.current?.getAudioTracks()[0]?.enabled ?? false;
            const video = local.current?.getVideoTracks()[0]?.enabled ?? false;
            client.current?.send({ t: "media.state", audio, video });
          }
          return;
        }
        case "signal":
          void peer.current?.handle(msg.data);
          return;
        case "media.state":
          set({ peerMedia: { audio: msg.audio, video: msg.video } });
          return;
        case "chat.msg":
          dispatch({
            type: "line",
            line: { key: msg.id, mine: false, text: msg.text, at: msg.at },
          });
          return;
        case "chat.ack":
          dispatch({ type: "ack", clientId: msg.clientId, id: msg.id, text: msg.text, at: msg.at });
          return;
        case "chat.rejected":
          dispatch({ type: "rejected", clientId: msg.clientId, reason: msg.reason });
          return;
        case "chat.typing":
          set({ peerTyping: true });
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => set({ peerTyping: false }), 3000);
          return;
        case "call.ended": {
          if (msg.callId !== s.callId) return;
          const name = s.peer?.displayName ?? "They";
          teardownCall();
          if (msg.by === "you") {
            if (msg.reason === "next") join();
            else if (msg.reason === "blocked") {
              toast(`Blocked. You won't be matched with ${name} again.`);
              join();
            } else if (msg.reason === "left") set({ phase: "setup", peer: null });
            // "reported" continues in report.received
          } else {
            toast(
              msg.reason === "disconnected" ? `${name} lost connection` : `${name} left the chat`,
            );
            join();
          }
          return;
        }
        case "report.received":
          set({ phase: "reported", peer: null });
          return;
        case "kicked":
          teardownCall();
          set({ phase: "kicked", kicked: msg.reason });
          return;
        case "error":
          toast(msg.message);
          return;
      }
    },
    [join, set, teardownCall, toast],
  );

  // One realtime connection for the life of the page.
  useEffect(() => {
    const c = new RealtimeClient();
    client.current = c;
    const offMsg = c.on(onMessage);
    const offClose = c.onClose((code) => {
      if (code === 4401) router.replace("/join");
      else if (code === 4403)
        set({ phase: "kicked", kicked: stateRef.current.kicked ?? "suspended" });
      else if (stateRef.current.phase === "waiting" || stateRef.current.phase === "in_call") {
        teardownCall();
        set({ phase: "setup" });
        toast("Connection lost. Check your internet and try again.");
      }
    });
    c.connect();
    return () => {
      offMsg();
      offClose();
      c.close();
    };
  }, [onMessage, router, set, teardownCall, toast]);

  // Stop the camera when leaving the page.
  useEffect(
    () => () => {
      stopWatch.current?.();
      peer.current?.close();
      for (const t of local.current?.getTracks() ?? []) t.stop();
    },
    [],
  );

  // Watch incoming video for nudity during video calls.
  useEffect(() => {
    const video = remoteVideo.current;
    if (!state.remote || !video || state.blurred) return;
    stopWatch.current?.();
    stopWatch.current = watchForNudity(video, (score) => {
      set({ blurred: true });
      client.current?.send({ t: "nsfw.flag", score });
    });
    return () => {
      stopWatch.current?.();
      stopWatch.current = null;
    };
  }, [state.remote, state.blurred, set]);

  const actions = {
    setMode: (mode: CallMode) => set({ mode }),
    /** Asks for camera + mic; returns the stream or null if refused. */
    async enableCamera(): Promise<MediaStream | null> {
      if (local.current) return local.current;
      try {
        local.current = await getCamera();
        return local.current;
      } catch {
        return null;
      }
    },
    localStream: () => local.current,
    start: join,
    cancel() {
      client.current?.send({ t: "queue.leave" });
      set({ phase: "setup" });
    },
    next() {
      client.current?.send({ t: "call.next" });
    },
    leave() {
      client.current?.send({ t: "call.end" });
    },
    block() {
      client.current?.send({ t: "call.block" });
    },
    /** Grab evidence first (the blur is CSS only, so the frame is the real picture). */
    captureEvidence: () =>
      stateRef.current.mode === "video" ? captureFrame(remoteVideo.current) : undefined,
    report(category: ReportCategory, note: string, frame?: string) {
      client.current?.send({ t: "call.report", category, note: note || undefined, frame });
    },
    send(text: string) {
      const clientId = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      dispatch({
        type: "line",
        line: { key: clientId, mine: true, text, at: new Date().toISOString(), pending: true },
      });
      client.current?.send({ t: "chat.send", clientId, text });
    },
    typing() {
      const now = Date.now();
      if (now - lastTypingSent.current < 2000) return;
      lastTypingSent.current = now;
      client.current?.send({ t: "chat.typing" });
    },
    setTrack(kind: "audio" | "video", enabled: boolean) {
      const stream = local.current;
      if (!stream) return;
      for (const t of kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks())
        t.enabled = enabled;
      client.current?.send({
        t: "media.state",
        audio: stream.getAudioTracks()[0]?.enabled ?? false,
        video: stream.getVideoTracks()[0]?.enabled ?? false,
      });
    },
    blur: (on: boolean) => set({ blurred: on }),
    backToSetup: () => set({ phase: "setup" }),
  };

  return { state, actions, remoteVideo };
}
