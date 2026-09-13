import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config();

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://vihe:vihe@localhost:5432/vihe_app_test?schema=public";
const E2E_PORT = process.env.E2E_PORT ?? "3001";
const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

// e2e/db.ts Prisma client reads DATABASE_URL at import time. Point it at the
// isolated test database so fixtures never write to the app DB.
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // Specs still share one test database — run serially so writes don't race.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run test:e2e:prepare && next dev --port ${E2E_PORT}`,
    url: E2E_ORIGIN,
    // Never attach to the app on :3000 — that process uses DATABASE_URL (vihe_app).
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_URL: E2E_ORIGIN,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
