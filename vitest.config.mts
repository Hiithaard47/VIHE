import path from "node:path";
import { defineConfig } from "vitest/config";

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
