# Quad

Monorepo: `apps/web` (Next.js 16 + Tailwind v4), `apps/server` (Fastify 5 + Drizzle + Postgres + Redis),
`packages/ui` (design system), `packages/shared` (zod schemas, constants, API types).

## Commands
- `pnpm lint` (Biome), `pnpm typecheck`, `pnpm test`, `pnpm build`. Run all four before pushing.
- Server tests need Postgres + Redis; they use `TEST_DATABASE_URL` (default `postgres://quad:quad@localhost:5432/quad_test`) and `TEST_REDIS_URL` (default `redis://localhost:6379/15`).
- After editing `apps/server/src/db/schema.ts`: `pnpm --filter @quad/server db:generate`, commit the SQL in `apps/server/drizzle/`.

## Conventions
- Validate request bodies with schemas from `@quad/shared` via `parse()`; throw `AppError(status, code, message)`. Error codes live in `packages/shared/src/constants.ts`.
- New routes get integration tests in `apps/server/test/` using the harness (`createHarness()`), which gives a controllable clock via `h.advance(ms)`.
- UI follows `docs/DESIGN.md`: use `@quad/ui` components and tokens, never raw hex in app code. Safety flows (reports, bans, age, account deletion) use the plain style: no stickers, tilt or mascot.
- No fake numbers in the UI (online counts etc.); only real data from the API.
