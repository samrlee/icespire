import { test, expect, type Page } from '@playwright/test';

async function openMobileMenu(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') === 'false') await menu.click();
}

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
  await openMobileMenu(page);
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
  await openMobileMenu(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const trigger = nav.getByRole('button', { name: 'The Story' });
  await trigger.focus();
  await trigger.press('Space');
  await nav.getByRole('link', { name: 'Story so far', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('button', { name: 'The World' })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('pointer toggles, outside dismissal and ordinary navigation remain usable', async ({ page, isMobile }) => {
  await openMobileMenu(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const story = nav.getByRole('button', { name: 'The Story' });
  const world = nav.getByRole('button', { name: 'The World' });
  const activate = async (target: typeof story) => isMobile ? target.tap() : target.click();
  await activate(story);
  await activate(world);
  await expect(nav).toBeVisible();
  await expect(story).toHaveAttribute('aria-expanded', 'false');
  await expect(world).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.nav-trigger[aria-controls="nav-links-1"]')).toHaveAttribute('aria-expanded', 'false');
  await openMobileMenu(page);
  await activate(story);
  await activate(nav.getByRole('link', { name: 'Recaps' }));
  await expect(page).toHaveURL('/sessions/');
  await openMobileMenu(page);
  await activate(story);
  await expect(nav.getByRole('link', { name: 'Recaps' })).toHaveAttribute('aria-current', 'page');
  await expect(story).not.toHaveAttribute('aria-current');
});

test('theme control names its destination and remembers the selection', async ({ page }) => {
  await openMobileMenu(page);
  const light = page.getByRole('button', { name: 'Light mode', exact: true });
  await light.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await openMobileMenu(page);
  const dark = page.getByRole('button', { name: 'Dark mode', exact: true });
  await expect(dark).toBeVisible();
  await dark.focus();
  await dark.press('Enter');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await page.reload();
  await openMobileMenu(page);
  await expect(light).toBeVisible();
});

test('player tools remain reachable through the primary navigation', async ({ page }) => {
  await openMobileMenu(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const tools = nav.getByRole('button', { name: 'Tools', exact: true });
  await tools.click();
  await expect(tools).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Next session', 'Catch up', 'Table reference', 'Bookmarks and notes', 'Evidence']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await nav.getByRole('link', { name: 'Table reference', exact: true }).click();
  await expect(page).toHaveURL('/table/');
  await openMobileMenu(page);
  await tools.click();
  await expect(nav.getByRole('link', { name: 'Table reference', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('theme switching survives blocked preference storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await openMobileMenu(page);
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(errors).toEqual([]);
});

for (const width of [320, 390]) {
  test(`phone header stays compact with reachable search and Menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const header = page.locator('.site-header');
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    const search = page.getByRole('button', { name: 'Search or ask', exact: true });
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toBeHidden();
    await expect(page.locator('#theme-toggle')).toBeHidden();
    await expect(search).toBeInViewport({ ratio: 1 });
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(92);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await menu.focus();
    await menu.press('Enter');
    await expect(nav).toBeVisible();
    await expect(menu).toHaveAttribute('aria-controls', 'site-navigation');
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await menu.click();
    await page.getByRole('main').click({ position: { x: 5, y: 5 } });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await search.click();
    await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Close search', exact: true }).click();
    await expect(search).toBeFocused();
  });
}

test('phone menu closes when focus leaves and resets sensibly across screen sizes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.click();
  await page.locator('#theme-toggle').focus();
  await page.keyboard.press('Tab');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).not.toBeFocused();

  await menu.click();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const world = nav.getByRole('button', { name: 'The World' });
  await world.click();
  await nav.getByRole('link', { name: 'Party', exact: true }).focus();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(menu).toBeHidden();
  await expect(nav).toBeVisible();
  await expect(world).toBeFocused();
  await expect(world).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.header-tools #theme-toggle')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
});

test('primary and footer navigation have distinct landmark names', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Primary', includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Footer', exact: true })).toHaveCount(1);
});

test('search shortcuts from a navigation link return to a visible menu trigger', async ({ page, isMobile }) => {
  await openMobileMenu(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('button', { name: 'The Story' }).click();
  await nav.getByRole('link', { name: 'Recaps', exact: true }).focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeVisible();
  await page.keyboard.press('Escape');
  const trigger = isMobile ? page.getByRole('button', { name: 'Menu', exact: true }) : nav.getByRole('button', { name: 'The Story' });
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeFocused();
});

test('without JavaScript every navigation link remains available on a phone', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 }, baseURL });
  try {
    const page = await context.newPage();
    await page.route('https://**', route => route.abort());
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const name of ['Home', 'Recaps', 'Timeline', 'Story so far', 'Map', 'Party', 'NPCs', 'Relationships', 'Codex', 'Next session', 'Catch up', 'Table reference', 'Bookmarks and notes', 'Evidence']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.site-menu-toggle')).toBeHidden();
    await nav.getByRole('link', { name: 'Recaps', exact: true }).click();
    await expect(page).toHaveURL('/sessions/');
  } finally {
    await context.close();
  }
});
