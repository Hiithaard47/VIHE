import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, prisma } from "./db";

function csvFile(name: string, content: string) {
  return {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(content, "utf8"),
  };
}

test.describe("admin bulk import", () => {
  test("imports teachers and students from CSV", async ({ page }) => {
    const course = await createCourse(`Import Course ${unique("c")}`, unique("IMP").toUpperCase());
    const teacherEmail = `${unique("bulkteacher")}@example.com`;
    const studentRoll = unique("BR").toUpperCase();

    await loginAsAdmin(page);

    await page.goto("/admin/teachers");
    await page.getByRole("button", { name: "Import CSV" }).click();
    const teacherDialog = page.getByRole("dialog");
    await expect(teacherDialog.getByText(/Required columns: name, email/)).toBeVisible();
    await expect(teacherDialog.getByRole("button", { name: "Download sample CSV" })).toBeVisible();
    await teacherDialog.getByLabel("Default temporary password (optional)").fill("TempPass123!");
    await teacherDialog.locator('input[name="file"]').setInputFiles(
      csvFile(
        "teachers.csv",
        `name,email,phone\nBulk Teacher,${teacherEmail},555-0100\n`,
      ),
    );
    expect(await waitForFlashAfter(page, () => teacherDialog.getByRole("button", { name: "Import" }).click())).toBe(
      "success",
    );
    await expect(page.getByText(teacherEmail)).toBeVisible();
    const teacher = await prisma.user.findUniqueOrThrow({
      where: { email: teacherEmail },
      include: { roles: { include: { role: true } } },
    });
    expect(teacher.roles.map((item) => item.role.name)).toContain("Teacher");

    await page.goto(`/admin/courses/${course.id}`);
    await expect(page.getByRole("button", { name: "Import CSV" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add subject" })).toBeVisible();

    await page.goto("/admin/students");
    await page.getByRole("button", { name: "Import CSV" }).click();
    const studentDialog = page.getByRole("dialog");
    await studentDialog.getByLabel("Default portal password (optional)").fill("StudentPass123!");
    await studentDialog.locator('input[name="file"]').setInputFiles(
      csvFile(
        "students.csv",
        `name,rollNumber,email,courseCode\nBulk Student,${studentRoll},${unique("bulkstudent")}@example.com,${course.code}\n`,
      ),
    );
    expect(await waitForFlashAfter(page, () => studentDialog.getByRole("button", { name: "Import" }).click())).toBe(
      "success",
    );
    await expect(page.getByText(studentRoll)).toBeVisible();
    const student = await prisma.student.findUniqueOrThrow({
      where: { rollNumber: studentRoll },
      include: { enrollments: true },
    });
    expect(student.enrollments.map((item) => item.courseId)).toContain(course.id);
  });
});
