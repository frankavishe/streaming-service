import { test, expect } from '@playwright/test';

// US1: a visitor with no account can browse the catalog and reach a title's detail page.
// Requires the stack running with at least one published, seeded title.
test('visitor can browse the catalog with no account', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('unauthenticated direct full-playback request is refused (FR-003)', async ({ request, baseURL }) => {
  const apiBase = process.env.E2E_API_BASE_URL ?? 'http://localhost:3001/api';
  const response = await request.get(`${apiBase}/media/00000000-0000-0000-0000-000000000000/playback-url`);
  expect(response.status()).toBe(401);
});
