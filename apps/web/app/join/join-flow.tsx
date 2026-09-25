"use client";

import type { OtpRequestResponse, OtpVerifyResponse, University } from "@quad/shared";
import { Button, flag, Logo, Notice, OtpInput, Pip, Sticker, TextField } from "@quad/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError, api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";

type Step =
  | { kind: "email" }
  | { kind: "code"; university: University }
  | { kind: "request"; domain: string; personal: boolean }
  | { kind: "requested" };

export function JoinFlow() {
  const router = useRouter();
  const { state, setMe } = useMe();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");

  // Already signed in? Skip straight past this page.
  useEffect(() => {
    if (state.status === "ready")
      router.replace(state.me.status === "onboarding" ? "/onboarding" : "/home");
  }, [state, router]);

  return (
    <div className="mx-auto grid min-h-dvh max-w-[520px] content-start gap-8 px-4 py-6">
      <Link href="/" aria-label="Quad home">
        <Logo />
      </Link>
      {step.kind === "email" && (
        <EmailStep
          email={email}
          setEmail={setEmail}
          onSent={(university) => setStep({ kind: "code", university })}
          onUnknown={(domain, personal) => setStep({ kind: "request", domain, personal })}
        />
      )}
      {step.kind === "code" && (
        <CodeStep
          email={email}
          university={step.university}
          onBack={() => setStep({ kind: "email" })}
          onVerified={(res) => {
            setMe(res.me);
            router.replace(res.needsOnboarding ? "/onboarding" : "/home");
          }}
        />
      )}
      {step.kind === "request" && (
        <RequestStep
          email={email}
          domain={step.domain}
          personal={step.personal}
          onBack={() => setStep({ kind: "email" })}
          onDone={() => setStep({ kind: "requested" })}
        />
      )}
      {step.kind === "requested" && (
        <div className="q-card q-pop grid justify-items-start gap-4 p-6">
          <Pip size={64} mood="wow" className="q-bob" />
          <h1 className="text-[31px] font-extrabold leading-tight tracking-[-0.02em]">
            Got it. We'll add your university.
          </h1>
          <p className="text-muted">
            We check every request by hand. You'll get an email at{" "}
            <strong className="text-ink">{email}</strong> as soon as you can sign in.
          </p>
          <Link href="/" className="font-semibold underline">
            Back to the homepage
          </Link>
        </div>
      )}
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  onSent,
  onUnknown,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSent: (u: University) => void;
  onUnknown: (domain: string, personal: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: { email },
      });
      onSent(res.university);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "UNKNOWN_DOMAIN") {
        const details = err.details as { domain: string; personal?: boolean };
        onUnknown(details.domain, details.personal === true);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="q-display text-[clamp(40px,9vw,61px)]">
          get in with your <span className="q-hl">college email.</span>
        </h1>
        <p className="text-muted">
          We'll send you a 6-digit code. No passwords. Quad is for current university students aged
          18+.
        </p>
      </div>
      <TextField
        id="email"
        label="College email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder="you@university.edu"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        hint="Personal emails like Gmail won't work."
      />
      <Button type="submit" variant="primary" block disabled={busy || !email.includes("@")}>
        {busy ? "Sending…" : "Send my code →"}
      </Button>
      <p className="text-sm text-muted">
        By continuing you agree to the{" "}
        <Link href="/terms" className="font-semibold text-ink underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="font-semibold text-ink underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/guidelines" className="font-semibold text-ink underline">
          community guidelines
        </Link>
        .
      </p>
    </form>
  );
}

function CodeStep({
  email,
  university,
  onBack,
  onVerified,
}: {
  email: string;
  university: University;
  onBack: () => void;
  onVerified: (res: OtpVerifyResponse) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      onVerified(
        await api<OtpVerifyResponse>("/auth/otp/verify", {
          method: "POST",
          body: { email, code: value },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
      setShake((n) => n + 1);
      setCode("");
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const res = await api<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: { email },
      });
      setResendIn(res.resendInSeconds);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-6">
      <Sticker
        color="sky"
        tilt={-2}
        className="q-pop max-w-[calc(100%-12px)] justify-self-start !whitespace-normal"
      >
        oh hey, {university.name} {flag(university.countryCode)}
      </Sticker>
      <div className="grid gap-2">
        <h1 className="text-[clamp(32px,7vw,49px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
          Check your inbox
        </h1>
        <p className="text-muted">
          We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It expires in 10
          minutes.
        </p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
        }}
      >
        <OtpInput
          key={shake}
          value={code}
          onChange={setCode}
          onComplete={verify}
          disabled={busy}
          invalid={shake > 0}
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" variant="primary" block disabled={busy || code.length < 6}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onBack} className="font-semibold underline">
          Use a different email
        </button>
        {resendIn > 0 ? (
          <span className="q-label">Resend in 0:{String(resendIn).padStart(2, "0")}</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold underline">
            Send a new code
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Can't find it? Check spam or your university's quarantine folder.
      </p>
    </div>
  );
}

function RequestStep({
  email,
  domain,
  personal,
  onBack,
  onDone,
}: {
  email: string;
  domain: string;
  personal: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const [universityName, setUniversityName] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/domain-requests", {
        method: "POST",
        body: { email, universityName, country, website: website || undefined },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="flex items-start gap-3">
        <Pip size={56} mood="wow" />
        <div className="grid gap-1">
          <h1 className="text-[clamp(28px,6vw,39px)] font-extrabold leading-[1.05] tracking-[-0.02em]">
            {personal ? (
              "That's a personal email"
            ) : (
              <>
                We don't know <span className="break-all text-grape-text">@{domain}</span> yet
              </>
            )}
          </h1>
          <p className="text-muted">
            {personal
              ? "Use the email your university gave you. If your university doesn't give students an email, tell us where you study and we'll check by hand."
              : "Tell us your university and we'll add it. We check each one by hand."}
          </p>
        </div>
      </div>
      <TextField
        id="uni-name"
        label="University name"
        required
        minLength={2}
        value={universityName}
        onChange={(e) => setUniversityName(e.target.value)}
        placeholder="e.g. University of Lagos"
      />
      <TextField
        id="uni-country"
        label="Country"
        required
        minLength={2}
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        placeholder="e.g. Nigeria"
      />
      <TextField
        id="uni-site"
        label="University website (optional)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="unilag.edu.ng"
        hint="Helps us check the email domain belongs to your university."
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? "Sending…" : "Request my university"}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="justify-self-start text-sm font-semibold underline"
      >
        Typo? Change email
      </button>
    </form>
  );
}
