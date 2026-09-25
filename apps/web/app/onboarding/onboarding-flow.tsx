"use client";

import { displayNameSchema, dobSchema, type Me } from "@quad/shared";
import { Button, flag, IdCard, Logo, Notice, TextField } from "@quad/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Loading } from "@/components/loading";
import { ApiClientError, api, errorMessage } from "@/lib/api";
import { VIBE_CHECK } from "@/lib/guidelines";
import { useGuard, useMe } from "@/lib/me";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function OnboardingFlow() {
  const me = useGuard("onboarding");
  const { setMe } = useMe();
  const router = useRouter();
  const [step, setStep] = useState<"basics" | "vibe" | "underage">("basics");
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [card, setCard] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; dob?: string }>({});

  if (step === "underage") return <Underage />;
  if (!me) return <Loading />;

  const next = (e: FormEvent) => {
    e.preventDefault();
    const name = displayNameSchema.safeParse(displayName);
    const date = dobSchema.safeParse(dob);
    setFieldErrors({
      name: name.success ? undefined : name.error.issues[0]?.message,
      dob: date.success ? undefined : "Enter your date of birth",
    });
    if (name.success && date.success) setStep("vibe");
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Me>("/onboarding", {
        method: "POST",
        body: { displayName, dob, acceptGuidelines: true },
      });
      setMe(updated);
      router.replace("/home");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "UNDERAGE") {
        setStep("underage");
        return;
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-dvh max-w-[560px] content-start gap-8 px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="q-label">Step {step === "basics" ? 1 : 2} of 2</span>
      </div>

      {step === "basics" && (
        <form onSubmit={next} className="grid gap-6">
          <div className="grid gap-2">
            <h1 className="q-display text-[clamp(38px,8vw,56px)]">
              welcome to the <span className="q-hl">quad.</span>
            </h1>
            <p className="text-muted">
              You're in as a student at {me.university.name} {flag(me.university.countryCode)}. Two
              quick things.
            </p>
          </div>
          <IdCard
            className="q-pop rotate-[-1.5deg]"
            name={displayName || "Your name"}
            university={me.university.name}
            countryCode={me.university.countryCode}
            avatarColor="zest"
          />
          <TextField
            id="display-name"
            label="What should people call you?"
            autoComplete="given-name"
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={fieldErrors.name}
            hint="First name or a nickname. This goes on your card."
          />
          <TextField
            id="dob"
            label="Date of birth"
            type="date"
            max={todayIso()}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            error={fieldErrors.dob}
            hint="Quad is 18+. We only use this to check your age and never show it. You can't change it later."
          />
          <Button type="submit" variant="primary" block>
            Next →
          </Button>
        </form>
      )}

      {step === "vibe" && (
        <div className="grid gap-6">
          <div className="grid gap-2">
            <h1 className="q-display text-[clamp(38px,8vw,56px)]">
              the <span className="q-hl">vibe check.</span>
            </h1>
            <p className="text-muted">
              Three rules. Break them and you're out, and bans follow your university email.
            </p>
          </div>

          <div className="relative grid min-h-[260px]">
            {VIBE_CHECK.map((rule, i) => (
              <div
                key={rule.title}
                aria-hidden={i !== card}
                className={`q-card col-start-1 row-start-1 grid content-start gap-3 p-6 transition-[transform,opacity] duration-300 ${
                  i === card
                    ? "z-10 rotate-0 opacity-100"
                    : i < card
                      ? "pointer-events-none -translate-x-6 rotate-[-6deg] opacity-0"
                      : "pointer-events-none translate-y-2 rotate-[3deg] opacity-60"
                }`}
                style={{
                  background: `color-mix(in srgb, var(--${rule.color}) 28%, var(--surface))`,
                }}
              >
                <span className="q-label">
                  Rule {i + 1} of {VIBE_CHECK.length}
                </span>
                <span className="text-4xl" aria-hidden="true">
                  {rule.emoji}
                </span>
                <h2 className="text-[25px] font-bold leading-tight">{rule.title}</h2>
                <p>{rule.body}</p>
              </div>
            ))}
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          {card < VIBE_CHECK.length - 1 ? (
            <Button variant="primary" block onClick={() => setCard((c) => c + 1)}>
              Got it →
            </Button>
          ) : (
            <Button variant="zest" block onClick={finish} disabled={busy}>
              {busy ? "Setting you up…" : "I'm in ✦"}
            </Button>
          )}
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => (card > 0 ? setCard((c) => c - 1) : setStep("basics"))}
            >
              ← Back
            </button>
            <Link href="/guidelines" target="_blank" className="font-semibold underline">
              All guidelines
            </Link>
          </div>
          <p className="text-sm text-muted">
            By tapping “I'm in” you agree to the{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-ink underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-ink underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/** Safety voice: plain, no mascot, no jokes. */
function Underage() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-[520px] content-center gap-5 px-4 py-6">
      <h1 className="font-body text-[28px] font-bold">Quad is only for students 18 and over</h1>
      <p>
        We've deleted the account and the details you entered. This email can't be used to sign up
        again.
      </p>
      <p className="text-muted">
        If you entered the wrong date by mistake, contact support from your university email.
      </p>
      <Link href="/" className="font-semibold underline">
        Back to the homepage
      </Link>
    </div>
  );
}
