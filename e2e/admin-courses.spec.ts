import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test.describe("admin: courses", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/courses");
  });

  test("creates a course with a default batch", async ({ page }) => {
    const courseName = `Bhakti Sastra ${unique("course")}`;
    const code = unique("BS").toUpperCase();

    await page.fill('section:has-text("Add course") input[name="name"]', courseName);
    await page.fill('section:has-text("Add course") input[name="code"]', code);
    const kind = await waitForFlashAfter(page, () =>
      page.click('section:has-text("Add course") button:has-text("Create course")'),
    );
    expect(kind).toBe("success");

    const row = page.locator("tr", { hasText: courseName });
    await expect(row).toBeVisible();
    await expect(row.getByText(code)).toBeVisible();
    await expect(row.getByText("Unassigned")).toBeVisible();
  });

  test("archives and restores a course", async ({ page }) => {
    const courseName = `Archive Test ${unique("course")}`;
    await page.fill('section:has-text("Add course") input[name="name"]', courseName);
    await page.fill('section:has-text("Add course") input[name="code"]', unique("ARC").toUpperCase());
    await waitForFlashAfter(page, () => page.click('section:has-text("Add course") button:has-text("Create course")'));

    const row = page.locator("tr", { hasText: courseName });
    await expect(row.getByText("Active")).toBeVisible();

    const archiveKind = await waitForFlashAfter(page, () => row.locator('button:has-text("Archive")').click());
    expect(archiveKind).toBe("success");
    await expect(page.locator("tr", { hasText: courseName }).getByText("Archived")).toBeVisible();

    const restoreRow = page.locator("tr", { hasText: courseName });
    const restoreKind = await waitForFlashAfter(page, () => restoreRow.locator('button:has-text("Restore")').click());
    expect(restoreKind).toBe("success");
    await expect(page.locator("tr", { hasText: courseName }).getByText("Active")).toBeVisible();
  });
});
