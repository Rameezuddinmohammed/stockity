"use client";

import { type AllowedDomainRow, FREE_EMAIL_PROVIDERS, type UniversityTarget } from "@quad/shared";
import { Button, flag, Notice, TextField } from "@quad/ui";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { UniversityPicker } from "./university-picker";

const FREE = new Set<string>(FREE_EMAIL_PROVIDERS);

export function Domains() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AllowedDomainRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      setRows((await api<{ domains: AllowedDomainRow[] }>(`/admin/domains${qs}`)).domains);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="grid gap-6">
      <AddDomain onAdded={() => load(q)} />
      <section className="grid gap-3">
        <h2 className="font-body text-lg font-bold">Allowed domains</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
        >
          <input
            className="q-input max-w-[320px]"
            placeholder="Search domain or university"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search domains"
          />
          <Button size="sm" type="submit" variant="plain">
            Search
          </Button>
        </form>
        <p className="text-sm text-muted">
          {q.trim()
            ? "Search covers the full list (10,000+ domains)."
            : "Showing domains added by admins. Search to see the rest."}
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="overflow-x-auto rounded-[16px] border border-hairline bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-hairline text-muted">
              <tr>
                <th className="p-3 font-semibold">Domain</th>
                <th className="p-3 font-semibold">University</th>
                <th className="p-3 font-semibold">Source</th>
                <th className="p-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((d) => (
                <DomainRow key={d.domain} row={d} onRemoved={() => load(q)} />
              ))}
            </tbody>
          </table>
          {rows?.length === 0 && <p className="p-4 text-muted">No domains match.</p>}
        </div>
      </section>
    </div>
  );
}

function AddDomain({ onAdded }: { onAdded: () => void }) {
  const [domain, setDomain] = useState("");
  const [target, setTarget] = useState<UniversityTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const onPick = useCallback((t: UniversityTarget | null) => setTarget(t), []);
  const clean = domain.trim().toLowerCase().replace(/^@/, "");
  const personal = FREE.has(clean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await api<{ approvedRequests: number }>("/admin/domains", {
        method: "POST",
        body: { domain, ...target },
      });
      setStatus({
        tone: "success",
        text: `@${clean} added.${res.approvedRequests ? ` ${res.approvedRequests} waiting student(s) emailed.` : ""}`,
      });
      setDomain("");
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
      <h2 className="font-body text-lg font-bold">Add a college email domain</h2>
      <p className="text-sm text-muted">
        Everyone with an address at this domain (and its subdomains) can sign up. Use this for
        official university domains only.
      </p>
      <TextField
        label="Domain"
        placeholder="unilag.edu.ng"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        error={
          personal
            ? "That's a personal email provider. Approve single addresses in the Approved emails tab."
            : null
        }
        required
      />
      <UniversityPicker key={pickerKey} onChange={onPick} />
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Button
        type="submit"
        size="sm"
        variant="plain"
        className="justify-self-start"
        disabled={!target || busy || personal || !clean}
      >
        {busy ? "Adding…" : "Add domain"}
      </Button>
    </form>
  );
}

function DomainRow({ row, onRemoved }: { row: AllowedDomainRow; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    try {
      await api(`/admin/domains/${encodeURIComponent(row.domain)}`, { method: "DELETE" });
      onRemoved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <tr className="border-b border-hairline align-top last:border-0">
      <td className="p-3 font-mono">{row.domain}</td>
      <td className="p-3">
        {row.university.name} {flag(row.university.countryCode)}
      </td>
      <td className="p-3 text-muted">
        {row.source === "admin"
          ? `admin · ${new Date(row.createdAt).toLocaleDateString()}`
          : "university list"}
      </td>
      <td className="p-3 text-right">
        {confirm ? (
          <div className="flex flex-wrap justify-end gap-2">
            <span className="text-muted">New sign-ups stop. Existing accounts stay.</span>
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
