import type { CSSProperties } from "react";
import { cx, flag, initial } from "../cx";

export type IdCardProps = {
  name: string;
  university: string;
  countryCode: string;
  course?: string;
  year?: number | null;
  chips?: string[];
  avatarColor?: "grape" | "zest" | "tang" | "gum" | "sky";
  cardNo?: string;
  tint?: string;
  className?: string;
  style?: CSSProperties;
};

/** The student-ID profile card (ID-1 card ratio, holographic verified strip). */
export function IdCard({
  name,
  university,
  countryCode,
  course,
  year,
  chips = [],
  avatarColor = "zest",
  cardNo,
  tint,
  className,
  style,
}: IdCardProps) {
  const line = [university, [course, year ? `Yr ${year}` : null].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      className={cx("q-id", className)}
      style={{ ...(tint ? { background: tint } : {}), ...style }}
    >
      <div className="q-id__top">
        <span>Quad ID{cardNo ? ` · ${cardNo}` : ""}</span>
        <span>
          {flag(countryCode)} {countryCode.toUpperCase()}
        </span>
      </div>
      <div className={cx("q-id__avatar", `q-fill-${avatarColor}`)} aria-hidden="true">
        {initial(name)}
      </div>
      <div className="q-id__name">{name || "Your name"}</div>
      <div>
        <div className="q-id__uni">{line}</div>
        {chips.length > 0 && (
          <div className="q-id__chips">
            {chips.slice(0, 3).map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        )}
      </div>
      <div className="q-id__strip" />
    </div>
  );
}
