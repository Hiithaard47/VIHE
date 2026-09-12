import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";

test("admin assigns teachers and keeps roster enrollment per batch", async ({ page }) => {
  await loginAsAdmin(page);

  const teacherOne = unique("teacher-one");
  const teacherTwo = unique("teacher-two");
  for (const [name, email] of [[teacherOne, `${teacherOne}@example.com`], [teacherTwo, `${teacherTwo}@example.com`]]) {
    await page.goto("/admin/teachers");
    const form = page.locator('section:has-text("Add user") form');
    await form.getByPlaceholder("Full name").fill(name);
    await form.getByPlaceholder("Email").fill(email);
    await form.getByPlaceholder("Temporary password").fill("ChangeMe123!");
    expect(await waitForFlashAfter(page, () => form.getByRole("button", { name: "Create user" }).click())).toBe("success");
  }

  const studentName = unique("Student");
  const rollNumber = unique("roll");
  await page.goto("/admin/students");
  const studentForm = page.locator('section:has-text("Add student") form');
  await studentForm.getByPlaceholder("Full name").fill(studentName);
  await studentForm.getByPlaceholder(/Roll number/).fill(rollNumber);
  expect(await waitForFlashAfter(page, () => studentForm.getByRole("button", { name: "Add student" }).click())).toBe("success");

  const courseName = unique("Batch Course");
  await page.goto("/admin/courses");
  const courseForm = page.locator('section:has-text("Add course") form');
  await courseForm.getByPlaceholder("Course name").fill(courseName);
  await courseForm.getByPlaceholder(/Course code/).fill(unique("BATCH").toUpperCase());
  expect(await waitForFlashAfter(page, () => courseForm.getByRole("button", { name: "Create course" }).click())).toBe("success");
  await page.getByRole("link", { name: courseName }).click();

  await page.fill('section:has-text("Add batch") input[name="name"]', "Evening");
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Add batch" }).click())).toBe("success");
  await page.goto(page.url().replace(/\/batches\/[^/?]+(?:\?.*)?$/, ""));
  await page.getByRole("link", { name: "Default" }).click();
  await page.getByLabel("Batch name").fill("Morning");
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save details" }).click())).toBe("success");

  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByLabel(new RegExp(teacherOne)).check();
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save teachers" }).click())).toBe("success");

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Evening" }).click();
  await page.getByRole("main").getByRole("link", { name: "Teachers" }).click();
  await page.getByLabel(new RegExp(teacherTwo)).check();
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save teachers" }).click())).toBe("success");

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Morning" }).click();
  await page.getByRole("main").getByRole("link", { name: "Roster" }).click();
  const studentOption = page.locator('select[name="studentId"] option').filter({ hasText: studentName });
  await page.locator('select[name="studentId"]').selectOption(await studentOption.getAttribute("value") as string);
  expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Enroll" }).click())).toBe("success");
  await expect(page.getByText(studentName)).toBeVisible();

  await page.getByRole("link", { name: courseName }).click();
  await page.getByRole("link", { name: "Evening" }).click();
  await page.getByRole("main").getByRole("link", { name: "Roster" }).click();
  await expect(page.getByText("No students enrolled in this batch yet.")).toBeVisible();
  await expect(page.locator("tbody").getByText(studentName)).toHaveCount(0);
});
