import { test, expect } from "@playwright/test";
import { unique } from "./helpers";
import { prisma } from "./db";

test.describe("public: apply as a student", () => {
  test("submits the full form and creates an application with every field", async ({ page }) => {
    const email = `${unique("applicant")}@example.com`;

    await page.goto("/apply");
    await page.fill('input[name="name"]', "Radha Devi");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="phone"]', "+91 98765 43210");
    await page.selectOption('select[name="preferredMode"]', "HYBRID");
    await page.selectOption('select[name="preferredLanguage"]', "HINDI");
    await page.fill('input[name="dateOfBirth"]', "1998-04-12");
    await page.fill('input[name="country"]', "India");
    await page.fill('input[name="city"]', "Vrindavan");
    await page.fill('textarea[name="priorExperience"]', "Attended local bhajan programs.");
    await page.fill('textarea[name="message"]', "Looking forward to it.");

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("submitted") === "1"),
      page.click('button:has-text("Submit application")'),
    ]);
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

    const application = await prisma.studentApplication.findFirstOrThrow({ where: { email } });
    expect(application.name).toBe("Radha Devi");
    expect(application.phone).toBe("+91 98765 43210");
    expect(application.preferredMode).toBe("HYBRID");
    expect(application.preferredLanguage).toBe("HINDI");
    expect(application.country).toBe("India");
    expect(application.city).toBe("Vrindavan");
    expect(application.priorExperience).toContain("bhajan");
    expect(application.status).toBe("PENDING");
    expect(application.dateOfBirth?.toISOString().slice(0, 10)).toBe("1998-04-12");
  });

  test("only name and email are required", async ({ page }) => {
    const email = `${unique("minimal")}@example.com`;
    await page.goto("/apply");
    await page.fill('input[name="name"]', "Minimal Applicant");
    await page.fill('input[name="email"]', email);

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("submitted") === "1"),
      page.click('button:has-text("Submit application")'),
    ]);

    const application = await prisma.studentApplication.findFirstOrThrow({ where: { email } });
    expect(application.phone).toBeNull();
    expect(application.preferredMode).toBeNull();
  });

  test("honeypot field silently drops bot submissions", async ({ page }) => {
    const email = `${unique("bot")}@example.com`;
    await page.goto("/apply");
    await page.fill('input[name="name"]', "Bot Applicant");
    await page.fill('input[name="email"]', email);
    // A real visitor never sees or fills this field (it's hidden off-screen);
    // simulate a bot that fills every field regardless of visibility.
    await page.locator('input[name="website"]').fill("http://spam.example", { force: true });

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("submitted") === "1"),
      page.click('button:has-text("Submit application")'),
    ]);
    // Still shows the thank-you page, so the bot gets no signal it was blocked...
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
    // ...but no application row was actually created.
    const application = await prisma.studentApplication.findFirst({ where: { email } });
    expect(application).toBeNull();
  });

  test("links to /apply from the login page", async ({ page }) => {
    await page.goto("/login");
    await Promise.all([page.waitForURL(/\/apply/), page.click('a:has-text("Apply here")')]);
    await expect(page.getByRole("heading", { name: "Apply as a student" })).toBeVisible();
  });
});
