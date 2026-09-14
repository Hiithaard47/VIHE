import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse } from "./db";

async function createStudent(page: import("@playwright/test").Page, name: string, roll: string, courseId?: string) {
  await page.getByRole("button", { name: "Add student" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Roll number").fill(roll);
  if (courseId) {
    await dialog.locator(`input[name="course-${courseId}"]`).check();
  }
  return waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create student" }).click());
}

test.describe("admin: students", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/students");
    await expect(page.getByRole("link", { name: "Applications" })).toBeVisible();
  });

  test("adds a student enrolled in a course", async ({ page }) => {
    const course = await createCourse(`Enroll Course ${unique("c")}`, unique("ENR").toUpperCase());
    await page.reload();

    const studentName = `Test Student ${unique("s")}`;
    const roll = unique("R");
    expect(await createStudent(page, studentName, roll, course.id)).toBe("success");

    const row = page.locator("tr", { hasText: studentName });
    await expect(row).toBeVisible();
    await expect(row.getByText(roll)).toBeVisible();
    await expect(row.getByText(course.name)).toBeVisible();

    await row.getByRole("link", { name: studentName }).click();
    await expect(page.getByRole("heading", { name: studentName })).toBeVisible();
    await expect(page.getByRole("link", { name: course.name })).toBeVisible();
  });

  test("archives and restores a student from the detail page", async ({ page }) => {
    const studentName = `Toggle Student ${unique("s")}`;
    expect(await createStudent(page, studentName, unique("R"))).toBe("success");
    await expect(page.locator("tr", { hasText: studentName }).getByRole("button", { name: "Archive" })).toHaveCount(0);

    await page.getByRole("link", { name: studentName }).click();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Archive" }).click())).toBe("success");
    await expect(page.getByText("This student is archived. Restore to make changes.")).toBeVisible();

    await page.goto("/admin/students");
    await expect(page.locator("tr", { hasText: studentName })).toHaveCount(0);
    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await page.getByRole("link", { name: studentName }).click();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Restore" }).click())).toBe("success");
    await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  });

  test("finds a student by email or mobile", async ({ page }) => {
    const token = unique("searchstudent");
    const studentName = `Search Student ${token}`;
    const email = `${token}@example.com`;
    const phone = `555${Date.now().toString().slice(-7)}`;
    await page.getByRole("button", { name: "Add student" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(studentName);
    await dialog.getByLabel("Roll number").fill(unique("R"));
    await dialog.getByLabel("Email (optional)").fill(email);
    await dialog.getByLabel("Mobile (optional)").fill(phone);
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create student" }).click())).toBe("success");

    await page.getByRole("searchbox", { name: "Search" }).fill(email);
    await expect(page.locator("tr", { hasText: studentName })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search" }).fill(phone);
    await expect(page.locator("tr", { hasText: studentName })).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
  });
});
