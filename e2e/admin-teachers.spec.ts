import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test.describe("admin: teachers", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/teachers");
  });

  test("creates a teacher user with the Teacher role", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;

    await page.fill('section:has-text("Add user") input[name="name"]', "Test Teacher");
    await page.fill('section:has-text("Add user") input[name="email"]', email);
    await page.fill('section:has-text("Add user") input[name="password"]', "TempPass123!");
    await page.check('section:has-text("Add user") label:has-text("Teacher") input[type="checkbox"]');

    const kind = await waitForFlashAfter(page, () =>
      page.click('section:has-text("Add user") button:has-text("Create user")'),
    );
    expect(kind).toBe("success");
    await expect(page.getByText(email)).toBeVisible();
  });

  test("updates a user's roles and it persists after reload", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;
    await page.fill('section:has-text("Add user") input[name="name"]', "Role Update Teacher");
    await page.fill('section:has-text("Add user") input[name="email"]', email);
    await page.fill('section:has-text("Add user") input[name="password"]', "TempPass123!");
    await waitForFlashAfter(page, () => page.click('section:has-text("Add user") button:has-text("Create user")'));

    const row = page.locator("tr", { hasText: email });
    await row.locator('label:has-text("Admin") input[type="checkbox"]').check();
    const kind = await waitForFlashAfter(page, () => row.locator('button:has-text("Save")').click());
    expect(kind).toBe("success");

    await page.goto("/admin/teachers");
    const reloadedRow = page.locator("tr", { hasText: email });
    await expect(reloadedRow.locator('label:has-text("Admin") input[type="checkbox"]')).toBeChecked();
  });

  test("deactivates and reactivates a user", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;
    await page.fill('section:has-text("Add user") input[name="name"]', "Toggle Teacher");
    await page.fill('section:has-text("Add user") input[name="email"]', email);
    await page.fill('section:has-text("Add user") input[name="password"]', "TempPass123!");
    await waitForFlashAfter(page, () => page.click('section:has-text("Add user") button:has-text("Create user")'));

    const row = page.locator("tr", { hasText: email });
    await expect(row.getByText("Active")).toBeVisible();

    const deactivateKind = await waitForFlashAfter(page, () => row.locator('button:has-text("Deactivate")').click());
    expect(deactivateKind).toBe("success");
    await expect(page.locator("tr", { hasText: email }).getByText("Deactivated")).toBeVisible();

    const reactivateRow = page.locator("tr", { hasText: email });
    const reactivateKind = await waitForFlashAfter(page, () =>
      reactivateRow.locator('button:has-text("Reactivate")').click(),
    );
    expect(reactivateKind).toBe("success");
    await expect(page.locator("tr", { hasText: email }).getByText("Active")).toBeVisible();
  });
});
