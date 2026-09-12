import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse } from "./db";

test.describe("admin: students", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/students");
  });

  test("adds a student enrolled in a course", async ({ page }) => {
    const course = await createCourse(`Enroll Course ${unique("c")}`, unique("ENR").toUpperCase());
    await page.reload();

    const studentName = `Test Student ${unique("s")}`;
    const roll = unique("R");

    await page.fill('section:has-text("Add student") input[name="name"]', studentName);
    await page.fill('section:has-text("Add student") input[name="rollNumber"]', roll);
    await page
      .locator(`section:has-text("Add student") select[name="batch-${course.id}"]`)
      .selectOption(course.batches[0].id);

    const kind = await waitForFlashAfter(page, () =>
      page.click('section:has-text("Add student") button:has-text("Add student")'),
    );
    expect(kind).toBe("success");

    const row = page.locator("tr", { hasText: studentName });
    await expect(row).toBeVisible();
    await expect(row.getByText(roll)).toBeVisible();
    await expect(row.locator(`select[name="batch-${course.id}"]`)).toHaveValue(course.batches[0].id);
  });

  test("deactivates and reactivates a student", async ({ page }) => {
    const studentName = `Toggle Student ${unique("s")}`;
    await page.fill('section:has-text("Add student") input[name="name"]', studentName);
    await page.fill('section:has-text("Add student") input[name="rollNumber"]', unique("R"));
    await waitForFlashAfter(page, () => page.click('section:has-text("Add student") button:has-text("Add student")'));

    const row = page.locator("tr", { hasText: studentName });
    const deactivateKind = await waitForFlashAfter(page, () => row.locator('button:has-text("Deactivate")').click());
    expect(deactivateKind).toBe("success");
    await expect(page.locator("tr", { hasText: studentName }).getByText("Deactivated")).toBeVisible();

    const reactivateRow = page.locator("tr", { hasText: studentName });
    const reactivateKind = await waitForFlashAfter(page, () =>
      reactivateRow.locator('button:has-text("Reactivate")').click(),
    );
    expect(reactivateKind).toBe("success");
    await expect(page.locator("tr", { hasText: studentName }).getByText("Active")).toBeVisible();
  });
});
