import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Integration tests share one Postgres database and one Redis db.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
