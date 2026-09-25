"use client";

import {
  Avatar,
  Button,
  Chip,
  IdCard,
  Logo,
  Notice,
  OtpInput,
  Pip,
  Sticker,
  Switch,
  TextField,
  Tile,
  ToggleChip,
  Verified,
} from "@quad/ui";
import { type ReactNode, useEffect, useState } from "react";
import { readCalm, writeCalm } from "@/lib/calm";

const COLORS = [
  { token: "grape-strong", note: "Just Chat · primary buttons (white text)" },
  { token: "zest", note: "Quick Play" },
  { token: "tang", note: "Tables" },
  { token: "gum", note: "Cinema" },
  { token: "sky", note: "Global · passport" },
  { token: "danger", note: "Safety actions only" },
] as const;

/** Every @quad/ui component in one place. Flip your OS theme or Calm mode to review all three looks. */
export function Styleguide() {
  const [calm, setCalm] = useState(false);
  const [otp, setOtp] = useState("481");
  const [pressed, setPressed] = useState(true);
  useEffect(() => setCalm(readCalm()), []);

  return (
    <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Switch
          id="sg-calm"
          checked={calm}
          onChange={(on) => {
            setCalm(on);
            writeCalm(on);
          }}
        >
          Calm mode
        </Switch>
      </header>

      <div className="grid gap-2">
        <span className="q-label">@quad/ui · live components</span>
        <h1 className="q-display text-[clamp(40px,7vw,72px)]">
          the <span className="q-hl">styleguide.</span>
        </h1>
        <p className="max-w-[60ch] text-muted">
          Source of truth: docs/DESIGN.md. Switch your OS to dark mode and toggle Calm mode to check
          all three looks.
        </p>
      </div>

      <Section title="Color" note="Brights are surfaces with ink text, never text on the page.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLORS.map((c) => (
            <div key={c.token} className="q-card overflow-hidden">
              <div
                className="flex h-20 items-end border-b-2 border-line p-3 font-display text-xl font-extrabold"
                style={{
                  background: `var(--${c.token})`,
                  color:
                    c.token === "grape-strong" || c.token === "danger"
                      ? "#fff"
                      : "var(--on-bright)",
                }}
              >
                {c.token}
              </div>
              <p className="p-3 text-sm text-muted">{c.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="grid gap-3">
          <span className="q-display text-[61px]">say hi to Kyoto</span>
          <span className="text-[39px] font-extrabold leading-tight tracking-[-0.02em]">
            Tonight at the Quad
          </span>
          <span className="font-display text-[25px] font-bold">Ludo · 3/4 seats</span>
          <span>You both hit Connect. Socials unlocked 🎉</span>
          <span className="q-label text-ink">Row C · Seat 07 · 21:00 IST</span>
        </div>
      </Section>

      <Section
        title="Buttons"
        note="Danger and plain are flat on purpose: used in safety and admin flows."
      >
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Start chatting →</Button>
          <Button variant="zest">Play</Button>
          <Button variant="gum">Reserve seat</Button>
          <Button variant="tang">Join table</Button>
          <Button variant="sky">Set reminder</Button>
          <Button>Edit profile</Button>
          <Button variant="ghost">Maybe later</Button>
          <Button variant="plain">Admin action</Button>
          <Button variant="danger">Report and leave</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
        </div>
      </Section>

      <Section title="Chips, stickers, badges">
        <div className="flex flex-wrap items-center gap-4">
          <Chip>🎬 film nerd</Chip>
          <Chip color="zest">♟ chess</Chip>
          <Chip color="sky">🌍 anywhere</Chip>
          <ToggleChip pressed={pressed} onChange={setPressed}>
            toggle me
          </ToggleChip>
          <Sticker color="zest" tilt={6}>
            verified ✦
          </Sticker>
          <Sticker color="gum">18+ only</Sticker>
          <Verified university="Kyoto University" />
        </div>
      </Section>

      <Section title="Tiles">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile color="grape" title="Just Chat" meta="Random 1:1 video + text" soon="beta" />
          <Tile color="zest" title="Quick Play" meta="tic-tac-toe, trivia" />
          <Tile color="tang" title="Tables" meta="Ludo · 3/4" />
          <Tile color="gum" title="Cinema" meta="Friday 21:00 · 38/60 seats" />
          <Tile color="sky" title="Global Hour" meta="starts in 2h 14m" />
          <Tile color="surface" title="Finish your card" meta="Add a few interests" />
        </div>
      </Section>

      <Section title="ID card">
        <div className="grid gap-6 md:grid-cols-2">
          <IdCard
            name="Aisha W."
            university="University of Nairobi"
            countryCode="KE"
            course="Law"
            year={2}
            chips={["debate", "afrobeats"]}
            avatarColor="gum"
            cardNo="#0042"
          />
          <IdCard
            name="Kenji Takahashi-Nakamura"
            university="Kyoto University"
            countryCode="JP"
            course="Computer Science"
            year={3}
            chips={["chess", "ghibli", "space"]}
            avatarColor="sky"
            tint="#EFFFC2"
          />
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid max-w-[520px] gap-5">
          <TextField
            label="College email"
            placeholder="you@university.edu"
            hint="Personal emails like Gmail won't work."
          />
          <TextField
            label="Display name"
            defaultValue="dm me @ insta"
            error="Names can't contain links or handles"
          />
          <OtpInput value={otp} onChange={setOtp} />
        </div>
      </Section>

      <Section title="Notices" note="Plain style: used for errors and safety copy.">
        <div className="grid max-w-[640px] gap-3">
          <Notice title="Report sent">You won't be matched with this person again.</Notice>
          <Notice tone="success">Saved. Your card is updated.</Notice>
          <Notice tone="danger" title="Your account is suspended">
            You can't chat until Friday, 9:00.
          </Notice>
        </div>
      </Section>

      <Section title="Pip and avatars" note="Pip never appears in calls or safety flows.">
        <div className="flex flex-wrap items-center gap-6">
          <Pip size={64} />
          <Pip size={64} mood="wow" />
          <Pip size={64} mood="sleepy" />
          <Pip size={64} className="q-bob" />
          {(["grape", "zest", "tang", "gum", "sky"] as const).map((c) => (
            <Avatar key={c} name={c} color={c} size={44} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-[25px] font-bold">{title}</h2>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}
