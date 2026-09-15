import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createStudent } from "./db";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("admin: classroom", () => {
  test("can run sessions, roster, attendance, and assignments on a course", async ({ page }) => {
    const course = await createCourse(`Admin Classroom ${unique("c")}`, unique("ACL").toUpperCase());
    const student = await createStudent(`Admin Student ${unique("s")}`, unique("ACS"), course.id);
    const title = `Admin Essay ${unique("asg")}`;

    await loginAsAdmin(page);
    await page.goto(`/admin/courses/${course.id}`);
    await expect(page.getByRole("link", { name: "Sessions", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Details", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Policy", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Roster", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Default" }).click();
    await expect(page.getByRole("link", { name: "Sessions", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Roster", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Attendance", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Assignments", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Sessions", exact: true }).click();
    await page.locator('input[type="date"]').fill("2026-03-15");
    await page.locator('input[name="name"]').fill("Admin overview");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await expect(page.getByText("Admin overview")).toBeVisible();
    await expect(page.getByText("15 Mar 2026")).toBeVisible();

    await page.locator('a[href*="/admin/sessions/"]', { hasText: "Admin overview" }).click();
    await expect(page).toHaveURL(/\/admin\/sessions\//);
    await expect(page.getByText(student.name)).toBeVisible();
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save attendance" }).click())).toBe(
      "success",
    );

    await page.goto(`/admin/courses/${course.id}/roster`);
    await expect(page.getByText(student.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add student" })).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}/attendance`);
    // Attendance shows the student in summary + matrix tables.
    await expect(page.getByRole("cell", { name: student.name, exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Assignments", exact: true }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Maximum marks").fill("20");
    await page.locator('input[name="files"]').setInputFiles({
      name: "question.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Issue assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/courses\/.+\/assignments/);
  });
});
