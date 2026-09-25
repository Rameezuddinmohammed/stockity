import { and, eq, lt, ne } from "drizzle-orm";
import type { Ctx } from "../context";
import { adminActions, domainRequests, otpCodes, sessions, users } from "../db/schema";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes data we no longer need. The retention periods here are the ones promised in the
 * Privacy Policy (apps/web/content/legal/privacy.md); change both together.
 */
export const RETENTION = {
  otpAfterExpiryDays: 1,
  unfinishedSignupDays: 30,
  reviewedRequestDays: 180,
  auditLogDays: 730,
} as const;

export async function runCleanup(ctx: Ctx) {
  const now = ctx.now().getTime();
  const ago = (days: number) => new Date(now - days * DAY);

  const otps = await ctx.db
    .delete(otpCodes)
    .where(lt(otpCodes.expiresAt, ago(RETENTION.otpAfterExpiryDays)))
    .returning({ id: otpCodes.id });
  const expiredSessions = await ctx.db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .returning({ id: sessions.id });
  const unfinished = await ctx.db
    .delete(users)
    .where(
      and(eq(users.status, "onboarding"), lt(users.createdAt, ago(RETENTION.unfinishedSignupDays))),
    )
    .returning({ id: users.id });
  const requests = await ctx.db
    .delete(domainRequests)
    .where(
      and(
        ne(domainRequests.status, "pending"),
        lt(domainRequests.reviewedAt, ago(RETENTION.reviewedRequestDays)),
      ),
    )
    .returning({ id: domainRequests.id });
  const audit = await ctx.db
    .delete(adminActions)
    .where(lt(adminActions.createdAt, ago(RETENTION.auditLogDays)))
    .returning({ id: adminActions.id });

  return {
    otpCodes: otps.length,
    sessions: expiredSessions.length,
    unfinishedSignups: unfinished.length,
    domainRequests: requests.length,
    adminActions: audit.length,
  };
}
