import { test, expect } from '@playwright/test';

const combiningName = 'Facktore\u0301';
const prefix = 'İe\u0301 '.repeat(130);
const docs = [
  { title: 'Facktoré', kind: 'NPC', href: '/npcs/facktore/', text: 'Facktoré left her workshop.' },
  { title: 'Workshop report', kind: 'Recap', href: '/campaign/', text: prefix + `${combiningName} spoke with Sage in the workshop.` },
  { title: 'Unrelated place', kind: 'Place', href: '/map/', text: 'A blacksmith worked elsewhere.' },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/ask', route => route.abort());
  await page.route('**/search-index.json', route => route.fulfill({ json: docs }));
  await page.goto('/');
  await page.locator('[data-search-open]:visible').first().click();
});

test('accent and case variants find the same sources and retain their authored spelling', async ({ page }) => {
  let questions = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) questions++; });
  for (const query of ['Facktoré', 'Facktore', 'FACKTORE', combiningName]) {
    await page.getByRole('combobox').fill(query);
    const results = page.getByRole('option');
    await expect(results).toHaveCount(2);
    await expect(results.first()).toHaveAttribute('href', '/npcs/facktore/');
    await expect(results.nth(1)).toHaveAttribute('href', '/campaign/');
    await expect(results.first().locator('.search-hit-title')).toHaveText('Facktoré');
    await expect(results.first().locator('.search-hit-title mark')).toHaveText('Facktoré');
    await expect(results.nth(1).locator('.search-hit-title mark')).toHaveCount(0);
    await expect(results.nth(1).locator('.search-hit-snippet mark')).toHaveText(combiningName);
    await expect(results.nth(1).locator('.search-hit-snippet')).toContainText('spoke with Sage');
  }
  expect(questions).toBe(0);
});

test('body snippets use original positions after combining accents and dotted capital I', async ({ page }) => {
  await page.getByRole('combobox').fill('Sage');
  const result = page.getByRole('option');
  await expect(result).toHaveCount(1);
  await expect(result.locator('.search-hit-title mark')).toHaveCount(0);
  await expect(result.locator('.search-hit-snippet')).toContainText(`${combiningName} spoke with Sage`);
  await expect(result.locator('.search-hit-snippet mark')).toHaveText('Sage');
  await page.getByRole('combobox').fill('a name absent from the record');
  await expect(page.getByRole('option')).toHaveCount(0);
});

test('title highlights include whole combining accents and preserve lowercase expansions', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ json: [{
    title: `${combiningName} and İNDİGO`, kind: 'NPC', href: '/npcs/facktore/', text: 'A workshop record.',
  }] }));
  await page.getByRole('button', { name: 'Close search' }).click();
  await page.locator('[data-search-open]:visible').first().click();
  for (const [query, authored] of [['Facktore', combiningName], ['indigo', 'İNDİGO']]) {
    await page.getByRole('combobox').fill(query);
    const title = page.getByRole('option').locator('.search-hit-title');
    await expect(title).toHaveText(`${combiningName} and İNDİGO`);
    await expect(title.locator('mark')).toHaveText(authored);
  }
});
