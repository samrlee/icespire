import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
});

test('first Tab exposes a skip link that focuses the main content', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await skip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('disclosure links follow Tab order and Escape returns to the trigger', async ({ page }) => {
  const tab = 'Tab';
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const trigger = nav.getByRole('button', { name: 'The Story' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-controls', 'nav-links-0');
  await expect(nav.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press(tab);
  await expect(nav.getByRole('link', { name: 'Recaps' })).toBeFocused();
  await page.keyboard.press(tab);
  await expect(nav.getByRole('link', { name: 'Timeline' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('link', { name: 'Recaps' })).toBeHidden();
  await page.keyboard.press(tab);
  await expect(nav.getByRole('button', { name: 'The World' })).toBeFocused();
});

test('tabbing out closes a disclosure without moving focus back', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const trigger = nav.getByRole('button', { name: 'The Story' });
  await trigger.focus();
  await trigger.press('Space');
  await nav.getByRole('link', { name: 'Campaign', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('button', { name: 'The World' })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('pointer toggles, outside dismissal and ordinary navigation remain usable', async ({ page, isMobile }) => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const story = nav.getByRole('button', { name: 'The Story' });
  const world = nav.getByRole('button', { name: 'The World' });
  const activate = async (target: typeof story) => isMobile ? target.tap() : target.click();
  await activate(story);
  await activate(world);
  await expect(story).toHaveAttribute('aria-expanded', 'false');
  await expect(world).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await expect(world).toHaveAttribute('aria-expanded', 'false');
  await activate(story);
  await activate(nav.getByRole('link', { name: 'Recaps' }));
  await expect(page).toHaveURL('/sessions/');
  await activate(story);
  await expect(nav.getByRole('link', { name: 'Recaps' })).toHaveAttribute('aria-current', 'page');
  await expect(story).not.toHaveAttribute('aria-current');
});

test('theme control names its destination and remembers the selection', async ({ page }) => {
  const light = page.getByRole('button', { name: 'Light mode', exact: true });
  await light.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  const dark = page.getByRole('button', { name: 'Dark mode', exact: true });
  await expect(dark).toBeVisible();
  await dark.focus();
  await dark.press('Enter');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await page.reload();
  await expect(light).toBeVisible();
});

test('theme switching survives blocked preference storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(errors).toEqual([]);
});
