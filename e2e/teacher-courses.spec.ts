import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse, createSession, prisma } from "./db";
import { startOfTodayUtc } from "../src/lib/time";

test.describe("teacher: course visibility & session management", () => {
  test("highlights the current section in the side nav", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Nav Teacher ${unique("t")}`, `${unique("teachernav")}@example.com`, password);

    await login(page, teacher.email, password);
    await expect(page).toHaveURL(/\/teacher/);

    const nav = page.getByRole("navigation").filter({ hasText: "Courses" });
    await expect(nav.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Students" })).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Students" }).click();
    await expect(page).toHaveURL(/\/teacher\/students/);
    await expect(nav.getByRole("link", { name: "Students" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Courses" })).not.toHaveAttribute("aria-current", "page");
  });

  test("sees only courses they are assigned to", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Course Teacher ${unique("t")}`, `${unique("courseview")}@example.com`, password);
    const mine = await createCourse(`Bhakti Sastra ${unique("c")}`, unique("MIN").toUpperCase(), teacher.id);
    const other = await createCourse(`Vedic Cosmology ${unique("c")}`, unique("OTH").toUpperCase());

    await login(page, teacher.email, password);
    await expect(page).toHaveURL(/\/teacher/);

    const mineRow = page.locator("tr", { hasText: mine.name });
    await expect(mineRow).toBeVisible();
    await expect(mineRow.getByRole("link", { name: "Default" })).toBeVisible();
    await expect(page.locator("tr", { hasText: other.name })).toHaveCount(0);

    await mineRow.getByRole("link", { name: "Default" }).click();
    await expect(page.getByText("New session")).toBeVisible();
    await expect(page.locator('button:has-text("Create session")')).toBeVisible();

    await page.goto(`/teacher/courses/${other.id}`);
    await expect(page).toHaveURL(/\/teacher$/);
  });

  test("lists archived assigned courses under Archived", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Archive Teacher ${unique("t")}`, `${unique("archivet")}@example.com`, password);
    const active = await createCourse(`Active Course ${unique("c")}`, unique("ACT").toUpperCase(), teacher.id);
    const archived = await createCourse(`Archived Course ${unique("c")}`, unique("ARV").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: archived.id }, data: { isActive: false } });

    await login(page, teacher.email, password);
    await page.goto("/teacher");

    await expect(page.getByRole("link", { name: "Active", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("tr", { hasText: active.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: archived.name })).toHaveCount(0);

    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await expect(page.getByRole("link", { name: "Archived", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("tr", { hasText: archived.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: active.name })).toHaveCount(0);

    await page.getByRole("link", { name: archived.name }).click();
    await expect(page.getByText("This course is archived. An admin can restore it to make changes.")).toBeVisible();
  });

  test("sees sessions from every assigned subject", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Multi Subject Teacher ${unique("t")}`, `${unique("multisubject")}@example.com`, password);
    const course = await createCourse(`Multi Subject Course ${unique("c")}`, unique("MSC").toUpperCase(), teacher.id);
    const evening = await prisma.courseSubject.create({
      data: {
        courseId: course.id,
        name: "Evening",
        teachers: { create: [{ teacherId: teacher.id }] },
      },
    });
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Morning class");
    await createSession(evening.id, teacher.id, new Date("2026-03-16T00:00:00.000Z"), "Evening class");

    await login(page, teacher.email, password);
    await page.goto("/teacher");
    const row = page.locator("tr", { hasText: course.name });
    await expect(row.getByRole("link", { name: "Default" })).toBeVisible();
    await expect(row.getByRole("link", { name: "Evening" })).toBeVisible();
    await row.getByRole("link", { name: "Default" }).click();
    await expect(page.getByText("Morning class")).toBeVisible();
    await expect(page.getByText("Evening class")).toHaveCount(0);

    await page.goto("/teacher");
    await page.locator("tr", { hasText: course.name }).getByRole("link", { name: "Evening" }).click();
    await expect(page.getByText("Evening class")).toBeVisible();
    await expect(page.getByText("Morning class")).toHaveCount(0);

    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page.getByText("Morning class")).toBeVisible();
    await expect(page.getByText("Evening class")).toBeVisible();
    await expect(page.getByText("15 Mar 2026 · Default")).toBeVisible();
    await expect(page.getByText("16 Mar 2026 · Evening")).toBeVisible();
    await expect(page.locator('select[name="subjectId"]')).toBeVisible();
  });

  test("creates a session for an assigned course", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Session Teacher ${unique("t")}`, `${unique("sessionteacher")}@example.com`, password);
    const course = await createCourse(`Session Course ${unique("c")}`, unique("SES").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.fill('input[type="date"]', "2026-03-15");
    await page.fill('input[name="name"]', "Chapter 1 overview");

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Create session")'));
    expect(kind).toBe("success");
    await expect(page.getByRole("link", { name: /Class/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Chapter 1 overview")).toBeVisible();
    await expect(page.getByText("15 Mar 2026")).toBeVisible();
  });

  test("lists sessions on a tab per category", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Group Teacher ${unique("t")}`, `${unique("groupteacher")}@example.com`, password);
    const course = await createCourse(`Group Course ${unique("c")}`, unique("GRP").toUpperCase(), teacher.id);
    const temple = await prisma.sessionCategory.create({ data: { name: `Kirtana ${unique("k")}` } });
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Chapter 1");
    await prisma.classSession.create({
      data: {
        subjectId: course.subjects[0].id,
        categoryId: temple.id,
        date: new Date("2026-03-16T00:00:00.000Z"),
        name: "Evening kirtana",
        createdById: teacher.id,
      },
    });

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await expect(page.getByRole("link", { name: /Class/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Chapter 1")).toBeVisible();
    await expect(page.getByText("Evening kirtana")).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(temple.name) }).click();
    await expect(page.getByRole("link", { name: new RegExp(temple.name) })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Evening kirtana")).toBeVisible();
    await expect(page.getByText("Chapter 1")).toHaveCount(0);
  });

  test("hides category tabs the course has not used", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Unused Tab Teacher ${unique("t")}`, `${unique("unusedtab")}@example.com`, password);
    const course = await createCourse(`Unused Tab Course ${unique("c")}`, unique("UTB").toUpperCase(), teacher.id);
    const unused = await prisma.sessionCategory.create({ data: { name: `Sadhana ${unique("s")}` } });
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Chapter 1");

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await expect(page.getByRole("link", { name: /Class/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(unused.name) })).toHaveCount(0);
    await expect(page.locator('select[name="categoryId"]')).toContainText(unused.name);
  });

  test("changes the date of a future session", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Reschedule Teacher ${unique("t")}`, `${unique("reschedule")}@example.com`, password);
    const course = await createCourse(`Reschedule Course ${unique("c")}`, unique("RSC").toUpperCase(), teacher.id);
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-11-20T00:00:00.000Z"));

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.getByRole("button", { name: "Session actions" }).click();
    await page.getByRole("menuitem", { name: "Change date or time" }).click();
    const dialog = page.getByRole("dialog", { name: "Change date or time" });
    await dialog.locator('input[type="date"]').fill("2026-12-01");
    await dialog.locator('input[name="startTime"]').fill("14:00");
    await dialog.locator('input[name="endTime"]').fill("15:30");

    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Save" }).click())).toBe("success");
    await expect(page.getByText("1 Dec 2026")).toBeVisible();
    await expect(page.getByText("14:00–15:30")).toBeVisible();
    await expect(page.getByText("20 Nov 2026")).toHaveCount(0);
  });

  test("does not offer a date change for today or past sessions", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Past Session Teacher ${unique("t")}`, `${unique("pastdate")}@example.com`, password);
    const course = await createCourse(`Past Session Course ${unique("c")}`, unique("PSD").toUpperCase(), teacher.id);
    await createSession(course.subjects[0].id, teacher.id, startOfTodayUtc());
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-01-05T00:00:00.000Z"));

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.getByRole("button", { name: "Session actions" }).first().click();
    await expect(page.getByRole("menuitem", { name: "Mark attendance" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Change date or time" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
  });

  test("removes an unmarked session from the list", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Delete Teacher ${unique("t")}`, `${unique("deleteteacher")}@example.com`, password);
    const course = await createCourse(`Delete Course ${unique("c")}`, unique("DEL").toUpperCase(), teacher.id);
    await createSession(course.subjects[0].id, teacher.id, new Date("2026-11-20T00:00:00.000Z"), "Chapter 4");

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);
    await page.getByRole("button", { name: "Session actions" }).click();
    expect(await waitForFlashAfter(page, () => page.getByRole("menuitem", { name: "Remove" }).click())).toBe("success");
    await expect(page.getByText("Chapter 4")).toHaveCount(0);
  });
});
