"use client";

import type { PeerCard } from "@quad/shared";
import { Avatar, flag, IdCard } from "@quad/ui";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BotVideo } from "./bot-video";
import { ReportSheet } from "./report-sheet";
import type { ChatLine, useChat } from "./use-chat";

type Chat = ReturnType<typeof useChat>;

const ICEBREAKERS = [
  "What's the best food near your campus?",
  "What are you studying, and do you actually like it?",
  "What's something your city is known for?",
  "Best and worst class you've ever taken?",
  "If you could study abroad anywhere, where?",
  "What do people get wrong about your country?",
  "What are you listening to lately?",
];

const REJECTED: Record<NonNullable<ChatLine["rejected"]>, string> = {
  links_locked: "Links, handles and numbers unlock after 5 min, for safety.",
  rate_limited: "Slow down a little.",
  not_in_call: "The chat already ended.",
};

/** The quietest screen in the app: always dark, the person is the focus (DESIGN.md §7.5). */
export function CallView({ chat }: { chat: Chat }) {
  const { state, actions, remoteVideo } = chat;
  const peer = state.peer as PeerCard;
  const video = state.mode === "video";
  const self = useRef<HTMLVideoElement>(null);
  const [mic, setMic] = useState(() => actions.localStream()?.getAudioTracks()[0]?.enabled ?? true);
  const [cam, setCam] = useState(() => actions.localStream()?.getVideoTracks()[0]?.enabled ?? true);
  const [reporting, setReporting] = useState(false);
  const [evidence, setEvidence] = useState<string | undefined>();
  const wasBlurred = useRef(false);
  const [chatOpen, setChatOpen] = useState(!video);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (self.current) self.current.srcObject = actions.localStream();
  }, [actions]);
  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = state.remote;
  }, [state.remote, remoteVideo]);

  const openReport = useCallback(() => {
    setEvidence(actions.captureEvidence());
    wasBlurred.current = state.blurred;
    actions.blur(true);
    setReporting(true);
  }, [actions, state.blurred]);

  const toggleMic = useCallback(() => {
    setMic((m) => {
      actions.setTrack("audio", !m);
      return !m;
    });
  }, [actions]);
  const toggleCam = useCallback(() => {
    setCam((c) => {
      actions.setTrack("video", !c);
      return !c;
    });
  }, [actions]);

  // Shortcuts: N next, M mute, V camera, R report. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (reporting || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "n") actions.next();
      else if (k === "m" && video) toggleMic();
      else if (k === "v" && video) toggleCam();
      else if (k === "r" && !peer.bot) openReport();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, reporting, video, toggleMic, toggleCam, openReport, peer.bot]);

  const bot = peer.bot === true;
  const connecting =
    video && !bot && state.connection !== "connected" && state.connection !== "failed";
  const showCard = !bot && (!video || !state.remote || !state.peerMedia.video);

  return (
    <div className={`grid h-dvh ${video ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
      <section
        className={`relative overflow-hidden ${video ? "bg-black" : "hidden"}`}
        aria-label="Video"
      >
        {video && bot && <BotVideo scene={state.botScene} sceneKey={state.botSceneKey} />}
        {video && !bot && (
          // biome-ignore lint/a11y/useMediaCaption: live peer video has no caption track (live captions are a later feature)
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-cover transition-[filter] ${state.blurred || reporting ? "blur-3xl" : ""} ${showCard ? "opacity-0" : ""}`}
          />
        )}
        {showCard && video && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <IdCard
              name={peer.displayName}
              university={peer.university}
              countryCode={peer.countryCode}
              course={peer.course}
              year={peer.year}
              chips={peer.interests}
              avatarColor={peer.avatarColor}
            />
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <PeerChip peer={peer} />
          {bot ? (
            <span className="q-glass flex-none rounded-full px-3 py-2 font-mono text-xs font-semibold">
              🤖 BOT · not a real student
            </span>
          ) : (
            <button
              type="button"
              onClick={openReport}
              className="q-glass grid h-12 w-12 flex-none place-items-center rounded-full"
              aria-label={`Report ${peer.displayName}`}
              title="Report (R)"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
              </svg>
            </button>
          )}
        </div>

        {video && (
          <video
            ref={self}
            autoPlay
            playsInline
            muted
            className={`absolute right-3 top-20 w-24 -scale-x-100 rounded-2xl border-2 border-white object-cover shadow-[3px_3px_0_rgba(0,0,0,0.5)] sm:w-36 ${cam ? "" : "opacity-30"}`}
            style={{ aspectRatio: "3 / 4" }}
          />
        )}

        {connecting && !showCard && (
          <p className="q-glass absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm">
            Connecting video…
          </p>
        )}
        {state.connection === "failed" && (
          <p className="q-glass absolute inset-x-6 top-1/2 mx-auto max-w-sm -translate-y-1/2 rounded-2xl px-4 py-3 text-center text-sm">
            Video couldn't connect on this network. You can keep texting, or press Next.
          </p>
        )}

        {state.blurred && !reporting && (
          <div className="absolute inset-x-4 top-1/2 mx-auto grid max-w-sm -translate-y-1/2 gap-3 rounded-2xl border border-hairline bg-surface p-4 text-center">
            <p className="font-semibold">Blurred for your safety</p>
            <p className="text-sm text-muted">Something in their video may break the guidelines.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="q-btn q-btn--danger q-btn--sm" onClick={openReport}>
                Report
              </button>
              <button type="button" className="q-btn q-btn--plain q-btn--sm" onClick={actions.next}>
                Next
              </button>
            </div>
          </div>
        )}

        {!state.peerMedia.audio && !showCard && (
          <span className="q-glass absolute left-3 top-20 rounded-full px-3 py-1 text-xs font-semibold">
            🔇 muted
          </span>
        )}

        {/* Mobile: recent messages float over the video. */}
        {!chatOpen && (
          <div className="pointer-events-none absolute inset-x-3 bottom-28 grid gap-1.5 lg:hidden">
            {state.lines
              .filter((l) => !l.rejected)
              .slice(-3)
              .map((l) => (
                <span
                  key={l.key}
                  className={`q-bubble ${l.mine ? "q-bubble--me" : "q-bubble--them"}`}
                >
                  {l.text}
                </span>
              ))}
          </div>
        )}

        <div
          className="q-glass absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-3xl p-2"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex gap-2">
            <button
              type="button"
              className="q-ctrl"
              aria-pressed={!mic}
              aria-label={mic ? "Mute (M)" : "Unmute (M)"}
              title="M"
              onClick={toggleMic}
            >
              {mic ? "🎤" : "🔇"}
            </button>
            <button
              type="button"
              className="q-ctrl"
              aria-pressed={!cam}
              aria-label={cam ? "Camera off (V)" : "Camera on (V)"}
              title="V"
              onClick={toggleCam}
            >
              {cam ? "📷" : "🚫"}
            </button>
            <button
              type="button"
              className="q-ctrl lg:hidden"
              aria-label="Open chat"
              onClick={() => setChatOpen(true)}
            >
              💬
            </button>
            <MoreMenu
              open={menu}
              setOpen={setMenu}
              onBlock={actions.block}
              onLeave={actions.leave}
            />
          </div>
          <button
            type="button"
            onClick={actions.next}
            className="q-btn q-btn--sm !min-h-12 !bg-white !text-[#16131F]"
            title="Next (N)"
          >
            Next →
          </button>
        </div>
      </section>

      <ChatPanel
        chat={chat}
        peer={peer}
        className={
          video
            ? `${chatOpen ? "fixed inset-0 z-30 flex" : "hidden"} lg:static lg:flex`
            : "mx-auto flex h-dvh w-full max-w-2xl"
        }
        onClose={video ? () => setChatOpen(false) : undefined}
        onReport={openReport}
        textOnly={!video}
      />

      {reporting && (
        <ReportSheet
          name={peer.displayName}
          onCancel={() => {
            setReporting(false);
            if (!wasBlurred.current) actions.blur(false);
          }}
          onSubmit={(category, note) => actions.report(category, note, evidence)}
        />
      )}
    </div>
  );
}

function PeerChip({ peer }: { peer: PeerCard }) {
  const detail = [peer.course, peer.year ? `Yr ${peer.year}` : null].filter(Boolean).join(" · ");
  return (
    <div className="q-glass flex min-w-0 max-w-full items-center gap-2.5 rounded-full py-1 pl-1 pr-4">
      {peer.bot ? (
        <span
          className="q-avatar q-fill-zest !border-white text-xl"
          style={{ width: 38, height: 38 }}
          aria-hidden="true"
        >
          🤖
        </span>
      ) : (
        <Avatar
          name={peer.displayName}
          color={peer.avatarColor}
          size={38}
          className="!border-white"
        />
      )}
      <div className="min-w-0 text-sm leading-tight">
        <div className="truncate font-bold">
          {peer.displayName} · {peer.university} {peer.countryCode ? flag(peer.countryCode) : ""}
        </div>
        {(detail || peer.interests.length > 0) && (
          <div className="truncate text-xs opacity-80">
            {[detail, peer.interests.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function MoreMenu({
  open,
  setOpen,
  onBlock,
  onLeave,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onBlock: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className="q-ctrl"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute bottom-14 left-0 z-10 grid w-44 gap-1 rounded-2xl border border-hairline bg-surface p-1.5 text-sm">
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-left hover:bg-bg"
            onClick={onBlock}
          >
            Block and skip
          </button>
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-left hover:bg-bg"
            onClick={onLeave}
          >
            End chat
          </button>
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  chat,
  peer,
  className,
  onClose,
  onReport,
  textOnly,
}: {
  chat: Chat;
  peer: PeerCard;
  className: string;
  onClose?: () => void;
  onReport: () => void;
  textOnly: boolean;
}) {
  const { state, actions } = chat;
  const [text, setText] = useState("");
  const [showIcebreaker, setShowIcebreaker] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const icebreaker = useMemo(
    () => ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)] ?? "",
    [],
  );
  const linksLocked = Date.now() < state.linksUnlockAt;

  // Keep the newest message in view whenever one arrives or the typing line appears.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these values are the triggers
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [state.lines.length, state.peerTyping]);

  // Offer an icebreaker if nobody has said anything after 10 seconds.
  useEffect(() => {
    if (state.lines.length > 0) return setShowIcebreaker(false);
    const t = setTimeout(() => setShowIcebreaker(true), 10_000);
    return () => clearTimeout(t);
  }, [state.lines.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    actions.send(value);
    setText("");
  };

  return (
    <aside
      className={`${className} flex-col bg-bg lg:border-l lg:border-hairline`}
      aria-label="Chat"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-3">
        {textOnly ? (
          <PeerChip peer={peer} />
        ) : (
          <span className="font-bold">Chat with {peer.displayName}</span>
        )}
        <div className="flex gap-2">
          {textOnly && (
            <>
              {!peer.bot && (
                <button
                  type="button"
                  onClick={onReport}
                  className="q-btn q-btn--plain q-btn--sm"
                  title="Report (R)"
                >
                  🛡 Report
                </button>
              )}
              <button
                type="button"
                onClick={actions.next}
                className="q-btn q-btn--primary q-btn--sm"
                title="Next (N)"
              >
                Next →
              </button>
            </>
          )}
          {onClose && (
            <button
              type="button"
              className="q-btn q-btn--plain q-btn--sm lg:hidden"
              onClick={onClose}
            >
              Back to video
            </button>
          )}
        </div>
      </div>

      <div
        ref={list}
        className="grid flex-1 content-start gap-2 overflow-y-auto p-3"
        aria-live="polite"
      >
        {textOnly && (
          <div className="mb-2 w-full max-w-[380px] justify-self-center">
            <IdCard
              name={peer.displayName}
              university={peer.university}
              countryCode={peer.countryCode}
              course={peer.course}
              year={peer.year}
              chips={peer.interests}
              avatarColor={peer.avatarColor}
              avatarEmoji={peer.bot ? "🤖" : undefined}
              regionLabel={peer.bot ? "BOT" : undefined}
            />
          </div>
        )}
        <p className="justify-self-center text-center text-xs text-muted">
          {peer.bot
            ? "Practice mode: Quad Bot is a robot, not a student. Press Next to meet a real person."
            : `You're chatting with a verified student. ${linksLocked ? "Links and numbers unlock after 5 min." : ""}`}
        </p>
        {state.lines.map((l) => (
          <div
            key={l.key}
            className={`grid ${l.mine ? "justify-items-end" : "justify-items-start"}`}
          >
            <span
              className={`q-bubble ${l.mine ? "q-bubble--me" : "q-bubble--them"} ${l.pending ? "opacity-60" : ""} ${l.rejected ? "line-through opacity-50" : ""}`}
            >
              {l.text}
            </span>
            {l.rejected && <span className="mt-0.5 text-xs text-warn">{REJECTED[l.rejected]}</span>}
          </div>
        ))}
        {state.peerTyping && (
          <span className="text-xs text-muted">{peer.displayName} is typing…</span>
        )}
        {showIcebreaker && (
          <button
            type="button"
            onClick={() => setText(icebreaker)}
            className="q-chip mt-2 justify-self-center !border-zest text-left !text-sm"
          >
            💡 Ask them: {icebreaker}
          </button>
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-hairline p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          className="q-input !min-h-12 flex-1"
          placeholder="Say hi…"
          autoComplete="off"
          maxLength={500}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            actions.typing();
          }}
        />
        <button
          type="submit"
          className="q-btn q-btn--primary q-btn--sm !min-h-12"
          disabled={!text.trim()}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
