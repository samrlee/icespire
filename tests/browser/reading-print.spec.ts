import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
});

test('only longer recaps show an estimated reading time', async ({ page }) => {
  await page.goto('/sessions/session-0/');
  await expect(page.locator('.reading-time')).toHaveCount(0);
  await page.goto('/sessions/session-9/');
  await expect(page.locator('.reading-time')).toHaveText(/^About \d+ min read$/);
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
