import {
  type Me,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  type OtpRequestResponse,
  type OtpVerifyResponse,
  otpRequestSchema,
  otpVerifySchema,
  VERIFICATION_VALID_DAYS,
} from "@quad/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { clearSessionCookie, requireUser, startSession } from "../auth";
import type { Ctx } from "../context";
import { blockedEmails, otpCodes, sessions, users } from "../db/schema";
import { generateOtp, hmac, safeEqualHex } from "../lib/crypto";
import { canonicalEmail, isAlumniDomain, isDisposableDomain, splitEmail } from "../lib/email";
import { AppError, parse } from "../lib/errors";
import { otpMail } from "../lib/mailer";
import { cooldown, enforce } from "../lib/rate-limit";
import { findUniversityForDomain, loadMe } from "../lib/users";

const MAX_OTP_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export const blockedHash = (ctx: Ctx, canonical: string) =>
  hmac(ctx.config.APP_SECRET, `blocked:${canonical}`);

async function assertEmailAllowed(ctx: Ctx, canonical: string) {
  const [blocked] = await ctx.db
    .select({ reason: blockedEmails.reason })
    .from(blockedEmails)
    .where(eq(blockedEmails.emailHash, blockedHash(ctx, canonical)));
  if (blocked) throw new AppError(403, "EMAIL_BLOCKED", "This email can't be used on Quad.");
  const [user] = await ctx.db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.emailCanonical, canonical));
  if (user?.status === "banned") {
    throw new AppError(403, "BANNED", "This account has been banned from Quad.");
  }
}

export function authRoutes(app: FastifyInstance, ctx: Ctx) {
  app.post("/api/auth/otp/request", async (req): Promise<OtpRequestResponse> => {
    const { email } = parse(otpRequestSchema, req.body);
    const canonical = canonicalEmail(email);
    const { domain } = splitEmail(canonical);

    await enforce(ctx.redis, { key: `otp:ip:${req.ip}`, max: 20, windowSeconds: 3600 });
    await enforce(ctx.redis, { key: `otp:email:${canonical}`, max: 6, windowSeconds: 3600 });

    if (isAlumniDomain(domain)) {
      throw new AppError(
        400,
        "ALUMNI_EMAIL",
        "Alumni emails can't be used. Quad is for current students.",
      );
    }
    if (isDisposableDomain(domain)) {
      throw new AppError(400, "DISPOSABLE_EMAIL", "Use your college email, not a temporary one.");
    }
    await assertEmailAllowed(ctx, canonical);

    const university = await findUniversityForDomain(ctx.db, domain);
    if (!university) {
      throw new AppError(404, "UNKNOWN_DOMAIN", "We don't know this university email yet.", {
        domain,
      });
    }

    // Stops one university's inbox from being flooded by a script.
    await enforce(ctx.redis, { key: `otp:domain:${domain}`, max: 500, windowSeconds: 3600 });
    await cooldown(ctx.redis, `otp:${canonical}`, OTP_RESEND_SECONDS);

    const code = generateOtp();
    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(otpCodes)
        .set({ consumedAt: now })
        .where(and(eq(otpCodes.emailCanonical, canonical), isNull(otpCodes.consumedAt)));
      await tx.insert(otpCodes).values({
        emailCanonical: canonical,
        codeHash: hmac(ctx.config.APP_SECRET, `${canonical}:${code}`),
        expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
      });
    });
    await ctx.mailer.send(otpMail(email, code, OTP_TTL_MINUTES));
    return { ok: true, university, resendInSeconds: OTP_RESEND_SECONDS };
  });

  app.post("/api/auth/otp/verify", async (req, reply): Promise<OtpVerifyResponse> => {
    const { email, code } = parse(otpVerifySchema, req.body);
    const canonical = canonicalEmail(email);
    await enforce(ctx.redis, { key: `verify:ip:${req.ip}`, max: 60, windowSeconds: 900 });
    await enforce(ctx.redis, { key: `verify:email:${canonical}`, max: 15, windowSeconds: 900 });

    const now = ctx.now();
    const [otp] = await ctx.db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.emailCanonical, canonical), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (!otp) {
      throw new AppError(400, "OTP_INVALID", "That code isn't right. Request a new one.");
    }
    if (otp.expiresAt <= now) {
      throw new AppError(400, "OTP_EXPIRED", "That code has expired. Request a new one.");
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      throw new AppError(429, "OTP_TOO_MANY_ATTEMPTS", "Too many wrong tries. Request a new code.");
    }
    await ctx.db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, otp.id));

    const expected = hmac(ctx.config.APP_SECRET, `${canonical}:${code}`);
    if (!safeEqualHex(expected, otp.codeHash)) {
      const left = MAX_OTP_ATTEMPTS - otp.attempts - 1;
      throw new AppError(
        400,
        "OTP_INVALID",
        left > 0 ? `That code isn't right. ${left} tries left.` : "That code isn't right.",
        { attemptsLeft: Math.max(left, 0) },
      );
    }
    const consumed = await ctx.db
      .update(otpCodes)
      .set({ consumedAt: now })
      .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });
    if (consumed.length === 0) {
      throw new AppError(400, "OTP_INVALID", "That code was already used. Request a new one.");
    }

    await assertEmailAllowed(ctx, canonical);
    const isAdmin = ctx.config.ADMIN_EMAILS.includes(canonical);
    const verification = {
      verifiedAt: now,
      verificationExpiresAt: new Date(now.getTime() + VERIFICATION_VALID_DAYS * DAY_MS),
      updatedAt: now,
    };

    let [user] = await ctx.db.select().from(users).where(eq(users.emailCanonical, canonical));
    if (user) {
      [user] = await ctx.db
        .update(users)
        .set({ ...verification, ...(isAdmin ? { role: "admin" as const } : {}) })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      const university = await findUniversityForDomain(ctx.db, splitEmail(canonical).domain);
      if (!university) {
        throw new AppError(404, "UNKNOWN_DOMAIN", "We don't know this university email yet.");
      }
      [user] = await ctx.db
        .insert(users)
        .values({
          email,
          emailCanonical: canonical,
          universityId: university.id,
          role: isAdmin ? "admin" : "user",
          ...verification,
        })
        .returning();
    }
    if (!user) throw new AppError(500, "INTERNAL", "Couldn't sign you in. Try again.");

    await startSession(ctx, req, reply, user.id);
    return { me: await loadMe(ctx.db, user.id), needsOnboarding: user.status === "onboarding" };
  });

  /** Like GET /api/me but answers 200 when signed out, so the web app can check quietly. */
  app.get("/api/auth/session", async (req): Promise<{ me: Me | null }> => {
    if (!req.auth || req.auth.user.status === "banned") return { me: null };
    return { me: await loadMe(ctx.db, req.auth.user.id) };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    if (req.auth) await ctx.db.delete(sessions).where(eq(sessions.id, req.auth.sessionId));
    clearSessionCookie(ctx, reply);
    return { ok: true };
  });

  app.post("/api/auth/logout-all", async (req, reply) => {
    const { user } = requireUser(req);
    await ctx.db.delete(sessions).where(eq(sessions.userId, user.id));
    clearSessionCookie(ctx, reply);
    return { ok: true };
  });
}
