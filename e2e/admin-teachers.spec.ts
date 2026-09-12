import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

async function createTeacher(page: import("@playwright/test").Page, name: string, email: string) {
  await page.getByRole("button", { name: "Add teacher" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Temporary password").fill("TempPass123!");
  return waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create teacher" }).click());
}

test.describe("admin: teachers", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/teachers");
  });

  test("creates a teacher user with the Teacher role", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;
    await page.getByRole("button", { name: "Add teacher" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill("Test Teacher");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Temporary password").fill("TempPass123!");
    await dialog.locator('label:has-text("Teacher") input[type="checkbox"]').check();
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create teacher" }).click())).toBe("success");
    await expect(page.getByText(email)).toBeVisible();
  });

  test("updates a user's roles and it persists after reload", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;
    expect(await createTeacher(page, "Role Update Teacher", email)).toBe("success");

    await page.locator("tr", { hasText: email }).getByRole("link", { name: "Role Update Teacher" }).click();
    await page.getByRole("main").getByRole("link", { name: "Roles" }).click();
    await page.locator('label:has-text("Admin") input[type="checkbox"]').check();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save roles" }).click())).toBe("success");

    await page.goto("/admin/teachers");
    await page.locator("tr", { hasText: email }).getByRole("link", { name: "Role Update Teacher" }).click();
    await page.getByRole("main").getByRole("link", { name: "Roles" }).click();
    await expect(page.locator('label:has-text("Admin") input[type="checkbox"]')).toBeChecked();
  });

  test("archives and restores a teacher from the detail page", async ({ page }) => {
    const email = `${unique("teacher")}@example.com`;
    expect(await createTeacher(page, "Toggle Teacher", email)).toBe("success");
    await expect(page.locator("tr", { hasText: email }).getByRole("button", { name: "Archive" })).toHaveCount(0);

    await page.locator("tr", { hasText: email }).getByRole("link", { name: "Toggle Teacher" }).click();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Archive" }).click())).toBe("success");
    await expect(page.getByText("This teacher is archived. Restore to make changes.")).toBeVisible();

    await page.goto("/admin/teachers");
    await expect(page.locator("tr", { hasText: email })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await page.locator("tr", { hasText: email }).getByRole("link", { name: "Toggle Teacher" }).click();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Restore" }).click())).toBe("success");
    await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  });

  test("finds a teacher by email or mobile", async ({ page }) => {
    const token = unique("searchteacher");
    const email = `${token}@example.com`;
    const phone = `555${Date.now().toString().slice(-7)}`;
    await page.getByRole("button", { name: "Add teacher" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(`Search Teacher ${token}`);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Mobile (optional)").fill(phone);
    await dialog.getByLabel("Temporary password").fill("TempPass123!");
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create teacher" }).click())).toBe("success");

    await page.getByRole("searchbox", { name: "Search" }).fill(email);
    await expect(page.locator("tr", { hasText: email })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search" }).fill(phone);
    await expect(page.locator("tr", { hasText: email })).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
  });
});
