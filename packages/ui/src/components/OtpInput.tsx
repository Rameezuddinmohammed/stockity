"use client";

import { type ClipboardEvent, type KeyboardEvent, useRef } from "react";

/** Six boxes that auto-advance, accept a pasted code, and call onComplete when full. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const setAt = (i: number, d: string) => {
    const arr = [...digits];
    arr[i] = d;
    return commit(arr.join(""));
  };

  const onInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (d.length > 1) {
      // Autofill or typing fast: spread from this box on.
      const merged = (digits.slice(0, i).join("") + d).slice(0, length);
      const clean = commit(merged);
      refs.current[Math.min(clean.length, length - 1)]?.focus();
      return;
    }
    setAt(i, d);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    e.preventDefault();
    const clean = commit(text);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  return (
    <fieldset className={`q-otp${invalid ? " q-shake" : ""}`} aria-label={`${length}-digit code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`otp-${i}`}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  );
}
