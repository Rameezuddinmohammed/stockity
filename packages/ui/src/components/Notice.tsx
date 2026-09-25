import type { ReactNode } from "react";
import { cx } from "../cx";

/** Plain notice used for errors and safety copy: no tilt, no mascot. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx("q-notice", tone !== "info" && `q-notice--${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      {title && <strong>{title}</strong>}
      {children && <span>{children}</span>}
    </div>
  );
}
