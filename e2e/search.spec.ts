import { expect, test } from '@playwright/test';

test('search shell renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/search');

  await expect(page.getByText('Where to?')).toBeVisible();
  await expect(page.getByText('0 stays in view')).toBeVisible();
  expect(errors).toEqual([]);
});
