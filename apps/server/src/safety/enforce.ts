import { eq, sql } from "drizzle-orm";
import type { Ctx } from "../context";
import {
  adminActions,
  bannedDevices,
  sessions,
  userDevices,
  userNotices,
  users,
} from "../db/schema";

export type Enforcement = "warn" | "suspend_24h" | "suspend_7d" | "ban";

/** The strike ladder from DESIGN.md: warning → 24h → 7 days → permanent ban. */
export function nextStrike(strikeCount: number): Enforcement {
  if (strikeCount <= 0) return "warn";
  if (strikeCount === 1) return "suspend_24h";
  if (strikeCount === 2) return "suspend_7d";
  return "ban";
}

const HOURS: Record<"suspend_24h" | "suspend_7d", number> = { suspend_24h: 24, suspend_7d: 168 };

/** Anything that can drop a live connection (the realtime hub). */
export type Kicker = { kick(userId: string, reason: "suspended" | "banned"): void };

/**
 * Applies an enforcement action: updates the account, leaves the person a plain notice,
 * signs them out of live chat and, for bans, blocks their known devices.
 */
export async function enforce(
  ctx: Ctx,
  kicker: Kicker,
  input: {
    userId: string;
    action: Enforcement;
    reason: string;
    adminId: string | null;
    /** Strikes count toward the ladder; manual admin suspensions don't have to. */
    countsAsStrike: boolean;
  },
) {
  const now = ctx.now();
  const strikeInc = input.countsAsStrike ? 1 : 0;

  await ctx.db.transaction(async (tx) => {
    if (input.action === "warn") {
      await tx
        .update(users)
        .set({ strikeCount: sql`${users.strikeCount} + ${strikeInc}`, updatedAt: now })
        .where(eq(users.id, input.userId));
      await tx.insert(userNotices).values({
        userId: input.userId,
        kind: "warning",
        message: `Warning from the Quad safety team: ${input.reason}. Next time your account will be suspended.`,
      });
    } else if (input.action === "ban") {
      await tx
        .update(users)
        .set({
          status: "banned",
          suspendedUntil: null,
          statusReason: input.reason,
          strikeCount: sql`${users.strikeCount} + ${strikeInc}`,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));
      await tx.delete(sessions).where(eq(sessions.userId, input.userId));
      const devices = await tx
        .select({ deviceHash: userDevices.deviceHash })
        .from(userDevices)
        .where(eq(userDevices.userId, input.userId));
      if (devices.length > 0) {
        await tx
          .insert(bannedDevices)
          .values(devices.map((d) => ({ deviceHash: d.deviceHash, userId: input.userId })))
          .onConflictDoNothing();
      }
    } else {
      const until = new Date(now.getTime() + HOURS[input.action] * 3_600_000);
      await tx
        .update(users)
        .set({
          status: "suspended",
          suspendedUntil: until,
          statusReason: input.reason,
          strikeCount: sql`${users.strikeCount} + ${strikeInc}`,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));
      await tx.insert(userNotices).values({
        userId: input.userId,
        kind: "suspension",
        message: `Your account is suspended until ${until.toUTCString()}: ${input.reason}. Repeat breaks lead to a permanent ban.`,
      });
    }
    await tx.insert(adminActions).values({
      adminId: input.adminId,
      action: input.adminId ? input.action : `auto_${input.action}`,
      targetUserId: input.userId,
      reason: input.reason,
    });
  });

  if (input.action === "ban") kicker.kick(input.userId, "banned");
  else if (input.action !== "warn") kicker.kick(input.userId, "suspended");
}
