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
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.goto(`/teacher/courses/${other.id}`);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

    // A hidden tab is not access control — the route itself must refuse.
    await page.goto(`/teacher/courses/${other.id}/settings`);
    await expect(page).toHaveURL(`/teacher/courses/${other.id}`);
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

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Save details")'));
    expect(kind).toBe("success");
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
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
});
