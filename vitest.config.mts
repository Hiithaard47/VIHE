import path from "node:path";
import { defineConfig } from "vitest/config";

// startOfTodayUtc reads LOCAL calendar fields and rebuilds them in UTC.
// Pinned to a non-zero offset so those tests stay meaningful on a UTC
// CI runner, where local and UTC getters would otherwise agree and a
// broken implementation would pass.
process.env.TZ = "America/New_York";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // process.cwd(), not __dirname: whether __dirname exists in a .ts config
    // depends on how Vite compiles it (package.json has no "type" field), and
    // vitest always runs from the project root.
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
