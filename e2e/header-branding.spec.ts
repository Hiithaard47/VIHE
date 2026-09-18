import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("header branding", () => {
  test("login header shows the banner without a Vihe text label", async ({ page }) => {
    await page.goto("/login");
    const banner = page.getByRole("banner");
    await expect(banner.locator('img[src="/vihe-header.jpg"]')).toBeVisible();
    await expect(banner.getByText("Vihe", { exact: true })).toHaveCount(0);
    await expect(banner.getByText("Attendance")).toHaveCount(0);
  });

  test("admin header shows Vihe and Admin on desktop, hides Admin on mobile", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    await page.setViewportSize({ width: 1280, height: 800 });
    const banner = page.getByRole("banner");
    await expect(banner.getByText("Vihe", { exact: true })).toBeVisible();
    await expect(banner.getByText("Admin")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(banner.getByText("Admin")).toBeHidden();
    await expect(banner.locator('img[src="/vihe-header.jpg"]')).toBeVisible();
  });
});
