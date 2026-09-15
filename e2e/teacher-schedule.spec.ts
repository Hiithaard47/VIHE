import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import {
  createCourse,
  createSession,
  createStudent,
  createStaffWithPermissions,
  createTeacher,
  defaultSessionCategory,
  prisma,
} from "./db";
import { PERMISSIONS } from "../src/lib/permissions";
import { mondayOf } from "../src/lib/schedule";
import {
  addUtcDays,
  formatDayHeading,
  formatDisplayDate,
  startOfTodayUtc,
  toDateInputValue,
} from "../src/lib/time";

/** Next calendar week's Monday — every day in that week is strictly after today. */
function futureTermMonday() {
  return addUtcDays(mondayOf(startOfTodayUtc()), 7);
}

test.describe("teacher: week schedule", () => {
  test("saves one meeting on that day and that subject only", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Schedule Teacher ${unique("t")}`, `${unique("schedteacher")}@example.com`, password);
    const course = await createCourse(`Schedule Course ${unique("c")}`, unique("SCH").toUpperCase(), teacher.id);
    const student = await createStudent(`Schedule Student ${unique("s")}`, unique("SCS"), course.id);
    const klass = await defaultSessionCategory();
    const temple = await prisma.sessionCategory.create({ data: { name: `Temple ${unique("k")}` } });
    const subjectId = course.subjects[0].id;
    const evening = await prisma.courseSubject.create({
      data: {
        courseId: course.id,
        name: "Evening",
        teachers: { create: [{ teacherId: teacher.id }] },
      },
    });

    const termStart = futureTermMonday();
    const mon = termStart;
    const tue = addUtcDays(termStart, 1);
    const sun = addUtcDays(termStart, 6);
    const mon2 = addUtcDays(termStart, 7);
    const wed2 = addUtcDays(termStart, 9);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);

    await page.getByLabel("Term start").fill(toDateInputValue(termStart));
    await page.getByLabel("Weeks").fill("2");
    await expect(page.getByRole("region", { name: formatDayHeading(mon) })).toBeInViewport();
    await expect(page.getByRole("region", { name: formatDayHeading(sun) })).toBeInViewport();

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const add = page.getByRole("dialog", { name: "Add meeting" });
    await add.getByLabel("Name").fill("Chapter 1");
    await add.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await add.getByLabel("Start").fill("09:00");
    await add.getByLabel("End").fill("10:30");
    await add.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId, name: "Chapter 1" } })).toBe(1);

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(tue)}`) }).click();
    const addTemple = page.getByRole("dialog", { name: "Add meeting" });
    await addTemple.getByLabel("Name").fill("Mangla Aarti");
    await addTemple.locator('select[name="categoryId"]').selectOption({ label: temple.name });
    await addTemple.getByLabel("Start").fill("05:00");
    await addTemple.getByLabel("End").fill("05:45");
    await addTemple.getByRole("button", { name: "Add" }).click();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId } })).toBe(2);
    await expect.poll(() => prisma.classSession.count({ where: { subjectId: evening.id } })).toBe(0);
    await expect(page.getByRole("button", { name: /Apply to \d+ weeks/ })).toHaveCount(0);

    const created = await prisma.classSession.findMany({
      where: { subjectId },
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    });
    expect(created.map((row) => row.date.toISOString())).toEqual([mon.toISOString(), tue.toISOString()]);
    expect(created.map((row) => row.name)).toEqual(["Chapter 1", "Mangla Aarti"]);

    await page.goto(`/teacher/courses/${course.id}?subject=${subjectId}`);
    await expect(page.getByText("New session")).toBeVisible();
    await expect(page.getByText("Chapter 1")).toHaveCount(1);
    await expect(page.getByText(formatDisplayDate(mon))).toBeVisible();
    await expect(page.getByText(formatDisplayDate(mon2))).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(temple.name) }).click();
    await expect(page.getByText("Mangla Aarti")).toHaveCount(1);

    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toHaveCount(0);
    await expect(page.getByRole("article").filter({ hasText: "Mangla Aarti" })).toHaveCount(0);

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon2)}`) }).click();
    const addWeek2 = page.getByRole("dialog", { name: "Add meeting" });
    await addWeek2.getByLabel("Name").fill("Chapter 1");
    await addWeek2.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await addWeek2.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();

    expect(
      await waitForFlashAfter(page, () =>
        page.getByRole("article").filter({ hasText: "Chapter 1" }).getByRole("button", { name: "Remove" }).click(),
      ),
    ).toBe("success");
    expect(await prisma.classSession.count({ where: { subjectId, name: "Chapter 1" } })).toBe(1);

    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);
    await page.getByRole("button", { name: "Next week" }).click();
    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon2)}`) }).click();
    const addAgain = page.getByRole("dialog", { name: "Add meeting" });
    await addAgain.getByLabel("Name").fill("Chapter 1");
    await addAgain.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await addAgain.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();
    await expect
      .poll(() =>
        prisma.classSession.count({
          where: { subjectId, name: "Chapter 1", date: mon2 },
        }),
      )
      .toBe(1);
    const week2Class = await prisma.classSession.findFirstOrThrow({
      where: { subjectId, name: "Chapter 1", date: mon2 },
    });
    expect(
      await waitForFlashAfter(page, () =>
        page
          .getByRole("article")
          .filter({ hasText: "Chapter 1" })
          .dragTo(page.getByRole("region", { name: formatDayHeading(wed2) })),
      ),
    ).toBe("success");
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: week2Class.id } })).toMatchObject({
      date: wed2,
    });

    const week1Class = created.find((row) => row.date.toISOString() === mon.toISOString());
    await prisma.attendanceRecord.create({
      data: {
        sessionId: week1Class!.id,
        studentId: student.id,
        status: "PRESENT",
        markedById: teacher.id,
      },
    });

    await page.goto(`/teacher/courses/${course.id}?subject=${subjectId}`);
    await expect(page.getByText("1 marked")).toBeVisible();

    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" }).getByRole("button", { name: "Remove" })).toHaveCount(0);
    expect(await prisma.classSession.findUnique({ where: { id: week1Class!.id } })).not.toBeNull();
    expect(await prisma.classSession.count({ where: { subjectId: evening.id } })).toBe(0);
  });

  test("duplicates a meeting onto the next free day in the same week", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Dup Teacher ${unique("t")}`, `${unique("dupteacher")}@example.com`, password);
    const course = await createCourse(`Dup Course ${unique("c")}`, unique("DUP").toUpperCase(), teacher.id);
    const klass = await defaultSessionCategory();
    const subjectId = course.subjects[0].id;
    const termStart = futureTermMonday();
    const mon = termStart;
    const tue = addUtcDays(termStart, 1);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/schedule`);
    await page.getByLabel("Term start").fill(toDateInputValue(termStart));
    await page.getByLabel("Weeks").fill("2");
    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const add = page.getByRole("dialog", { name: "Add meeting" });
    await add.getByLabel("Name").fill("Chapter 1");
    await add.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await add.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId, name: "Chapter 1" } })).toBe(1);

    await page.getByRole("article").filter({ hasText: "Chapter 1" }).getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByRole("region", { name: formatDayHeading(tue) }).getByText("Chapter 1")).toBeVisible();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId, name: "Chapter 1" } })).toBe(2);
    await expect(page.getByRole("button", { name: "Apply to 2 weeks" })).toHaveCount(0);

    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toHaveCount(0);
  });

  test("does not let schedule remove or move a class on or before today without manage_past", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createStaffWithPermissions(
      `Lock Teacher ${unique("t")}`,
      `${unique("lockteacher")}@example.com`,
      password,
      [
        PERMISSIONS.COURSES_CONFIGURE,
        PERMISSIONS.SESSIONS_MANAGE,
        PERMISSIONS.ATTENDANCE_MARK,
        PERMISSIONS.ATTENDANCE_VIEW,
        PERMISSIONS.STUDENTS_READ,
      ],
    );
    const course = await createCourse(`Lock Course ${unique("c")}`, unique("LCK").toUpperCase(), teacher.id);
    const today = startOfTodayUtc();
    const termStart = addUtcDays(mondayOf(today), -7);
    await prisma.courseSubject.update({
      where: { id: course.subjects[0].id },
      data: { termStart, weekCount: 2 },
    });
    await createSession(course.subjects[0].id, teacher.id, today, "Today class");

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/schedule`);
    await page.getByRole("button", { name: "Next week" }).click();
    const card = page.getByRole("article").filter({ hasText: "Today class" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Remove" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Duplicate" })).toHaveCount(0);
    await expect(card).not.toHaveAttribute("draggable", "true");
  });

  test("shows an error when adding a second meeting at the same time", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Clash Teacher ${unique("t")}`, `${unique("clashteacher")}@example.com`, password);
    const course = await createCourse(`Clash Course ${unique("c")}`, unique("CLH").toUpperCase(), teacher.id);
    const klass = await defaultSessionCategory();
    const subjectId = course.subjects[0].id;
    const termStart = futureTermMonday();
    const mon = termStart;

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);
    await page.getByLabel("Term start").fill(toDateInputValue(termStart));
    await page.getByLabel("Weeks").fill("2");

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const add = page.getByRole("dialog", { name: "Add meeting" });
    await add.getByLabel("Name").fill("Chapter 1");
    await add.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await add.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const clash = page.getByRole("dialog", { name: "Add meeting" });
    await clash.getByLabel("Name").fill("Chapter 1 again");
    await clash.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await clash.getByRole("button", { name: "Add" }).click();
    await expect(clash.getByText("That day already has a session at this time.")).toBeVisible();
    await expect(page.locator("p[aria-live]")).not.toHaveText("That day already has a session at this time.");
    await expect(clash).toBeVisible();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId } })).toBe(1);
  });
});
