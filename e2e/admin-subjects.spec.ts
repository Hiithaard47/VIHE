import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test("admin assigns teachers and keeps roster enrollment at course level", async ({ page }) => {
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

  const courseName = unique("Subject Course");
  await page.goto("/admin/courses");
  await page.getByRole("button", { name: "Add course" }).click();
  const courseDialog = page.getByRole("dialog");
  await courseDialog.getByLabel("Course name").fill(courseName);
  await courseDialog.getByLabel("Course code").fill(unique("SUBJ").toUpperCase());
  expect(await waitForFlashAfter(page, () => courseDialog.getByRole("button", { name: "Create course" }).click())).toBe("success");
  await page.getByRole("link", { name: courseName }).click();

  await page.getByRole("button", { name: "Add subject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject name").fill("Evening");
  expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create subject" }).click())).toBe("success");
  await expect(page.getByRole("link", { name: "Evening", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Default" }).click();
  await page.getByLabel("Subject name").fill("Morning");
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save details" }).click())).toBe("success");
  const status = page.locator('section:has-text("Subject status")');
  await expect(status.getByText("Active")).toBeVisible();
  await expect(status.getByRole("button", { name: "Archive" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByRole("button", { name: "Add teacher" }).click();
  const teacherDialog = page.getByRole("dialog");
  await teacherDialog.getByPlaceholder(/Search by name/).fill(teacherOne);
  await teacherDialog.getByRole("option", { name: new RegExp(teacherOne) }).click();
  expect(await waitForFlashAfter(page, () => teacherDialog.getByRole("button", { name: "Add teacher" }).click())).toBe("success");
  await expect(page.getByRole("cell", { name: teacherOne, exact: true })).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Evening" }).click();
  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByRole("button", { name: "Add teacher" }).click();
  const eveningTeacherDialog = page.getByRole("dialog");
  await eveningTeacherDialog.getByPlaceholder(/Search by name/).fill(teacherTwo);
  await eveningTeacherDialog.getByRole("option", { name: new RegExp(teacherTwo) }).click();
  expect(await waitForFlashAfter(page, () => eveningTeacherDialog.getByRole("button", { name: "Add teacher" }).click())).toBe("success");
  await expect(page.getByRole("cell", { name: teacherTwo, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add teacher" }).click();
  const sharedTeacherDialog = page.getByRole("dialog");
  await sharedTeacherDialog.getByPlaceholder(/Search by name/).fill(teacherOne);
  await sharedTeacherDialog.getByRole("option", { name: new RegExp(teacherOne) }).click();
  expect(await waitForFlashAfter(page, () => sharedTeacherDialog.getByRole("button", { name: "Add teacher" }).click())).toBe("success");
  await expect(page.getByRole("cell", { name: teacherOne, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: teacherTwo, exact: true })).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("main").getByRole("link", { name: "Roster" }).click();
  await page.getByRole("button", { name: "Add student" }).click();
  const rosterStudentDialog = page.getByRole("dialog");
  await rosterStudentDialog.getByPlaceholder(/Search by name/).fill(studentName);
  await rosterStudentDialog.getByRole("option", { name: new RegExp(studentName) }).click();
  expect(await waitForFlashAfter(page, () => rosterStudentDialog.getByRole("button", { name: "Add student" }).click())).toBe("success");
  await page.getByRole("link", { name: studentName }).click();
  await expect(page.getByRole("heading", { name: studentName })).toBeVisible();
  // Active students show enrollment as checkboxes; course name is label text.
  await expect(page.locator("label", { hasText: courseName })).toBeVisible();

  await page.goto("/admin/courses");
  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("main").getByRole("link", { name: "Roster" }).click();
  await expect(page.locator("tbody").getByText(studentName)).toBeVisible();
});
