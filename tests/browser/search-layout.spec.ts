import { test, expect, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

const kinds = ['Faction', 'Lore', 'NPC', 'Page', 'Party', 'Place', 'Recap', 'Recap part'];
const docs = Array.from({ length: 19 }, (_, i) => ({
  title: `Dragon record ${String(i + 1).padStart(2, '0')} — the conversation and the surrounding events`,
  kind: kinds[i % kinds.length],
  href: `/sessions/session-${i}/`,
  text: 'The dragon report was discussed in the published chronicle, with the surrounding conversations recorded for context.',
}));
const sources = docs.slice(0, 5).map(({ text, ...source }) => source);
const version = createHash('sha256').update(JSON.stringify(docs)).digest('hex');
const answer = 'The published chronicle described the party discussing the dragon, comparing what different people had heard, and deciding which information they could pass on when they returned to town. Some details were direct observations while others were reports from conversations, so the record should be read with those differences in mind when checking what happened and who knew about it. The relevant passages below provide the surrounding scenes, including the conversations before and after the report, and let the reader follow the story back to the original recap without relying on this short answer alone.';

async function open(page: Page) {
  await page.locator('[data-search-open]:visible').first().click();
  await page.getByRole('combobox').fill('dragon');
  await expect(page.locator('#search-status')).toHaveText('Showing 8 of 19 results.');
}

async function withinBody(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const bounds = await page.locator('.search-body').boundingBox();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/search-index.json', route => route.fulfill({ json: docs }));
  await page.route('**/api/ask', route => route.fulfill({ json: { answer, sources, corpusVersion: version } }));
  await page.goto('/');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`results, a long answer and saved controls remain usable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let requests = 0;
    page.on('request', request => { if (request.url().endsWith('/api/ask')) requests++; });
    await open(page);
    const input = page.getByRole('combobox');
    const close = page.getByRole('button', { name: 'Close search' });
    const header = await page.locator('.search-header').boundingBox();
    const count = await page.locator('#search-status').boundingBox();
    const query = await input.boundingBox();
    expect(count!.y).toBeGreaterThanOrEqual(query!.y);
    expect(count!.y + count!.height).toBeLessThanOrEqual(query!.y + query!.height + 60);
    const closeBox = await close.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);

    // Compact type controls keep their full hit targets without wrapping above
    // the results, including on a short landscape viewport.
    const filterRows = await page.locator('#search-filters button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().y));
    expect(Math.max(...filterRows) - Math.min(...filterRows)).toBeLessThan(1);
    const body = await page.locator('.search-body').boundingBox();
    const first = await page.getByRole('option').first().boundingBox();
    const visibleResultHeight = Math.min(first!.y + first!.height, body!.y + body!.height) - Math.max(first!.y, body!.y);
    expect(visibleResultHeight).toBeGreaterThanOrEqual(64);
    await expect(page.locator('#search-ask .ask-trigger')).toBeInViewport({ ratio: 1 });
    expect(requests).toBe(0);

    await page.locator('#search-ask .ask-trigger').click();
    await expect(page.locator('.ask-answer')).toHaveText(answer);
    await expect(page.locator('.ask-sources a')).toHaveCount(5);
    for (const source of await page.locator('.ask-sources a').all()) await withinBody(page, source);
    await withinBody(page, page.getByRole('button', { name: 'Save answer in this tab' }));
    await page.getByRole('button', { name: 'Save answer in this tab' }).click();
    await withinBody(page, page.getByRole('button', { name: 'Restore saved answer' }));
    await withinBody(page, page.getByRole('button', { name: 'Forget saved answer' }));
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(close).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#search-status')).toBeInViewport({ ratio: 1 });
    const scrolledHeader = await page.locator('.search-header').boundingBox();
    expect(Math.abs(scrolledHeader!.y - header!.y)).toBeLessThan(1);
    expect(await page.locator('.search-body').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('#search-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Forget saved answer' }).click();
    expect(await page.evaluate(() => sessionStorage.getItem('icespire-saved-answer'))).toBeNull();
    expect(requests).toBe(1);
    await close.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
}

test('keyboard selection scrolls results while retaining the query and selection', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await open(page);
  const input = page.getByRole('combobox');
  await input.press('ArrowUp');
  const selected = page.locator('#search-hit-7');
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(selected).toBeInViewport({ ratio: 1 });
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Close search' })).toBeInViewport({ ratio: 1 });
  await input.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
