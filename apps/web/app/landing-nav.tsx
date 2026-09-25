"use client";

import { buttonClass, Logo } from "@quad/ui";
import Link from "next/link";
import { useMe } from "@/lib/me";

export function LandingNav() {
  const { state } = useMe();
  const signedIn = state.status === "ready";
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-5">
      <Link href="/" aria-label="Quad home">
        <Logo />
      </Link>
      <Link href={signedIn ? "/home" : "/join"} className={buttonClass("secondary", "sm")}>
        {signedIn ? "Open Quad →" : "Sign in"}
      </Link>
    </header>
  );
}
