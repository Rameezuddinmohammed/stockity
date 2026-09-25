import { buttonClass, IdCard, Logo, Sticker, Tile } from "@quad/ui";
import Link from "next/link";
import { LandingNav } from "./landing-nav";

const MODES = [
  {
    color: "grape",
    title: "Just Chat",
    meta: "Random 1:1 video and text with a verified student.",
  },
  {
    color: "zest",
    title: "Quick Play",
    meta: "Icebreaker games inside your chat: trivia, would-you-rather.",
  },
  { color: "tang", title: "Tables", meta: "Ludo, cards and Mafia with 2–6 students." },
  { color: "gum", title: "Cinema", meta: "Reserve a seat for a watch party. Your row gets voice." },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Enter your college email",
    body: "We recognize 10,000+ universities by their email domain.",
  },
  {
    n: "2",
    title: "Type the 6-digit code",
    body: "Proves the inbox is yours. No passwords to remember.",
  },
  {
    n: "3",
    title: "Confirm you're 18+",
    body: "Your birthday is only used for the age check and never shown.",
  },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16">
      <LandingNav />

      <section className="grid items-center gap-10 py-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-5">
          <span className="q-label">Verified university students · 18+ · worldwide</span>
          <h1 className="q-display text-[clamp(44px,7.4vw,84px)]">
            meet students from <span className="q-hl">everywhere.</span>
          </h1>
          <p className="max-w-[56ch] text-[17px] text-muted">
            Video chat, games and watch parties with real students from real universities. Everyone
            is verified with their college email, so bans stick and people behave.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/join" className={buttonClass("primary")}>
              Get in with your college email →
            </Link>
            <Link href="/guidelines" className={buttonClass("ghost")}>
              Read the guidelines
            </Link>
          </div>
        </div>

        <div
          className="relative h-[340px] overflow-x-clip"
          role="img"
          aria-label="Example student ID cards"
        >
          <IdCard
            className="q-float !absolute left-[2%] top-0 w-[76%] rotate-[-7deg] sm:left-[6%] sm:w-[82%]"
            tint="#FFE7F2"
            name="Aisha W."
            university="University of Nairobi"
            countryCode="KE"
            course="Law"
            year={2}
            chips={["debate", "afrobeats"]}
            avatarColor="gum"
          />
          <IdCard
            className="!absolute left-[16%] top-[70px] w-[74%] rotate-[4deg] sm:left-[18%] sm:w-[78%]"
            tint="#EFFFC2"
            name="Kenji T."
            university="Kyoto University"
            countryCode="JP"
            course="CS"
            year={3}
            chips={["chess", "ghibli"]}
            avatarColor="sky"
          />
          <IdCard
            className="!absolute left-[4%] top-[160px] w-[76%] rotate-[-2deg] sm:left-[8%] sm:w-[80%]"
            name="Riya S."
            university="IIT Bombay"
            countryCode="IN"
            course="Design"
            year={1}
            chips={["ludo", "film nerd"]}
            avatarColor="zest"
          />
          <Sticker color="zest" tilt={8} className="absolute right-[4%] top-[-6px]">
            verified ✦
          </Sticker>
          <Sticker color="gum" tilt={-6} className="absolute bottom-[18px] right-[2%]">
            18+ only
          </Sticker>
        </div>
      </section>

      <section className="grid gap-6 pt-14">
        <div className="grid gap-2">
          <span className="q-label">What you can do</span>
          <h2 className="text-[clamp(28px,4vw,39px)] font-extrabold tracking-[-0.02em]">
            One lounge, four ways to hang out
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <Tile key={m.title} color={m.color} title={m.title} meta={m.meta} soon="beta" />
          ))}
        </div>
      </section>

      <section className="grid gap-6 pt-14">
        <div className="grid gap-2">
          <span className="q-label">How getting in works</span>
          <h2 className="text-[clamp(28px,4vw,39px)] font-extrabold tracking-[-0.02em]">
            Three steps, under a minute
          </h2>
        </div>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="q-card grid gap-2 p-5">
              <span className="font-mono text-sm font-semibold text-grape-text">STEP {s.n}</span>
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 pt-14 md:grid-cols-[0.9fr_1.1fr]">
        <div className="grid content-start gap-2">
          <span className="q-label">Safety</span>
          <h2 className="text-[clamp(28px,4vw,39px)] font-extrabold tracking-[-0.02em]">
            Built so bad actors don't come back
          </h2>
        </div>
        <ul className="grid gap-3 rounded-[24px] border border-hairline bg-surface p-5 text-[15px]">
          <li>
            Every account is tied to a verified university email. A ban applies to the person, not
            just a session.
          </li>
          <li>
            Report is one tap and always on screen. The other person's video blurs straight away.
          </li>
          <li>
            Quad is for students 18 and over. Under-18 sign-ups are deleted and the email is
            blocked.
          </li>
          <li>
            Moderation won't catch everything instantly, so don't share personal details early in a
            chat.
          </li>
        </ul>
      </section>

      <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t-2 border-line pt-5 text-sm text-muted">
        <Logo size={26} />
        <nav className="flex flex-wrap gap-5">
          <Link href="/guidelines">Guidelines</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/join">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
