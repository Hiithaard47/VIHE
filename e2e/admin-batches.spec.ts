import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test("admin assigns teachers and keeps roster enrollment per batch", async ({ page }) => {
  await loginAsAdmin(page);

  const teacherOne = unique("teacher-one");
  const teacherTwo = unique("teacher-two");
  for (const [name, email] of [[teacherOne, `${teacherOne}@example.com`], [teacherTwo, `${teacherTwo}@example.com`]]) {
    await page.goto("/admin/teachers");
    await page.getByRole("button", { name: "Add teacher" }).click();
    const teacherDialog = page.getByRole("dialog");
    await teacherDialog.getByLabel("Full name").fill(name);
    await teacherDialog.getByLabel("Email").fill(email);
    await teacherDialog.getByLabel("Temporary password").fill("ChangeMe123!");
    expect(await waitForFlashAfter(page, () => teacherDialog.getByRole("button", { name: "Create teacher" }).click())).toBe("success");
  }

  const studentName = unique("Student");
  const rollNumber = unique("roll");
  await page.goto("/admin/students");
  await page.getByRole("button", { name: "Add student" }).click();
  const studentDialog = page.getByRole("dialog");
  await studentDialog.getByLabel("Full name").fill(studentName);
  await studentDialog.getByLabel("Roll number").fill(rollNumber);
  expect(await waitForFlashAfter(page, () => studentDialog.getByRole("button", { name: "Create student" }).click())).toBe("success");

  const courseName = unique("Batch Course");
  await page.goto("/admin/courses");
  await page.getByRole("button", { name: "Add course" }).click();
  const courseDialog = page.getByRole("dialog");
  await courseDialog.getByLabel("Course name").fill(courseName);
  await courseDialog.getByLabel("Course code").fill(unique("BATCH").toUpperCase());
  expect(await waitForFlashAfter(page, () => courseDialog.getByRole("button", { name: "Create course" }).click())).toBe("success");
  await page.getByRole("link", { name: courseName }).click();

  await page.getByRole("button", { name: "Add batch" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Batch name").fill("Evening");
  expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create batch" }).click())).toBe("success");
  await expect(page.getByRole("link", { name: "Evening", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Default" }).click();
  await page.getByLabel("Batch name").fill("Morning");
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save details" }).click())).toBe("success");
  const status = page.locator('section:has-text("Batch status")');
  await expect(status.getByText("Active")).toBeVisible();
  await expect(status.getByRole("button", { name: "Archive" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByRole("button", { name: "Add teacher" }).click();
  const teacherDialog = page.getByRole("dialog");
  await teacherDialog.getByPlaceholder(/Search by name/).fill(teacherOne);
  await teacherDialog.getByRole("option", { name: new RegExp(teacherOne) }).click();
  expect(await waitForFlashAfter(page, () => teacherDialog.getByRole("button", { name: "Add teacher" }).click())).toBe("success");
  await expect(page.getByRole("cell", { name: teacherOne })).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Evening" }).click();
  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByRole("button", { name: "Add teacher" }).click();
  const eveningTeacherDialog = page.getByRole("dialog");
  await eveningTeacherDialog.getByPlaceholder(/Search by name/).fill(teacherTwo);
  await eveningTeacherDialog.getByRole("option", { name: new RegExp(teacherTwo) }).click();
  expect(await waitForFlashAfter(page, () => eveningTeacherDialog.getByRole("button", { name: "Add teacher" }).click())).toBe("success");
  await expect(page.getByRole("cell", { name: teacherTwo })).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Morning" }).click();
  await page.getByRole("main").getByRole("link", { name: "Students" }).click();
  await page.getByRole("button", { name: "Add student" }).click();
  const rosterStudentDialog = page.getByRole("dialog");
  await rosterStudentDialog.getByPlaceholder(/Search by name/).fill(studentName);
  await rosterStudentDialog.getByRole("option", { name: new RegExp(studentName) }).click();
  expect(await waitForFlashAfter(page, () => rosterStudentDialog.getByRole("button", { name: "Add student" }).click())).toBe("success");
  await page.getByRole("link", { name: studentName }).click();
  await expect(page.getByRole("heading", { name: studentName })).toBeVisible();
  await expect(page.getByRole("link", { name: courseName })).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Evening" }).click();
  await page.getByRole("main").getByRole("link", { name: "Students" }).click();
  await expect(page.getByText("No students enrolled in this batch yet.")).toBeVisible();
  await expect(page.locator("tbody").getByText(studentName)).toHaveCount(0);
});
