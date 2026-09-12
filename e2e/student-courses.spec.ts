import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createSession, createStudent, createTeacher, prisma } from "./db";

test.describe("student: my courses and sessions", () => {
  test("lists active and completed courses, then every past and upcoming session", async ({ page }) => {
    const teacher = await createTeacher(`Student Course Teacher ${unique("t")}`, `${unique("sct")}@example.com`, "TeacherPass123!");
    const active = await createCourse(`Active Course ${unique("c")}`, unique("ACT").toUpperCase(), teacher.id);
    const completed = await createCourse(`Completed Course ${unique("c")}`, unique("CMP").toUpperCase(), teacher.id);
    const hidden = await createCourse(`Hidden Course ${unique("c")}`, unique("HID").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: completed.id }, data: { isActive: false } });
    const email = `${unique("stu")}@example.com`;
    const password = "StudentPass123!";
    const student = await createStudent(`Portal Student ${unique("s")}`, unique("PS").toUpperCase(), active.batches[0].id, {
      email,
      password,
    });
    await prisma.batchEnrollment.create({ data: { studentId: student.id, batchId: completed.batches[0].id } });
    const past = await createSession(active.batches[0].id, teacher.id, new Date("2026-01-05T00:00:00.000Z"));
    await createSession(active.batches[0].id, teacher.id, new Date("2026-11-20T00:00:00.000Z"));
    await prisma.sessionResource.create({
      data: {
        sessionId: past.id,
        fileName: "class-notes.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        storageKey: `e2e/${unique("notes")}`,
        uploadedById: teacher.id,
      },
    });

    await login(page, email, password);
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByRole("heading", { name: "My courses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Active/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Completed/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(active.name) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(completed.name) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(hidden.name) })).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(active.name) }).click();
    await expect(page.getByRole("heading", { name: active.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sessions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByText("5 Jan 2026")).toBeVisible();
    await expect(page.getByText("20 Nov 2026")).toBeVisible();
    await expect(page.getByText("Previous")).toBeVisible();
    await expect(page.getByText("Upcoming")).toBeVisible();

    await page.getByRole("link", { name: "Documents" }).click();
    await expect(page.getByRole("link", { name: "class-notes.pdf" })).toBeVisible();
    await expect(page.getByText("5 Jan 2026")).toBeVisible();

    await page.goto("/student");
    await page.getByRole("link", { name: new RegExp(completed.name) }).click();
    await expect(page.getByRole("heading", { name: completed.name })).toBeVisible();
    await expect(page.getByText(/· Completed$/)).toBeVisible();

    await page.goto(`/student/courses/${hidden.id}`);
    await expect(page.getByRole("heading", { name: "My courses" })).toHaveCount(0);
  });
});
