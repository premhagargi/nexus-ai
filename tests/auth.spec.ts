import { test, expect } from '@playwright/test';

test('has title and login works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Nexus AI/);

  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('signup page renders correctly', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});
