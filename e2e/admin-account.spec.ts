import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createAdmin } from "./db";

test.describe("admin: account password", () => {
  test("changes their own password and signs in with the new one", async ({ page }) => {
    const email = `${unique("adminpw")}@example.com`;
    const current = "AdminPass123!";
    await createAdmin(`Own Password Admin ${unique("a")}`, email, current);

    await login(page, email, current);
    await page.goto("/admin/account");
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill("ChangedPass123!");
    await page.getByLabel("Confirm new password").fill("ChangedPass123!");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Update password" }).click())).toBe(
      "success",
    );

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', current);
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();

    await page.fill('input[type="password"]', "ChangedPass123!");
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login")),
      page.click('button[type="submit"]'),
    ]);
    await expect(page).toHaveURL(/\/admin/);
  });
});
