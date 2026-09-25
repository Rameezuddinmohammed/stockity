"use client";

import type { Me } from "@quad/shared";
import { Avatar, Button, Logo, Notice, Switch } from "@quad/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { readCalm, writeCalm } from "@/lib/calm";
import { useGuard, useMe } from "@/lib/me";
import { Loading } from "./loading";

export function AppShell({ children }: { children: ReactNode }) {
  const me = useGuard("active");
  const { setMe } = useMe();
  const pathname = usePathname();
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(readCalm()), []);

  if (!me) return <Loading />;

  const nav = [
    { href: "/home", label: "Quad", color: "grape" },
    { href: "/me", label: "Me", color: "zest" },
    ...(me.role === "admin" ? [{ href: "/admin", label: "Admin", color: "sky" }] : []),
  ];
  const name = me.profile?.displayName ?? "you";

  return (
    <div className="mx-auto grid min-h-dvh max-w-[1180px] grid-rows-[auto_1fr] px-4 pb-28 md:pb-12">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/home" aria-label="Quad home">
          <Logo size={30} />
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? "page" : undefined}
              className="rounded-full border-2 border-transparent px-4 py-1.5 font-semibold aria-[current=page]:border-line aria-[current=page]:bg-surface aria-[current=page]:shadow-[3px_3px_0_var(--line)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Switch
            id="calm-mode"
            checked={calm}
            onChange={(on) => {
              setCalm(on);
              writeCalm(on);
            }}
          >
            <span className="hidden sm:inline">Calm mode</span>
            <span className="sr-only sm:hidden">Calm mode</span>
          </Switch>
          <Link href="/me" aria-label="Your profile">
            <Avatar name={name} color={me.profile?.avatarColor} size={38} />
          </Link>
        </div>
      </header>

      <main className="grid content-start gap-6">
        {me.notices.map((n) => (
          <Notice
            key={n.id}
            tone="danger"
            title={n.kind === "warning" ? "Warning from the safety team" : "Account notice"}
          >
            <span className="grid gap-3">
              {n.message}
              <Button
                size="sm"
                variant="plain"
                className="justify-self-start"
                onClick={() => api<Me>(`/me/notices/${n.id}/seen`, { method: "POST" }).then(setMe)}
              >
                Got it
              </Button>
            </span>
          </Notice>
        ))}
        {me.status === "suspended" && (
          <Notice tone="danger" title="Your account is suspended">
            You can't chat or edit your profile until{" "}
            {me.suspendedUntil ? new Date(me.suspendedUntil).toLocaleString() : "further notice"}.
          </Notice>
        )}
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t-2 border-line bg-surface px-2 pt-2 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        aria-label="Main"
      >
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={pathname === n.href ? "page" : undefined}
            className="grid min-w-16 justify-items-center gap-1 text-[12px] font-bold"
          >
            <span
              className={`block h-6 w-6 rounded-[8px] border-2 border-line ${pathname === n.href ? `q-fill-${n.color}` : ""}`}
              aria-hidden="true"
            />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
