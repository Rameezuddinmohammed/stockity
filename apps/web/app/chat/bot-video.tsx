"use client";

import type { BotScene } from "@quad/shared";
import { Pip } from "@quad/ui";
import { useEffect, useState } from "react";

/**
 * Quad Bot's "camera". Everything here is drawn locally: original meme cards and illustrations
 * (no stock or meme images we don't own), plus the one classic rickroll via YouTube's official embed.
 */

const MEMES = [
  {
    top: "me: I'll start the essay early",
    bottom: "also me at 11:58pm",
    mood: "wow",
    bg: "var(--gum)",
  },
  { top: "prof: “this won't be on the exam”", bottom: "the exam:", mood: "wow", bg: "var(--tang)" },
  { top: "group project", bottom: "one person doing everything", mood: "sleepy", bg: "var(--sky)" },
  { top: "8am lecture attendance", bottom: "me (spiritually)", mood: "sleepy", bg: "var(--grape)" },
  { top: "library wifi", bottom: "loading… forever", mood: "sleepy", bg: "var(--zest)" },
  { top: "someone: “quick question”", bottom: "45 minutes later", mood: "wow", bg: "var(--tang)" },
  {
    top: "nobody:",
    bottom: "me at 3am: time to reorganise my whole life",
    mood: "happy",
    bg: "var(--grape)",
  },
  {
    top: "when the group chat says “we're all going”",
    bottom: "3 people show up",
    mood: "happy",
    bg: "var(--gum)",
  },
] as const;

const ROTATION: BotScene[] = ["robot", "meme", "campus", "meme"];
const ROTATE_MS = 8_000;
const RICKROLL_MS = 25_000;

export function BotVideo({ scene, sceneKey }: { scene: BotScene | null; sceneKey: number }) {
  const [current, setCurrent] = useState<BotScene>("robot");
  const [step, setStep] = useState(0);
  const [meme, setMeme] = useState(0);

  // A scene pushed by the bot (e.g. a rickroll after "play some music") takes over for a while.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneKey re-applies the same scene when resent
  useEffect(() => {
    if (!scene) return;
    setCurrent(scene);
    if (scene === "meme") setMeme((m) => (m + 1) % MEMES.length);
  }, [scene, sceneKey]);

  // Otherwise keep the feed moving: robot → meme → campus → meme …
  useEffect(() => {
    const t = setTimeout(
      () => {
        const next = ROTATION[(step + 1) % ROTATION.length] ?? "robot";
        if (next === "meme") setMeme((m) => (m + 1) % MEMES.length);
        setCurrent(next);
        setStep((s) => s + 1);
      },
      current === "rickroll" ? RICKROLL_MS : ROTATE_MS,
    );
    return () => clearTimeout(t);
  }, [current, step]);

  return (
    <section className="absolute inset-0" aria-label="Quad Bot's camera">
      {current === "robot" && <RobotScene />}
      {current === "meme" && <MemeScene meme={MEMES[meme] ?? MEMES[0]} />}
      {current === "campus" && <CampusScene night={step % 2 === 1} />}
      {current === "rickroll" && <Rickroll />}
      <span className="q-glass absolute bottom-24 left-3 flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
        <span className="q-pulse-dot h-2 w-2 rounded-full bg-[#ff4d4d]" aria-hidden="true" />
        LIVE from Quad HQ · bot camera
      </span>
    </section>
  );
}

function RobotScene() {
  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#7B5CFF,#2a1f66_70%)]">
      <svg
        viewBox="0 0 240 240"
        className="w-[min(70%,420px)]"
        role="img"
        aria-label="Quad Bot waving"
      >
        <line x1="120" y1="28" x2="120" y2="52" stroke="#16131F" strokeWidth="6" />
        <circle
          cx="120"
          cy="24"
          r="9"
          fill="#FF5FA2"
          stroke="#16131F"
          strokeWidth="4"
          className="q-pulse-dot"
        />
        <rect
          x="52"
          y="52"
          width="136"
          height="104"
          rx="30"
          fill="#D4FF3A"
          stroke="#16131F"
          strokeWidth="6"
        />
        <rect x="72" y="76" width="96" height="46" rx="20" fill="#16131F" />
        <g className="q-blink">
          <circle cx="98" cy="99" r="10" fill="#4FC3FF" />
          <circle cx="142" cy="99" r="10" fill="#4FC3FF" />
        </g>
        <path
          d="M104 136 q16 12 32 0"
          stroke="#16131F"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="78"
          y="162"
          width="84"
          height="54"
          rx="18"
          fill="#FF9142"
          stroke="#16131F"
          strokeWidth="6"
        />
        <text
          x="120"
          y="196"
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="700"
          fontSize="18"
          fill="#16131F"
        >
          BOT
        </text>
        <g className="q-wave">
          <rect
            x="164"
            y="150"
            width="16"
            height="48"
            rx="8"
            fill="#D4FF3A"
            stroke="#16131F"
            strokeWidth="5"
            transform="rotate(-35 172 174)"
          />
        </g>
        <rect
          x="60"
          y="164"
          width="16"
          height="44"
          rx="8"
          fill="#D4FF3A"
          stroke="#16131F"
          strokeWidth="5"
        />
      </svg>
    </div>
  );
}

function MemeScene({ meme }: { meme: (typeof MEMES)[number] }) {
  return (
    <div
      className="grid h-full grid-rows-[auto_1fr_auto] items-center gap-4 px-6 pt-20 pb-36"
      style={{ background: meme.bg }}
    >
      <p className="q-meme text-[clamp(26px,5vw,52px)]">{meme.top}</p>
      <div className="grid place-items-center">
        <Pip size={160} mood={meme.mood} />
      </div>
      <p className="q-meme text-[clamp(26px,5vw,52px)]">{meme.bottom}</p>
    </div>
  );
}

/** Illustrated "stock footage" of campus, drawn in SVG so there's nothing to license. */
function CampusScene({ night }: { night: boolean }) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-label={night ? "Campus at night" : "Campus quad on a sunny day"}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#120F1C" : "#4FC3FF"} />
          <stop offset="1" stopColor={night ? "#3a2f7a" : "#bfeaff"} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky)" />
      {night ? (
        <>
          <circle cx="330" cy="60" r="22" fill="#F7F4FF" />
          {[40, 90, 150, 210, 260, 300, 370].map((x, i) => (
            <circle key={x} cx={x} cy={30 + ((i * 37) % 70)} r="1.8" fill="#F7F4FF" />
          ))}
        </>
      ) : (
        <circle cx="330" cy="60" r="26" fill="#FFD23F" stroke="#16131F" strokeWidth="3" />
      )}
      {/* buildings */}
      <rect
        x="20"
        y="120"
        width="110"
        height="120"
        fill="#FF9142"
        stroke="#16131F"
        strokeWidth="4"
      />
      <polygon points="20,120 75,80 130,120" fill="#FF5FA2" stroke="#16131F" strokeWidth="4" />
      <rect
        x="150"
        y="100"
        width="100"
        height="140"
        fill="#7B5CFF"
        stroke="#16131F"
        strokeWidth="4"
      />
      <rect x="185" y="70" width="30" height="30" fill="#7B5CFF" stroke="#16131F" strokeWidth="4" />
      <circle cx="200" cy="85" r="8" fill="#F7F4FF" stroke="#16131F" strokeWidth="3" />
      <rect
        x="270"
        y="140"
        width="110"
        height="100"
        fill="#4FC3FF"
        stroke="#16131F"
        strokeWidth="4"
      />
      {[35, 60, 85, 110, 165, 195, 225, 285, 315, 345].map((x) =>
        [140, 175].map((y) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={x > 150 && x < 250 ? y - 15 : y}
            width="14"
            height="18"
            fill={night ? "#FFD23F" : "#F7F4FF"}
            stroke="#16131F"
            strokeWidth="2"
          />
        )),
      )}
      {/* the quad */}
      <rect x="0" y="236" width="400" height="64" fill="#D4FF3A" stroke="#16131F" strokeWidth="4" />
      <circle cx="60" cy="236" r="22" fill="#2FD37A" stroke="#16131F" strokeWidth="4" />
      <circle cx="350" cy="236" r="18" fill="#2FD37A" stroke="#16131F" strokeWidth="4" />
      {/* Pip holding a sign */}
      <rect
        x="200"
        y="192"
        width="190"
        height="38"
        rx="8"
        fill="#fff"
        stroke="#16131F"
        strokeWidth="3"
      />
      <text
        x="295"
        y="218"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontWeight="800"
        fontSize="13"
        fill="#16131F"
      >
        {night ? "still studying 📚" : "greetings from Quad HQ"}
      </text>
    </svg>
  );
}

/** Never gonna give you up. Uses YouTube's privacy-enhanced embed; starts muted as browsers require. */
function Rickroll() {
  return (
    <div className="relative h-full bg-black">
      <iframe
        className="absolute inset-0 h-full w-full"
        src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ&controls=1&playsinline=1&rel=0"
        title="Rick Astley: Never Gonna Give You Up (you've been rickrolled)"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="q-meme pointer-events-none absolute inset-x-4 top-20 text-[clamp(22px,4vw,40px)]">
        you've been rickrolled 🕺
      </p>
    </div>
  );
}
