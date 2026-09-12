import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse } from "./db";

test.describe("teacher: course visibility & session management", () => {
  test("sees every active course, but can only manage the one they're assigned to", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Course Teacher ${unique("t")}`, `${unique("courseview")}@example.com`, password);
    // Names deliberately avoid the word "assigned" — it would otherwise
    // collide (case-insensitively) with the "Assigned" badge text itself.
    const mine = await createCourse(`Bhakti Sastra ${unique("c")}`, unique("MIN").toUpperCase(), teacher.id);
    const other = await createCourse(`Vedic Cosmology ${unique("c")}`, unique("OTH").toUpperCase());

    await login(page, teacher.email, password);
    await expect(page).toHaveURL(/\/teacher/);

    const myCard = page.locator("a", { hasText: mine.name });
    await expect(myCard.getByText("Assigned", { exact: true })).toBeVisible();

    const otherCard = page.locator("a", { hasText: other.name });
    await expect(otherCard.getByText("Assigned", { exact: true })).toHaveCount(0);

    // My course: full manage UI.
    await myCard.click();
    await expect(page.getByText("New session")).toBeVisible();
    await expect(page.locator('button:has-text("Create session")')).toBeVisible();

    // Someone else's course: view-only, no session-management controls.
    await page.goto("/teacher");
    await otherCard.click();
    await expect(page.getByText("View only")).toBeVisible();
    await expect(page.getByText("New session")).toHaveCount(0);
  });

  test("creates a session for an assigned course", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Session Teacher ${unique("t")}`, `${unique("sessionteacher")}@example.com`, password);
    const course = await createCourse(`Session Course ${unique("c")}`, unique("SES").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);

    await page.fill('input[type="date"]', "2026-03-15");
    await page.fill('input[name="topic"]', "Chapter 1 overview");

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Create session")'));
    expect(kind).toBe("success");
    await expect(page.getByText("Chapter 1 overview")).toBeVisible();
    await expect(page.getByText("3/15/2026")).toBeVisible();
  });
});
