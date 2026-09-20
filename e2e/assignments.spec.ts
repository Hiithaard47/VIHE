import { test, expect } from "@playwright/test";
import { login, signOut, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createStudent, createTeacher, prisma } from "./db";
import { startOfTodayUtc } from "../src/lib/time";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

function upload(page: import("@playwright/test").Page, names: string | string[]) {
  const list = Array.isArray(names) ? names : [names];
  return page.locator('input[name="files"]').setInputFiles(
    list.map((name) => ({
      name,
      mimeType: "image/png",
      buffer: PNG,
    })),
  );
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
    const student = await createStudent(`Assignment Student ${unique("s")}`, unique("AS"), course.id, {
      email: studentEmail,
      password: studentPassword,
    });
    const title = `Essay ${unique("asg")}`;

    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Maximum marks").fill("20");
    await upload(page, ["question-a.png", "question-b.png"]);
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Issue assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText("Not submitted")).toBeVisible();
    await expect(page.getByRole("link", { name: /question-a\.png/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /question-b\.png/ })).toBeVisible();
    await upload(page, ["answer-a.png", "answer-b.png"]);
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit assignment" }).click())).toBe(
      "success",
    );
    await expect(page.getByText(/Out of \d+ · Submitted/)).toBeVisible();
    await expect(page.getByRole("link", { name: "answer-a.png" })).toBeVisible();
    await expect(page.getByRole("link", { name: "answer-b.png" })).toBeVisible();

    await signOut(page);
    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText(student.name)).toBeVisible();
    await expect(page.getByText("Submitted")).toBeVisible();
    const row = page.locator("tr", { hasText: student.name });
    await expect(row.getByRole("link", { name: "answer-a.png" })).toBeVisible();
    await expect(row.getByRole("link", { name: "answer-b.png" })).toBeVisible();
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
    await createStudent(`Late Student ${unique("s")}`, unique("LS"), course.id, {
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
    await expect(page.getByRole("button", { name: /Submit/ })).toHaveCount(0);
  });

  test("student can submit a new attempt after grading", async ({ page }) => {
    const teacherPassword = "TeacherPass123!";
    const studentPassword = "StudentPass123!";
    const teacher = await createTeacher(
      `Retry Teacher ${unique("t")}`,
      `${unique("retryteacher")}@example.com`,
      teacherPassword,
    );
    const course = await createCourse(`Retry Course ${unique("c")}`, unique("RTY").toUpperCase(), teacher.id);
    const studentEmail = `${unique("retrystudent")}@example.com`;
    const student = await createStudent(`Retry Student ${unique("s")}`, unique("RS"), course.id, {
      email: studentEmail,
      password: studentPassword,
    });
    const title = `Retry essay ${unique("asg")}`;

    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Maximum marks").fill("10");
    await upload(page, "question.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Issue assignment" }).click())).toBe(
      "success",
    );

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await upload(page, "attempt-1.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit assignment" }).click())).toBe(
      "success",
    );

    await signOut(page);
    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    const row = page.locator("tr", { hasText: student.name });
    await expect(row.getByText("Attempt 1")).toBeVisible();
    await row.locator('input[name="marks"]').fill("4");
    expect(await waitForFlashAfter(page, () => row.getByRole("button", { name: "Save" }).click())).toBe("success");

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText("Submit a new attempt if you need to revise")).toBeVisible();
    await upload(page, "attempt-2.png");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit new attempt" }).click())).toBe(
      "success",
    );
    await expect(page.getByText(/Out of 10 · Submitted · Attempt 2/)).toBeVisible();
    await expect(page.getByRole("link", { name: "attempt-2.png" })).toBeVisible();
    await expect(page.getByRole("link", { name: "attempt-1.png" })).toBeVisible();

    await signOut(page);
    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    const gradedRow = page.locator("tr", { hasText: student.name });
    await expect(gradedRow.getByText("Attempt 2")).toBeVisible();
    await expect(gradedRow.getByText("2 total")).toBeVisible();
    await expect(gradedRow.getByRole("link", { name: "attempt-2.png" })).toBeVisible();
    await gradedRow.locator('input[name="marks"]').fill("9");
    expect(await waitForFlashAfter(page, () => gradedRow.getByRole("button", { name: "Save" }).click())).toBe(
      "success",
    );
    await expect(gradedRow.getByText("Graded")).toBeVisible();
  });
});
