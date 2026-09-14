import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createTeacher, createCourse, createStudent, createSession, prisma } from "./db";

async function setUpSessionWithRoster() {
  const password = "TeacherPass123!";
  const teacher = await createTeacher(
    `Attendance Teacher ${unique("t")}`,
    `${unique("attendanceteacher")}@example.com`,
    password,
  );
  const course = await createCourse(`Attendance Course ${unique("c")}`, unique("ATT").toUpperCase(), teacher.id);
  const studentA = await createStudent(`Arjuna ${unique("s")}`, unique("R1"), course.id);
  const studentB = await createStudent(`Krishna ${unique("s")}`, unique("R2"), course.id);
  const session = await createSession(course.subjects[0].id, teacher.id, new Date("2026-02-04T00:00:00.000Z"));
  return { teacher, password, course, studentA, studentB, session };
}

test.describe("teacher: attendance marking", () => {
  test("defaults everyone to Present and shows live counts", async ({ page }) => {
    const { teacher, password, session, studentA, studentB } = await setUpSessionWithRoster();
    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${session.id}`);

    await expect(page.locator("tr", { hasText: studentA.name }).getByText("Present", { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: studentB.name }).getByText("Present", { exact: true })).toBeVisible();
    await expect(page.getByText("2 present")).toBeVisible();
    await expect(page.getByText("0 absent")).toBeVisible();
  });

  test("marking a student autosaves and persists after reload", async ({ page }) => {
    const { teacher, password, session, studentA } = await setUpSessionWithRoster();
    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${session.id}`);

    await page.locator("tr", { hasText: studentA.name }).locator('label:has-text("Absent")').click();
    await expect(page.getByText("1 absent")).toBeVisible();

    // Autosave fires ~1.2s after the change and redirects with a flash message.
    await page.waitForURL((url) => url.searchParams.get("flash") !== null, { timeout: 8000 });
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(page.getByText(/Last saved .* by/)).toBeVisible();

    const record = await prisma.attendanceRecord.findFirstOrThrow({
      where: { sessionId: session.id, studentId: studentA.id },
    });
    expect(record.status).toBe("ABSENT");

    // Fresh load reflects the saved state, not just the in-page one.
    await page.goto(`/teacher/sessions/${session.id}`);
    await expect(page.locator("tr", { hasText: studentA.name }).getByText("Absent", { exact: true })).toBeVisible();
  });

  test("mark all present resets the whole roster in one action", async ({ page }) => {
    const { teacher, password, session, studentA, studentB } = await setUpSessionWithRoster();
    await prisma.attendanceRecord.createMany({
      data: [
        { sessionId: session.id, studentId: studentA.id, status: "ABSENT", markedById: teacher.id },
        { sessionId: session.id, studentId: studentB.id, status: "LATE", markedById: teacher.id },
      ],
    });

    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${session.id}`);
    await expect(page.getByText("2 present")).toHaveCount(0);

    await page.click('button:has-text("Mark all present")');
    await expect(page.getByText("2 present")).toBeVisible();
    await page.waitForURL((url) => url.searchParams.get("flash") !== null, { timeout: 8000 });

    const records = await prisma.attendanceRecord.findMany({ where: { sessionId: session.id } });
    expect(records.every((r) => r.status === "PRESENT")).toBe(true);
  });

  test("search filters the visible roster without dropping hidden rows from the save", async ({ page }) => {
    const { teacher, password, session, studentA, studentB } = await setUpSessionWithRoster();
    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${session.id}`);

    await page.fill('input[placeholder*="Search"]', studentA.name);
    await expect(page.locator("tr", { hasText: studentA.name })).toBeVisible();
    await expect(page.locator("tr", { hasText: studentB.name })).toBeHidden();

    // Save while filtered — the hidden student's status must still be submitted.
    await page.click('button:has-text("Save attendance")');
    await page.waitForURL((url) => url.searchParams.get("flash") !== null, { timeout: 8000 });

    const records = await prisma.attendanceRecord.findMany({ where: { sessionId: session.id } });
    const studentIds = records.map((r) => r.studentId);
    expect(studentIds).toContain(studentA.id);
    expect(studentIds).toContain(studentB.id);
  });
});
