"use client";

import type { AdminUserRow, DomainRequestRow, University, UserStatus } from "@quad/shared";
import { Button, Notice, TextField } from "@quad/ui";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";

/** Deliberately plain: a work tool, same tokens, no stickers or tilt (DESIGN.md §7.11). */
export function AdminView() {
  const { state } = useMe();
  const [tab, setTab] = useState<"requests" | "users">("requests");
  if (state.status !== "ready") return null;
  if (state.me.role !== "admin") return <Notice tone="danger">Admins only.</Notice>;

  return (
    <div className="grid gap-6">
      <h1 className="font-body text-[28px] font-bold">Admin</h1>
      <div className="flex gap-2 border-b border-hairline" role="tablist">
        {(["requests", "users"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 font-semibold text-muted aria-selected:border-ink aria-selected:text-ink"
          >
            {t === "requests" ? "University requests" : "Users"}
          </button>
        ))}
      </div>
      {tab === "requests" ? <Requests /> : <Users />}
    </div>
  );
}

function Requests() {
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
  const [mode, setMode] = useState<"idle" | "existing" | "new" | "reject">("idle");
  const [query, setQuery] = useState(row.universityName);
  const [results, setResults] = useState<University[]>([]);
  const [name, setName] = useState(row.universityName);
  const [country, setCountry] = useState(row.country);
  const [countryCode, setCountryCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setResults(
        (
          await api<{ universities: University[] }>(
            `/admin/universities?q=${encodeURIComponent(query)}`,
          )
        ).universities,
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const act = async (path: string, body: unknown) => {
    setError(null);
    try {
      await api(`/admin/domain-requests/${row.id}/${path}`, { method: "POST", body });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <article className="grid gap-3 rounded-[16px] border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[15px] font-semibold">@{row.domain}</div>
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
            <Button size="sm" variant="plain" onClick={() => setMode("existing")}>
              Add to existing uni
            </Button>
            <Button size="sm" variant="plain" onClick={() => setMode("new")}>
              Create new uni
            </Button>
            <Button size="sm" variant="plain" onClick={() => setMode("reject")}>
              Reject
            </Button>
          </div>
        )}
      </div>

      {mode === "existing" && (
        <div className="grid gap-3">
          <form onSubmit={search} className="flex gap-2">
            <input
              className="q-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search universities"
            />
            <Button size="sm" type="submit" variant="plain">
              Search
            </Button>
          </form>
          <ul className="grid gap-1">
            {results.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 border-b border-hairline py-1.5 text-sm"
              >
                <span>
                  {u.name} · {u.countryCode}
                </span>
                <Button
                  size="sm"
                  variant="plain"
                  onClick={() => act("approve", { universityId: u.id })}
                >
                  Approve here
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mode === "new" && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void act("approve", { newUniversity: { name, country, countryCode } });
          }}
        >
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
          <TextField
            label="Code"
            placeholder="NG"
            maxLength={2}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            required
          />
          <Button size="sm" type="submit" variant="plain">
            Approve
          </Button>
        </form>
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
          <Button size="sm" type="submit" variant="danger">
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

function Users() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    try {
      setRows((await api<{ users: AdminUserRow[] }>(`/admin/users?${params}`)).users);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [q, status]);

  // Reload when the status filter changes; the search box is submitted explicitly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `q` is intentionally not a trigger
  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div className="grid gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          className="q-input max-w-[320px]"
          placeholder="Search email or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search users"
        />
        <select
          className="q-input max-w-[180px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as UserStatus | "")}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <Button size="sm" type="submit" variant="plain">
          Search
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="overflow-x-auto rounded-[16px] border border-hairline bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-hairline text-muted">
            <tr>
              <th className="p-3 font-semibold">User</th>
              <th className="p-3 font-semibold">University</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((u) => (
              <UserRow key={u.id} user={u} onDone={load} />
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && <p className="p-4 text-muted">No users match.</p>}
      </div>
    </div>
  );
}

function UserRow({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = async (path: string, body?: unknown) => {
    setError(null);
    try {
      await api(`/admin/users/${user.id}/${path}`, { method: "POST", body });
      setReason("");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const needReason = reason.trim().length < 3;

  return (
    <tr className="border-b border-hairline align-top last:border-0">
      <td className="p-3">
        <div className="font-semibold">{user.displayName ?? "—"}</div>
        <div className="break-all text-muted">{user.email}</div>
      </td>
      <td className="p-3">{user.university}</td>
      <td className="p-3">
        <div className="font-semibold">
          {user.status}
          {user.role === "admin" ? " · admin" : ""}
        </div>
        {user.suspendedUntil && (
          <div className="text-muted">until {new Date(user.suspendedUntil).toLocaleString()}</div>
        )}
        {user.statusReason && <div className="text-muted">{user.statusReason}</div>}
      </td>
      <td className="p-3">
        {user.role === "admin" ? (
          <span className="text-muted">—</span>
        ) : (
          <div className="grid gap-2">
            <input
              className="q-input !min-h-10 !py-2 text-sm"
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label={`Reason for ${user.email}`}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="plain"
                disabled={needReason}
                onClick={() => act("suspend", { hours: 24, reason })}
              >
                Suspend 24h
              </Button>
              <Button
                size="sm"
                variant="plain"
                disabled={needReason}
                onClick={() => act("suspend", { hours: 168, reason })}
              >
                Suspend 7d
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={needReason}
                onClick={() => act("ban", { reason })}
              >
                Ban
              </Button>
              {(user.status === "suspended" || user.status === "banned") && (
                <Button size="sm" variant="plain" onClick={() => act("reinstate")}>
                  Reinstate
                </Button>
              )}
            </div>
            {error && <span className="text-danger">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
