import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
});

test('only longer recaps show an estimated reading time', async ({ page }) => {
  await page.goto('/sessions/session-0/');
  await expect(page.locator('.reading-time')).toHaveCount(0);
  await expect(page.locator('.reading-position')).toHaveCount(0);
  await page.goto('/sessions/session-9/');
  await expect(page.locator('.reading-time')).toHaveText(/^About \d+ min read$/);
});

test('reading position is opt-in, resumes explicitly and can be forgotten', async ({ page }) => {
  await page.goto('/sessions/session-9/');
  const remember = page.getByRole('checkbox', { name: 'Remember my place in this tab' });
  const key = 'icespire-reading:/sessions/session-9/';
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  await remember.check();
  await page.locator('.session-layout > .prose p').nth(12).scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).position, key)).toBeGreaterThan(0);
  await page.goto('/sessions/');
  await page.goto('/sessions/session-9/');
  await expect(remember).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Resume reading' })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Resume reading' }).click();
  await expect(page.locator('.session-layout > .prose')).toBeFocused();
  await expect(remember).toBeChecked();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Forget saved place' }).click();
  await expect(remember).toBeFocused();
  await expect(remember).not.toBeChecked();
  await page.locator('.session-layout > .prose p').nth(15).scrollIntoViewIfNeeded();
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
});

test('obsolete and malformed reading positions are discarded', async ({ page }) => {
  await page.goto('/sessions/session-9/');
  for (const value of ['not JSON', JSON.stringify({ version: 'old-recap', position: 0.5 })]) {
    await page.evaluate(value => sessionStorage.setItem('icespire-reading:/sessions/session-9/', value), value);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Resume reading' })).toBeHidden();
    await expect(page.locator('[data-reading-status]')).toContainText('outdated or invalid');
    expect(await page.evaluate(() => sessionStorage.getItem('icespire-reading:/sessions/session-9/'))).toBeNull();
  }
});

test('blocked reading storage leaves the recap readable and reports the limitation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/sessions/session-9/');
  await expect(page.getByRole('checkbox', { name: 'Remember my place in this tab' })).toBeDisabled();
  await expect(page.locator('[data-reading-status]')).toContainText('unavailable');
  await expect(page.locator('.session-layout > .prose')).toBeVisible();
});

for (const route of ['/sessions/session-9/', '/campaign/']) {
  test(`print preserves prose and hides screen controls for ${route}`, async ({ page }) => {
    await page.goto(route);
    const prose = page.locator('.prose').first();
    await page.locator('.entity-link').first().focus();
    await expect(page.locator('.entity-pop')).toBeVisible();
    const paragraphs = await prose.locator('p').allTextContents();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.locator('.entity-pop')).toBeHidden();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(prose).toHaveCSS('color', 'rgb(17, 17, 17)');
    await expect(page.locator('.session-layout, .doc-layout')).toHaveCSS('display', 'block');
    expect(await prose.locator('p').allTextContents()).toEqual(paragraphs);
    await expect(prose.locator('p').last()).toBeVisible();
    if (route.startsWith('/sessions/')) {
      await expect(page.locator('.reading-position')).toBeHidden();
      await expect(page.locator('.session-meta')).toBeVisible();
      await expect(page.locator('.dramatis')).toBeVisible();
      await expect(page.locator('.session-pager')).toBeHidden();
    } else {
      await expect(page.locator('.doc-toc')).toBeHidden();
    }
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.site-header')).toBeVisible();
  });
}
