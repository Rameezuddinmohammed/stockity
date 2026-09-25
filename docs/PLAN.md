# Campus Chat: Build Plan

Random 1:1 video and text chat for **verified university students, 18+**, matched globally.
Friendly conversation only. No NSFW content.

---

## 1. Lessons from Omegle

Omegle shut down in 2023 after years of abuse and lawsuits. Anonymous users faced no consequences, and moderation couldn't keep up. This product avoids that by design:

- **Every user is tied to a verified identity.** A ban sticks because it applies to the person (email, ID, and device), not just a session.
- **Safety features ship in the MVP.** Report, block, auto-moderation, and a ban system are part of the first release.
- **Personal info stays private by default.** Socials and full names are shown only when both people choose to connect.

---

## 2. Core user flows

### Onboarding
1. **Sign up with a college email.** The user gets a 6-digit OTP.
   - The email domain is checked against a list of university domains. Seed it from the open-source `Hipo/university-domains-list` and add `.edu`, `.ac.uk`, `.ac.in`, `.edu.au`, and similar.
   - Block disposable-email domains. Watch out for alumni domains (e.g. `alumni.xyz.edu`).
   - Unknown domain: the user can request that it be added, or use the ID path.
2. **Or sign up with a college ID.** Used when the college email doesn't work.
   - Upload photos of the ID (front and back) plus a live selfie.
   - A person reviews it in the admin queue (approve or reject with a reason).
   - Delete the ID images once the review is done. Keep only the result, the university, and the expiry date.
3. **Confirm age (18+).** Collect date of birth and an attestation. Check the DOB against the ID when an ID is available.
   - A college email alone does not prove someone is 18+. Some students start university early. Treat this as a legal requirement.
4. **Set up the profile.** Display name, university (filled in from the email domain), course/year, a short "about", interests (tags), and socials (Instagram, LinkedIn, X, etc.).
5. **Accept the community guidelines.** Short and clear, with a checkbox.
6. **Re-verify every year.** Students graduate. Re-send the OTP, or honour the expiry date on the ID.

### Matching and chat
- Choose **video + text** (the default) or **text only**.
- Optional filters: anywhere / my country / my university; interests; language.
- Press **Start**. The user joins the queue, gets a match, and the call connects. Video and text chat run side by side.
- **Next** skips to a new match. **Report** ends the call and blurs the video right away. **Block** means the two users are never matched again.
- **Connect**: if both people press it, each can see the other's socials and they can message later. Otherwise the chat stays ephemeral.

---

## 3. Architecture

```
 ┌──────────────┐    HTTPS/REST     ┌──────────────────────┐
 │  Web app     │ ────────────────► │  API (Node/TS)       │──► Postgres
 │  (Next.js)   │                   │  auth, profiles,     │──► Object storage (ID uploads, encrypted)
 │  later:      │ ◄──── WebSocket ─►│  reports, admin      │──► Email (OTP)
 │  Expo mobile │                   ├──────────────────────┤
 └──────┬───────┘                   │  Realtime service    │──► Redis (queue, presence,
        │                           │  matchmaking + chat  │          rate limits, recent pairs)
        │  WebRTC media             └──────────┬───────────┘
        ▼                                      │ issues room tokens
 ┌──────────────┐                              ▼
 │  SFU (LiveKit)│◄───────────────── moderation workers (frame + text checks)
 └──────────────┘
```

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js + TypeScript + Tailwind** | Web first: WebRTC works in any browser with no app-store review. Mobile comes later with Expo, reusing the same logic. |
| API | **Node.js + TypeScript (Fastify or NestJS)** | One language across the whole codebase. |
| Realtime | **WebSocket (Socket.IO or ws) + Redis** | Handles the matchmaking queue, presence, text chat, and call signalling. |
| DB | **PostgreSQL** (Supabase or Neon to start) + **Prisma/Drizzle** | Data is relational: users, reports, bans, connections. |
| Video | **LiveKit (Cloud to start, can self-host later)** | See below. |
| Auth | Own OTP flow + JWT/session cookies (or Supabase Auth with a custom email check) | The domain allowlist and ID-approval logic are custom either way. |
| Email | Resend / Postmark / AWS SES | Sends OTP emails. |
| Moderation | Client-side NSFW model + server-side frame sampling (Hive / Sightengine / AWS Rekognition) + text moderation API | Layered checks, covered in section 5. |
| Hosting | Vercel (web) + Fly.io/Railway/AWS (API + realtime) + Upstash/managed Redis | Cheap to start and easy to scale. |

### Why an SFU instead of pure peer-to-peer WebRTC?
With pure P2P, **each user sees the other's IP address**. That is a real risk on a platform where strangers meet. It also makes server-side moderation hard.
Routing media through an SFU (or a TURN server in relay-only mode) hides IPs. It also lets moderation workers sample frames.
Cost: you pay for bandwidth (a 1:1 call at ~720p is roughly 1–2 Mbps each way). This will be your largest variable cost, so cap resolution and bitrate.

Cheaper MVP option: P2P with `iceTransportPolicy: "relay"` through your own coturn server. It still hides IPs, but moderation has to happen on the client.

---

## 4. Data model (first draft)

```
users            id, email, email_domain, university_id, dob, status(pending|active|suspended|banned),
                 verification_method(email|id), verified_at, verification_expires_at, created_at
universities     id, name, country, domains[]
profiles         user_id, display_name, about, course, year, interests[], avatar_url, languages[]
socials          user_id, platform, handle            -- visible only to mutual connections
id_verifications id, user_id, status, reviewer_id, reason, submitted_at, reviewed_at  (images deleted post-review)
sessions         id, user_a, user_b, mode(video|text), started_at, ended_at, ended_by, end_reason
reports          id, session_id, reporter_id, reported_id, category, note, evidence_ref, status, action_taken
blocks           blocker_id, blocked_id
connections      user_a, user_b, status(pending|mutual), created_at
bans             user_id, reason, until, device_fingerprints[], created_by
```

Redis:
- `queue:{mode}:{bucket}`: users waiting to be matched
- `recent:{user}`: people this user met recently, so they aren't re-matched right away
- `presence:{user}`: online status
- rate-limit counters

### Matchmaking (v1)
1. A user joins the queue with their filters.
2. Every ~200 ms, or when someone new joins, find a waiting user whose filters are compatible and who isn't blocked, recently skipped, or already in a call.
3. Take both users out of the queue in one atomic step (Lua script / `MULTI`), create the session, issue LiveKit room tokens, and notify both clients.
4. If no match is found within N seconds, relax the filters (my university → my country → global).
Start with a simple queue. Add weighting by interests and language later.

---

## 5. Trust and safety (MVP scope)

| Layer | What |
|---|---|
| Identity | Verified email or ID. One account per person. Device fingerprinting to catch ban evasion. |
| Client-side | A lightweight NSFW model (e.g. NSFWJS) runs on the **incoming** video. If it flags a frame, that video is blurred and the event is logged. Optional: require a face in frame before the call connects. |
| Server-side | Sample a frame every few seconds and send it to a moderation API. Several high-confidence hits suspend the account automatically. |
| Text | Run messages through a moderation API. Filter slurs and block phone numbers and links in the first minutes of a chat. |
| Reports | One tap. The reported video blurs and the call ends. The report goes into the admin queue along with the frames captured at report time. |
| Enforcement | Strike system: warning → temporary ban → permanent ban tied to identity and device. |
| Rate limits | Cap on how often a user can skip and how many reports they can file. Stops harassment and abuse of the report button. |
| Admin panel | ID approval queue, report queue, user lookup, ban/unban, domain allowlist editor. |
| Retention | No call recordings. Chat logs are ephemeral; keep them for a short window only when a report is filed. |

### Legal checklist (do before public launch)
- Terms of Service, Privacy Policy, Community Guidelines.
- Age assurance: a documented 18+ policy and how it is enforced.
- Data protection: GDPR (EU/UK), DPDP Act (India), CCPA. Plan to store ID images for as short a time as possible.
- Online safety laws: UK Online Safety Act, EU Digital Services Act. Both require risk assessments and reporting mechanisms.
- CSAM: be ready to report to NCMEC (US) or the local equivalent. The 18+ gate lowers this risk but does not remove the obligation.
- Talk to a lawyer before launching in multiple countries.

---

## 6. Phased roadmap

See **[`ROADMAP.md`](ROADMAP.md)** for the full phased build plan with gates.

---

## 7. Biggest risks

1. **Not enough users (the cold-start problem).** Random chat only works if a match comes within a few seconds. Launch at a few campuses at a time, run scheduled peak hours, and show a live count of people online.
2. **Abuse and moderation.** This is what killed Omegle. Verified identity is your advantage, so enforce it strictly.
3. **Video bandwidth costs.** Cap bitrate, drop video quality when someone is idle, and track cost per minute of chat.
4. **Human review of IDs doesn't scale.** Start with manual review, then move to a KYC vendor (e.g. Persona, Veriff, Onfido) once volume grows.
5. **Privacy.** ID images and minors' data are high-liability. Keep as little as possible and encrypt everything.

---

## 8. Open decisions
- Product name and domain.
- Web first (recommended) or mobile first?
- LiveKit Cloud (faster to ship) or self-hosted SFU/coturn (cheaper at scale)?
- Budget for moderation APIs and a KYC vendor.
- Launch region: which universities go first?

---

## 9. Zero-budget version (domain + one server only)

The goal is to pay only for a domain (~$10–15/year) and one small server (~$0–6/month). Everything else runs on free tiers or free open-source tools.
**Free-tier limits change often. Check each provider's current pricing page before relying on it.**

| Need | Paid choice (above) | Free / near-free choice |
|---|---|---|
| Video | LiveKit Cloud | Direct browser-to-browser WebRTC + your own **coturn** relay server on the VPS |
| API + realtime + Redis + Postgres | Separate managed services | **All on one VPS** with Docker Compose (Oracle Cloud Always Free ARM VM, or Hetzner at ~€4–6/mo with lots of included traffic) |
| Web frontend | Vercel | **Cloudflare Pages** (free, allows commercial use; Vercel's free Hobby plan is non-commercial only) |
| OTP email | Postmark/SES | **Resend** or **Brevo** free tier (a few thousand emails/month is plenty at launch) |
| ID image storage | S3 | **Cloudflare R2** free tier, or local disk on the VPS; images are deleted after review anyway |
| NSFW video detection | Hive/Sightengine | **NSFWJS** running in the browser (free) + reports |
| Text moderation | Paid API | Word-list filter + block links/phone numbers early in a chat (+ OpenAI's moderation endpoint if it's still free for API users) |
| ID verification | KYC vendor | **Manual review by you** in the admin panel. Or skip ID sign-up at launch and allow college email only |
| DNS / SSL / DDoS protection | n/a | **Cloudflare** free plan + Caddy (automatic HTTPS) |

### Key trade-offs
- **Video bandwidth is the real cost.** Relaying video through your server protects IPs but uses your bandwidth. At ~500 kbps per direction (480p, which is fine for casual chat), one hour of relayed call ≈ 0.5–1 GB of server traffic. A server with 10–20 TB/month of included traffic covers roughly 10,000+ call-hours.
- **While small:** force all video through the relay (`iceTransportPolicy: "relay"`). That hides IPs, and you have bandwidth to spare.
- **If you outgrow it:** switch to direct connections first, with the relay only as a fallback. This cuts relay traffic by ~80%, but users can see each other's IP (usually the campus or ISP network, not a home address). Or add a second cheap server.
- **University Wi-Fi often blocks direct connections**, so you need your own relay (TURN) server either way. Run coturn on port 443 over TLS so calls get through strict firewalls.
- **No server-side frame scanning:** moderation relies on the in-browser NSFW detector, one-tap reports, and verified identity. That's acceptable at small scale.
- **One server = a single point of failure.** Take daily `pg_dump` backups to R2 or free object storage.

### Minimal setup
```
Cloudflare (DNS, proxy, Pages → Next.js static/SPA frontend)
        │
        ▼
One VPS (Docker Compose)
  ├─ Caddy          (HTTPS, reverse proxy)
  ├─ api + realtime (Node/TS, one process at first)
  ├─ postgres
  ├─ redis
  └─ coturn         (TURN relay, ports 3478 + 443/TLS)
```

### Things that are free but cost your time
- Reviewing ID submissions and reports yourself.
- Writing ToS/Privacy Policy (use free generators and plain language; still get a lawyer's review before a big launch).
- Growth: campus ambassadors, Reddit/Discord communities, Instagram reels, scheduled "global hour" events.

---

## 10. Activities: technical plan (games & cinema)

See `BUSINESS.md` §4–5 for why these exist and for the legal limits.

### Game engine (Quick Play + Tables)
- **The server decides the game state.** The game state lives on the realtime server, and dice rolls and card shuffles are done there, so players can't cheat. Clients only send moves; the server checks each move and broadcasts the new state over the same WebSocket.
- **Library:** `boardgame.io` (MIT; turn-based, lobbies, and turn/phase handling built in) or `Colyseus` (MIT; room-based multiplayer). Either runs on the single VPS.
- **Only turn-based games.** They're cheap to run, and lag doesn't matter.
- Quick Play games run inside the existing chat session. Game state is attached to the session.
- Table data: `tables (id, game, host_id, max_players, visibility(public|friends), status)`, `table_players`.
- Starting games: tic-tac-toe, four-in-a-row, chess (use `chess.js`), trivia (your own question bank), would-you-rather, two truths and a lie, draw-and-guess (canvas strokes sent over WebSocket), Ludo, a crazy-eights-style card game (own name and artwork), Mafia/Werewolf.

### Group audio/video in Tables
- ≤4 players: peer-to-peer mesh through your coturn relay, voice first, with small low-resolution video tiles (e.g. 160–240p at ~150 kbps).
- 5–6 players: voice only. Or add a self-hosted LiveKit SFU once there's budget.

### Cinema
- **Playback sync, not streaming:** each viewer plays the video themselves (YouTube IFrame API, or an HTML5 `<video>` for public-domain or Creative Commons files hosted on Internet Archive or R2). The server only sends play/pause/seek commands and a reference clock. Each client corrects drift above ~0.5 seconds. **No movie ever passes through your server.**
- **Legal content only:** YouTube embeds, public-domain films, Creative Commons films, and films submitted by student or indie filmmakers with permission. Never screen-share or re-stream movies you don't have rights to.
- **Rooms:** scheduled `screenings (id, title, source_type, source_ref, starts_at, capacity, host_id)`, `seats (screening_id, seat_no, user_id)` with a seat map, and reservations held in Redis with a TTL and then confirmed in Postgres.
- **Social layer:** text chat and emoji reactions for the whole room (rate-limited and filtered). Optional voice/video with your **row** (≤4 people, peer-to-peer mesh). Host controls: pause, kick, slow mode.
