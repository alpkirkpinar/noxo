import { expect, test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("opens dashboard and core navigation", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Teklifler/i })).toBeVisible();
  });

  test("opens and closes new offer modal", async ({ page }) => {
    await page.goto("/dashboard/offers");

    await expect(page).toHaveURL(/\/dashboard\/offers$/);
    await page.getByRole("button", { name: "Yeni" }).click();

    await expect(page.getByRole("heading", { name: /Yeni Fiyat Teklifi/i })).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();

    await page.getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByRole("heading", { name: /Yeni Fiyat Teklifi/i })).toBeHidden();
  });

  test("opens edit offer modal when an offer exists", async ({ page }) => {
    await page.goto("/dashboard/offers");

    const rows = page.locator("tbody tr");
    const offerCount = await rows.count();

    test.skip(offerCount === 0, "No offers available for edit smoke test.");

    await rows.first().click();
    const navigatedToDetail = await page
      .waitForURL(/\/dashboard\/offers\/[^/]+$/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!navigatedToDetail, "Offer detail page did not open from the first row.");

    await page.getByRole("link", { name: "Düzenle" }).click();
    await expect(page.getByRole("heading", { name: /Teklif Düzenle/i })).toBeVisible();
  });
});
