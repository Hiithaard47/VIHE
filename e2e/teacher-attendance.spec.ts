import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher, prisma } from "./db";
import { DEFAULT_SUBJECT_NAME } from "../src/lib/subjects";
import { formatDisplayDate, startOfTodayUtc } from "../src/lib/time";

test.describe("teacher: attendance matrix", () => {
  test("shows percents and a per-session letter grid by category", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Matrix Teacher ${unique("t")}`,
      `${unique("matrixteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Matrix Course ${unique("c")}`, unique("MTX").toUpperCase(), teacher.id);
    const student = await createStudent(`Matrix Student ${unique("s")}`, unique("MS").toUpperCase(), course.id);
    const present = await createSession(
      course.subjects[0].id,
      teacher.id,
      new Date("2026-02-01T00:00:00.000Z"),
      "Chapter 1",
    );
    const absent = await createSession(
      course.subjects[0].id,
      teacher.id,
      new Date("2026-02-03T00:00:00.000Z"),
      "Chapter 2",
    );
    const temple = await prisma.sessionCategory.create({
      data: { name: `Kirtana ${unique("k")}` },
    });
    const templeSession = await prisma.classSession.create({
      data: {
        subjectId: course.subjects[0].id,
        categoryId: temple.id,
        date: new Date("2026-02-02T00:00:00.000Z"),
        name: "Evening kirtana",
        createdById: teacher.id,
      },
    });
    await prisma.attendanceRecord.createMany({
      data: [
        { sessionId: present.id, studentId: student.id, status: "PRESENT", markedById: teacher.id },
        { sessionId: absent.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
        { sessionId: templeSession.id, studentId: student.id, status: "LATE", markedById: teacher.id },
      ],
    });

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/attendance`);

    await expect(page.getByRole("button", { name: "Print attendance" })).toBeVisible();

    const summary = page.locator("table").first().locator("tr", { hasText: student.name });
    await expect(summary.getByText("50%", { exact: true })).toBeVisible();

    const matrix = page.locator("table").nth(1);
    await expect(matrix.getByRole("link", { name: "1 Feb 2026" })).toBeVisible();
    await expect(matrix.getByRole("link", { name: "3 Feb 2026" })).toBeVisible();
    await expect(matrix.getByRole("link", { name: "2 Feb 2026" })).toHaveCount(0);
    const matrixRow = matrix.locator("tr", { hasText: student.name });
    await expect(matrixRow.getByText("P", { exact: true })).toBeVisible();
    await expect(matrixRow.getByText("A", { exact: true })).toBeVisible();
    await expect(matrixRow.getByText("L", { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(temple.name) }).click();
    const templeMatrix = page.locator("table").nth(1);
    await expect(templeMatrix.getByRole("link", { name: "2 Feb 2026" })).toBeVisible();
    await expect(templeMatrix.getByRole("link", { name: "1 Feb 2026" })).toHaveCount(0);
    await expect(templeMatrix.locator("tr", { hasText: student.name }).getByText("L", { exact: true })).toBeVisible();
  });

  test("print layout keeps the session matrix and hides the percent summary", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Print Teacher ${unique("t")}`,
      `${unique("printteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Print Course ${unique("c")}`, unique("PRT").toUpperCase(), teacher.id);
    const student = await createStudent(`Print Student ${unique("s")}`, unique("PS").toUpperCase(), course.id);
    const session = await createSession(
      course.subjects[0].id,
      teacher.id,
      new Date("2026-02-01T00:00:00.000Z"),
      "Chapter 1",
    );
    await prisma.attendanceRecord.create({
      data: { sessionId: session.id, studentId: student.id, status: "PRESENT", markedById: teacher.id },
    });

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/attendance`);

    const printHeading = page.getByRole("heading", { name: "Attendance", exact: true, level: 1 });
    const summaryHeading = page.getByRole("heading", { name: /Attendance · 1 student/ });
    const printButton = page.getByRole("button", { name: "Print attendance" });

    await expect(printButton).toBeVisible();
    await expect(summaryHeading).toBeVisible();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await expect(printHeading).toBeHidden();

    await page.evaluate(() => {
      (window as unknown as { __printCalled?: boolean }).__printCalled = false;
      window.print = () => {
        (window as unknown as { __printCalled?: boolean }).__printCalled = true;
      };
    });
    await printButton.click();
    expect(await page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled)).toBe(true);

    await page.emulateMedia({ media: "print" });

    await expect(printHeading).toBeVisible();
    await expect(page.getByText(`${course.name} · ${DEFAULT_SUBJECT_NAME}`)).toBeVisible();
    await expect(page.getByText(`Printed ${formatDisplayDate(startOfTodayUtc())}`)).toBeVisible();
    await expect(page.getByText(/Class · 1 session/)).toBeVisible();
    await expect(summaryHeading).toBeHidden();
    await expect(printButton).toBeHidden();
    await expect(page.getByText("100%", { exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: "1 Feb 2026" })).toBeVisible();
    await expect(page.locator("table").locator("tr", { hasText: student.name }).getByText("P", { exact: true })).toBeVisible();
  });
});
