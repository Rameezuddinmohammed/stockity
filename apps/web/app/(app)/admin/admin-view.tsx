"use client";

import { Notice } from "@quad/ui";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { Domains } from "./domains";
import { ApprovedEmails } from "./emails";
import { Reports } from "./reports";
import { Requests } from "./requests";
import { Survey } from "./survey";
import { Users } from "./users";

const TABS = [
  { id: "reports", label: "Reports" },
  { id: "requests", label: "Requests" },
  { id: "domains", label: "Domains" },
  { id: "emails", label: "Approved emails" },
  { id: "users", label: "Users" },
  { id: "survey", label: "Survey" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Deliberately plain: a work tool, same tokens, no stickers or tilt (DESIGN.md §7.11). */
export function AdminView() {
  const { state } = useMe();
  const [tab, setTab] = useState<Tab>("reports");
  if (state.status !== "ready") return null;
  if (state.me.role !== "admin") return <Notice tone="danger">Admins only.</Notice>;

  return (
    <div className="grid gap-6">
      <h1 className="font-body text-[28px] font-bold">Admin</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-hairline" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="admin-panel"
            onClick={() => setTab(t.id)}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-semibold text-muted aria-selected:border-ink aria-selected:text-ink"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "reports" && <Reports />}
        {tab === "requests" && <Requests />}
        {tab === "domains" && <Domains />}
        {tab === "emails" && <ApprovedEmails />}
        {tab === "users" && <Users />}
        {tab === "survey" && <Survey />}
      </div>
    </div>
  );
}
