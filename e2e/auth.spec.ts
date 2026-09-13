import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, login, signOut } from "./helpers";

test.describe("authentication & access control", () => {
  test("unauthenticated visitors are redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', "definitely-wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can sign in, lands on /admin, and can sign out", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Vihe Attendance")).toBeVisible();
    await expect(page.getByRole("button", { name: /account menu for admin/i })).toBeVisible();

    await page.getByRole("button", { name: /account menu for admin/i }).click();
    await expect(page.getByRole("menuitem", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");

    await signOut(page);
    await expect(page).toHaveURL(/\/login/);

    // Session is really gone, not just a client-side redirect.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("root path routes a signed-in admin straight to /admin", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin/);
  });
});
