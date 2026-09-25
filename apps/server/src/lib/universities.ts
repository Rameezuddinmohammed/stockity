import type { UniversityTarget } from "@quad/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { universities } from "../db/schema";
import { AppError } from "./errors";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Turns an admin's "existing university" or "new university" choice into a university row. */
export async function resolveTarget(
  db: Db | Tx,
  target: UniversityTarget,
): Promise<{ id: string; name: string }> {
  if ("universityId" in target) {
    const [u] = await db
      .select({ id: universities.id, name: universities.name })
      .from(universities)
      .where(eq(universities.id, target.universityId));
    if (!u) throw new AppError(404, "NOT_FOUND", "University not found.");
    return u;
  }
  const [u] = await db
    .insert(universities)
    .values(target.newUniversity)
    .onConflictDoUpdate({
      target: [universities.name, universities.countryCode],
      set: { country: target.newUniversity.country },
    })
    .returning({ id: universities.id, name: universities.name });
  if (!u) throw new AppError(500, "INTERNAL", "Couldn't create the university.");
  return u;
}
