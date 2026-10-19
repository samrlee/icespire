import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('narrow Codex panels fit the page and expose a complete heading hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/codex/');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  expect(await page.locator('.faction-panel h2').count()).toBeGreaterThan(0);
  for (const panel of await page.locator('.faction-panel').all()) {
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
});

test('character profiles have a main heading and entity descriptions', async ({ page }) => {
  await page.goto('/characters/');
  const routes = await page.locator('.char-name a').evaluateAll(links => links.map(link => link.getAttribute('href')!));
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const tagline = await page.locator('.char-bio').innerText();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', tagline);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', tagline);
  }
});

test('all font subsets load under the production CSP without external font hosts', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalRequests.push(request.url());
  });
  const headers = await readFile(new URL('../../dist/_headers', import.meta.url), 'utf8');
  const csp = headers.match(/^  Content-Security-Policy: (.+)$/m)![1];
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  await page.route('https://**', route => route.abort());
  await page.goto('/timeline/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.fonts].map(font => font.load())));
  const families = await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family));
  for (const family of ['Cinzel', 'Crimson Pro', 'JetBrains Mono']) expect(families.join(' ')).toContain(family);
  expect(externalRequests).toEqual([]);
});
