import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin: add dialogs", () => {
  test("focuses the first input when Add course opens", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/courses");
    await page.getByRole("button", { name: "Add course" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="name"]')).toBeFocused();
  });
});
