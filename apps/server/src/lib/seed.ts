import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { universities, universityDomains } from "../db/schema";

/** Shape of entries in github.com/Hipo/university-domains-list. */
export type HipoUniversity = {
  name: string;
  country: string;
  alpha_two_code: string;
  domains: string[];
  web_pages?: string[];
};

const normalizeDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");

export async function seedUniversities(db: Db, list: HipoUniversity[]) {
  const byKey = new Map<string, HipoUniversity>();
  for (const u of list) {
    if (!u.name || !u.alpha_two_code || !Array.isArray(u.domains)) continue;
    const key = `${u.name.trim()}|${u.alpha_two_code.toUpperCase()}`;
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, domains: [...prev.domains, ...u.domains] } : u);
  }
  const entries = [...byKey.values()];
  let domainCount = 0;

  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    const rows = await db
      .insert(universities)
      .values(
        batch.map((u) => ({
          name: u.name.trim(),
          country: u.country.trim(),
          countryCode: u.alpha_two_code.toUpperCase(),
          webPage: u.web_pages?.[0] ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [universities.name, universities.countryCode],
        set: { country: sql`excluded.country`, webPage: sql`excluded.web_page` },
      })
      .returning({ id: universities.id, name: universities.name, cc: universities.countryCode });

    const idByKey = new Map(rows.map((r) => [`${r.name}|${r.cc}`, r.id]));
    const domains = new Map<string, string>();
    for (const u of batch) {
      const id = idByKey.get(`${u.name.trim()}|${u.alpha_two_code.toUpperCase()}`);
      if (!id) continue;
      for (const d of u.domains.map(normalizeDomain)) {
        if (d.includes(".") && !domains.has(d)) domains.set(d, id);
      }
    }
    if (domains.size > 0) {
      const inserted = await db
        .insert(universityDomains)
        .values([...domains].map(([domain, universityId]) => ({ domain, universityId })))
        .onConflictDoNothing()
        .returning({ domain: universityDomains.domain });
      domainCount += inserted.length;
    }
  }
  return { universities: entries.length, newDomains: domainCount };
}
