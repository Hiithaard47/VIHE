import { test, expect } from "@playwright/test";
import { login, signOut, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createStudent, createTeacher, prisma } from "./db";
import { startOfTodayUtc } from "../src/lib/time";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

function upload(page: import("@playwright/test").Page, name: string) {
  return page.locator('input[name="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG,
  });
}

test.describe("course assignments", () => {
  test("teacher issues a test, student uploads work, teacher marks it", async ({ page }) => {
    const teacherPassword = "TeacherPass123!";
    const studentPassword = "StudentPass123!";
    const teacher = await createTeacher(
      `Assignment Teacher ${unique("t")}`,
      `${unique("asgteacher")}@example.com`,
      teacherPassword,
    );
    const course = await createCourse(`Assignment Course ${unique("c")}`, unique("ASG").toUpperCase(), teacher.id);
    const studentEmail = `${unique("asgstudent")}@example.com`;
    const student = await createStudent(`Assignment Student ${unique("s")}`, unique("AS"), course.batches[0].id, {
      email: studentEmail,
      password: studentPassword,
    });
    const title = `Essay ${unique("asg")}`;

    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Maximum marks").fill("20");
    await upload(page, "question.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Issue assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText("Not submitted")).toBeVisible();
    await upload(page, "answer.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByText("Submitted")).toBeVisible();

    await signOut(page);
    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText(student.name)).toBeVisible();
    await expect(page.getByText("Submitted")).toBeVisible();
    const row = page.locator("tr", { hasText: student.name });
    await row.locator('input[name="marks"]').fill("16");
    await row.locator('input[name="feedback"]').fill("Clear answers.");
    expect(await waitForFlashAfter(page, () => row.getByRole("button", { name: "Save" }).click())).toBe("success");
    await expect(row.getByText("Graded")).toBeVisible();

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await expect(page.getByText("Graded · 16/20")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText("16/20")).toBeVisible();
    await expect(page.getByText("Clear answers.")).toBeVisible();
  });

  test("allows a first late submit but blocks replacing it after the due date", async ({ page }) => {
    const teacherPassword = "TeacherPass123!";
    const studentPassword = "StudentPass123!";
    const teacher = await createTeacher(
      `Late Teacher ${unique("t")}`,
      `${unique("lateteacher")}@example.com`,
      teacherPassword,
    );
    const course = await createCourse(`Late Course ${unique("c")}`, unique("LTE").toUpperCase(), teacher.id);
    const studentEmail = `${unique("latestudent")}@example.com`;
    await createStudent(`Late Student ${unique("s")}`, unique("LS"), course.batches[0].id, {
      email: studentEmail,
      password: studentPassword,
    });
    const title = `Late essay ${unique("asg")}`;

    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByLabel("Title").fill(title);
    await upload(page, "question.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Issue assignment" }).click())).toBe(
      "success",
    );
    const assignment = await prisma.assignment.findFirstOrThrow({ where: { title } });
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { dueDate: new Date(startOfTodayUtc().getTime() - 24 * 60 * 60 * 1000) },
    });

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText("You can still submit once.")).toBeVisible();
    await upload(page, "late-answer.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByText("cannot be replaced")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit assignment" })).toHaveCount(0);
  });
});
