import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("header branding", () => {
  test("login header shows the banner without a Vihe text label", async ({ page }) => {
    await page.goto("/login");
    const banner = page.getByRole("banner");
    const image = banner.locator('img[src="/vihe-header.jpg"]');
    await expect(image).toBeVisible();
    await expect(banner.getByText("Vihe", { exact: true })).toHaveCount(0);
    await expect(banner.getByText("Attendance")).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktop = await image.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, viewport: window.innerWidth };
    });
    expect(desktop.width).toBeLessThan(desktop.viewport * 0.75);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await image.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, viewport: window.innerWidth };
    });
    expect(mobile.width).toBeGreaterThan(mobile.viewport * 0.9);
  });

  test("admin header shows Vihe and Admin on desktop, hides Admin on mobile", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    await page.setViewportSize({ width: 1280, height: 800 });
    const banner = page.getByRole("banner");
    const brand = banner.getByRole("link", { name: "Vihe" });
    await expect(brand.getByText("Vihe", { exact: true })).toBeVisible();
    await expect(brand.getByText("Admin")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(brand.getByText("Admin")).toBeHidden();
    await expect(banner.locator('img[src="/vihe-header.jpg"]')).toBeVisible();
  });
});
