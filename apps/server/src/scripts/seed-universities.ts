import { readFile } from "node:fs/promises";
import { createDb } from "../db/client";
import { type HipoUniversity, seedUniversities } from "../lib/seed";

const HIPO_URL =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";

// Usage: pnpm db:seed [path-or-url]   (defaults to the full Hipo list)
const source = process.argv[2] ?? HIPO_URL;
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const list: HipoUniversity[] = source.startsWith("http")
  ? await (await fetch(source)).json()
  : JSON.parse(await readFile(source, "utf8"));

const { db, client } = createDb(url);
const result = await seedUniversities(db, list);
await client.end();
console.log(`seeded ${result.universities} universities, ${result.newDomains} new domains`);
