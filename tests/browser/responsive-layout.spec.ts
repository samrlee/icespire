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
  // Give the browser a secure site origin while serving the real build through
  // the local fixture. The production policy upgrades insecure requests, which
  // WebKit also applies to the fixture's HTTP loopback stylesheet URLs.
  await page.route('https://**', route => route.abort());
  await page.route('https://chronicle.test/**', async route => {
    const target = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:4322${target.pathname}${target.search}` });
    await route.fulfill({ response, headers: {
      ...response.headers(),
      ...(route.request().resourceType() === 'document' ? { 'content-security-policy': csp } : {}),
    } });
  });
  await page.goto('https://chronicle.test/timeline/');
  // WebKit can resolve fonts.ready before its first style/layout pass has
  // populated the CSS-backed FontFaceSet. Flush layout and wait for that set
  // before loading every subset, including ones absent from the page's text.
  await page.locator('h1').evaluate(heading => heading.getBoundingClientRect());
  await expect.poll(() => page.evaluate(() => document.fonts.size)).toBe(14);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.fonts].map(font => font.load())));
  const families = await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family));
  expect(families).toHaveLength(14);
  for (const family of ['Cinzel', 'Crimson Pro', 'JetBrains Mono']) expect(families.join(' ')).toContain(family);
  expect(externalRequests).toEqual([]);
});
