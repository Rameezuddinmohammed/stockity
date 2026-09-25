"use client";

import type { Me } from "@quad/shared";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

type MeState =
  | { status: "loading"; me: null }
  | { status: "anon"; me: null }
  | { status: "ready"; me: Me };

const MeContext = createContext<{
  state: MeState;
  setMe: (me: Me) => void;
  refresh: () => Promise<void>;
} | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeState>({ status: "loading", me: null });

  const refresh = useCallback(async () => {
    const { me } = await api<{ me: Me | null }>("/auth/session");
    setState(me ? { status: "ready", me } : { status: "anon", me: null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setMe = useCallback((me: Me) => setState({ status: "ready", me }), []);
  return <MeContext.Provider value={{ state, setMe, refresh }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside MeProvider");
  return ctx;
}

/** Sends people to the right place for their account state. Returns the user once they belong here. */
export function useGuard(want: "active" | "onboarding"): Me | null {
  const { state } = useMe();
  const router = useRouter();
  const me = state.status === "ready" ? state.me : null;
  const redirect =
    state.status === "anon"
      ? "/join"
      : me && want === "active" && me.status === "onboarding"
        ? "/onboarding"
        : me && want === "onboarding" && me.status !== "onboarding"
          ? "/home"
          : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  return redirect ? null : me;
}
