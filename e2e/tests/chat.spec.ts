import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('user can send a message and see the echo', async ({ page }) => {
  await page.goto('/');
  // The SPA bootstraps and shows the chat UI.
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox').fill('hello');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Echo: hello/)).toBeVisible({ timeout: 10_000 });
});

test('asking for code triggers the execute_code approve UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox').fill('please write code');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 10_000 });
});
