import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false, reducedMotion: 'reduce' });
for (const profile of ['/characters/dax/', '/npcs/holia-thornton/']) {
  test(`${profile} links to mentioned recaps without JavaScript`, async ({ page }) => {
    await page.route('https://**', route => route.abort());
    await page.goto(profile);
    const section = page.getByRole('region', { name: 'Mentioned in recaps' });
    await expect(section).toBeVisible();
    const links = section.locator('ul > li > a');
    await expect(links.first()).toHaveAttribute('href', '/sessions/session-9/');
    await expect(section).toContainText('Sep 18, 2026');
    const texts = await links.allTextContents();
    const numbers = texts.map(text => Number(text.match(/Session (\d+)/)?.[1]));
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Exercise native no-script navigation without pointer stability polling
    // on a below-the-fold, wrapping link in mobile browser emulation.
    await links.first().focus();
    await expect(links.first()).toBeFocused();
    await links.first().press('Enter');
    await expect(page).toHaveURL(/\/sessions\/session-9\/$/);
    await expect(page.locator('h1')).toContainText('An Alibi');
  });
}
