import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
});

test('homepage actions precede the cover on phones and remain usable', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    const actions = await page.locator('.hero-actions').boundingBox();
    const cover = await page.locator('.hero-cover').boundingBox();
    const state = await page.locator('.current-state').boundingBox();
    expect(actions!.y + actions!.height).toBeLessThan(state!.y);
    expect(actions!.y + actions!.height).toBeLessThan(cover!.y);
  }
  await page.getByRole('button', { name: 'Ask the chronicle', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Read the latest recap' }).click();
  await expect(page).toHaveURL(/\/sessions\/session-\d+\/$/);
});

test('phone cast is compact, expands with the keyboard, and remains complete when printed', async ({ page, isMobile }) => {
  await page.goto('/sessions/session-9/');
  const toggle = page.locator('.dramatis-toggle');
  const cast = page.locator('.dramatis-list');
  if (isMobile) {
    await expect(cast).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(cast).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(cast).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(cast).toBeVisible();
    await expect(toggle).toBeHidden();
  } else {
    await expect(cast).toBeVisible();
    await expect(page.locator('.dramatis-toggle')).toBeHidden();
  }
});

test('the complete recap cast remains available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('https://**', route => route.abort());
  await page.goto('http://127.0.0.1:4322/sessions/session-9/');
  await expect(page.locator('.dramatis-list')).toBeVisible();
  await expect(page.locator('.dramatis-list a')).toHaveCount(14);
  await expect(page.locator('.dramatis-toggle')).toBeHidden();
  await context.close();
});

test('homepage and roster load small portraits with reserved crop dimensions', async ({ page }) => {
  for (const [route, selector] of [['/', '.party-portrait'], ['/characters/', '.portrait > img']]) {
    await page.goto(route);
    const img = page.locator(selector).first();
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(await img.evaluate((node: HTMLImageElement) => node.currentSrc)).toContain('/portraits/');
    await expect(img).toHaveCSS('object-position', '50% 0%');
    const box = await img.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(3 / 4, 1);
    await expect(img).toHaveAttribute('loading', 'lazy');
  }
});

test('recap avatars and entity previews load their responsive candidates', async ({ page }) => {
  await page.goto('/sessions/session-9/');
  const avatar = page.locator('img.dp-avatar').first();
  await expect.poll(() => avatar.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(await avatar.evaluate((node: HTMLImageElement) => node.currentSrc)).toMatch(/\/portraits\/.*-(64|128)\.webp$/);
  const link = page.locator('.entity-link').filter({ hasText: 'Dax' }).first();
  await link.focus();
  const portrait = page.locator('.pop-portrait');
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(await portrait.evaluate((node: HTMLImageElement) => node.currentSrc)).toContain('/portraits/');
});

test('profile artwork keeps its original source', async ({ page }) => {
  await page.goto('/characters/dax/');
  await expect(page.locator('.character-card.page .portrait')).toHaveCSS('background-image', /\/images\/characters\/dax.webp/);
  await page.goto('/npcs/adabra-gwynn/');
  await expect(page.locator('.npc-portrait-card img')).toHaveAttribute('src', '/images/npcs/adabra-gwynn.webp');
});
