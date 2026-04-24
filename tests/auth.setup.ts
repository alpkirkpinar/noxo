import { expect, test } from "@playwright/test";

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL || "admin@noxo.local";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "Admin12345!";

test("authenticate admin session", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /noxo/i })).toBeVisible();

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);
  await page.getByRole("button", { name: "Giriş Yap" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().storageState({ path: "playwright/.auth/admin.json" });
});
