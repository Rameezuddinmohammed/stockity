"use client";

import { REPORT_CATEGORIES, type ReportCategory } from "@quad/shared";
import { Button } from "@quad/ui";
import { useEffect, useRef, useState } from "react";

/**
 * Plain safety styling (DESIGN.md §7.6): no stickers or mascot.
 * The other person's video is already blurred and a frame captured when this opens.
 */
export function ReportSheet({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (category: ReportCategory, note: string) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 grid items-end bg-black/60 sm:items-center"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="mx-auto grid w-full max-w-md gap-4 rounded-t-[28px] border border-hairline bg-surface p-5 sm:rounded-[28px]"
      >
        <span
          className="h-1.5 w-10 justify-self-center rounded-full bg-hairline sm:hidden"
          aria-hidden="true"
        />
        <div className="grid gap-1">
          <h2 id="report-title" className="font-body text-xl font-bold">
            Report {name}
          </h2>
          <p className="text-sm text-muted">
            Their video is blurred now. They won't know you reported them, and you won't be matched
            again.
          </p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="sr-only">What happened?</legend>
          {REPORT_CATEGORIES.map((c, i) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3.5 font-semibold ${category === c.id ? "border-2 border-ink" : "border-hairline"}`}
            >
              {c.label}
              <input
                ref={i === 0 ? first : undefined}
                type="radio"
                name="report-category"
                value={c.id}
                checked={category === c.id}
                onChange={() => setCategory(c.id)}
                className="h-5 w-5 accent-[var(--ink)]"
              />
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1.5 text-sm font-semibold">
          Anything else? (optional)
          <textarea
            className="q-input !min-h-20 font-normal"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="grid gap-2">
          <Button
            variant="danger"
            block
            disabled={!category || sent}
            onClick={() => {
              if (!category) return;
              setSent(true);
              onSubmit(category, note.trim());
            }}
          >
            {sent ? "Sending…" : "Report and leave"}
          </Button>
          <Button variant="plain" block onClick={onCancel} disabled={sent}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
