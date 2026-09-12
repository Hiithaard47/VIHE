import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

// Unique-enough suffix so repeated runs against the same dev database never
// collide on unique columns (email, course code, roll number, role name).
export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.click('button[type="submit"]'),
  ]);
}

export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

// Triggers a server action (via `trigger`, e.g. a button click) and waits
// for its redirect to land with a flash message, returning whether it was
// a success or error banner.
//
// Snapshotting the URL *before* running `trigger` and requiring the final
// URL to differ from it is what makes this safe to call more than once per
// test: a flash param from an earlier action in the same test is still
// sitting in the current URL, and `waitForURL` resolves the instant its
// predicate is already true — so checking only "has a flash param" would
// resolve immediately against that stale one, before the new action's own
// redirect (or even its request) had actually happened.
export async function waitForFlashAfter(page: Page, trigger: () => Promise<void>): Promise<"success" | "error"> {
  const before = page.url();
  await trigger();
  await page.waitForURL((url) => url.toString() !== before && url.searchParams.get("flash") !== null);
  const kind = new URL(page.url()).searchParams.get("kind");
  return kind === "error" ? "error" : "success";
}
