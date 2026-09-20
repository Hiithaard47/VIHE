import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, prisma } from "./db";

test.describe("admin: archived subject sessions", () => {
  test("does not offer create session on an archived subject", async ({ page }) => {
    const course = await createCourse(`Archived Session ${unique("c")}`, unique("ARS").toUpperCase());
    const subjectId = course.subjects[0].id;
    await prisma.courseSubject.update({ where: { id: subjectId }, data: { isActive: false } });

    await loginAsAdmin(page);
    await page.goto(`/admin/courses/${course.id}/subjects/${subjectId}/sessions`);
    await expect(page.getByText("This subject is archived. Restore it to add sessions.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create session" })).toHaveCount(0);

    await page.goto(`/admin/courses/${course.id}/subjects/${subjectId}/schedule`);
    await expect(page.getByText("This subject is archived. Restore it to edit the schedule.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add" })).toHaveCount(0);
  });

  test("can create sessions again after restoring the subject", async ({ page }) => {
    const course = await createCourse(`Restore Session ${unique("c")}`, unique("RSS").toUpperCase());
    const subjectId = course.subjects[0].id;
    await prisma.courseSubject.update({ where: { id: subjectId }, data: { isActive: false } });

    await loginAsAdmin(page);
    await page.goto(`/admin/courses/${course.id}/subjects/${subjectId}`);
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Restore" }).click())).toBe(
      "success",
    );
    await page.goto(`/admin/courses/${course.id}/subjects/${subjectId}/sessions`);
    await expect(page.getByRole("button", { name: "Create session" })).toBeVisible();
  });
});
