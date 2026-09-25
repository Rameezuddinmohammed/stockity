"use client";

import { type ApprovedEmailRow, FREE_EMAIL_PROVIDERS, type UniversityTarget } from "@quad/shared";
import { Button, flag, Notice, TextField } from "@quad/ui";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { UniversityPicker } from "./university-picker";

const FREE = new Set<string>(FREE_EMAIL_PROVIDERS);

export function ApprovedEmails() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ApprovedEmailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      setRows((await api<{ emails: ApprovedEmailRow[] }>(`/admin/approved-emails${qs}`)).emails);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="grid gap-6">
      <AddEmail onAdded={() => load(q)} />
      <section className="grid gap-3">
        <h2 className="font-body text-lg font-bold">Approved emails</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
        >
          <input
            className="q-input max-w-[320px]"
            placeholder="Search email or university"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search approved emails"
          />
          <Button size="sm" type="submit" variant="plain">
            Search
          </Button>
        </form>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="overflow-x-auto rounded-[16px] border border-hairline bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-hairline text-muted">
              <tr>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">University</th>
                <th className="p-3 font-semibold">Note</th>
                <th className="p-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <EmailRow key={r.email} row={r} onRemoved={() => load(q)} />
              ))}
            </tbody>
          </table>
          {rows?.length === 0 && <p className="p-4 text-muted">No approved emails yet.</p>}
        </div>
      </section>
    </div>
  );
}

function AddEmail({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [target, setTarget] = useState<UniversityTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const onPick = useCallback((t: UniversityTarget | null) => setTarget(t), []);
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  const personal = FREE.has(domain);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setStatus(null);
    try {
      await api("/admin/approved-emails", {
        method: "POST",
        body: { email, note: note || undefined, notify, ...target },
      });
      setStatus({
        tone: "success",
        text: `${email.trim()} can sign in now.${notify ? " We emailed them." : ""}`,
      });
      setEmail("");
      setNote("");
      setPickerKey((k) => k + 1);
      onAdded();
    } catch (err) {
      setStatus({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-[16px] border border-hairline bg-surface p-4"
    >
      <h2 className="font-body text-lg font-bold">Approve a single email</h2>
      <p className="text-sm text-muted">
        Lets one address in without opening its whole domain. Use it when a university's domain is
        shared with staff or alumni, or when you've verified a student another way.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          placeholder="student@college.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint={
            personal
              ? "Personal address: only approve if you've checked they're a current student."
              : undefined
          }
          required
        />
        <TextField
          label="Note (only admins see this)"
          placeholder="Showed student ID on a call"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <UniversityPicker key={pickerKey} onChange={onPick} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Email them that they can sign in
      </label>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Button
        type="submit"
        size="sm"
        variant="plain"
        className="justify-self-start"
        disabled={!target || busy || !email.includes("@")}
      >
        {busy ? "Approving…" : "Approve email"}
      </Button>
    </form>
  );
}

function EmailRow({ row, onRemoved }: { row: ApprovedEmailRow; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    try {
      await api(`/admin/approved-emails/${encodeURIComponent(row.email)}`, { method: "DELETE" });
      onRemoved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <tr className="border-b border-hairline align-top last:border-0">
      <td className="break-all p-3 font-mono">{row.email}</td>
      <td className="p-3">
        {row.university.name} {flag(row.university.countryCode)}
      </td>
      <td className="p-3 text-muted">{row.note ?? "—"}</td>
      <td className="p-3 text-right">
        {confirm ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="danger" onClick={remove}>
              Remove
            </Button>
            <Button size="sm" variant="plain" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="plain" onClick={() => setConfirm(true)}>
            Remove…
          </Button>
        )}
        {error && <div className="text-danger">{error}</div>}
      </td>
    </tr>
  );
}
