import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse, createStudent, createSession, prisma } from "./db";

test.describe("teacher: roster", () => {
  test("shows attendance percentage and flags a student below the threshold", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Roster Teacher ${unique("t")}`,
      `${unique("rosterteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Roster Course ${unique("c")}`, unique("ROS").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: course.id }, data: { minAttendancePercent: 75 } });

    const good = await createStudent(`Good Student ${unique("s")}`, unique("RG").toUpperCase(), course.batches[0].id);
    const poor = await createStudent(`Poor Student ${unique("s")}`, unique("RP").toUpperCase(), course.batches[0].id);

    // Four past sessions: `good` attends all four, `poor` attends one.
    //
    // Anchor to the same UTC-midnight boundary the page filters on, then step
    // back whole days. Deriving these from Date.now() instead puts the i=1
    // session exactly ON the cutoff for any host at a negative UTC offset late
    // in the day, silently dropping it from the groupBy and turning the
    // asserted 25% into 0%.
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const day = 24 * 60 * 60 * 1000;
    for (let i = 1; i <= 4; i++) {
      const classSession = await createSession(course.batches[0].id, teacher.id, new Date(todayUtc - i * day));
      await prisma.attendanceRecord.createMany({
        data: [
          { sessionId: classSession.id, studentId: good.id, status: "PRESENT", markedById: teacher.id },
          {
            sessionId: classSession.id,
            studentId: poor.id,
            status: i === 1 ? "PRESENT" : "ABSENT",
            markedById: teacher.id,
          },
        ],
      });
    }

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    const goodRow = page.locator("tr", { hasText: good.name });
    await expect(goodRow.getByText("100%")).toBeVisible();
    await expect(goodRow.getByText("At risk")).toHaveCount(0);

    const poorRow = page.locator("tr", { hasText: poor.name });
    await expect(poorRow.getByText("25%")).toBeVisible();
    await expect(poorRow.getByText("At risk")).toBeVisible();
  });

  test("shows no percentage for a student with nothing marked", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Blank Teacher ${unique("t")}`,
      `${unique("blankteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Blank Course ${unique("c")}`, unique("BLK").toUpperCase(), teacher.id);
    const student = await createStudent(`Blank Student ${unique("s")}`, unique("RB").toUpperCase(), course.batches[0].id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    // Target the attendance cell by position: the Status cell renders an em
    // dash too, so getByText("—") would match twice and trip strict mode.
    const attendanceCell = page.locator("tr", { hasText: student.name }).locator("td").nth(2);
    await expect(attendanceCell).toHaveText("—");
    await expect(page.locator("tr", { hasText: student.name }).getByText("0%")).toHaveCount(0);
  });

  test("enrolls and unenrolls a student", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Enroll Teacher ${unique("t")}`,
      `${unique("enrollteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Enroll Course ${unique("c")}`, unique("ENR").toUpperCase(), teacher.id);
    const student = await createStudent(`Enroll Student ${unique("s")}`, unique("RE").toUpperCase());

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    await expect(page.getByText("No students enrolled in this course yet.")).toBeVisible();

    await page.getByRole("button", { name: "Add student" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(/Search by name/).fill(student.name);
    await dialog.getByRole("option", { name: new RegExp(student.name) }).click();
    const added = await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Add student" }).click());
    expect(added).toBe("success");
    await expect(page.locator("tr", { hasText: student.name })).toBeVisible();

    const removed = await waitForFlashAfter(page, () =>
      page.locator("tr", { hasText: student.name }).getByRole("button", { name: "Remove" }).click(),
    );
    expect(removed).toBe("success");
    await expect(page.locator("tr", { hasText: student.name })).toHaveCount(0);
  });

  test("does not offer enrolment to a teacher who is not assigned", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Outsider Teacher ${unique("t")}`,
      `${unique("outsiderteacher")}@example.com`,
      password,
    );
    const other = await createCourse(`Outsider Course ${unique("c")}`, unique("OUT").toUpperCase());

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${other.id}/roster`);
    await expect(page).toHaveURL(/\/teacher$/);
  });

  test("removing an already-removed student is a graceful no-op", async ({ page, context }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Racer Teacher ${unique("t")}`,
      `${unique("racerteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Racer Course ${unique("c")}`, unique("RCE").toUpperCase(), teacher.id);
    const student = await createStudent(`Racer Student ${unique("s")}`, unique("RR").toUpperCase(), course.batches[0].id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);
    await expect(page.locator("tr", { hasText: student.name })).toBeVisible();

    // A second tab, signed in as the same teacher and viewing the same
    // roster, stands in for a second person racing to remove the same
    // student — or equally, a stale reload of this same tab.
    const page2 = await context.newPage();
    await page2.goto(`/teacher/courses/${course.id}/roster`);
    await expect(page2.locator("tr", { hasText: student.name })).toBeVisible();

    // First removal succeeds and the row disappears.
    const firstRemoved = await waitForFlashAfter(page, () =>
      page.locator("tr", { hasText: student.name }).getByRole("button", { name: "Remove" }).click(),
    );
    expect(firstRemoved).toBe("success");
    await expect(page.locator("tr", { hasText: student.name })).toHaveCount(0);

    // The second tab's DOM is now stale — it still shows the (already
    // removed) student's Remove button. Clicking it resubmits the exact
    // same courseId+studentId delete a second time. That must be a graceful
    // no-op (a success flash), not an unhandled P2025 surfacing as a 500.
    const secondRemoved = await waitForFlashAfter(page2, () =>
      page2.locator("tr", { hasText: student.name }).getByRole("button", { name: "Remove" }).click(),
    );
    expect(secondRemoved).toBe("success");

    await page2.close();
  });
});
