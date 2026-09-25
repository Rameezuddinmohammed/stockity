# Quad

Video chat, games and watch parties for **verified university students, 18+**, worldwide.
Sign-in is by college email (6-digit code); every account is tied to a real university, so bans stick.

Planning docs live in [`docs/`](docs):
[PLAN](docs/PLAN.md) · [ROADMAP](docs/ROADMAP.md) · [BUSINESS](docs/BUSINESS.md) · [DESIGN](docs/DESIGN.md) · [DEPLOY](docs/DEPLOY.md) · [design preview](docs/design/preview.html)

## What's built (Phase 0 + Phase 1)

- College-email sign-in with one-time codes, matched against 10,000+ university domains (subdomains included), with alumni and disposable emails rejected
- "My university isn't listed" requests, reviewed by admins
- 18+ gate: under-18 accounts are deleted and the email is blocked (stored only as a hash)
- Onboarding (name, date of birth, the three-rule "vibe check"), profile card editor, private socials
- Sessions in httpOnly cookies with sign-out-everywhere; CSRF origin check; Redis rate limits
- Admin panel: university requests, allowlisted domains, individually approved emails, user search, suspend/ban/reinstate, survey results, with an audit log
- Demand survey on Home (which modes, when people are free) to pick what launches first and when Global Hour runs
- Draft [Terms](apps/web/content/legal/terms.md) and [Privacy Policy](apps/web/content/legal/privacy.md) at `/terms` and `/privacy`, plus an hourly retention cleanup that enforces the policy's deletion periods
- The Quad design system (`packages/ui`) implementing [DESIGN.md](docs/DESIGN.md), previewed at `/styleguide`
- Production deployment kit: Dockerfiles, Caddy, daily backups ([DEPLOY.md](docs/DEPLOY.md))

## Stack

| | |
|---|---|
| `apps/web` | Next.js 16 (App Router) + Tailwind v4 |
| `apps/server` | Fastify 5, Drizzle ORM, Postgres 16, Redis 7 |
| `packages/ui` | Design tokens + React components |
| `packages/shared` | Zod schemas, constants and API types used by both apps |
| Tooling | pnpm workspaces, Turborepo, Biome, Vitest, GitHub Actions |

## Getting started

Requires Node 22+, pnpm 10, and Docker (or local Postgres 16 + Redis 7).

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d   # Postgres (quad + quad_test DBs) and Redis
cp .env.example .env                                # then set APP_SECRET and ADMIN_EMAILS
pnpm db:migrate
pnpm db:seed                                        # ~10k universities from Hipo/university-domains-list
pnpm dev                                            # web on :3000, API on :4000
```

With `MAIL_PROVIDER=console` (the default), sign-in codes are printed in the API log.
Add your own college email to `ADMIN_EMAILS` to get the admin panel at `/admin`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + API with hot reload |
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm test` | Unit + integration tests (needs Postgres + Redis; uses the `quad_test` DB and Redis db 15) |
| `pnpm build` | Production builds |
| `pnpm --filter @quad/server db:generate` | Create a migration after editing `apps/server/src/db/schema.ts` |

## How requests flow

The browser only talks to its own origin: Next.js rewrites `/api/*` to the Fastify server (in production, Caddy does the same). That keeps the session cookie first-party and `SameSite=Lax`, and the server also rejects writes whose `Origin` isn't `APP_ORIGIN`.
