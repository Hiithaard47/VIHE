import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse } from "./db";
import { prisma } from "./db";

// The applications list has no per-card test id, and a plain `div:has-text`
// match would also match every enclosing wrapper div up to <section> (they
// all "contain" the applicant's name too). Anchor on the name paragraph and
// walk up to the nearest ancestor that actually looks like the card.
function applicationCard(page: Page, name: string) {
  return page.locator("p", { hasText: name }).locator(`xpath=ancestor::div[contains(@class, "rounded-lg")][1]`);
}

test.describe("admin: reviewing student applications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("approving an application creates an enrolled student", async ({ page }) => {
    const course = await createCourse(`Applicant Course ${unique("c")}`, unique("APP").toUpperCase());
    const name = `Approve Applicant ${unique("a")}`;
    const email = `${unique("approve")}@example.com`;
    await prisma.studentApplication.create({
      data: { name, email, desiredCourseId: course.id },
    });

    await page.goto("/admin/students?tab=applications");
    const card = applicationCard(page, name);
    const roll = unique("R");
    await card.locator('input[name="rollNumber"]').fill(roll);
    const kind = await waitForFlashAfter(page, () => card.locator('button:has-text("Approve")').click());
    expect(kind).toBe("success");
    await expect(page.locator("p", { hasText: name })).toHaveCount(0);
    await page.getByRole("link", { name: "Active" }).click();
    await expect(page.locator("tr", { hasText: name })).toBeVisible();

    const student = await prisma.student.findFirstOrThrow({
      where: { rollNumber: roll },
      include: { enrollments: { include: { batch: true } } },
    });
    expect(student.name).toBe(name);
    expect(student.enrollments.map((e) => e.batch.courseId)).toContain(course.id);

    const application = await prisma.studentApplication.findFirstOrThrow({ where: { email } });
    expect(application.status).toBe("APPROVED");
  });

  test("rejecting an application leaves no student behind", async ({ page }) => {
    const name = `Reject Applicant ${unique("a")}`;
    const email = `${unique("reject")}@example.com`;
    await prisma.studentApplication.create({ data: { name, email } });

    await page.goto("/admin/students?tab=applications");
    const card = applicationCard(page, name);
    const kind = await waitForFlashAfter(page, () => card.locator('button:has-text("Reject")').click());
    expect(kind).toBe("success");
    await expect(page.locator("p", { hasText: name })).toHaveCount(0);

    const application = await prisma.studentApplication.findFirstOrThrow({ where: { email } });
    expect(application.status).toBe("REJECTED");

    const student = await prisma.student.findFirst({ where: { name } });
    expect(student).toBeNull();
  });
});
