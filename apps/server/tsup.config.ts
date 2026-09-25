import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/scripts/migrate.ts", "src/scripts/seed-universities.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  // Workspace packages ship TypeScript source, so bundle them in.
  noExternal: [/^@quad\//],
});
