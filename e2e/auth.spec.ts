import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, accountMenuButton, login, signOut, unique } from "./helpers";
import { createAdmin, prisma } from "./db";

test.describe("authentication & access control", () => {
  test("unauthenticated visitors are redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', "definitely-wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can sign in, lands on /admin, and can sign out", async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL },
      select: { name: true },
    });
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("banner").getByText("Vihe")).toBeVisible();
    const menu = accountMenuButton(page, admin.name);
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(admin.name);

    await menu.click();
    await expect(page.getByRole("menuitem", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");

    await signOut(page);
    await expect(page).toHaveURL(/\/login/);

    // Session is really gone, not just a client-side redirect.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("account menu shows the staff full name, not the email prefix", async ({ page }) => {
    const name = `Menu Name ${unique("n")}`;
    const email = `${unique("menuname")}@example.com`;
    await createAdmin(name, email, "MenuPass123!");
    await login(page, email, "MenuPass123!");
    await expect(page).toHaveURL(/\/admin/);
    const menu = accountMenuButton(page, name);
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(name);
    await expect(
      page.getByRole("button", { name: `Account menu for ${email.split("@")[0] ?? email}`, exact: true }),
    ).toHaveCount(0);
  });

  test("root path routes a signed-in admin straight to /admin", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin/);
  });
});
