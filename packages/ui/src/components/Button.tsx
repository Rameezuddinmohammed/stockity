import type { ButtonHTMLAttributes } from "react";
import { cx } from "../cx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "plain"
  | "zest"
  | "gum"
  | "tang"
  | "sky";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
};

export const buttonClass = (variant: ButtonVariant = "secondary", size = "md", block = false) =>
  cx(
    "q-btn",
    variant !== "secondary" && `q-btn--${variant}`,
    size === "sm" && "q-btn--sm",
    block && "q-btn--block",
  );

export function Button({
  variant = "secondary",
  size = "md",
  block,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClass(variant, size, block), className)} {...rest} />
  );
}
