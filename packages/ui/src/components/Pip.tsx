import { cx } from "../cx";

type Mood = "happy" | "wow" | "sleepy";

/** Pip, the mascot. Never used in calls or safety flows (see DESIGN.md §3). */
export function Pip({
  size = 48,
  mood = "happy",
  className,
}: {
  size?: number;
  mood?: Mood;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cx("flex-none", className)}
      aria-hidden="true"
    >
      <path
        d="M24 4c11 0 20 8 20 19 0 12-9 21-20 21S4 35 4 23C4 12 13 4 24 4z"
        fill="#D4FF3A"
        stroke="#16131F"
        strokeWidth="3"
      />
      {mood === "sleepy" ? (
        <>
          <path
            d="M13 22q4 3 8 0M27 22q4 3 8 0"
            stroke="#16131F"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M20 32h8" stroke="#16131F" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="17" cy="22" r="4" fill="#16131F" />
          <circle cx="31" cy="22" r="4" fill="#16131F" />
          <circle cx="18.3" cy="20.6" r="1.3" fill="#fff" />
          <circle cx="32.3" cy="20.6" r="1.3" fill="#fff" />
          {mood === "wow" ? (
            <ellipse cx="24" cy="32" rx="3.5" ry="4" fill="#16131F" />
          ) : (
            <path
              d="M19 31q5 4 10 0"
              stroke="#16131F"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-display text-[26px] font-extrabold tracking-[-0.03em]">
      <Pip size={size} />
      quad
    </span>
  );
}
