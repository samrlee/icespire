import { test, expect, type Page } from '@playwright/test';

const docs = [
  { title: 'Dragon report', kind: 'Session', href: '/campaign/', text: 'A dragon report.' },
  { title: 'Dragon sightings', kind: 'Lore', href: '/timeline/', text: 'More dragon sightings.' },
];
const input = (page: Page) => page.getByRole('combobox');
async function open(page: Page) {
  await page.locator('[data-search-open]:visible').first().click();
  await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeVisible();
  await expect(input(page)).toBeFocused();
}
test.beforeEach(async ({ page }) => {
  // Block external fonts and prevent any accidental live model request.
  await page.route('https://**', route => route.abort());
  await page.route('**/api/ask', route => route.fulfill({ status: 503, json: { error: 'Test chronicler unavailable.' } }));
  await page.route('**/search-index.json', route => route.fulfill({ json: docs }));
  await page.goto('/');
});

for (const close of ['Escape', 'button', 'shortcut', 'backdrop']) {
  test(`reset after ${close}, reopen, and restore focus`, async ({ page }) => {
    const opener = page.locator('[data-search-open]:visible').first();
    await open(page);
    await input(page).fill('dragon');
    await expect(page.getByRole('option')).toHaveCount(2);
    if (close === 'button') await page.getByRole('button', { name: 'Close search' }).click();
    else if (close === 'backdrop') await page.mouse.click(2, 2);
    else await input(page).press(close === 'shortcut' ? 'Control+k' : 'Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(opener).toBeFocused();
    await open(page);
    await expect(input(page)).toHaveValue('');
    await expect(input(page)).not.toHaveAttribute('aria-activedescendant');
    await expect(page.locator('#search-intro')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.locator('#search-ask')).toBeHidden();
  });
}

test('pending index renders the latest query after reopen, fetching only once', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/search-index.json', async route => {
    calls++;
    await gate;
    await route.fulfill({ json: docs });
  });
  await open(page);
  await input(page).fill('report');
  await expect(page.locator('#search-status')).toHaveText('Loading the chronicle…');
  await input(page).press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await input(page).press('Escape');
  await open(page);
  await input(page).fill('sightings');
  release();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('Dragon sightings');
  expect(calls).toBe(1);
});

for (const failure of ['http', 'network', 'malformed', 'invalid-entry']) {
  test(`recover from ${failure} failure without disguising it as no matches`, async ({ page }) => {
    let calls = 0;
    await page.route('**/search-index.json', async route => {
      if (++calls > 1) return route.fulfill({ json: docs });
      if (failure === 'network') return route.abort();
      if (failure === 'malformed') return route.fulfill({ json: {} });
      if (failure === 'invalid-entry') return route.fulfill({ json: [{ ...docs[0], href: null }] });
      return route.fulfill({ status: 503 });
    });
    await open(page);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await input(page).fill('dragon');
    await expect(page.locator('#search-status')).toContainText("couldn't load");
    await input(page).press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await input(page).press('Escape');
    await open(page);
    await input(page).fill('dragon');
    const retry = page.getByRole('button', { name: 'Try again' });
    await retry.focus();
    await retry.press('Enter');
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(input(page)).toBeFocused();
    await expect(retry).toBeHidden();
    expect(calls).toBe(2);
  });
}

test('empty index is valid and Enter with no hits does not close', async ({ page }) => {
  await page.route('**/search-index.json', route => route.fulfill({ json: [] }));
  await open(page);
  await input(page).fill('dragon');
  await expect(page.locator('#search-status')).toContainText('Nothing in the chronicle matches');
  await input(page).press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeHidden();
});

test('arrow keys select results and Enter follows the selected link', async ({ page }) => {
  await open(page);
  await input(page).fill('dragon');
  await expect(page.getByRole('option')).toHaveCount(2);
  await input(page).press('ArrowDown');
  await expect(input(page)).toHaveAttribute('aria-activedescendant', 'search-hit-1');
  await input(page).press('Enter');
  await expect(page).toHaveURL('/timeline/');
});

test('Ask requires a click, shows errors, and resets for a different question', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/ask', route => {
    calls++;
    return route.fulfill({ status: 503, json: { error: 'Test chronicler unavailable.' } });
  });
  await open(page);
  await input(page).fill('dragon');
  await expect(page.getByRole('option')).toHaveCount(2);
  expect(calls).toBe(0);
  await page.locator('.ask-trigger').click();
  await expect(page.locator('#search-ask')).toHaveText('Test chronicler unavailable.');
  expect(calls).toBe(1);
  await input(page).fill('report');
  await expect(page.locator('.ask-trigger')).toContainText('report');
  expect(calls).toBe(1);
});

for (const cancel of ['query', 'close']) {
  test(`late Ask response cannot replace the state after ${cancel}`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started = false;
    const aborted = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/ask'));
    await page.route('**/api/ask', async route => {
      started = true;
      await gate;
      await route.fulfill({ json: { answer: 'Obsolete answer', sources: [] } });
    });
    await open(page);
    await input(page).fill('dragon');
    await page.locator('.ask-trigger').click();
    await expect.poll(() => started).toBe(true);
    await expect(page.locator('#search-ask')).toHaveText('Consulting the chronicle…');
    if (cancel === 'close') {
      await input(page).press('Escape');
      await open(page);
    }
    await input(page).fill('report');
    await aborted;
    release();
    await expect(page.locator('.ask-trigger')).toContainText('report');
    await expect(page.locator('#search-ask')).not.toContainText('Obsolete answer');
  });
}

test('successful Ask displays its source and clears when the query is erased', async ({ page }) => {
  await page.route('**/api/ask', route => route.fulfill({ json: {
    answer: 'A recorded sighting.',
    sources: [{ title: 'Dragon report', kind: 'Session', href: '/campaign/' }],
  } }));
  await open(page);
  await input(page).fill('dragon');
  await page.locator('.ask-trigger').click();
  await expect(page.locator('.ask-answer')).toHaveText('A recorded sighting.');
  await expect(page.locator('.ask-sources a')).toHaveAttribute('href', '/campaign/');
  await input(page).fill('');
  await expect(page.locator('#search-ask')).toBeHidden();
  await expect(page.locator('#search-intro')).toBeVisible();
});
