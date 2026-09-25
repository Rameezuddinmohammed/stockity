import {
  ageOn,
  MAX_AGE,
  type Me,
  MIN_AGE,
  onboardingSchema,
  profileUpdateSchema,
  type SurveyAnswers,
  type SurveyMode,
  socialsSchema,
  surveySchema,
} from "@quad/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { clearSessionCookie, requireActive, requireUser } from "../auth";
import type { Ctx } from "../context";
import { blockedEmails, profiles, socials, surveyResponses, users } from "../db/schema";
import { AppError, parse } from "../lib/errors";
import { avatarColorFor, loadMe } from "../lib/users";
import { blockedHash } from "./auth";

export function meRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/me", async (req): Promise<Me> => {
    const { user } = requireUser(req);
    return loadMe(ctx.db, user.id);
  });

  app.post("/api/onboarding", async (req, reply): Promise<Me> => {
    const { user } = requireUser(req);
    if (user.status !== "onboarding") {
      throw new AppError(409, "ALREADY_ONBOARDED", "You've already set up your account.");
    }
    const input = parse(onboardingSchema, req.body);
    const age = ageOn(input.dob, ctx.now());

    if (age < MIN_AGE) {
      // Keep nothing about minors except a one-way hash that stops the email signing up again.
      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(blockedEmails)
          .values({ emailHash: blockedHash(ctx, user.emailCanonical), reason: "underage" })
          .onConflictDoNothing();
        await tx.delete(users).where(eq(users.id, user.id));
      });
      clearSessionCookie(ctx, reply);
      throw new AppError(403, "UNDERAGE", "Quad is only for students aged 18 and over.");
    }
    if (age > MAX_AGE) throw new AppError(400, "VALIDATION", "Enter your real date of birth.");

    const now = ctx.now();
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ dob: input.dob, guidelinesAcceptedAt: now, status: "active", updatedAt: now })
        .where(eq(users.id, user.id));
      await tx.insert(profiles).values({
        userId: user.id,
        displayName: input.displayName,
        avatarColor: avatarColorFor(user.id),
      });
    });
    return loadMe(ctx.db, user.id);
  });

  app.patch("/api/me/profile", async (req): Promise<Me> => {
    const { user } = requireActive(req);
    const input = parse(profileUpdateSchema, req.body);
    if (Object.keys(input).length > 0) {
      await ctx.db
        .update(profiles)
        .set({ ...input, updatedAt: ctx.now() })
        .where(eq(profiles.userId, user.id));
    }
    return loadMe(ctx.db, user.id);
  });

  app.put("/api/me/socials", async (req): Promise<Me> => {
    const { user } = requireActive(req);
    const input = parse(socialsSchema, req.body);
    await ctx.db.transaction(async (tx) => {
      await tx.delete(socials).where(eq(socials.userId, user.id));
      if (input.socials.length > 0) {
        await tx.insert(socials).values(input.socials.map((s) => ({ userId: user.id, ...s })));
      }
    });
    return loadMe(ctx.db, user.id);
  });

  app.get("/api/me/survey", async (req): Promise<{ answers: SurveyAnswers | null }> => {
    const { user } = requireActive(req);
    const [row] = await ctx.db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.userId, user.id));
    return {
      answers: row
        ? {
            modes: row.modes as SurveyMode[],
            freeHoursUtc: row.freeHoursUtc,
            timezone: row.timezone,
          }
        : null,
    };
  });

  app.put("/api/me/survey", async (req): Promise<{ answers: SurveyAnswers }> => {
    const { user } = requireActive(req);
    const input = parse(surveySchema, req.body);
    const values = {
      modes: input.modes,
      freeHoursUtc: input.freeHoursUtc,
      timezone: input.timezone ?? null,
      updatedAt: ctx.now(),
    };
    await ctx.db
      .insert(surveyResponses)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: surveyResponses.userId, set: values });
    return { answers: { ...values } };
  });

  app.delete("/api/me", async (req, reply) => {
    const { user } = requireUser(req);
    if (user.status === "suspended") {
      throw new AppError(
        403,
        "SUSPENDED",
        "You can delete your account once your suspension ends.",
      );
    }
    await ctx.db.delete(users).where(eq(users.id, user.id));
    clearSessionCookie(ctx, reply);
    return { ok: true };
  });
}
