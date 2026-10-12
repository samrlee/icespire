import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('licensed local fonts load every weight and italics under the published policy', async ({ page, baseURL }) => {
  const headers = await readFile(new URL('../../dist/_headers', import.meta.url), 'utf8');
  const policy = headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1];
  expect(policy).toBeTruthy();
  expect(policy).not.toMatch(/googleapis|gstatic/);
  const externalFontRequests: string[] = [];
  const fontResponses: { path: string; status: number; type?: string }[] = [];
  const failedRequests: { url: string; error?: string }[] = [];
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFontRequests.push(request.url());
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/fonts/') && url.pathname.endsWith('.woff2')) {
      fontResponses.push({ path: url.pathname, status: response.status(), type: response.headers()['content-type'] });
    }
  });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.route('https://fonts.**', route => route.abort());
  // The published policy upgrades insecure requests. WebKit also upgrades
  // loopback HTTP assets, while this fixture server speaks only HTTP. Serve
  // the built site through a virtual HTTPS origin so the complete production
  // policy is tested with the same secure URLs visitors receive.
  await page.route('https://icespire.test/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: new URL(url.pathname + url.search, baseURL).href });
    const responseHeaders = { ...response.headers() };
    if (route.request().isNavigationRequest()) responseHeaders['content-security-policy'] = policy!;
    await route.fulfill({ response, headers: responseHeaders });
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
  await page.goto('https://icespire.test/sessions/session-9/');
  const before = await page.evaluate(() => Array.from(document.fonts, face => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })));
  // Force style/layout before querying the font set, including in engines
  // that register stylesheet faces when the first layout is resolved.
  await expect(page.locator('h1'), JSON.stringify({ before, fontResponses, failedRequests })).toHaveCSS('font-family', /Cinzel/);
  const after = await page.evaluate(async () => {
    const heading = document.querySelector('h1')!;
    const bodyFamily = getComputedStyle(document.body).fontFamily;
    const headingFamily = getComputedStyle(heading).fontFamily;
    const headingWidth = heading.getBoundingClientRect().width;
    await document.fonts.ready;
    return { bodyFamily, headingFamily, headingWidth, faces: Array.from(document.fonts, face => ({ family: face.family, style: face.style, weight: face.weight, status: face.status })) };
  });
  const diagnostics = () => ({ before, after, fontResponses, failedRequests });
  expect(after.bodyFamily, JSON.stringify(diagnostics())).toContain('Crimson Pro');
  expect(after.headingWidth, JSON.stringify(diagnostics())).toBeGreaterThan(0);
  expect(after.faces.length, JSON.stringify(diagnostics())).toBe(4);
  expect(after.faces.map(face => `${face.family.replace(/["']/g, '')}:${face.style}`).sort(), JSON.stringify(diagnostics())).toEqual([
    'Cinzel:normal', 'Crimson Pro:italic', 'Crimson Pro:normal', 'JetBrains Mono:normal',
  ]);
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
    const detail = `${font.specification}\n${JSON.stringify({ ...diagnostics(), fonts })}`;
    expect(font.faces, detail).toBeGreaterThan(0);
    expect(font.loaded, detail).toBe(true);
  }
  expect(new Set(fontResponses.map(response => response.path)).size).toBe(4);
  for (const response of fontResponses) {
    expect(response.status, response.path).toBe(200);
    expect(response.type, response.path).toBe('font/woff2');
  }
  expect(externalFontRequests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { fontPolicyViolations: string[] }).fontPolicyViolations)).toEqual([]);
});
