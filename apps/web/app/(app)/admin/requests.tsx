"use client";

import { type DomainRequestRow, FREE_EMAIL_PROVIDERS, type UniversityTarget } from "@quad/shared";
import { Button, Notice, TextField } from "@quad/ui";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { UniversityPicker } from "./university-picker";

const FREE = new Set<string>(FREE_EMAIL_PROVIDERS);

export function Requests() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<DomainRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(
        (await api<{ requests: DomainRequestRow[] }>(`/admin/domain-requests?status=${status}`))
          .requests,
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
        Students whose email wasn't recognized. Allow their whole domain, or just their one address.
      </p>
      <select
        className="q-input max-w-[220px]"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        aria-label="Status"
      >
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      {error && <Notice tone="danger">{error}</Notice>}
      {rows?.length === 0 && <p className="text-muted">Nothing here.</p>}
      {rows?.map((r) => (
        <RequestRow key={r.id} row={r} onDone={load} />
      ))}
    </div>
  );
}

function RequestRow({ row, onDone }: { row: DomainRequestRow; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [target, setTarget] = useState<UniversityTarget | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const personal = FREE.has(row.domain);
  const onPick = useCallback((t: UniversityTarget | null) => setTarget(t), []);

  const act = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/domain-requests/${row.id}/${path}`, { method: "POST", body });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <article className="grid gap-3 rounded-[16px] border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[15px] font-semibold">
            @{row.domain}
            {personal && (
              <span className="ml-2 font-body text-xs font-semibold text-warn">
                personal email provider
              </span>
            )}
          </div>
          <div className="text-sm">
            {row.universityName} · {row.country}
            {row.website && (
              <>
                {" · "}
                <a
                  className="underline"
                  href={row.website.startsWith("http") ? row.website : `https://${row.website}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {row.website}
                </a>
              </>
            )}
          </div>
          <div className="text-sm text-muted">
            {row.email} · {new Date(row.createdAt).toLocaleString()}
          </div>
        </div>
        {row.status === "pending" && mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="plain" onClick={() => setMode("approve")}>
              Approve…
            </Button>
            <Button size="sm" variant="plain" onClick={() => setMode("reject")}>
              Reject…
            </Button>
          </div>
        )}
      </div>

      {mode === "approve" && (
        <div className="grid gap-3">
          <UniversityPicker
            initialName={row.universityName}
            initialCountry={row.country}
            onChange={onPick}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="plain"
              disabled={!target || busy || personal}
              title={personal ? "Personal providers can't be allowed as a whole domain" : undefined}
              onClick={() => act("approve", target)}
            >
              Allow all of @{row.domain}
            </Button>
            <Button
              size="sm"
              variant="plain"
              disabled={!target || busy}
              onClick={() => act("approve-email", target)}
            >
              Allow only {row.email}
            </Button>
          </div>
          {personal && (
            <p className="text-sm text-muted">
              Only allow this address if you've checked they're a current student (for example, a
              student ID on a call).
            </p>
          )}
        </div>
      )}
      {mode === "reject" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act("reject", { note });
          }}
        >
          <div className="min-w-[240px] flex-1">
            <TextField
              label="Note to the student"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="This domain isn't a university email."
              required
              minLength={3}
            />
          </div>
          <Button size="sm" type="submit" variant="danger" disabled={busy}>
            Reject
          </Button>
        </form>
      )}
      {mode !== "idle" && (
        <button
          type="button"
          className="justify-self-start text-sm underline"
          onClick={() => setMode("idle")}
        >
          Cancel
        </button>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </article>
  );
}
