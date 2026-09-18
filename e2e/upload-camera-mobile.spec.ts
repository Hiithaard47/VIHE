import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createTeacher } from "./db";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("upload camera on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows Take photo and can attach a captured image", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Camera Teacher ${unique("t")}`, `${unique("camteacher")}@example.com`, password);
    const course = await createCourse(`Camera Course ${unique("c")}`, unique("CAM").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/assignments`);

    await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();

    const camera = page.locator('input[capture="environment"]');
    await expect(camera).toHaveCount(1);
    await camera.setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByText("photo.png")).toBeVisible();
  });

  test("hides Take photo on desktop widths", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const password = "TeacherPass123!";
    const teacher = await createTeacher(`Desktop Cam ${unique("t")}`, `${unique("deskcam")}@example.com`, password);
    const course = await createCourse(`Desktop Cam Course ${unique("c")}`, unique("DCC").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/assignments`);
    await expect(page.getByRole("button", { name: "Take photo" })).toBeHidden();
  });
});
