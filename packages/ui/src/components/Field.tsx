import {
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { cx } from "../cx";

type FieldShell = { label: ReactNode; hint?: ReactNode; error?: string | null };

function Shell({
  id,
  label,
  hint,
  error,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="q-field">
      <label className="q-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="q-field__error" id={`${id}-msg`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="q-field__hint" id={`${id}-msg`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        className={cx("q-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        {...rest}
      />
    </Shell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        className={cx("q-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        {...rest}
      />
    </Shell>
  );
}
