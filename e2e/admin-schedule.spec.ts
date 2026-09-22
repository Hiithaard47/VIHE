import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, defaultSessionCategory, prisma } from "./db";
import { mondayOf } from "../src/modules/schedule/service/schedule";
import { addUtcDays, formatDayHeading, startOfTodayUtc, toDateInputValue } from "../src/lib/time";

/** Previous calendar week's Monday — days in that week are on or before today. */
function pastTermMonday() {
  return addUtcDays(mondayOf(startOfTodayUtc()), -7);
}

test.describe("admin: week schedule", () => {
  test("can add, duplicate, and remove a meeting on a previous day", async ({ page }) => {
    const course = await createCourse(`Admin Past Schedule ${unique("c")}`, unique("APS").toUpperCase());
    const klass = await defaultSessionCategory();
    const subjectId = course.subjects[0].id;
    const termStart = pastTermMonday();
    const mon = termStart;
    const tue = addUtcDays(termStart, 1);

    await loginAsAdmin(page);
    await page.goto(`/admin/courses/${course.id}/subjects/${subjectId}/schedule`);

    await page.getByLabel("Term start").fill(toDateInputValue(termStart));
    await page.getByLabel("Weeks").fill("2");
    await expect(page.getByRole("region", { name: formatDayHeading(mon) })).toBeInViewport();

    await page.getByRole("button", { name: new RegExp(`\\+ Add on ${formatDayHeading(mon)}`) }).click();
    const add = page.getByRole("dialog", { name: "Add meeting" });
    await add.getByLabel("Name").fill("Makeup class");
    await add.locator('select[name="categoryId"]').selectOption({ label: klass.name });
    await add.getByLabel("Start").fill("09:00");
    await add.getByLabel("End").fill("10:30");
    await add.getByRole("button", { name: "Add" }).click();

    const card = page.getByRole("article").filter({ hasText: "Makeup class" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Duplicate" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Remove" })).toBeVisible();
    await expect
      .poll(() =>
        prisma.classSession.count({
          where: { subjectId, name: "Makeup class", date: mon },
        }),
      )
      .toBe(1);

    await card.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByRole("region", { name: formatDayHeading(tue) }).getByText("Makeup class")).toBeVisible();
    await expect.poll(() => prisma.classSession.count({ where: { subjectId, name: "Makeup class" } })).toBe(2);

    expect(
      await waitForFlashAfter(page, () =>
        page.getByRole("region", { name: formatDayHeading(tue) }).getByRole("button", { name: "Remove" }).click(),
      ),
    ).toBe("success");
    await expect.poll(() => prisma.classSession.count({ where: { subjectId, name: "Makeup class" } })).toBe(1);
  });
});
