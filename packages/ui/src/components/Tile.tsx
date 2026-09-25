import type { ReactNode } from "react";
import { cx } from "../cx";

export function Tile({
  color,
  title,
  meta,
  children,
  soon,
  className,
}: {
  color: "grape" | "zest" | "tang" | "gum" | "sky" | "surface";
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  /** Shows a "coming soon" style tag in the corner. */
  soon?: string;
  className?: string;
}) {
  return (
    <div className={cx("q-tile", `q-tile--${color}`, className)}>
      {soon && <span className="q-soon">{soon}</span>}
      <div className="grid gap-1.5">
        <span className="q-tile__title">{title}</span>
        {meta && <span className="q-tile__meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}
