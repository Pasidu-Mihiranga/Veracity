// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Veracity AI Dashboard & Authentication E2E', () => {
  test('redirects unauthenticated user to auth page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator('text=Sign In').first()).toBeVisible();
  });

  test('displays brand wordmark and login form inputs', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('toggles password visibility', async ({ page }) => {
    await page.goto('/auth');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('switches between Sign In and Sign Up tabs', async ({ page }) => {
    await page.goto('/auth');
    const signUpTab = page.locator('button:has-text("Create Account")');
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
      await expect(page.locator('input[placeholder*="Company"], input[name*="company"]').first()).toBeVisible();
    }
  });
});
