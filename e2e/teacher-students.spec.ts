import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createTeacher, createCourse, createStudent } from "./db";

test.describe("teacher: students directory", () => {
  test("lists every enrolled student read-only, with no edit controls", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Directory Teacher ${unique("t")}`,
      `${unique("directoryteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Directory Course ${unique("c")}`, unique("DIR").toUpperCase(), teacher.id);
    const student = await createStudent(`Directory Student ${unique("s")}`, unique("R"), course.id);

    await login(page, teacher.email, password);
    await page.goto("/teacher/students");

    const row = page.locator("tr", { hasText: student.name });
    await expect(row).toBeVisible();
    await expect(row.getByText(student.rollNumber)).toBeVisible();
    await expect(row.getByText(course.name)).toBeVisible();

    // Read-only: no inputs, checkboxes, or forms in the page content (the
    // header's sign-out button is expected and lives outside <main>).
    const main = page.locator("main");
    await expect(main.locator("form")).toHaveCount(0);
    await expect(main.locator("input")).toHaveCount(0);
    await expect(main.locator("button")).toHaveCount(0);
  });
});
