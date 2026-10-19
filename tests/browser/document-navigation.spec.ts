import { test, expect } from '@playwright/test';

for (const javaScriptEnabled of [true, false]) {
  test.describe(`document navigation with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, () => {
    test.use({ javaScriptEnabled, reducedMotion: 'reduce' });
    test.beforeEach(async ({ page }) => {
      await page.route('https://**', route => route.abort());
    });

    test('campaign sections remain reachable in a compact phone disclosure', async ({ page, isMobile }) => {
      await page.goto('/campaign/');
      const disclosure = page.locator('.doc-toc-mobile');
      const navigation = page.getByRole('navigation', { name: 'On this page', exact: true });
      if (isMobile) {
        await expect(disclosure).toBeVisible();
        await expect(disclosure).not.toHaveAttribute('open', '');
        await expect(navigation).toHaveCount(0);
        expect((await disclosure.boundingBox())!.height).toBeLessThan(80);
        // The disclosure precedes the campaign snapshot and works with native
        // touch interaction even when JavaScript cannot run.
        expect(await disclosure.evaluate(element => !!(
          element.compareDocumentPosition(document.querySelector('.current-state')!) & Node.DOCUMENT_POSITION_FOLLOWING
        ))).toBe(true);
        await disclosure.locator('summary').tap();
      } else {
        await expect(disclosure).toBeHidden();
      }
      await expect(navigation).toHaveCount(1);
      await expect(navigation).toBeVisible();
      const openThreads = navigation.getByRole('link', { name: 'Open threads', exact: true });
      await openThreads.focus();
      await openThreads.press('Enter');
      await expect(page).toHaveURL(/\/campaign\/#open-threads$/);
      await expect(page.locator('#open-threads')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });

    test('recap scene navigation collapses on phones and preserves published anchors', async ({ page, isMobile }) => {
      await page.goto('/sessions/session-9/');
      const disclosure = page.locator('.recap-scenes-mobile');
      const navigation = page.getByRole('navigation', { name: 'Jump within this recap', exact: true });
      if (isMobile) {
        await expect(disclosure).toBeVisible();
        await expect(disclosure).not.toHaveAttribute('open', '');
        await expect(navigation).toHaveCount(0);
        expect((await disclosure.boundingBox())!.height).toBeLessThan(80);
        await disclosure.locator('summary').focus();
        await disclosure.locator('summary').press('Enter');
      } else {
        await expect(disclosure).toBeHidden();
      }
      await expect(navigation).toHaveCount(1);
      const scene = navigation.getByRole('link').nth(1);
      const fragment = (await scene.getAttribute('href'))!;
      expect(fragment).toMatch(/^#scene-/);
      await scene.focus();
      await scene.press('Enter');
      expect(new URL(page.url()).hash).toBe(fragment);
      await expect(page.locator(fragment)).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}
