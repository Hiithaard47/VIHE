import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

async function columnIndexFor(page: import("@playwright/test").Page, roleName: string) {
  const headers = await page.locator("th").allTextContents();
  const index = headers.findIndex((h) => h.includes(roleName));
  expect(index).toBeGreaterThan(-1);
  return index;
}

test.describe("admin: roles & permission matrix", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/roles");
  });

  test("creates a role and it appears as a matrix column", async ({ page }) => {
    const roleName = `Coordinator ${unique("r")}`;

    await page.fill('section:has-text("Add role") input[name="name"]', roleName);
    await page.fill('section:has-text("Add role") input[name="description"]', "Read-only oversight");

    const kind = await waitForFlashAfter(page, () =>
      page.click('section:has-text("Add role") button:has-text("Create role")'),
    );
    expect(kind).toBe("success");
    await expect(page.locator("th", { hasText: roleName })).toBeVisible();
  });

  test("grants a permission to a role and it persists after reload", async ({ page }) => {
    const roleName = `Grader ${unique("r")}`;
    await page.fill('section:has-text("Add role") input[name="name"]', roleName);
    await waitForFlashAfter(page, () => page.click('section:has-text("Add role") button:has-text("Create role")'));

    const colIndex = await columnIndexFor(page, roleName);
    const permRow = page.locator("tr", { hasText: "attendance.view" });
    await permRow.locator("td").nth(colIndex).locator('input[type="checkbox"]').check();

    const tfootCell = page.locator("tfoot tr td").nth(colIndex);
    const kind = await waitForFlashAfter(page, () => tfootCell.locator('button:has-text("Save")').click());
    expect(kind).toBe("success");

    await page.goto("/admin/roles");
    const newColIndex = await columnIndexFor(page, roleName);
    const reloadedRow = page.locator("tr", { hasText: "attendance.view" });
    await expect(reloadedRow.locator("td").nth(newColIndex).locator('input[type="checkbox"]')).toBeChecked();
  });

  test("deletes a non-system role", async ({ page }) => {
    const roleName = `Temporary ${unique("r")}`;
    await page.fill('section:has-text("Add role") input[name="name"]', roleName);
    await waitForFlashAfter(page, () => page.click('section:has-text("Add role") button:has-text("Create role")'));

    await expect(page.locator("th", { hasText: roleName })).toBeVisible();
    const colIndex = await columnIndexFor(page, roleName);
    const tfootCell = page.locator("tfoot tr td").nth(colIndex);

    const kind = await waitForFlashAfter(page, () => tfootCell.locator('button:has-text("Delete")').click());
    expect(kind).toBe("success");
    await expect(page.locator("th", { hasText: roleName })).toHaveCount(0);
  });

  test("system roles (Admin, Teacher) have no delete button", async ({ page }) => {
    const adminColIndex = await columnIndexFor(page, "Admin");
    const tfootCell = page.locator("tfoot tr td").nth(adminColIndex);
    await expect(tfootCell.locator('button:has-text("Delete")')).toHaveCount(0);
  });
});
