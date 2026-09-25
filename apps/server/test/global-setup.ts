import postgres from "postgres";
import { runMigrations } from "../src/db/migrate";
import { TEST_DATABASE_URL } from "./env";

/** Fresh schema for every test run, built from the real migrations. */
export default async function setup() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql.unsafe(
    "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
  );
  await sql.end();
  await runMigrations(TEST_DATABASE_URL);
}
