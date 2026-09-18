import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createTeacher, defaultSessionCategory, prisma } from "./db";
import { mondayOf } from "../src/lib/schedule";
import { addUtcDays, formatDayHeading, startOfTodayUtc, toDateInputValue } from "../src/lib/time";

test.use({ viewport: { width: 390, height: 844 } });

function futureTermMonday() {
  return addUtcDays(mondayOf(startOfTodayUtc()), 7);
}

test.describe("teacher: mobile schedule move", () => {
  test("moves a meeting by tapping Move then a day", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Mobile Move ${unique("t")}`, `${unique("mmteacher")}@example.com`, password);
    const course = await createCourse(`Mobile Move Course ${unique("c")}`, unique("MMC").toUpperCase(), teacher.id);
    const klass = await defaultSessionCategory();
    const subjectId = course.subjects[0].id;
    const termStart = futureTermMonday();
    const mon = termStart;
    const wed = addUtcDays(termStart, 2);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/schedule?subject=${subjectId}`);
    await page.getByLabel("Term start").fill(toDateInputValue(termStart));
    await page.getByLabel("Weeks").fill("2");

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const add = page.getByRole("dialog", { name: "Add meeting" });
    await add.getByLabel("Name").fill("Chapter 1");
    await add.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await add.getByLabel("Start").fill("09:00");
    await add.getByLabel("End").fill("10:30");
    await add.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Chapter 1" })).toBeVisible();

    const card = page.getByRole("article").filter({ hasText: "Chapter 1" });
    await expect(card.getByRole("button", { name: "Move" })).toBeVisible();
    await card.getByRole("button", { name: "Move" }).click();
    await expect(page.getByText(/Moving Chapter 1/)).toBeVisible();

    expect(
      await waitForFlashAfter(page, () => page.getByRole("region", { name: formatDayHeading(wed) }).click()),
    ).toBe("success");

    await expect(page.getByRole("region", { name: formatDayHeading(wed) }).getByText("Chapter 1")).toBeVisible();
    await expect.poll(async () => {
      const row = await prisma.classSession.findFirst({ where: { subjectId, name: "Chapter 1" } });
      return row?.date.toISOString() ?? null;
    }).toBe(wed.toISOString());
  });
});
