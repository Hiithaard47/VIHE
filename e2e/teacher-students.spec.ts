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
    const student = await createStudent(`Directory Student ${unique("s")}`, unique("R"), course.batches[0].id, {
      email: `${unique("directorystudent")}@example.com`,
      phone: `555${unique("p").replace(/\D/g, "").padEnd(7, "0").slice(0, 7)}`,
    });

    await login(page, teacher.email, password);
    await page.goto("/teacher/students");

    const row = page.locator("tr", { hasText: student.name });
    await expect(row).toBeVisible();
    await expect(row.getByText(student.rollNumber)).toBeVisible();
    await expect(row.getByText(course.name)).toBeVisible();

    // Read-only directory plus a search box. No edit forms or buttons in <main>.
    const main = page.locator("main");
    await expect(main.locator("form")).toHaveCount(0);
    await expect(main.locator("input")).toHaveCount(1);
    await expect(main.locator("button")).toHaveCount(0);
  });

  test("finds enrolled students by email or mobile", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Search Teacher ${unique("t")}`,
      `${unique("searchteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Search Course ${unique("c")}`, unique("SRCH").toUpperCase(), teacher.id);
    const email = `${unique("searchstudent")}@example.com`;
    const phone = `555${Date.now().toString().slice(-7)}`;
    const match = await createStudent(`Search Student ${unique("s")}`, unique("RS"), course.batches[0].id, {
      email,
      phone,
    });
    const other = await createStudent(`Other Student ${unique("s")}`, unique("RO"), course.batches[0].id);

    await login(page, teacher.email, password);
    await page.goto("/teacher/students");
    await expect(page.locator("tr", { hasText: match.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: other.name })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search" }).fill(email);
    await expect(page.locator("tr", { hasText: match.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: other.name })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Search" }).fill(phone);
    await expect(page.locator("tr", { hasText: match.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: other.name })).toHaveCount(0);
  });
});
