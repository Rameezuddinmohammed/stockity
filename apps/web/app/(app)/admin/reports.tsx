"use client";

import { type AdminReportRow, REPORT_CATEGORIES } from "@quad/shared";
import { Button, Notice } from "@quad/ui";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

const LABEL = new Map<string, string>(REPORT_CATEGORIES.map((c) => [c.id, c.label]));
const LADDER = ["Warning", "24-hour suspension", "7-day suspension", "Permanent ban"] as const;
const nextStep = (strikes: number) => LADDER[Math.min(strikes, 3)];

export function Reports() {
  const [status, setStatus] = useState<"open" | "actioned" | "dismissed">("open");
  const [rows, setRows] = useState<AdminReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(
        (await api<{ reports: AdminReportRow[] }>(`/admin/reports?status=${status}`)).reports,
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-4">
      <p className="text-muted">
        Oldest first. Evidence (frames and chat excerpts) is deleted 30 days after a report.
      </p>
      <select
        className="q-input max-w-[220px]"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        aria-label="Status"
      >
        <option value="open">Open</option>
        <option value="actioned">Actioned</option>
        <option value="dismissed">Dismissed</option>
      </select>
      {error && <Notice tone="danger">{error}</Notice>}
      {rows?.length === 0 && <p className="text-muted">No reports here.</p>}
      {rows?.map((r) => (
        <ReportCard key={r.id} report={r} onDone={load} />
      ))}
    </div>
  );
}

function ReportCard({ report, onDone }: { report: AdminReportRow; onDone: () => void }) {
  const [showFrame, setShowFrame] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = report.reported;

  const resolve = async (action: "dismiss" | "strike" | "ban") => {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/reports/${report.id}/resolve`, {
        method: "POST",
        body: { action, reason: reason.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <article className="grid gap-4 rounded-[16px] border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-body text-lg font-bold">
            {LABEL.get(report.category) ?? report.category}
          </h2>
          {report.automatic && (
            <span className="rounded-full border border-hairline px-2 py-0.5 text-xs font-semibold">
              automatic
            </span>
          )}
          {report.action && <span className="text-sm text-muted">→ {report.action}</span>}
        </div>
        <span className="text-sm text-muted">
          {new Date(report.createdAt).toLocaleString()}
          {report.callMode ? ` · ${report.callMode} chat` : ""}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <dl className="grid content-start gap-1 text-sm">
          <dt className="font-semibold text-muted">Reported</dt>
          {target ? (
            <dd className="grid gap-0.5">
              <span className="font-semibold">
                {target.displayName ?? "—"} · {target.university}
              </span>
              <span className="break-all text-muted">{target.email}</span>
              <span>
                Status {target.status} · {target.strikeCount} strike
                {target.strikeCount === 1 ? "" : "s"} · {target.reportsTotal} report
                {target.reportsTotal === 1 ? "" : "s"} total · {target.nsfwFlags30d} nudity flag
                {target.nsfwFlags30d === 1 ? "" : "s"} (30d)
              </span>
            </dd>
          ) : (
            <dd className="text-muted">Account deleted</dd>
          )}
          <dt className="mt-2 font-semibold text-muted">Reported by</dt>
          <dd>
            {report.automatic
              ? "Automatic check"
              : report.reporter
                ? `${report.reporter.displayName ?? "—"} (${report.reporter.email})`
                : "Account deleted"}
          </dd>
          {report.note && (
            <>
              <dt className="mt-2 font-semibold text-muted">Note</dt>
              <dd>{report.note}</dd>
            </>
          )}
        </dl>

        <div className="grid content-start gap-3">
          {report.hasFrame &&
            (showFrame ? (
              // biome-ignore lint/performance/noImgElement: private evidence, must not go through the image optimizer
              <img
                src={`/api/admin/reports/${report.id}/frame`}
                alt="Frame captured by the reporter's device when they opened the report"
                className="max-h-72 w-auto rounded-xl border border-hairline"
              />
            ) : (
              <Button
                size="sm"
                variant="plain"
                className="justify-self-start"
                onClick={() => setShowFrame(true)}
              >
                Show evidence frame (may be explicit)
              </Button>
            ))}
          {report.chatExcerpt && report.chatExcerpt.length > 0 ? (
            <ol className="grid max-h-60 gap-1 overflow-y-auto rounded-xl border border-hairline p-3 text-sm">
              {report.chatExcerpt.map((l, i) => (
                <li key={i}>
                  <span
                    className={`font-semibold ${l.from === "reported" ? "text-danger" : "text-muted"}`}
                  >
                    {l.from === "reported" ? "Reported" : "Reporter"}:
                  </span>{" "}
                  {l.text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No chat messages.</p>
          )}
        </div>
      </div>

      {report.status === "open" && target && (
        <div className="grid gap-2 border-t border-hairline pt-3">
          <input
            className="q-input !min-h-10 !py-2 text-sm"
            placeholder="Reason shown to the person (optional)"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="plain" disabled={busy} onClick={() => resolve("dismiss")}>
              Dismiss
            </Button>
            <Button size="sm" variant="plain" disabled={busy} onClick={() => resolve("strike")}>
              Apply strike: {nextStep(target.strikeCount)}
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => resolve("ban")}>
              Ban now
            </Button>
          </div>
        </div>
      )}
      {report.status === "open" && !target && (
        <Button
          size="sm"
          variant="plain"
          className="justify-self-start"
          onClick={() => resolve("dismiss")}
        >
          Dismiss
        </Button>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </article>
  );
}
