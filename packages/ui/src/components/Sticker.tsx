import type { CSSProperties, ReactNode } from "react";
import { cx } from "../cx";

export function Sticker({
  children,
  color,
  tilt = -3,
  className,
  style,
}: {
  children: ReactNode;
  color?: "zest" | "gum" | "sky" | "tang";
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx("q-sticker", className)}
      style={{
        transform: `rotate(${tilt}deg)`,
        ...(color ? { background: `var(--${color})` } : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
