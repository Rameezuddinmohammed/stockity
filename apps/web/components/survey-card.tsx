"use client";

import { SURVEY_MODES, type SurveyAnswers, type SurveyMode } from "@quad/shared";
import { Button, Notice, ToggleChip } from "@quad/ui";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

/** Two-hour windows in the student's local time. */
const WINDOWS = [8, 10, 12, 14, 16, 18, 20, 22, 0] as const;
const label = (h: number) => {
  const fmt = (x: number) => {
    const hh = x % 24;
    return `${hh % 12 === 0 ? 12 : hh % 12}${hh < 12 ? "am" : "pm"}`;
  };
  return `${fmt(h)}–${fmt(h + 2)}`;
};
const offsetHours = () => -new Date().getTimezoneOffset() / 60;
const toUtc = (local: number) => Math.floor((((local - offsetHours()) % 24) + 24) % 24);

/** Phase 0 demand survey: shapes which mode we build first and when Global Hour happens. */
export function SurveyCard() {
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SurveyAnswers | null>(null);
  const [editing, setEditing] = useState(false);
  const [modes, setModes] = useState<SurveyMode[]>([]);
  const [windows, setWindows] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ answers: SurveyAnswers | null }>("/me/survey").then(
      ({ answers }) => {
        setSaved(answers);
        if (answers) {
          setModes(answers.modes);
          setWindows(WINDOWS.filter((w) => answers.freeHoursUtc.includes(toUtc(w))));
        }
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, []);

  if (!loaded) return null;

  if (saved && !editing) {
    return (
      <div className="q-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="grid gap-1">
          <h2 className="text-xl font-bold">Thanks for helping shape Quad ✦</h2>
          <p className="text-sm text-muted">
            We'll use your answers to pick what launches first and when Global Hour happens.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>
          Edit answers
        </Button>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const freeHoursUtc = windows.flatMap((w) => [toUtc(w), toUtc(w + 1)]);
      const res = await api<{ answers: SurveyAnswers }>("/me/survey", {
        method: "PUT",
        body: { modes, freeHoursUtc, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      setSaved(res.answers);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <section className="q-card grid gap-5 p-5" aria-labelledby="survey-title">
      <div className="grid gap-1">
        <span className="q-label">2 quick questions · optional</span>
        <h2 id="survey-title" className="text-2xl font-extrabold tracking-[-0.02em]">
          Help us build Quad for you
        </h2>
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-bold">What would you use most?</legend>
        <div className="flex flex-wrap gap-2.5">
          {SURVEY_MODES.map((m) => (
            <ToggleChip
              key={m.id}
              color="grape"
              pressed={modes.includes(m.id)}
              onChange={() => setModes((l) => toggle(l, m.id))}
            >
              {m.label}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-bold">When are you usually free to hang out?</legend>
        <p className="text-sm text-muted">Your local time. Pick as many as you like.</p>
        <div className="flex flex-wrap gap-2.5">
          {WINDOWS.map((w) => (
            <ToggleChip
              key={w}
              color="sky"
              pressed={windows.includes(w)}
              onChange={() => setWindows((l) => toggle(l, w))}
            >
              {label(w)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={save}
          disabled={busy || (modes.length === 0 && windows.length === 0)}
        >
          {busy ? "Saving…" : "Send answers"}
        </Button>
        {saved && (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}
