import type { AdminReportRow } from "@quad/shared";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth";
import type { Ctx } from "../context";
import {
  calls,
  moderationEvents,
  profiles,
  reportEvidence,
  reports,
  universities,
  users,
} from "../db/schema";
import { AppError, parse } from "../lib/errors";
import { Hub } from "../realtime/hub";
import { enforce, nextStrike } from "../safety/enforce";

const listQuery = z.object({ status: z.enum(["open", "actioned", "dismissed"]).default("open") });
const idParam = z.object({ id: z.uuid() });
const resolveBody = z.object({
  /** "strike" applies the next step of the ladder; "ban" skips straight to a permanent ban. */
  action: z.enum(["dismiss", "strike", "ban"]),
  reason: z.string().trim().min(3).max(300).optional(),
});

export function reportRoutes(app: FastifyInstance, ctx: Ctx, hub: Hub) {
  const reporter = alias(users, "reporter");
  const reporterProfile = alias(profiles, "reporter_profile");
  const reported = alias(users, "reported");
  const reportedProfile = alias(profiles, "reported_profile");

  app.get("/api/admin/reports", async (req): Promise<{ reports: AdminReportRow[] }> => {
    requireAdmin(req);
    const { status } = parse(listQuery, req.query);
    const rows = await ctx.db
      .select({
        report: reports,
        callMode: calls.mode,
        callStartedAt: calls.startedAt,
        hasFrame: reportEvidence.reportId,
        reporter: {
          id: reporter.id,
          email: reporter.email,
          displayName: reporterProfile.displayName,
        },
        reported: {
          id: reported.id,
          email: reported.email,
          displayName: reportedProfile.displayName,
          status: reported.status,
          strikeCount: reported.strikeCount,
        },
        reportedUniversity: universities.name,
      })
      .from(reports)
      .leftJoin(calls, eq(calls.id, reports.callId))
      .leftJoin(reportEvidence, eq(reportEvidence.reportId, reports.id))
      .leftJoin(reporter, eq(reporter.id, reports.reporterId))
      .leftJoin(reporterProfile, eq(reporterProfile.userId, reporter.id))
      .leftJoin(reported, eq(reported.id, reports.reportedId))
      .leftJoin(reportedProfile, eq(reportedProfile.userId, reported.id))
      .leftJoin(universities, eq(universities.id, reported.universityId))
      .where(eq(reports.status, status))
      .orderBy(status === "open" ? reports.createdAt : desc(reports.createdAt))
      .limit(100);

    // History for each reported person: total reports and recent nudity flags.
    const ids = [
      ...new Set(rows.map((r) => r.reported?.id).filter((v): v is string => Boolean(v))),
    ];
    const totals = new Map<string, number>();
    const flags = new Map<string, number>();
    if (ids.length > 0) {
      for (const r of await ctx.db
        .select({ id: reports.reportedId, n: count() })
        .from(reports)
        .where(inArray(reports.reportedId, ids))
        .groupBy(reports.reportedId)) {
        if (r.id) totals.set(r.id, Number(r.n));
      }
      const since = new Date(ctx.now().getTime() - 30 * 86_400_000);
      for (const r of await ctx.db
        .select({ id: moderationEvents.subjectId, n: count() })
        .from(moderationEvents)
        .where(
          and(
            inArray(moderationEvents.subjectId, ids),
            eq(moderationEvents.kind, "nsfw_flag"),
            gt(moderationEvents.createdAt, since),
          ),
        )
        .groupBy(moderationEvents.subjectId)) {
        flags.set(r.id, Number(r.n));
      }
    }

    return {
      reports: rows.map((r) => ({
        id: r.report.id,
        category: r.report.category,
        note: r.report.note,
        automatic: r.report.automatic,
        status: r.report.status,
        action: r.report.action,
        createdAt: r.report.createdAt.toISOString(),
        callMode: r.callMode ?? null,
        callStartedAt: r.callStartedAt?.toISOString() ?? null,
        hasFrame: Boolean(r.hasFrame),
        chatExcerpt: r.report.chatExcerpt ?? null,
        reporter:
          r.reporter?.id && r.reporter.email
            ? { id: r.reporter.id, email: r.reporter.email, displayName: r.reporter.displayName }
            : null,
        reported:
          r.reported?.id && r.reported.email && r.reported.status
            ? {
                id: r.reported.id,
                email: r.reported.email,
                displayName: r.reported.displayName,
                status: r.reported.status,
                strikeCount: r.reported.strikeCount ?? 0,
                university: r.reportedUniversity ?? "",
                reportsTotal: totals.get(r.reported.id) ?? 0,
                nsfwFlags30d: flags.get(r.reported.id) ?? 0,
              }
            : null,
      })),
    };
  });

  app.get("/api/admin/reports/:id/frame", async (req, reply) => {
    requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const [row] = await ctx.db.select().from(reportEvidence).where(eq(reportEvidence.reportId, id));
    if (!row) throw new AppError(404, "NOT_FOUND", "No frame for this report.");
    reply.header("Cache-Control", "private, no-store").type(row.mime);
    return reply.send(row.frame);
  });

  app.post("/api/admin/reports/:id/resolve", async (req) => {
    const { user: admin } = requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const input = parse(resolveBody, req.body);
    const [report] = await ctx.db.select().from(reports).where(eq(reports.id, id));
    if (!report) throw new AppError(404, "NOT_FOUND", "Report not found.");
    if (report.status !== "open") throw new AppError(409, "CONFLICT", "Already reviewed.");

    let action = "dismissed";
    if (input.action !== "dismiss") {
      if (!report.reportedId) throw new AppError(409, "CONFLICT", "That account no longer exists.");
      const [target] = await ctx.db.select().from(users).where(eq(users.id, report.reportedId));
      if (!target) throw new AppError(409, "CONFLICT", "That account no longer exists.");
      if (target.role === "admin")
        throw new AppError(403, "FORBIDDEN", "Admins can't take action on admins.");
      const step = input.action === "ban" ? "ban" : nextStrike(target.strikeCount);
      const reason =
        input.reason ?? `Broke the community guidelines (${Hub.categoryLabel(report.category)})`;
      await enforce(ctx, hub, {
        userId: target.id,
        action: step,
        reason,
        adminId: admin.id,
        countsAsStrike: true,
      });
      action = step;
    }

    await ctx.db
      .update(reports)
      .set({
        status: input.action === "dismiss" ? "dismissed" : "actioned",
        action,
        reviewerId: admin.id,
        reviewedAt: ctx.now(),
      })
      .where(eq(reports.id, id));
    return { ok: true, action };
  });
}
