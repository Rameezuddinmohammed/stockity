import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cx } from "../cx";

type Color = "zest" | "sky" | "gum" | "tang" | "grape";

export function Chip({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: Color;
  className?: string;
}) {
  return (
    <span
      className={cx("q-chip", color && "q-chip--on", className)}
      style={color ? ({ "--chip-color": `var(--${color})` } as CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}

export type ToggleChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  color?: Color;
};

/** A chip that toggles; exposes aria-pressed for screen readers. */
export function ToggleChip({
  pressed,
  onChange,
  color = "zest",
  className,
  style,
  ...rest
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx("q-chip", className)}
      style={{ "--chip-color": `var(--${color})`, ...style } as CSSProperties}
      onClick={() => onChange(!pressed)}
      {...rest}
    />
  );
}
