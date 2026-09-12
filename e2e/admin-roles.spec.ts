import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

async function createRole(page: import("@playwright/test").Page, name: string, description?: string) {
  await page.getByRole("button", { name: "Add role" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  if (description) await dialog.getByLabel("Description").fill(description);
  return waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create role" }).click());
}

test.describe("admin: roles & permissions", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/roles");
  });

  test("creates a role and opens its detail page", async ({ page }) => {
    const roleName = `Coordinator ${unique("r")}`;
    expect(await createRole(page, roleName, "Read-only oversight")).toBe("success");
    await expect(page.getByRole("heading", { name: roleName })).toBeVisible();
    await expect(page.getByRole("link", { name: "Permissions" })).toBeVisible();

    await page.goto("/admin/roles");
    await expect(page.getByRole("link", { name: roleName })).toBeVisible();
  });

  test("grants a permission to a role and it persists after reload", async ({ page }) => {
    const roleName = `Grader ${unique("r")}`;
    expect(await createRole(page, roleName)).toBe("success");

    const perm = page.locator("label", { hasText: "attendance.view" });
    await perm.locator('input[type="checkbox"]').check();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save permissions" }).click())).toBe(
      "success",
    );

    await page.reload();
    await expect(page.locator("label", { hasText: "attendance.view" }).locator('input[type="checkbox"]')).toBeChecked();
  });

  test("deletes a non-system role", async ({ page }) => {
    const roleName = `Temporary ${unique("r")}`;
    expect(await createRole(page, roleName)).toBe("success");
    await expect(page.getByRole("heading", { name: roleName })).toBeVisible();

    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Delete" }).click())).toBe("success");
    await expect(page.getByRole("link", { name: roleName })).toHaveCount(0);
  });

  test("system roles (Admin, Teacher) have no delete button", async ({ page }) => {
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });
});
