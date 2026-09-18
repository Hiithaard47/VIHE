import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from "./helpers";

test.describe("navigation and login loading", () => {
  test("shows a signing-in state while credentials are submitted", async ({ page }) => {
    await page.route("**/api/auth/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.continue();
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: "Signing in…" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Checking your account");
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test("keeps shared chrome while navigating admin sections", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Teachers" }).click();
    await expect(page).toHaveURL(/\/admin\/teachers/);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });
});
