import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/campaign/');
});

test('Escape dismisses a focused preview without losing the source link', async ({ page }) => {
  const link = page.locator('.entity-link').first();
  await link.focus();
  await expect(page.locator('.entity-pop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.entity-pop')).toBeHidden();
  await expect(link).toBeFocused();
});

test('touch previews before navigating; desktop links navigate directly', async ({ page, isMobile }) => {
  const link = page.locator('.entity-link').first();
  const href = await link.getAttribute('href');
  if (isMobile) {
    await link.tap();
    await expect(page).toHaveURL('/campaign/');
    await expect(page.locator('.entity-pop')).toBeVisible();
    await page.locator('.pop-open').tap();
  } else {
    await link.click();
  }
  await expect(page).toHaveURL(href!);
});

test('Tab reaches the named preview and Escape restores focus', async ({ page }) => {
  const link = page.locator('.entity-link').first();
  await link.focus();
  const card = page.getByRole('group', { name: 'Phandalin', exact: true });
  await expect(card).toBeVisible();
  await expect(link).toHaveAttribute('aria-controls', 'entity-preview');
  await page.keyboard.press('Tab');
  await expect(card.getByRole('link')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(link).toBeFocused();
  await expect(link).not.toHaveAttribute('aria-controls');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/map/#phandalin');
});

test('preview stays while focused, then closes after focus leaves', async ({ page }) => {
  const link = page.locator('.entity-link').first();
  await link.focus();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300); // Exercise the delayed pointer dismissal.
  await expect(page.locator('.entity-pop')).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await expect(page.locator('.entity-pop')).toBeHidden();
});

test('pointer preview supports card hover and outside dismissal', async ({ page, isMobile }) => {
  const link = page.locator('.entity-link').first();
  if (isMobile) await link.tap();
  else await link.hover();
  const card = page.locator('.entity-pop');
  await expect(card).toBeVisible();
  await expect(card).toBeInViewport();
  if (!isMobile) {
    await card.hover();
    await page.waitForTimeout(300);
    await expect(card).toBeVisible();
  }
  await page.locator('h1').click();
  await expect(card).toBeHidden();
  if (isMobile) {
    await link.tap();
    await expect(page).toHaveURL('/campaign/');
    await link.tap();
    await expect(page).toHaveURL('/map/#phandalin');
  }
});
