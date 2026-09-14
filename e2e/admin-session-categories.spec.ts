import { test, expect } from "@playwright/test";
import { login, loginAsAdmin, signOut, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher, prisma } from "./db";

test.describe("admin: session categories", () => {
  test("adds a category and uses it on a new session", async ({ page }) => {
    const course = await createCourse(`Category Course ${unique("c")}`, unique("CAT").toUpperCase());
    await loginAsAdmin(page);
    await page.goto("/admin/session-categories");

    const name = `Mangala ${unique("m")}`;
    await page.getByRole("button", { name: "Add category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Minimum attendance % (optional)").fill("80");
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create category" }).click())).toBe(
      "success",
    );
    await expect(page).toHaveURL(/\/admin\/session-categories(\?|$)/);
    const row = page.locator("tr", { hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText("80")).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}/sessions`);
    await page.locator('input[type="date"]').fill("2026-03-15");
    await page.locator('input[name="name"]').fill("Morning program");
    await page.locator('select[name="categoryId"]').selectOption({ label: name });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Morning program")).toBeVisible();
    await expect(page.getByText("15 Mar 2026")).toBeVisible();
  });

  test("keeps class and temple attendance percentages separate", async ({ page }) => {
    const teacher = await createTeacher(`Cat Teacher ${unique("t")}`, `${unique("catteacher")}@example.com`, "TeacherPass123!");
    const course = await createCourse(`Split Course ${unique("c")}`, unique("SPL").toUpperCase(), teacher.id);
    const student = await createStudent(`Split Student ${unique("s")}`, unique("RSS"), course.id);
    const temple = await prisma.sessionCategory.create({
      data: { name: `Kirtana ${unique("k")}`, minAttendancePercent: 90 },
    });
    const classSession = await createSession(
      course.subjects[0].id,
      teacher.id,
      new Date("2026-02-01T00:00:00.000Z"),
      "Bhagavad-gita 2",
    );
    const templeSession = await prisma.classSession.create({
      data: {
        subjectId: course.subjects[0].id,
        categoryId: temple.id,
        date: new Date("2026-02-02T00:00:00.000Z"),
        name: "Evening kirtana",
        createdById: teacher.id,
      },
    });
    await prisma.attendanceRecord.createMany({
      data: [
        { sessionId: classSession.id, studentId: student.id, status: "PRESENT", markedById: teacher.id },
        { sessionId: templeSession.id, studentId: student.id, status: "ABSENT", markedById: teacher.id },
      ],
    });

    await loginAsAdmin(page);
    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}/attendance`);
    const row = page.locator("tr", { hasText: student.name });
    await expect(row.getByText("100%", { exact: true })).toBeVisible();
    await expect(row.getByText("0%", { exact: true })).toBeVisible();
  });

  test("remove hides a category from new sessions but keeps it in the database", async ({ page }) => {
    const password = "TeacherPass123!";
    const name = `Temple ${unique("u")}`;
    await prisma.sessionCategory.create({ data: { name } });
    const teacher = await createTeacher(`Hide Cat ${unique("t")}`, `${unique("hidecat")}@example.com`, password);
    const course = await createCourse(`Hide Cat Course ${unique("c")}`, unique("HDC").toUpperCase(), teacher.id);

    await loginAsAdmin(page);
    await page.goto("/admin/session-categories");
    expect(
      await waitForFlashAfter(page, () =>
        page.locator("tr", { hasText: name }).getByRole("button", { name: "Remove" }).click(),
      ),
    ).toBe("success");
    await expect(page.locator("tr", { hasText: name })).toHaveCount(0);
    await expect(page.locator("tr", { hasText: "Class" }).getByRole("button", { name: "Remove" })).toHaveCount(0);

    const stored = await prisma.sessionCategory.findUniqueOrThrow({ where: { name } });
    expect(stored.isActive).toBe(false);

    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page.locator("tr", { hasText: name })).toBeVisible();

    await signOut(page);
    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page.locator('select[name="categoryId"]')).not.toContainText(name);
    await expect(page.locator('select[name="categoryId"]')).toContainText("Class");
  });

  test("hides session resources when the category disallows files", async ({ page }) => {
    const course = await createCourse(`No Files Course ${unique("c")}`, unique("NFL").toUpperCase());
    await loginAsAdmin(page);
    await page.goto("/admin/session-categories");

    const name = `Mangala ${unique("m")}`;
    await page.getByRole("button", { name: "Add category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("checkbox", { name: /Allow session files/ }).uncheck();
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create category" }).click())).toBe(
      "success",
    );
    await expect(page.locator("tr", { hasText: name }).getByText("No files")).toBeVisible();
    await expect(page.locator("tr", { hasText: "Class" }).getByText("Files")).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}/sessions`);
    await page.locator('input[type="date"]').fill("2026-03-15");
    await page.locator('input[name="name"]').fill("Morning aarti");
    await page.locator('select[name="categoryId"]').selectOption({ label: name });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await page.locator('a[href*="/admin/sessions/"]', { hasText: "Morning aarti" }).click();
    await expect(page).toHaveURL(/\/admin\/sessions\//);
    await expect(page.getByRole("heading", { name: "Resources" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save attendance" })).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/subjects/${course.subjects[0].id}/sessions`);
    await page.locator('input[type="date"]').fill("2026-03-16");
    await page.locator('input[name="name"]').fill("Chapter 1");
    await page.locator('select[name="categoryId"]').selectOption({ label: "Class" });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await page.locator('a[href*="/admin/sessions/"]', { hasText: "Chapter 1" }).click();
    await expect(page).toHaveURL(/\/admin\/sessions\//);
    await expect(page.getByRole("heading", { name: "Resources" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
  });
});
