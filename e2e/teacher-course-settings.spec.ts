import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse, prisma } from "./db";

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

  test("edits course details", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Detail Teacher ${unique("t")}`,
      `${unique("detailteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Old Name ${unique("c")}`, unique("DET").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);

    const newName = `New Name ${unique("c")}`;
    await page.fill('input[name="name"]', newName);
    await page.fill('textarea[name="description"]', "Revised outline");
    await page.selectOption('select[name="loginMonths"]', "6");

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Save details")'));
    expect(kind).toBe("success");
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
    await expect(page.locator('select[name="loginMonths"]')).toHaveValue("6");
  });

  test("clears a previously-set description", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Clear Teacher ${unique("t")}`,
      `${unique("clearteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Cleared Outline ${unique("c")}`, unique("CLR").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: course.id }, data: { description: "Original outline" } });

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);
    await expect(page.locator('textarea[name="description"]')).toHaveValue("Original outline");

    await page.fill('textarea[name="description"]', "");

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Save details")'));
    expect(kind).toBe("success");

    // Reload to confirm the clear actually persisted, not just the in-page state.
    await page.reload();
    await expect(page.locator('textarea[name="description"]')).toHaveValue("");
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
    await page.fill('input[name="minAttendancePercent"]', "75");
    await page.uncheck('input[name="excusedCountsAsAttended"]');
    await page.fill('input[name="lockAfterDays"]', "7");

    const ok = await waitForFlashAfter(page, () => page.click('button:has-text("Save policy")'));
    expect(ok).toBe("success");

    await page.reload();
    await expect(page.locator('select[name="defaultStatus"]')).toHaveValue("ABSENT");
    await expect(page.locator('input[name="minAttendancePercent"]')).toHaveValue("75");
    await expect(page.locator('input[name="excusedCountsAsAttended"]')).not.toBeChecked();

    // Bypass the browser's own number-input clamping to reach server validation.
    await page.locator('input[name="minAttendancePercent"]').evaluate((el) => el.removeAttribute("max"));
    await page.fill('input[name="minAttendancePercent"]', "101");
    const bad = await waitForFlashAfter(page, () => page.click('button:has-text("Save policy")'));
    expect(bad).toBe("error");
  });
});
