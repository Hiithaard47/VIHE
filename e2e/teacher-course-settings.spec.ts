import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse } from "./db";

test.describe("teacher: course settings", () => {
  test("shows configuration tabs only for assigned courses, and enforces it on the route", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Settings Teacher ${unique("t")}`,
      `${unique("settingsteacher")}@example.com`,
      password,
    );
    const mine = await createCourse(`Kirtan Standards ${unique("c")}`, unique("SET").toUpperCase(), teacher.id);
    const other = await createCourse(`Sanskrit Grammar ${unique("c")}`, unique("OTS").toUpperCase());

    await login(page, teacher.email, password);

    await page.goto(`/teacher/courses/${mine.id}`);
    await expect(page.getByRole("link", { name: "Attendance", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Uploads", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();

    await page.goto(`/teacher/courses/${other.id}`);
    await expect(page).toHaveURL(/\/teacher$/);

    await page.goto(`/teacher/courses/${other.id}/settings`);
    await expect(page).toHaveURL(/\/teacher$/);
  });

  test("does not let a teacher edit course-wide details", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Detail Teacher ${unique("t")}`,
      `${unique("detailteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Old Name ${unique("c")}`, unique("DET").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);
    await expect(page.getByRole("button", { name: "Save details" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save policy" })).toBeVisible();
  });

  test("saves an attendance policy and rejects an out-of-range percentage", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Policy Teacher ${unique("t")}`,
      `${unique("policyteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Policy Course ${unique("c")}`, unique("POL").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);

    await page.selectOption('select[name="defaultStatus"]', "ABSENT");
    await page.uncheck('input[name="excusedCountsAsAttended"]');
    await page.fill('input[name="lockAfterDays"]', "7");

    const ok = await waitForFlashAfter(page, () => page.click('button:has-text("Save policy")'));
    expect(ok).toBe("success");

    await page.reload();
    await expect(page.locator('select[name="defaultStatus"]')).toHaveValue("ABSENT");
    await expect(page.locator('input[name="excusedCountsAsAttended"]')).not.toBeChecked();
    await expect(page.locator('input[name="lockAfterDays"]')).toHaveValue("7");
  });
});
