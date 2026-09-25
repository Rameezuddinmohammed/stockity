import { cx, initial } from "../cx";

export function Avatar({
  name,
  color = "zest",
  size = 36,
  className,
}: {
  name: string;
  color?: "grape" | "zest" | "tang" | "gum" | "sky";
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cx("q-avatar", `q-fill-${color}`, className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {initial(name)}
    </span>
  );
}
