import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Ctx } from "./context";
import { sessions, users } from "./db/schema";
import { randomToken, sha256 } from "./lib/crypto";
import { AppError } from "./lib/errors";

export const SESSION_COOKIE = "quad_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_MS = 60 * 60 * 1000;

export type AuthUser = typeof users.$inferSelect;
export type Auth = { user: AuthUser; sessionId: string };

declare module "fastify" {
  interface FastifyRequest {
    auth: Auth | null;
  }
}

function cookieOptions(ctx: Ctx, expires: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure whenever the site is served over HTTPS (lets a server be tested by IP before DNS).
    secure: ctx.config.APP_ORIGIN.startsWith("https://"),
    expires,
  };
}

export async function startSession(
  ctx: Ctx,
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
) {
  const token = randomToken();
  const expiresAt = new Date(ctx.now().getTime() + SESSION_TTL_MS);
  await ctx.db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
    ip: req.ip,
  });
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(ctx, expiresAt));
}

export function clearSessionCookie(ctx: Ctx, reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { ...cookieOptions(ctx, new Date(0)), expires: undefined });
}

/** Resolves the session cookie into `req.auth` on every request. */
export function registerAuth(app: FastifyInstance, ctx: Ctx) {
  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const now = ctx.now();
    const [row] = await ctx.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)));
    if (!row) return;
    let { user } = row;

    // Suspensions lift themselves once they run out.
    if (user.status === "suspended" && user.suspendedUntil && user.suspendedUntil <= now) {
      const [lifted] = await ctx.db
        .update(users)
        .set({ status: "active", suspendedUntil: null, statusReason: null, updatedAt: now })
        .where(eq(users.id, user.id))
        .returning();
      if (lifted) user = lifted;
    }

    // Sliding expiry, written at most once an hour.
    if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await ctx.db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt })
        .where(eq(sessions.id, row.session.id));
      await ctx.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, user.id));
    }
    req.auth = { user, sessionId: row.session.id };
  });
}

export function requireUser(req: FastifyRequest): Auth {
  if (!req.auth) throw new AppError(401, "UNAUTHENTICATED", "Please sign in.");
  if (req.auth.user.status === "banned") {
    throw new AppError(403, "BANNED", "This account has been banned.");
  }
  return req.auth;
}

/** Signed in, onboarded and not suspended. */
export function requireActive(req: FastifyRequest): Auth {
  const auth = requireUser(req);
  const { status, suspendedUntil } = auth.user;
  if (status === "onboarding") {
    throw new AppError(403, "ONBOARDING_REQUIRED", "Finish setting up your account first.");
  }
  if (status === "suspended") {
    throw new AppError(403, "SUSPENDED", "Your account is suspended for now.", {
      until: suspendedUntil?.toISOString() ?? null,
    });
  }
  return auth;
}

export function requireAdmin(req: FastifyRequest): Auth {
  const auth = requireActive(req);
  if (auth.user.role !== "admin") throw new AppError(403, "FORBIDDEN", "Admins only.");
  return auth;
}
