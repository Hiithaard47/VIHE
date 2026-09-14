import { test, expect } from "@playwright/test";
import { loginAsAdmin, unique, waitForFlashAfter } from "./helpers";
import { createCourse, createStudent, prisma } from "./db";
import { addCalendarMonths } from "../src/lib/student-login";

test.describe("student login expiry", () => {
  test("blocks sign-in after the expiry calendar day", async ({ page }) => {
    const email = `${unique("expired")}@example.com`;
    const password = "StudentPass123!";
    await createStudent(`Expired Student ${unique("s")}`, unique("REX"), undefined, {
      email,
      password,
      loginExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("first enrollment on a BS course sets a one-year login expiry", async ({ page }) => {
    const course = await createCourse(`Sastri ${unique("c")}`, `BS${Date.now()}`);
    await loginAsAdmin(page);
    await page.goto("/admin/students");

    const name = `Login Expiry ${unique("s")}`;
    const roll = unique("RLX");
    await page.getByRole("button", { name: "Add student" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(name);
    await dialog.getByLabel("Roll number").fill(roll);
    await dialog.locator(`input[name="course-${course.id}"]`).check();
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create student" }).click())).toBe(
      "success",
    );

    const student = await prisma.student.findFirstOrThrow({ where: { rollNumber: roll } });
    expect(student.loginExpiresAt).toEqual(addCalendarMonths(new Date(), 12));
  });

  test("admin can change the login expiry on student details", async ({ page }) => {
    const student = await createStudent(`Expiry Edit ${unique("s")}`, unique("RED"), undefined, {
      email: `${unique("expiryedit")}@example.com`,
    });
    await loginAsAdmin(page);
    await page.goto(`/admin/students/${student.id}/details`);
    await page.getByLabel("Login expires on").fill("2027-03-15");
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Save details" }).click())).toBe(
      "success",
    );

    const updated = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(updated.loginExpiresAt).toEqual(new Date(Date.UTC(2027, 2, 15)));
  });
});
