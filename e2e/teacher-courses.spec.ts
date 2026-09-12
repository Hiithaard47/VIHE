import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse, createSession, prisma } from "./db";
import { startOfTodayUtc } from "../src/lib/time";

test.describe("teacher: course visibility & session management", () => {
  test("sees only courses they are assigned to", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Course Teacher ${unique("t")}`, `${unique("courseview")}@example.com`, password);
    const mine = await createCourse(`Bhakti Sastra ${unique("c")}`, unique("MIN").toUpperCase(), teacher.id);
    const other = await createCourse(`Vedic Cosmology ${unique("c")}`, unique("OTH").toUpperCase());

    await login(page, teacher.email, password);
    await expect(page).toHaveURL(/\/teacher/);

    await expect(page.locator("a", { hasText: mine.name })).toBeVisible();
    await expect(page.locator("a", { hasText: other.name })).toHaveCount(0);

    await page.locator("a", { hasText: mine.name }).click();
    await expect(page.getByText("New session")).toBeVisible();
    await expect(page.locator('button:has-text("Create session")')).toBeVisible();

    await page.goto(`/teacher/courses/${other.id}`);
    await expect(page).toHaveURL(/\/teacher$/);
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
    await createSession(course.batches[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Chapter 1");
    await prisma.classSession.create({
      data: {
        batchId: course.batches[0].id,
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

  test("hides category tabs the course batch has not used", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Unused Tab Teacher ${unique("t")}`, `${unique("unusedtab")}@example.com`, password);
    const course = await createCourse(`Unused Tab Course ${unique("c")}`, unique("UTB").toUpperCase(), teacher.id);
    const unused = await prisma.sessionCategory.create({ data: { name: `Sadhana ${unique("s")}` } });
    await createSession(course.batches[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"), "Chapter 1");

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
    await createSession(course.batches[0].id, teacher.id, new Date("2026-11-20T00:00:00.000Z"));

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.getByRole("button", { name: "Session actions" }).click();
    await page.getByRole("menuitem", { name: "Change date" }).click();
    const dialog = page.getByRole("dialog", { name: "Change date" });
    await dialog.locator('input[type="date"]').fill("2026-12-01");

    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Save date" }).click())).toBe(
      "success",
    );
    await expect(page.getByText("1 Dec 2026")).toBeVisible();
    await expect(page.getByText("20 Nov 2026")).toHaveCount(0);
  });

  test("does not offer a date change for today or past sessions", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Past Session Teacher ${unique("t")}`, `${unique("pastdate")}@example.com`, password);
    const course = await createCourse(`Past Session Course ${unique("c")}`, unique("PSD").toUpperCase(), teacher.id);
    await createSession(course.batches[0].id, teacher.id, startOfTodayUtc());
    await createSession(course.batches[0].id, teacher.id, new Date("2026-01-05T00:00:00.000Z"));

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.getByRole("button", { name: "Session actions" }).first().click();
    await expect(page.getByRole("menuitem", { name: "Mark attendance" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Change date" })).toHaveCount(0);
  });
});
