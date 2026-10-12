import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

const first = 'Bean opened the ledger.  Only Bean saw the entry.';
const last = 'Thornton promised payment. She had not paid.';
const markup = '<img src="x" onerror="window.evidenceExecuted=true"> was written as text.';
const docs = [
  { title: 'Ledger report', kind: 'Recap part', href: '/campaign/',
    text: `${first}\nAn unrelated road report was omitted.\n${last}\n${markup}` },
  { title: 'A session overview', kind: 'Recap', href: '/sessions/session-9/',
    text: 'A long recap body that was not supplied for this overview.', summary: 'The party reached the mine entrance.' },
  { title: 'Unconsulted report', kind: 'Lore', href: '/timeline/', text: 'This entry was not supplied.' },
];
const excerpt = `${first}\n[…]\n${last}\n${markup}`;
const sources = [
  { title: docs[0].title, kind: docs[0].kind, href: docs[0].href, excerpt },
  { title: docs[1].title, kind: docs[1].kind, href: docs[1].href, excerpt: docs[1].summary },
];
const version = createHash('sha256').update(JSON.stringify(docs)).digest('hex');
const answer = { answer: 'Payment had been promised but had not been made.', sources, corpusVersion: version };
const storageKey = 'icespire-saved-answer';

async function open(page: Page) {
  await page.locator('[data-search-open]:visible').first().click();
  await expect(page.getByRole('combobox')).toBeFocused();
}
async function ask(page: Page) {
  await open(page);
  await page.getByRole('combobox').fill('ledger');
  await page.locator('#search-ask').getByRole('button', { name: /Ask the chronicle/ }).click();
  await expect(page.locator('.ask-answer')).toHaveText(answer.answer);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  // Every request is intercepted; no browser case can contact a paid model.
  await page.route('**/api/ask', route => route.fulfill({ json: answer }));
  await page.route('**/search-index.json', route => route.fulfill({ json: docs }));
  await page.goto('/');
});

test('each consulted source expands its exact supplied passage with keyboard controls and plain text', async ({ page }) => {
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) calls++; });
  await ask(page);
  await expect(page.locator('.ask-sources')).toContainText('Sources consulted:');
  await expect(page.locator('.ask-sources a')).toHaveCount(2);
  await expect(page.locator('.ask-evidence')).toHaveCount(2);
  await expect(page.locator('.ask-excerpt').first()).toBeHidden();
  await expect(page.locator('#search-ask')).toContainText('do not independently verify every claim');
  const disclosure = page.getByLabel('Read supplied passage from Ledger report', { exact: true });
  await disclosure.focus();
  await disclosure.press('Enter');
  const passage = page.getByRole('region', { name: 'Passage supplied from Ledger report', exact: true });
  await expect(passage).toBeVisible();
  expect(await passage.textContent()).toBe(excerpt);
  await expect(passage.locator('img, script, a')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { evidenceExecuted?: boolean }).evidenceExecuted)).toBeUndefined();
  await expect(passage).not.toContainText('An unrelated road report was omitted.');
  await expect(page.locator('.ask-sources')).not.toContainText('Unconsulted report');
  await disclosure.press('Space');
  await expect(passage).toBeHidden();
  await page.getByLabel('Read supplied passage from A session overview', { exact: true }).click();
  expect(await page.getByRole('region', { name: 'Passage supplied from A session overview', exact: true }).textContent()).toBe(docs[1].summary);
  expect(calls).toBe(1);
});

test('saved passages restore only on request and forgetting removes the complete answer', async ({ page }) => {
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/ask')) calls++; });
  await ask(page);
  await page.getByRole('button', { name: 'Save answer in this tab', exact: true }).click();
  const record = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), storageKey);
  expect(record.sources).toEqual(sources);
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await page.goto('/campaign/');
  await open(page);
  await expect(page.getByRole('combobox')).toHaveValue('');
  await expect(page.locator('.ask-answer, .ask-evidence')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore saved answer', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('ledger');
  await page.getByLabel('Read supplied passage from Ledger report', { exact: true }).click();
  expect(await page.locator('.ask-excerpt').first().textContent()).toBe(excerpt);
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Forget saved answer', exact: true }).click();
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await expect(page.getByRole('button', { name: 'Restore saved answer', exact: true })).toHaveCount(0);
});

test('older source-only responses and saved answers keep their source links', async ({ page }) => {
  const legacy = { ...answer, sources: sources.map(({ excerpt: _excerpt, ...source }) => source) };
  await page.route('**/api/ask', route => route.fulfill({ json: legacy }));
  await ask(page);
  await expect(page.locator('.ask-sources a')).toHaveCount(2);
  await expect(page.locator('.ask-evidence')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save answer in this tab', exact: true }).click();
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await page.reload();
  await open(page);
  await page.getByRole('button', { name: 'Restore saved answer', exact: true }).click();
  await expect(page.locator('.ask-sources a')).toHaveCount(2);
  await expect(page.locator('.ask-evidence')).toHaveCount(0);
});

for (const [label, invalid] of [
  ['fabricated', 'A statement absent from the source.'],
  ['reordered', `${last}\n[…]\n${first}`],
  ['non-text', { html: first }],
  ['oversized', 'x'.repeat(48_001)],
] as const) {
  test(`invalid ${label} retained evidence cannot be restored`, async ({ page }) => {
    await page.evaluate(({ key, record }) => sessionStorage.setItem(key, JSON.stringify(record)), {
      key: storageKey, record: { ...answer, question: 'ledger', version, sources: [{ ...sources[0], excerpt: invalid }] },
    });
    await open(page);
    await expect(page.getByText('The saved answer was cleared because the chronicle changed or the record was invalid.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore saved answer', exact: true })).toHaveCount(0);
    expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  });
}

test('unmatched sources and unsafe URLs cannot create evidence disclosures', async ({ page }) => {
  await page.route('**/api/ask', route => route.fulfill({ json: { ...answer, sources: [
    sources[0],
    { ...sources[1], href: 'javascript:alert(1)' },
    { ...sources[1], href: '//untrusted.example/' },
    { ...sources[1], title: 'Wrong indexed title' },
    { ...sources[1], excerpt: 'A fabricated passage.' },
  ] } }));
  await ask(page);
  await expect(page.locator('.ask-sources a')).toHaveCount(1);
  await expect(page.locator('.ask-sources a')).toHaveAttribute('href', '/campaign/');
  await expect(page.locator('.ask-evidence')).toHaveCount(1);
});
