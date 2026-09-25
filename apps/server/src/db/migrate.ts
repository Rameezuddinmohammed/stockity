import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Generated SQL migrations live in apps/server/drizzle; scripts run from the package root. */
const defaultFolder = () => process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "drizzle");

export async function runMigrations(url: string, folder = defaultFolder()) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}
