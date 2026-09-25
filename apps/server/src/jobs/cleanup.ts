import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import type { Ctx } from "../context";
import {
  adminActions,
  calls,
  domainRequests,
  moderationEvents,
  otpCodes,
  reportEvidence,
  reports,
  sessions,
  userNotices,
  users,
} from "../db/schema";

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
  /** Report frames and chat excerpts. */
  reportEvidenceDays: 30,
  /** Call metadata (who, when, how it ended) and automated moderation signals. */
  callsDays: 90,
  seenNoticesDays: 90,
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

  const expiredReports = await ctx.db
    .update(reports)
    .set({ chatExcerpt: null, evidenceClearedAt: new Date(now) })
    .where(
      and(
        isNull(reports.evidenceClearedAt),
        lt(reports.createdAt, ago(RETENTION.reportEvidenceDays)),
      ),
    )
    .returning({ id: reports.id });
  const evidence =
    expiredReports.length === 0
      ? []
      : await ctx.db
          .delete(reportEvidence)
          .where(
            inArray(
              reportEvidence.reportId,
              expiredReports.map((r) => r.id),
            ),
          )
          .returning({ id: reportEvidence.reportId });
  const oldCalls = await ctx.db
    .delete(calls)
    .where(lt(calls.startedAt, ago(RETENTION.callsDays)))
    .returning({ id: calls.id });
  const oldSignals = await ctx.db
    .delete(moderationEvents)
    .where(lt(moderationEvents.createdAt, ago(RETENTION.callsDays)))
    .returning({ id: moderationEvents.id });
  const oldNotices = await ctx.db
    .delete(userNotices)
    .where(lt(userNotices.seenAt, ago(RETENTION.seenNoticesDays)))
    .returning({ id: userNotices.id });

  return {
    reportEvidence: evidence.length,
    calls: oldCalls.length,
    moderationEvents: oldSignals.length,
    userNotices: oldNotices.length,
    otpCodes: otps.length,
    sessions: expiredSessions.length,
    unfinishedSignups: unfinished.length,
    domainRequests: requests.length,
    adminActions: audit.length,
  };
}
