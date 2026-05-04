import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('settings page lists no providers initially and accepts adding one', async ({ page, server }) => {
  await page.goto('/');
  // Open settings — adapt the selector to whatever the UI uses (gear icon, etc.).
  await page.getByRole('button', { name: /settings|gear/i }).click();
  await expect(page.getByText(/Providers/i).first()).toBeVisible();

  // Add a CLI-bridge provider via API directly (UI selectors may vary).
  const resp = await page.request.post('/api/providers', {
    data: { kind: 'claude-code', label: 'Test CC' },
    headers: { Authorization: `Bearer ${server.token}` },
  });
  expect(resp.status()).toBe(201);
});
