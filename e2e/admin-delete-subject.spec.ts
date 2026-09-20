import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher, prisma } from "./db";

test.describe("admin: delete subject", () => {
  test("deletes a subject without attendance and blocks when attendance exists", async ({ page }) => {
    const course = await createCourse(`Delete Subject ${unique("c")}`, unique("DEL").toUpperCase());
    const removable = await prisma.courseSubject.create({
      data: { courseId: course.id, name: `Extra ${unique("x")}` },
    });
    const teacher = await createTeacher(`Delete Teacher ${unique("t")}`, `${unique("delteacher")}@example.com`, "TeacherPass123!");
    const student = await createStudent(`Delete Student ${unique("s")}`, unique("DS"), course.id);
    const session = await createSession(course.subjects[0].id, teacher.id, new Date("2026-03-15T00:00:00.000Z"));
    await prisma.attendanceRecord.create({
      data: { sessionId: session.id, studentId: student.id, status: "PRESENT", markedById: teacher.id },
    });

    await loginAsAdmin(page);

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}`);
    await expect(page.getByRole("button", { name: "Delete subject" })).toHaveCount(0);
    await expect(page.getByText("This subject has attendance records. Archive it instead of deleting.")).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/subjects/${removable.id}`);
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Delete subject" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: removable.name, exact: true })).toHaveCount(0);

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}`);
    await expect(page.getByRole("button", { name: "Delete subject" })).toHaveCount(0);
    await expect(page.getByText("A course needs at least one subject.")).toBeVisible();
  });
});
