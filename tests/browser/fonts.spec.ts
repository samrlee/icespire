import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('licensed local fonts load every weight and italics under the published policy', async ({ page }) => {
  const headers = await readFile(new URL('../../dist/_headers', import.meta.url), 'utf8');
  const policy = headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1];
  expect(policy).toBeTruthy();
  expect(policy).not.toMatch(/googleapis|gstatic/);
  const externalFontRequests: string[] = [];
  const fontResponses: { path: string; status: number; type?: string }[] = [];
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFontRequests.push(request.url());
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/fonts/') && url.pathname.endsWith('.woff2')) {
      fontResponses.push({ path: url.pathname, status: response.status(), type: response.headers()['content-type'] });
    }
  });
  await page.route('https://fonts.**', route => route.abort());
  await page.route('**/sessions/session-9/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy! } });
  });
  await page.addInitScript(() => {
    const state = window as unknown as { fontPolicyViolations: string[] };
    state.fontPolicyViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      if (event.violatedDirective.startsWith('font-src') || event.violatedDirective.startsWith('style-src-elem')) {
        state.fontPolicyViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
      }
    });
  });
  await page.goto('/sessions/session-9/');
  const fonts = await page.evaluate(async () => {
    const specifications = [
      ...[400, 500, 600, 700, 800].map(weight => `${weight} 24px "Cinzel"`),
      ...[400, 500, 600, 700].map(weight => `${weight} 24px "Crimson Pro"`),
      ...[400, 600, 700].map(weight => `italic ${weight} 24px "Crimson Pro"`),
      ...[400, 500].map(weight => `${weight} 24px "JetBrains Mono"`),
    ];
    const result = [];
    for (const specification of specifications) {
      const faces = await document.fonts.load(specification, 'Ærô— “Rut’s”');
      result.push({ specification, faces: faces.length, loaded: faces.every(face => face.status === 'loaded') });
    }
    return result;
  });
  for (const font of fonts) {
    expect(font.faces, font.specification).toBeGreaterThan(0);
    expect(font.loaded, font.specification).toBe(true);
  }
  expect(new Set(fontResponses.map(response => response.path)).size).toBe(4);
  for (const response of fontResponses) {
    expect(response.status, response.path).toBe(200);
    expect(response.type, response.path).toBe('font/woff2');
  }
  expect(externalFontRequests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { fontPolicyViolations: string[] }).fontPolicyViolations)).toEqual([]);
});
