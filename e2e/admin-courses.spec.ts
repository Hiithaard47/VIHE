import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test.describe("admin: courses", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/courses");
  });

  test("creates a course with a default subject", async ({ page }) => {
    const courseName = `Bhakti Sastra ${unique("course")}`;
    const code = unique("BS").toUpperCase();

    await page.getByRole("button", { name: "Add course" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Course name").fill(courseName);
    await dialog.getByLabel("Course code").fill(code);
    const kind = await waitForFlashAfter(page, () =>
      dialog.getByRole("button", { name: "Create course" }).click(),
    );
    expect(kind).toBe("success");

    await page.getByRole("link", { name: courseName }).click();
    await expect(page.getByRole("link", { name: "Default", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add subject" }).click();
    const subjectDialog = page.getByRole("dialog");
    await subjectDialog.getByLabel("Subject name").fill("Morning");
    const subjectKind = await waitForFlashAfter(page, () => subjectDialog.getByRole("button", { name: "Create subject" }).click());
    expect(subjectKind).toBe("success");
    await expect(page.getByRole("link", { name: "Morning", exact: true })).toBeVisible();
  });

  test("archives and restores a course", async ({ page }) => {
    const courseName = `Archive Test ${unique("course")}`;
    await page.getByRole("button", { name: "Add course" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Course name").fill(courseName);
    await dialog.getByLabel("Course code").fill(unique("ARC").toUpperCase());
    await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create course" }).click());

    await expect(page.locator("tr", { hasText: courseName }).getByRole("button", { name: "Archive" })).toHaveCount(0);
    await page.getByRole("link", { name: courseName }).click();
    const archiveKind = await waitForFlashAfter(page, () => page.getByRole("button", { name: "Archive" }).click());
    expect(archiveKind).toBe("success");
    await expect(page.getByText("This course is archived. Restore it to make changes.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add subject" })).toHaveCount(0);
    await page.getByRole("link", { name: "Details" }).click();
    await expect(page.getByRole("button", { name: "Save details" })).toHaveCount(0);
    await page.getByRole("link", { name: "Policy" }).click();
    await expect(page.getByRole("button", { name: "Save policy" })).toHaveCount(0);

    await page.goto("/admin/courses");
    await expect(page.locator("tr", { hasText: courseName })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await expect(page.getByRole("link", { name: "Archived", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("tr", { hasText: courseName }).getByRole("button", { name: "Restore" })).toHaveCount(0);
    await page.getByRole("link", { name: courseName }).click();
    const restoreKind = await waitForFlashAfter(page, () => page.getByRole("button", { name: "Restore" }).click());
    expect(restoreKind).toBe("success");
    await expect(page.getByRole("button", { name: "Add subject" })).toBeVisible();
  });
});
