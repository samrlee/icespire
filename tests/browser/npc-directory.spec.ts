import { test, expect } from '@playwright/test';

test('filters intersect, announce empty results and reset the alphabetical directory', async ({ page }) => {
  await page.goto('/npcs/');
  const entries = page.locator('#npc-directory > li:visible');
  const names = () => entries.locator('.npc-name').allTextContents();
  const all = await names();
  expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
  const disposition = page.getByLabel('Disposition', { exact: true });
  const faction = page.getByLabel('Faction', { exact: true });
  await disposition.selectOption('hostile');
  await expect(entries).toHaveCount(2);
  await faction.selectOption('the-zhentarim');
  await expect(entries).toHaveCount(1);
  await expect(entries).toContainText('Holia Thornton');
  await expect(page.getByRole('status')).toHaveText(`1 of ${all.length} NPCs`);
  await disposition.selectOption('ally');
  await expect(entries).toHaveCount(0);
  await expect(page.getByText('No NPCs match these filters.', { exact: false })).toBeVisible();
  await expect(page.locator('#npc-directory .npc-name a:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  expect(await names()).toEqual(all);
  await expect(disposition).toHaveValue('');
  await expect(faction).toHaveValue('');
  await faction.selectOption('unrecorded');
  await expect(entries).toHaveCount(9);
  await expect(entries.filter({ hasText: 'Don-Jon Raskin' })).toBeVisible();
  await expect(entries.filter({ hasText: 'Holia Thornton' })).toHaveCount(0);
});

test('controls have keyboard order and filtered profiles and thumbnails remain usable', async ({ page }) => {
  await page.goto('/npcs/');
  await page.getByLabel('Disposition', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Faction', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Reset filters' })).toBeFocused();
  await page.getByLabel('Faction', { exact: true }).selectOption('the-zhentarim');
  const row = page.locator('#npc-directory > li:visible').filter({ hasText: 'Holia Thornton' });
  const portrait = row.locator('img');
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toHaveAttribute('alt', '');
  await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await portrait.evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname)).toMatch(/^\/portraits\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.getByRole('link', { name: 'Holia Thornton' }).click();
  await expect(page).toHaveURL(/\/npcs\/holia-thornton\/$/);
});

test('without JavaScript every NPC remains available and inactive filters stay hidden', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/npcs/`);
    await expect(page.getByRole('form', { name: 'Filter NPCs' })).toBeHidden();
    await expect(page.locator('#npc-directory > li:visible')).toHaveCount(13);
    await page.getByRole('link', { name: 'Adabra Gwynn', exact: true }).click();
    await expect(page).toHaveURL(/\/npcs\/adabra-gwynn\/$/);
  } finally { await context.close(); }
});
