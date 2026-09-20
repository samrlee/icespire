import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
});

test('home and campaign show the same sourced current state', async ({ page }) => {
  await page.goto('/');
  const state = page.getByRole('region', { name: 'Where we left off' });
  const text = await state.innerText();
  await expect(state).toContainText('As of Session 9');
  await expect(state).toContainText('150 gp escort reward remains unpaid');
  await expect(state.getByRole('link', { name: 'Session 9', exact: true })).toHaveAttribute('href', '/sessions/session-9/');
  await state.getByRole('link', { name: 'Open threads' }).click();
  await expect(page).toHaveURL('/campaign/#open-threads');
  expect(await page.getByRole('region', { name: 'Where we left off' }).innerText()).toBe(text);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const open = await page.locator('#open-threads').boundingBox();
  const history = await page.locator('#the-story-so-far').boundingBox();
  expect(open!.y).toBeLessThan(history!.y);
  await page.getByRole('region', { name: 'Where we left off' }).getByRole('link', { name: 'View location on the map' }).click();
  await expect(page).toHaveURL('/map/#mountains-toe-gold-mine');
});
