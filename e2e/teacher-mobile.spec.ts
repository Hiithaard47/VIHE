import { test, expect, type Page } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher } from "./db";

test.use({ viewport: { width: 390, height: 844 } });

async function assertNoPageOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("teacher: mobile layout", () => {
  test("chrome, course workspace, and attendance marking fit a phone", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Mobile Teacher ${unique("t")}`, `${unique("mobileteacher")}@example.com`, password);
    const course = await createCourse(`Mobile Course ${unique("c")}`, unique("MOB").toUpperCase(), teacher.id);
    const student = await createStudent(`Mobile Student ${unique("s")}`, unique("MS"), course.id);
    const session = await createSession(course.subjects[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Chapter 1");

    await login(page, teacher.email, password);
    await expect(page).toHaveURL(/\/teacher/);

    const nav = page.getByRole("navigation", { name: "Teacher" });
    await expect(nav.getByRole("link", { name: "Courses" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Students" })).toBeVisible();
    await expect(page.locator("tr", { hasText: course.name })).toBeVisible();
    await assertNoPageOverflow(page);

    await nav.getByRole("link", { name: "Students" }).click();
    await expect(page).toHaveURL(/\/teacher\/students/);
    await expect(page.locator("tr", { hasText: student.name })).toBeVisible();
    await assertNoPageOverflow(page);

    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page.getByRole("link", { name: "Sessions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create session" })).toBeVisible();
    await expect(page.getByText("Chapter 1")).toBeVisible();
    await assertNoPageOverflow(page);

    await page.goto(`/teacher/sessions/${session.id}`);
    const row = page.locator("tr", { hasText: student.name });
    await expect(row.getByText("Present", { exact: true })).toBeVisible();
    await expect(row.getByText("Absent", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save attendance" })).toBeVisible();
    await assertNoPageOverflow(page);
  });
});
