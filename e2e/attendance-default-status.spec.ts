import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createTeacher, createCourse, createStudent, createSession, prisma } from "./db";

test.describe("attendance: course default status", () => {
  test("seeds unmarked students from the course default instead of PRESENT", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Default Teacher ${unique("t")}`,
      `${unique("defaultteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Default Course ${unique("c")}`, unique("DEF").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: course.id }, data: { defaultStatus: "ABSENT" } });

    const student = await createStudent(`Default Student ${unique("s")}`, unique("RD").toUpperCase(), course.batches[0].id);
    const classSession = await createSession(course.batches[0].id, teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${classSession.id}`);

    await expect(page.locator(`input[name="status:${student.id}"][value="ABSENT"]`)).toBeChecked();
    await expect(page.locator(`input[name="status:${student.id}"][value="PRESENT"]`)).not.toBeChecked();
  });
});
