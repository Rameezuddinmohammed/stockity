# Campus Chat: Phased Build Plan

Estimates assume **1 full-time developer with AI help**. Double them if you're part-time.
Stack and budget follow `PLAN.md` §9: one VPS + Cloudflare + free tiers.
There is a **go/no-go gate** between phases. Don't start the next phase until the current one passes its gate.

```
Phase 0  Validate + foundation        wk 1–2    ─┐
Phase 1  Identity (sign-up, profiles) wk 3–4     │  core product
Phase 2  Just Chat MVP                wk 5–8     │
Phase 3  Closed beta + Quick Play     wk 9–11   ─┘  ◄── most important gate
Phase 4  Cinema                       wk 12–15
Phase 5  Tables (group games)         wk 16–20
Phase 6  Growth + monetization        month 6+
```

---

## Phase 0: Validate + foundation (weeks 1–2)
**Goal:** get proof of demand before building much, and set up the base everything else runs on.

**Validation (do this first, alongside the setup work)**
- [~] Pick a name, buy the domain (Cloudflare Registrar), set up social handles. **Name: Quad.** Domain and handles still to do
- [x] Landing page: pitch, the four modes, how verification works, safety promise (served by the Next.js app on the VPS instead of Cloudflare Pages)
- [x] Waitlist: students sign up for real now (verified college email + university) and land on a Home that says chat opens at beta. Unknown universities go to the request queue
- [ ] Recruit 3–5 launch campuses: friends, societies, Reddit/Discord, Instagram reels
- [x] Short survey on Home: which mode would you use most, and when are you free (stored as UTC hours). Results chart in Admin → Survey

**Foundation**
- [x] Monorepo (pnpm + Turborepo)
  ```
  apps/web        Next.js + Tailwind (web app + admin panel)
  apps/server     Node/TS: REST API + WebSocket realtime (one process at first)
  packages/shared types, zod schemas, game logic shared by client and server
  packages/ui     design tokens + components (see DESIGN.md)
  infra/          docker-compose (postgres, redis, coturn, caddy), backup scripts
  docs/
  ```
- [x] Docker Compose for local dev: Postgres, Redis (coturn arrives with Phase 2)
- [x] CI with GitHub Actions: lint, typecheck, unit tests on every PR
- [~] Provision the VPS: **deployment kit ready and tested** (Dockerfiles, `infra/docker-compose.prod.yml`, Caddy, daily backups with optional R2 copy, hourly retention cleanup, `docs/DEPLOY.md`). Renting the server is still to do
- [x] Database schema v1 + migrations (Drizzle or Prisma)
- [x] Seed `universities` from `Hipo/university-domains-list` + a disposable-email blocklist
- [x] Draft the ToS, Privacy Policy and Community Guidelines (`/terms`, `/privacy`, `/guidelines`). Placeholders in [BRACKETS] and a lawyer review before launch
- [x] **Design system foundation** (`packages/ui`, see `DESIGN.md`): tokens (light/dark/calm) in CSS variables + Tailwind v4, fonts, core components (Button, Chip, Sticker, Tile, ID card, OTP input, Notice, Switch, Pip), previewed live at `/styleguide`. Radix-based Sheet/Dialog/Toast come in Phase 2 when calls need them
- [x] Landing page built on the design system (it's the first real test of the look)

**Gate → Phase 1:** repo, CI and server are live. The waitlist is growing, with a target of **300+ sign-ups across 3–5 campuses** by the end of Phase 2.

---

## Phase 1: Identity (weeks 3–4)
**Goal:** a verified 18+ student can sign up, build a profile, and log in again.

- [x] Email OTP: request → 6-digit code (hashed, 10-minute expiry, 5 attempts) → session
- [x] Domain allowlist check, including subdomains (`cs.uni.edu`). Reject alumni and disposable domains
- [x] "My university isn't listed" → request queue in the admin panel
- [x] Date of birth + 18+ confirmation. Under 18 is a hard block, and the email is flagged
- [x] Sessions: httpOnly cookie, refresh, log out from all devices
- [x] Profile: display name, university (filled in from the email domain), course/year, about, interests, languages, card color (photo avatars later)
- [x] Socials: stored privately and never shown until both people Connect (Phase 3)
- [x] Accept the Community Guidelines during onboarding
- [x] Rate limits on OTP (per email, IP and domain) via Redis
- [x] Admin panel v0: user list, domain requests, suspend/ban
- [x] Admin can allowlist whole domains or approve single email addresses (with a guard against allowlisting Gmail etc.)
- [x] Emails through Resend (free tier); console output in development
- [x] Tests: OTP flow, domain matching, age gate

**Deferred:** sign-up with a college ID. It means storing ID images, which is legally risky. Add it only if the domain-request queue shows real demand (Phase 6).

**Gate → Phase 2:** 10 test users from different universities can sign up from start to finish on the live site.

---

## Phase 2: Just Chat MVP (weeks 5–8)
**Goal:** safe random 1:1 video and text chat. This is the core of the product.

**Matchmaking and realtime (weeks 5–6)**
- [ ] WebSocket server with a session-authenticated connection, heartbeat, and presence in Redis
- [ ] Queue: join with a mode (video / text-only). Atomic pairing via a Redis Lua script
- [ ] Don't re-match people who met recently, never match people who blocked each other, and don't match anyone already in a call
- [ ] Session lifecycle: matched → connected → ended (by next / end / disconnect / report), logged to `sessions`
- [ ] Live "N students online" counter

**Video and chat (weeks 6–7)**
- [ ] WebRTC connection setup over the WebSocket; coturn issues short-lived credentials
- [ ] `iceTransportPolicy: "relay"` so video always goes through the relay and IP addresses stay hidden. coturn also listens on 443/TLS to get through strict campus Wi-Fi
- [ ] Video capped at ~480p / 500 kbps; mute and camera toggles; text-only mode
- [ ] Text chat next to the video, plus typing indicator
- [ ] Next / End controls; auto-requeue on Next
- [ ] Pre-call screen: camera preview and permissions check, plus a reminder of the guidelines

**Safety (weeks 7–8), required before any real users**
- [ ] Report (with categories): ends the call, blurs video right away, captures a frame and chat excerpt as evidence
- [ ] Block: never matched again
- [ ] NSFWJS runs on the **incoming** video in the browser. Blur when flagged, then log the event to the server
- [ ] Text filter: word list; block links and phone numbers in the first 5 minutes
- [ ] Strikes: warning → 24-hour suspension → 7-day suspension → permanent ban, applied to the account and a device fingerprint
- [ ] Rate limits on how often users can skip and report
- [ ] Admin panel v1: report queue with evidence, one-click actions, user history
- [ ] Evidence is deleted automatically after 30 days; there are no call recordings at all

**Gate → Phase 3:** 20 internal testers do 1 week of daily use. There is no crash-level bug. Reports reach the admin panel within 1 minute. **The chat has to feel safe to women testers. Ask them directly.**

---

## Phase 3: Closed beta + Quick Play (weeks 9–11)
**Goal:** find out whether people come back, using real students. **This is the most important gate.**

- [ ] **Global Hour:** a daily scheduled event, e.g. 1 hour at a time chosen from survey answers. Countdown on the homepage + email reminder
- [ ] **Quick Play inside the chat**, with the server deciding each move:
  - [ ] tic-tac-toe
  - [ ] would-you-rather
  - [ ] trivia (own question bank)
  - [ ] two truths and a lie
  - [ ] (stretch) draw-and-guess
- [ ] **Connect:** once both people accept, socials are revealed and a friends list appears
- [ ] Simple direct messages between connected users (text only)
- [ ] Filters: my country / my university / interests / language. If no match comes quickly, they widen to everyone
- [ ] Analytics (self-hosted Umami or PostHog free tier) and a small metrics page in the admin panel
- [ ] In-app feedback button; weekly calls with beta users
- [ ] Invite the waitlist in waves, one campus at a time

**Metrics gate → Phase 4.** All of these must hold during Global Hour:
| Metric | Target |
|---|---|
| Time to match (median) | < 10 s |
| Chats longer than 2 min | > 30% |
| Share of users back after 7 days | > 20% |
| Female share of active users | > 30% and not falling |
| Reports per 1,000 sessions | falling week over week |
| Connect rate | > 5% of sessions |

**If the gate fails,** don't build Cinema or Tables. Fix what's actually broken: not enough users (more campuses, fewer hours), safety, or getting started (onboarding). Adding features won't rescue a core product that doesn't work.

---

## Phase 4: Cinema (weeks 12–15)
**Goal:** scheduled watch parties that bring people online at the same time.

- [ ] Sync engine: the server holds the reference time; host play/pause/seek goes to everyone; clients correct drift above 0.5 s
- [ ] Sources: YouTube IFrame API, plus HTML5 `<video>` for public-domain and Creative Commons files (Internet Archive, R2)
- [ ] **Allowlist of content sources, checked by an admin.** No uploads of movies nobody has rights to and no screen-sharing, ever
- [ ] Screenings: schedule, capacity, poster. Admins create them first; clubs can host later
- [ ] Seat map + reservation (Redis hold with a time limit → confirmed in Postgres) + reminder email / web push
- [ ] Room text chat with slow mode and filtering; emoji reactions
- [ ] **Row voice/video** (≤4 people, peer-to-peer mesh through coturn, low resolution)
- [ ] Host controls: pause, kick, mute chat
- [ ] Launch program: weekly "Friday Night Cinema" + a call for student/indie film submissions

**Gate → Phase 5:** screenings average > 60% of seats filled, and people who attend come back more than people who don't.

---

## Phase 5: Tables (weeks 16–20)
**Goal:** group social games.

- [ ] Engine: boardgame.io or Colyseus, running inside `apps/server`; game logic in `packages/shared`
- [ ] Lobby: quick-join (show tables that are filling up), create a table (public / friends only), invite people you've connected with
- [ ] Table voice (+ small video tiles for ≤4 players); vote-kick; handling for players who disconnect or go idle
- [ ] Games, in order:
  1. [ ] **Ludo** (public domain, familiar everywhere)
  2. [ ] **Crazy-eights-style card game** (own name and artwork, not "UNO")
  3. [ ] **Mafia/Werewolf** (great for groups)
  4. [ ] **Trivia night** (scheduled, with a host)
  5. [ ] Chess (1v1, `chess.js`), four-in-a-row
- [ ] Game history, simple win stats, rematch

**Gate → Phase 6:** Tables increase time spent per user without lowering Just Chat activity (i.e. they don't split the user base).

---

## Phase 6: Growth + monetization (month 6+)
Pick based on the data. These don't need to be done in order.

- [ ] **Mobile:** start with an installable web app (PWA) for $0, then Expo native apps once app-store safety requirements are fully met
- [ ] **Clubs and events:** societies host screenings and game nights; campus ambassador program
- [ ] **Cosmetics:** card backs, dice and board skins, avatar frames, seat themes. Fixed prices, no loot boxes (Stripe)
- [ ] **Premium:** more filters and connects, private tables and screenings
- [ ] **Business customers:** university international-student buddy programs, study-abroad agencies, sponsored film festivals
- [ ] **Sign-up with a college ID**, via manual review or a KYC vendor once there's budget
- [ ] **Scale:** a second VPS for coturn, self-hosted LiveKit for group video, server-side moderation checks
- [ ] Lawyer review of ToS/Privacy and compliance checks (GDPR, India's DPDP Act, UK Online Safety Act, EU Digital Services Act) before a wider launch

---

## Running every phase
- **Safety is never deferred.** Every new mode ships with report, block, filters, and admin tooling on day one.
- **Weekly review:** metrics, user feedback, the report queue, VPS bandwidth and cost.
- **One mode at a time.** Don't split users across new modes until the current ones feel busy.
- **Delete what you don't need:** ID images, old evidence, inactive data.
