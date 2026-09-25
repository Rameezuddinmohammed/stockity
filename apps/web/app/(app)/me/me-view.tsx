"use client";

import {
  AVATAR_COLORS,
  type AvatarColor,
  INTERESTS,
  type InterestId,
  LANGUAGES,
  type LanguageCode,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  type Me,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@quad/shared";
import { Button, IdCard, Notice, TextArea, TextField, ToggleChip } from "@quad/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/me";

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  snapchat: "Snapchat",
  discord: "Discord",
  github: "GitHub",
  spotify: "Spotify",
  tiktok: "TikTok",
};

export function MeView() {
  const { state } = useMe();
  if (state.status !== "ready" || !state.me.profile) return null;
  return <Editor me={state.me} />;
}

function Editor({ me }: { me: Me }) {
  const { setMe } = useMe();
  const profile = me.profile as NonNullable<Me["profile"]>;
  const locked = me.status !== "active";

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [about, setAbout] = useState(profile.about);
  const [course, setCourse] = useState(profile.course);
  const [year, setYear] = useState(profile.year ? String(profile.year) : "");
  const [interests, setInterests] = useState<InterestId[]>(profile.interests);
  const [languages, setLanguages] = useState<LanguageCode[]>(profile.languages);
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(profile.avatarColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interestLabels = interests.map((id) => INTERESTS.find((i) => i.id === id)?.label ?? id);

  const toggle = <T,>(list: T[], item: T, max: number) =>
    list.includes(item)
      ? list.filter((x) => x !== item)
      : list.length >= max
        ? list
        : [...list, item];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<Me>("/me/profile", {
        method: "PATCH",
        body: {
          displayName,
          about,
          course,
          year: year ? Number(year) : null,
          interests,
          languages,
          avatarColor,
        },
      });
      setMe(updated);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="grid gap-4 lg:sticky lg:top-6">
        <IdCard
          className="q-pop rotate-[-1.5deg]"
          name={displayName}
          university={me.university.name}
          countryCode={me.university.countryCode}
          course={course}
          year={year ? Number(year) : null}
          chips={interestLabels}
          avatarColor={avatarColor}
          cardNo={`#${me.id.slice(0, 4).toUpperCase()}`}
        />
        <p className="text-sm text-muted">
          This is what people see when you match. Your birthday and email are never shown.
        </p>
      </aside>

      <div className="grid gap-8">
        <form onSubmit={save} className="grid gap-8">
          <Section title="Basics">
            <TextField
              id="p-name"
              label="Name"
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={locked}
            />
            <TextArea
              id="p-about"
              label="About"
              maxLength={280}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="design student, ludo champion, will talk about street food for hours"
              hint={`${about.length}/280`}
              disabled={locked}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <TextField
                id="p-course"
                label="Course"
                maxLength={60}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Law"
                disabled={locked}
              />
              <div className="q-field">
                <label className="q-field__label" htmlFor="p-year">
                  Year
                </label>
                <select
                  id="p-year"
                  className="q-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={locked}
                >
                  <option value="">–</option>
                  {Array.from({ length: 7 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Year {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Interests" note={`${interests.length}/${MAX_INTERESTS}`}>
            <div className="flex flex-wrap gap-2.5">
              {INTERESTS.map((i) => (
                <ToggleChip
                  key={i.id}
                  pressed={interests.includes(i.id)}
                  onChange={() => setInterests((l) => toggle(l, i.id, MAX_INTERESTS))}
                  disabled={
                    locked || (!interests.includes(i.id) && interests.length >= MAX_INTERESTS)
                  }
                >
                  <span aria-hidden="true">{i.emoji}</span> {i.label}
                </ToggleChip>
              ))}
            </div>
          </Section>

          <Section title="Languages you can chat in" note={`${languages.length}/${MAX_LANGUAGES}`}>
            <div className="flex flex-wrap gap-2.5">
              {LANGUAGES.map((l) => (
                <ToggleChip
                  key={l.code}
                  color="sky"
                  pressed={languages.includes(l.code)}
                  onChange={() => setLanguages((list) => toggle(list, l.code, MAX_LANGUAGES))}
                  disabled={
                    locked || (!languages.includes(l.code) && languages.length >= MAX_LANGUAGES)
                  }
                >
                  {l.name}
                </ToggleChip>
              ))}
            </div>
          </Section>

          <Section title="Card color">
            <fieldset className="flex flex-wrap gap-3">
              <legend className="sr-only">Card color</legend>
              {AVATAR_COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="card-color"
                    value={c}
                    checked={avatarColor === c}
                    onChange={() => setAvatarColor(c)}
                    disabled={locked}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{c}</span>
                  <span
                    aria-hidden="true"
                    className={`q-fill-${c} block h-12 w-12 rounded-full border-2 border-line transition-transform peer-checked:scale-110 peer-checked:shadow-[3px_3px_0_var(--line)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-grape-text`}
                  />
                </label>
              ))}
            </fieldset>
          </Section>

          <div className="grid gap-3">
            {error && <Notice tone="danger">{error}</Notice>}
            {saved && <Notice tone="success">Saved. Your card is updated.</Notice>}
            <Button
              type="submit"
              variant="primary"
              disabled={saving || locked}
              className="justify-self-start"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>

        <Socials me={me} locked={locked} />
        <Account me={me} />
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="q-card q-card--flat grid gap-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {note && <span className="q-label">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Socials({ me, locked }: { me: Me; locked: boolean }) {
  const { setMe } = useMe();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(me.socials.map((s) => [s.platform, s.handle])),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const socials = SOCIAL_PLATFORMS.filter((p) => values[p]?.trim()).map((p) => ({
        platform: p,
        handle: (values[p] ?? "").trim(),
      }));
      setMe(await api<Me>("/me/socials", { method: "PUT", body: { socials } }));
      setStatus({ tone: "success", text: "Socials saved." });
    } catch (err) {
      setStatus({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Section title="Socials">
        <p className="-mt-2 text-sm text-muted">
          🔒 Private. Only shown to someone after you both press Connect.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <TextField
              key={p}
              id={`s-${p}`}
              label={SOCIAL_LABELS[p]}
              placeholder="handle"
              autoCapitalize="none"
              maxLength={41}
              value={values[p] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              disabled={locked}
            />
          ))}
        </div>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
        <Button type="submit" disabled={busy || locked} className="justify-self-start">
          {busy ? "Saving…" : "Save socials"}
        </Button>
      </Section>
    </form>
  );
}

/** Account actions use the plain style: no stickers or bounce near destructive actions. */
function Account({ me }: { me: Me }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (path: string, method: "POST" | "DELETE") => {
    setError(null);
    try {
      await api(path, { method });
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="grid gap-4 rounded-[24px] border border-hairline bg-surface p-5">
      <h2 className="font-body text-xl font-bold">Account</h2>
      <dl className="grid gap-2 text-[15px] sm:grid-cols-[160px_1fr]">
        <dt className="text-muted">Email</dt>
        <dd className="break-all">{me.email}</dd>
        <dt className="text-muted">University</dt>
        <dd>{me.university.name}</dd>
        <dt className="text-muted">Verified until</dt>
        <dd>{new Date(me.verificationExpiresAt).toLocaleDateString()}</dd>
      </dl>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button variant="plain" size="sm" onClick={() => run("/auth/logout", "POST")}>
          Sign out
        </Button>
        <Button variant="plain" size="sm" onClick={() => run("/auth/logout-all", "POST")}>
          Sign out everywhere
        </Button>
        {me.role === "admin" && (
          <Button variant="plain" size="sm" onClick={() => router.push("/admin")}>
            Admin panel
          </Button>
        )}
      </div>
      <div className="grid gap-3 border-t border-hairline pt-4">
        {confirmDelete ? (
          <>
            <p>
              This permanently deletes your account, profile and socials. You can sign up again
              later with the same email.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" size="sm" onClick={() => run("/me", "DELETE")}>
                Delete my account
              </Button>
              <Button variant="plain" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="justify-self-start text-sm font-semibold text-danger underline"
            onClick={() => setConfirmDelete(true)}
          >
            Delete account…
          </button>
        )}
      </div>
    </section>
  );
}
