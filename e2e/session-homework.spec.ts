import { test, expect } from "@playwright/test";
import { login, signOut, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher, prisma } from "./db";
import { startOfTodayUtc, addUtcDays } from "../src/lib/time";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("session homework", () => {
  test("teacher assigns homework; student submits only on the session day", async ({ page }) => {
    const teacherPassword = "TeacherPass123!";
    const studentPassword = "StudentPass123!";
    const teacher = await createTeacher(
      `Homework Teacher ${unique("t")}`,
      `${unique("hwteacher")}@example.com`,
      teacherPassword,
    );
    const course = await createCourse(`Homework Course ${unique("c")}`, unique("HWK").toUpperCase(), teacher.id);
    const studentEmail = `${unique("hwstudent")}@example.com`;
    const student = await createStudent(`Homework Student ${unique("s")}`, unique("HS"), course.id, {
      email: studentEmail,
      password: studentPassword,
    });
    const today = await createSession(course.subjects[0].id, teacher.id, startOfTodayUtc(), "Today class");
    const past = await createSession(
      course.subjects[0].id,
      teacher.id,
      addUtcDays(startOfTodayUtc(), -2),
      "Past class",
    );
    const title = `Reading notes ${unique("hw")}`;

    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/sessions/${today.id}`);
    await page.getByRole("button", { name: "Assign homework" }).click();
    const todayDialog = page.getByRole("dialog");
    await todayDialog.getByLabel("Title").fill(title);
    await todayDialog.getByLabel("Instructions (optional)").fill("Bring one page of notes.");
    expect(
      await waitForFlashAfter(page, () => todayDialog.getByRole("button", { name: "Assign homework" }).click()),
    ).toBe("success");
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/0\/1 submitted · not graded/)).toBeVisible();

    await page.goto(`/teacher/sessions/${past.id}`);
    await page.getByRole("button", { name: "Assign homework" }).click();
    const pastDialog = page.getByRole("dialog");
    await pastDialog.getByLabel("Title").fill(`Past homework ${unique("hw")}`);
    expect(
      await waitForFlashAfter(page, () => pastDialog.getByRole("button", { name: "Assign homework" }).click()),
    ).toBe("success");

    await signOut(page);
    await login(page, studentEmail, studentPassword);
    await page.goto(`/student/courses/${course.id}/homework`);
    await expect(page.getByRole("heading", { name: /Pending/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await page.getByRole("link", { name: /Past homework/ }).click();
    await expect(page.getByText("You can submit homework only on the session day.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit homework" })).toHaveCount(0);

    await page.goto(`/student/courses/${course.id}/homework`);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.locator('input[name="files"]').setInputFiles({
      name: "notes.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Submit homework" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: "notes.png" })).toBeVisible();

    await page.goto(`/student/courses/${course.id}/homework`);
    await expect(page.getByRole("heading", { name: /Submitted/ })).toBeVisible();
    const submitted = page.locator("section", { has: page.getByRole("heading", { name: /Submitted/ }) });
    await expect(submitted.getByRole("link", { name: new RegExp(title) })).toBeVisible();

    await signOut(page);
    await login(page, teacher.email, teacherPassword);
    await page.goto(`/teacher/sessions/${today.id}`);
    await expect(page.getByText("1/1 submitted · not graded")).toBeVisible();
    const row = page.locator("li", { hasText: student.name });
    await expect(row.getByText(/Submitted/)).toBeVisible();
    await expect(row.getByRole("link", { name: "notes.png" })).toBeVisible();
    await expect(page.getByLabel("Marks")).toHaveCount(0);
  });
});
