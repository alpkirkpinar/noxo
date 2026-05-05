import { test, expect } from '@playwright/test';

test('login ve dashboard testi', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // email gir
  await page.fill('input[name="email"]', 'admin@test.com');

  // şifre gir
  await page.fill('input[name="password"]', '123456');

  // login butonuna bas
  await page.click('button[type="submit"]');

  // dashboard açıldı mı kontrol
  await expect(page).toHaveURL(/dashboard/);
});