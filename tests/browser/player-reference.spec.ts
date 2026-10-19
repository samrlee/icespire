import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
});

test('the table reference keeps authoritative rules, a correct roster and readable print content', async ({ page }) => {
  await page.goto('/table/');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Table reference');
  await expect(main).toContainText('Owen');
  await expect(main).toContainText('2014 rules');
  await expect(main).toContainText('Level cap');
  await expect(main).toContainText('Intelligence check');
  await expect(main.getByRole('row', { name: /Nolan/ })).toContainText('Rut');
  await expect(main.getByRole('row', { name: /Nate/ })).toContainText('Thom');
  await expect(main.getByRole('link', { name: 'Session 0' }).first()).toHaveAttribute('href', '/sessions/session-0/#scene-s9767c43460');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print reference' })).toBeHidden();
  await expect(main.getByRole('table')).toBeVisible();
  await expect(main).toContainText('Sending stones');
});

test('the briefing uses the shared continuation point and cites unpaid work and knowledge limits', async ({ page }) => {
  await page.goto('/briefing/');
  const state = page.getByRole('region', { name: 'Where we left off' });
  const text = await state.innerText();
  await expect(state).toContainText('150 gp escort reward remains unpaid');
  await expect(state).toContainText('That broader claim was not explicitly accepted');
  await expect(page.locator('#name-boundary')).toContainText('She has not yet done so');
  await expect(page.locator('#next-jobs')).toContainText('neither journey nor collection');
  await expect(page.locator('#name-boundary').getByRole('link')).toHaveAttribute('href', '/sessions/session-9/#scene-sc1f02db775');
  await page.goto('/');
  expect(await page.getByRole('region', { name: 'Where we left off' }).innerText()).toBe(text);
});

test('catch-up changes the cutoff deliberately and excludes later content and current profile metadata', async ({ page }) => {
  await page.goto('/catch-up/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catch up through Session 0');
  const choice = page.getByLabel('Stop after');
  await choice.selectOption('/catch-up/session-5/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catch up through Session 0');
  await page.getByRole('button', { name: 'Show catch-up' }).click();
  await expect(page).toHaveURL('/catch-up/session-5/');
  await expect(page.locator('[data-catchup-entry]')).toHaveCount(6);
  const html = await page.content();
  for (const later of ['Don-Jon', 'An Alibi, a Name', 'Means to be townmaster', 'Dax’s private offer', 'The White Dragon</strong>']) expect(html).not.toContain(later);
  await expect(page.locator('#entity-link-data, .entity-pop, .entity-link')).toHaveCount(0);
  await page.getByText('Read passages from Session 5', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Adabra and the first temple rooms' })).toBeVisible();
  const passage = page.locator('[data-session-number="5"] .catchup-passage').first();
  expect(await passage.locator(':scope > p').count()).toBeGreaterThan(1);
  const scene = page.getByRole('link', { name: 'Read this scene in the recap' }).last();
  await expect(scene).toHaveAttribute('href', '/sessions/session-5/#scene-s3b523e72cc');
  await page.goto('/catch-up/session-9/');
  await expect(page.locator('[data-catchup-entry]')).toHaveCount(10);
  await expect(page.getByRole('main')).toContainText('Don-Jon');
  const latest = page.locator('[data-session-number="9"]');
  await latest.getByText('Read passages from Session 9', { exact: true }).click();
  await expect(latest).toContainText('Payments & Sales');
  await expect(latest).not.toContainText('Payments &amp; Sales');
});

test('the evidence selector preserves original witnesses and later tellings and resets', async ({ page }) => {
  await page.goto('/evidence/');
  const character = page.getByLabel('Recorded for character');
  await character.selectOption('rut');
  await expect(page.locator('#exchange-townmaster')).toBeVisible();
  await expect(page.locator('#exchange-townmaster')).toContainText('Rut did not hear this speech');
  await expect(page.locator('#exchange-townmaster').getByRole('navigation', { name: 'Telling source for Thornton’s stated intention' }).getByRole('link')).toHaveAttribute('href', '/sessions/session-9/#scene-s326fe50dfd');
  await expect(page.locator('#exchange-payment-line')).toBeHidden();
  await character.selectOption('bean-hootwhistle');
  await expect(page.locator('#exchange-payment-line')).toBeVisible();
  await expect(page.locator('#exchange-payment-line')).toContainText('Dax was absent');
  await page.getByLabel('Topic').selectOption('temple');
  await expect(page.locator('#exchange-payment-line')).toBeHidden();
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(character).toHaveValue('');
  await expect(page.getByLabel('Topic')).toHaveValue('');
  await expect(page.locator('[data-evidence-claim]:visible')).toHaveCount(11);
  await expect(page.locator('#temple-earlier-statue')).toContainText('Not recorded');
});

test('player references remain readable without JavaScript and cutoff links retain the gate', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route('https://**', route => route.abort());
  try {
    await page.goto(`${baseURL}/catch-up/session-1/`);
    await expect(page.getByLabel('Stop after')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Choose where to stop' })).toBeVisible();
    await expect(page.locator('[data-catchup-entry]')).toHaveCount(2);
    await page.getByRole('link', { name: 'Through Session 3', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catch up through Session 3');
    await expect(page.locator('[data-catchup-entry]')).toHaveCount(4);
    await page.goto(`${baseURL}/evidence/`);
    await expect(page.getByLabel('Recorded for character')).toBeHidden();
    await expect(page.locator('[data-evidence-claim]:visible')).toHaveCount(11);
    await expect(page.locator('#exchange-payment-line')).toContainText('Bean explicitly read the line');
    await page.goto(`${baseURL}/briefing/`);
    await expect(page.getByRole('region', { name: 'Where we left off' })).toBeVisible();
  } finally { await context.close(); }
});
