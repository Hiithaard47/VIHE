import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createSession, createStaffWithPermissions } from "./db";
import { PERMISSIONS } from "../src/lib/permissions";

test.describe("teacher: sessions.read", () => {
  test("sees assigned sessions but not New session", async ({ page }) => {
    const password = "ViewerPass123!";
    const viewer = await createStaffWithPermissions(
      `Session Viewer ${unique("t")}`,
      `${unique("sessionviewer")}@example.com`,
      password,
      [PERMISSIONS.SESSIONS_READ],
    );
    const course = await createCourse(`View Course ${unique("c")}`, unique("VWC").toUpperCase(), viewer.id);
    await createSession(course.batches[0].id, viewer.id, new Date("2026-03-15T00:00:00.000Z"), "Visible class");

    await login(page, viewer.email, password);
    await expect(page).toHaveURL(/\/teacher/);
    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page.getByText("Visible class")).toBeVisible();
    await expect(page.getByText("New session")).toHaveCount(0);
    await expect(page.locator('button:has-text("Create session")')).toHaveCount(0);
  });
});
