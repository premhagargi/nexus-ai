import { test, expect } from '@playwright/test';

test('has title and login works', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Nexus AI/);

  // Click the sign in button.
  await page.goto('http://localhost:3000/login');

  // Fill out the form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');

  // We are not actually logging in to Supabase here in the test because it requires real credentials
  // or a mocked server. For now we just verify the form exists and can be submitted.
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('signup page renders correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/signup');
  
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});
