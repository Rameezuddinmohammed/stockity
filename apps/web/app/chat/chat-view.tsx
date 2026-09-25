"use client";

import { Button, buttonClass, Logo, Pip } from "@quad/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loading } from "@/components/loading";
import { useGuard } from "@/lib/me";
import { CallView } from "./call-view";
import { useChat } from "./use-chat";

export function ChatView() {
  const me = useGuard("active");
  const chat = useChat();
  if (!me) return <Loading />;
  const { state, actions } = chat;

  return (
    <div className="q-dark min-h-dvh">
      {state.phase === "setup" && <Setup chat={chat} />}
      {state.phase === "waiting" && <Waiting chat={chat} />}
      {state.phase === "in_call" && <CallView chat={chat} />}
      {state.phase === "reported" && (
        <Plain
          title="Report sent"
          body="You won't be matched with this person again. Our team reviews every report, usually within a few hours."
        >
          <Button variant="primary" onClick={actions.start}>
            Find someone new
          </Button>
          <Link href="/home" className={buttonClass("plain")}>
            Back to the Quad
          </Link>
        </Plain>
      )}
      {state.phase === "kicked" && <Kicked reason={state.kicked} onRetry={actions.backToSetup} />}
      {state.toast && (
        <div
          role="status"
          className="q-glass fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-semibold"
        >
          {state.toast}
        </div>
      )}
    </div>
  );
}

type Chat = ReturnType<typeof useChat>;

function Header({ online }: { online: number | null }) {
  return (
    <header className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-4">
      <Link
        href="/home"
        aria-label="Back to the Quad"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        ← <Logo size={28} />
      </Link>
      {online !== null && (
        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2FD37A]" aria-hidden="true" />
          {online.toLocaleString()} online now
        </span>
      )}
    </header>
  );
}

function Setup({ chat }: { chat: Chat }) {
  const { state, actions } = chat;
  const preview = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"asking" | "on" | "denied">("asking");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  useEffect(() => {
    if (state.mode !== "video") return;
    let cancelled = false;
    actions.enableCamera().then((stream) => {
      if (cancelled) return;
      setCamera(stream ? "on" : "denied");
      if (stream && preview.current) preview.current.srcObject = stream;
      const s = actions.localStream();
      setMic(s?.getAudioTracks()[0]?.enabled ?? true);
      setCam(s?.getVideoTracks()[0]?.enabled ?? true);
    });
    return () => {
      cancelled = true;
    };
  }, [state.mode, actions]);

  const video = state.mode === "video";
  const canStart = !video || camera === "on";

  return (
    <>
      <Header online={state.online} />
      <main className="mx-auto grid max-w-[1180px] items-start gap-8 px-4 pb-16 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border-2 border-line bg-surface shadow-[6px_6px_0_var(--line)]">
          {video ? (
            <>
              <video
                ref={preview}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              {camera !== "on" && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center">
                  {camera === "asking" ? (
                    <p className="text-muted">Allow camera and microphone to preview yourself.</p>
                  ) : (
                    <div className="grid max-w-sm gap-3">
                      <p className="font-semibold">Camera or microphone blocked</p>
                      <p className="text-sm text-muted">
                        Allow access in your browser's site settings and reload, or switch to text
                        only.
                      </p>
                      <Button size="sm" onClick={() => actions.setMode("text")}>
                        Use text only
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {camera === "on" && !cam && (
                <div className="absolute inset-0 grid place-items-center bg-surface text-muted">
                  Camera off
                </div>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="grid justify-items-center gap-3">
                <Pip size={72} />
                <p className="text-lg font-semibold">Text only. No camera needed.</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          <div className="grid gap-2">
            <h1 className="q-display text-[clamp(36px,5vw,52px)]">
              ready to meet <span className="q-hl">someone?</span>
            </h1>
            <p className="text-muted">
              You'll be matched with a verified student from anywhere in the world.
            </p>
          </div>

          <fieldset className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-line p-1">
            <legend className="sr-only">Chat mode</legend>
            {(["video", "text"] as const).map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-center font-semibold ${state.mode === m ? "bg-zest text-on-bright" : ""}`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="sr-only"
                  checked={state.mode === m}
                  onChange={() => actions.setMode(m)}
                />
                {m === "video" ? "Video + text" : "Text only"}
              </label>
            ))}
          </fieldset>

          {video && camera === "on" && (
            <div className="flex gap-3">
              <button
                type="button"
                className="q-ctrl"
                aria-pressed={!mic}
                aria-label={mic ? "Mute microphone" : "Unmute microphone"}
                onClick={() => {
                  setMic(!mic);
                  actions.setTrack("audio", !mic);
                }}
              >
                {mic ? "🎤" : "🔇"}
              </button>
              <button
                type="button"
                className="q-ctrl"
                aria-pressed={!cam}
                aria-label={cam ? "Turn camera off" : "Turn camera on"}
                onClick={() => {
                  setCam(!cam);
                  actions.setTrack("video", !cam);
                }}
              >
                {cam ? "📷" : "🚫"}
              </button>
            </div>
          )}

          <ul className="grid gap-2 rounded-2xl border border-hairline p-4 text-sm">
            <li>🤝 Be kind. Everyone here is a student somewhere.</li>
            <li>👕 No nudity or sexual stuff. It's an instant ban.</li>
            <li>🔒 Links and numbers unlock after 5 minutes.</li>
            <li>🛡 Report is always top right. It blurs their video straight away.</li>
          </ul>

          <Button variant="primary" block disabled={!canStart} onClick={actions.start}>
            Start →
          </Button>
          <Button variant="plain" block disabled={!canStart} onClick={actions.startBot}>
            🤖 Practice with Quad Bot
          </Button>
        </div>
      </main>
    </>
  );
}

function Waiting({ chat }: { chat: Chat }) {
  const { state, actions } = chat;
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <Header online={state.online} />
      <main
        className="mx-auto grid max-w-md justify-items-center gap-6 px-4 py-16 text-center"
        aria-live="polite"
      >
        <Pip size={96} className="q-bob" />
        <h1 className="q-display text-[clamp(34px,7vw,49px)]">finding someone cool…</h1>
        <p className="font-mono text-sm tabular-nums text-muted">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          {state.online !== null && ` · ${state.online.toLocaleString()} online`}
        </p>
        {seconds >= 15 && (
          <div className="grid justify-items-center gap-3">
            <p className="text-sm text-muted">
              Quiet right now. Keep this tab open and we'll match you as soon as someone joins.
            </p>
            <Button variant="plain" size="sm" onClick={actions.startBot}>
              🤖 Chat with Quad Bot while you wait
            </Button>
          </div>
        )}
        <Button onClick={actions.cancel}>Cancel</Button>
      </main>
    </>
  );
}

/** Plain, calm screens for safety outcomes: no mascot, no tilt. */
function Plain({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 px-4">
      <h1 className="font-body text-[28px] font-bold">{title}</h1>
      <p>{body}</p>
      <div className="flex flex-wrap gap-3">{children}</div>
    </main>
  );
}

function Kicked({ reason, onRetry }: { reason: Chat["state"]["kicked"]; onRetry: () => void }) {
  if (reason === "replaced") {
    return (
      <Plain
        title="Quad is open somewhere else"
        body="You can only chat in one tab or device at a time."
      >
        <Button variant="primary" onClick={onRetry}>
          Use Quad here
        </Button>
      </Plain>
    );
  }
  if (reason === "signed_out") {
    return (
      <Plain title="You've been signed out" body="Sign in again to keep chatting.">
        <Link href="/join" className={buttonClass("primary")}>
          Sign in
        </Link>
      </Plain>
    );
  }
  return (
    <Plain
      title={reason === "banned" ? "This account has been banned" : "Your account is suspended"}
      body={
        reason === "banned"
          ? "It broke the community guidelines. If you think this is a mistake, email support from your university address."
          : "You can't chat for now. Check the Quad home page for details and when it ends."
      }
    >
      <Link href="/home" className={buttonClass("plain")}>
        Go to the Quad
      </Link>
    </Plain>
  );
}
