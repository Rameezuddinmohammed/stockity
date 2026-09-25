"use client";

import type { AdminUserRow, UserStatus } from "@quad/shared";
import { Button, Notice } from "@quad/ui";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

export function Users() {
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
