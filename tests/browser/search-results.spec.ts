import { test, expect } from '@playwright/test';

const docs = Array.from({ length: 19 }, (_, i) => ({
  title: `Dragon ${String(i + 1).padStart(2, '0')}`,
  kind: i < 10 ? 'Session' : 'NPC', href: i === 18 ? '/campaign/' : '/timeline/',
  text: i === 18 ? 'Dragon sentinel' : 'Dragon report',
}));
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/search-index.json', route => route.fulfill({ json: docs }));
  await page.route('**/api/ask', route => route.fulfill({ json: { answer: 'Same question answer.' } }));
  await page.goto('/');
  await page.locator('[data-search-open]:visible').first().click();
  await page.getByRole('combobox').fill('dragon');
});

test('more results preserve ranking and keyboard access beyond the first eight', async ({ page }) => {
  const options = page.getByRole('option');
  const input = page.getByRole('combobox');
  await expect(options).toHaveCount(8);
  await expect(page.locator('#search-status')).toHaveText('Showing 8 of 19 results.');
  await page.getByRole('button', { name: 'Show more results' }).click();
  await expect(options).toHaveCount(16);
  await page.getByRole('button', { name: 'Show more results' }).click();
  await expect(options).toHaveCount(19);
  await expect(page.getByRole('button', { name: 'Show more results' })).toBeHidden();
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await options.locator('.search-hit-title').allTextContents()).toEqual(docs.map(doc => doc.title));
  await input.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/campaign\/$/);
});

test('type filters apply before truncation and reset selection, query batches and reopening', async ({ page }) => {
  const input = page.getByRole('combobox');
  await input.press('ArrowDown');
  await page.getByRole('button', { name: 'NPC', exact: true }).click();
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  await expect(page.getByRole('button', { name: 'NPC', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('option')).toHaveCount(8);
  await expect(page.locator('#search-status')).toHaveText('Showing 8 of 9 results.');
  await page.getByRole('button', { name: 'Show more results' }).click();
  await expect(page.getByRole('option')).toHaveCount(9);
  await input.fill('dragon sentinel');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.locator('#search-status')).toContainText('Try All types');
  await page.getByRole('button', { name: 'All types', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await input.fill('dragon');
  await expect(page.getByRole('option')).toHaveCount(8);
  await page.getByRole('button', { name: 'NPC', exact: true }).click();
  await page.getByRole('button', { name: 'Close search' }).click();
  await page.locator('[data-search-open]:visible').first().click();
  await expect(page.locator('#search-filters')).toBeHidden();
  await input.fill('dragon');
  await expect(page.getByRole('button', { name: 'All types', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#search-status')).toHaveText('Showing 8 of 19 results.');
});

test('filtering and expansion never call Ask or discard the same question answer', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) requests++; });
  await page.getByRole('button', { name: 'NPC', exact: true }).click();
  await page.getByRole('button', { name: 'Show more results' }).click();
  expect(requests).toBe(0);
  await expect(page.locator('#search-filter-note')).toBeVisible();
  await page.locator('.ask-trigger').click();
  await expect(page.locator('.ask-answer')).toHaveText('Same question answer.');
  await page.getByRole('button', { name: 'All types', exact: true }).click();
  await expect(page.locator('.ask-answer')).toHaveText('Same question answer.');
  expect(requests).toBe(1);
  await page.getByRole('combobox').fill('dragon sentinel');
  await expect(page.locator('.ask-answer')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
