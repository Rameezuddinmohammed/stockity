import { readFileSync } from "node:fs";
import { Redis } from "ioredis";
import { buildApp } from "../src/app";
import { SESSION_COOKIE } from "../src/auth";
import { loadConfig } from "../src/config";
import { createDb } from "../src/db/client";
import { createMemoryMailer } from "../src/lib/mailer";
import { type HipoUniversity, seedUniversities } from "../src/lib/seed";
import { TEST_DATABASE_URL, TEST_REDIS_URL } from "./env";

export const ORIGIN = "http://localhost:3000";
const fixture: HipoUniversity[] = JSON.parse(
  readFileSync(new URL("../data/fixtures/universities.sample.json", import.meta.url), "utf8"),
);

export async function createHarness() {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
    APP_SECRET: "test-secret-0123456789abcdef",
    APP_ORIGIN: ORIGIN,
    ADMIN_EMAILS: "admin@mit.edu",
  });
  const { db, client } = createDb(TEST_DATABASE_URL);
  const redis = new Redis(TEST_REDIS_URL);
  const mailer = createMemoryMailer();
  let clock = new Date("2026-09-25T12:00:00Z");
  const ctx = { config, db, redis, mailer, now: () => clock };
  const app = await buildApp(ctx);

  let wsUrl = "";
  const clients: { close(): Promise<number> }[] = [];

  const h = {
    app,
    /** Starts listening on a random port (needed for WebSocket tests). */
    async listen() {
      if (!wsUrl) {
        await app.listen({ port: 0, host: "127.0.0.1" });
        const addr = app.server.address();
        if (!addr || typeof addr === "string") throw new Error("no address");
        wsUrl = `ws://127.0.0.1:${addr.port}/api/ws`;
      }
      return wsUrl;
    },
    track<T extends { close(): Promise<number> }>(client: T): T {
      clients.push(client);
      return client;
    },
    ctx,
    mailer,
    advance(ms: number) {
      clock = new Date(clock.getTime() + ms);
    },
    async reset() {
      await Promise.all(clients.splice(0).map((c) => c.close().catch(() => 0)));
      await client.unsafe(
        "TRUNCATE report_evidence, reports, moderation_events, user_notices, user_devices, banned_devices, blocks, calls, survey_responses, approved_emails, admin_actions, domain_requests, blocked_emails, sessions, otp_codes, socials, profiles, users, university_domains, universities CASCADE",
      );
      await redis.flushdb();
      await seedUniversities(db, fixture);
      mailer.sent.length = 0;
      clock = new Date("2026-09-25T12:00:00Z");
    },
    async close() {
      await app.close();
      await client.end();
      redis.disconnect();
    },
    post(url: string, body?: unknown, cookie?: string) {
      return app.inject({
        method: "POST",
        url,
        headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { payload: body as object }),
      });
    },
    patch(url: string, body: unknown, cookie?: string) {
      return app.inject({
        method: "PATCH",
        url,
        headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
        payload: body as object,
      });
    },
    put(url: string, body: unknown, cookie?: string) {
      return app.inject({
        method: "PUT",
        url,
        headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
        payload: body as object,
      });
    },
    del(url: string, cookie?: string) {
      return app.inject({
        method: "DELETE",
        url,
        headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      });
    },
    get(url: string, cookie?: string) {
      return app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });
    },
    lastCode(): string {
      const mail = mailer.sent.at(-1);
      const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
      if (!code) throw new Error("no code mailed");
      return code;
    },
    /** Request + verify a code; returns the session cookie header. */
    async signIn(email: string): Promise<string> {
      const req = await h.post("/api/auth/otp/request", { email });
      if (req.statusCode !== 200) throw new Error(`otp request failed: ${req.body}`);
      const res = await h.post("/api/auth/otp/verify", { email, code: h.lastCode() });
      if (res.statusCode !== 200) throw new Error(`otp verify failed: ${res.body}`);
      const c = res.cookies.find((c) => c.name === SESSION_COOKIE);
      if (!c) throw new Error("no session cookie");
      return `${SESSION_COOKIE}=${c.value}`;
    },
    async signUp(email: string, displayName = "Riya S.", dob = "2005-04-12"): Promise<string> {
      const cookie = await h.signIn(email);
      const res = await h.post(
        "/api/onboarding",
        { displayName, dob, acceptGuidelines: true },
        cookie,
      );
      if (res.statusCode !== 200) throw new Error(`onboarding failed: ${res.body}`);
      return cookie;
    },
  };
  return h;
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;
