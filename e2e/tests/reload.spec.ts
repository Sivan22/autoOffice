import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('chat persists across page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').fill('persisted message');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Echo: persisted message/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText(/persisted message/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Echo: persisted message/)).toBeVisible();
});
