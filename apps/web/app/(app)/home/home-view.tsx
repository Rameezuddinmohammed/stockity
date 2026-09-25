"use client";

import type { PublicStats } from "@quad/shared";
import { Button, buttonClass, flag, Tile } from "@quad/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/me";

export function HomeView() {
  const { state } = useMe();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<PublicStats>("/stats").then(setStats, () => setStats(null));
  }, []);

  if (state.status !== "ready") return null;
  const { me } = state;
  const name = me.profile?.displayName ?? "there";
  const cardUnfinished = (me.profile?.interests.length ?? 0) === 0 || !me.profile?.about;

  const invite = async () => {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-[clamp(32px,6vw,49px)] font-extrabold leading-none tracking-[-0.03em]">
          hey {name} 👋
        </h1>
        <p className="text-muted">
          {me.university.name} {flag(me.university.countryCode)} · verified until{" "}
          {new Date(me.verificationExpiresAt).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Modes">
        <Tile
          color="grape"
          className="min-h-[180px] sm:col-span-2 lg:row-span-2"
          soon="opens at beta"
          title={<span className="text-[clamp(28px,4vw,39px)]">Just Chat</span>}
          meta={
            stats && stats.students > 0 ? (
              <span className="text-[#EDE8FF]">
                {stats.students.toLocaleString()} verified{" "}
                {stats.students === 1 ? "student" : "students"} from{" "}
                {stats.universities.toLocaleString()}{" "}
                {stats.universities === 1 ? "university" : "universities"} in {stats.countries}{" "}
                {stats.countries === 1 ? "country" : "countries"} are waiting.
              </span>
            ) : (
              <span className="text-[#EDE8FF]">
                Random 1:1 video + text with verified students.
              </span>
            )
          }
        >
          <span className="inline-flex w-max items-center rounded-xl border-2 border-[#16131F] bg-white px-3 py-2 text-sm font-bold text-[#16131F] opacity-80">
            Start → (soon)
          </span>
        </Tile>
        <Tile
          color="zest"
          soon="soon"
          title="Quick Play"
          meta="tic-tac-toe, trivia, would-you-rather"
        />
        <Tile color="tang" soon="soon" title="Tables" meta="Ludo, cards, Mafia" />
        <Tile
          color="gum"
          className="sm:col-span-2"
          soon="soon"
          title="Cinema"
          meta="Reserve a seat for Friday Night Cinema."
        />
        <Tile
          color="sky"
          className="sm:col-span-2"
          title="Bring your campus"
          meta={`The more students from ${me.university.name} join, the sooner your campus unlocks first.`}
        >
          <Button size="sm" onClick={invite} className="w-max">
            {copied ? "Link copied ✓" : "Copy invite link"}
          </Button>
        </Tile>
        {cardUnfinished && (
          <Tile
            color="surface"
            className="sm:col-span-2"
            title="Finish your card"
            meta="Add an about line and a few interests so people have something to talk about."
          >
            <Link href="/me" className={`${buttonClass("zest", "sm")} w-max`}>
              Edit my card →
            </Link>
          </Tile>
        )}
      </section>
    </>
  );
}
