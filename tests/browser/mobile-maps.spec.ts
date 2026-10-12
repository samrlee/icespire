import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test';

const maps = [
  { name: 'region', path: '/map/' },
  { name: 'Phandalin', path: '/map/phandalin/' },
  { name: 'Gnomengarde', path: '/map/gnomengarde/' },
  { name: 'Dwarven Excavation', path: '/map/dwarven-excavation/' },
  { name: 'Umbrage Hill', path: '/map/umbrage-hill/' },
];

test.use({ deviceScaleFactor: 3 });

test.beforeEach(async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  test.skip(!isMobile, 'The dedicated explorer is a phone/tablet interaction.');
  await page.route('https://**', route => route.abort());
  await page.route('**/api/ask', route => route.abort());
});

async function frame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

// This uses Chromium's native input pipeline. dispatchEvent(PointerEvent) never
// asks the browser to scroll, suppress a click, cancel a pointer, or page-zoom.
async function touchGesture(page: Page, session: CDPSession, contacts: Array<{
  from: { x: number; y: number }; to: { x: number; y: number };
}>) {
  const points = (progress: number) => contacts.map((contact, id) => ({
    id: id + 1,
    x: contact.from.x + (contact.to.x - contact.from.x) * progress,
    y: contact.from.y + (contact.to.y - contact.from.y) * progress,
  }));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
  try {
    for (let step = 1; step <= 12; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step / 12) });
      await frame(page);
    }
    // End at rest rather than deliberately flinging a long document.
    await frame(page);
    await frame(page);
  } finally {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

async function settledScroll(page: Page) {
  let previous = Number.NaN;
  let stable = 0;
  await expect.poll(async () => {
    const current = await page.evaluate(() => scrollY);
    stable = Math.abs(current - previous) < .5 ? stable + 1 : 0;
    previous = current;
    return stable;
  }, { intervals: [16, 32, 64], timeout: 5_000 }).toBeGreaterThanOrEqual(3);
  return previous;
}

async function swipePageMap(page: Page, session: CDPSession) {
  const svg = page.locator('#map-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const viewport = page.viewportSize()!;
  const top = Math.max(box.y + 12, 90);
  const bottom = Math.min(box.y + box.height - 12, viewport.height - 20);
  const distance = Math.min(160, bottom - top - 20);
  expect(distance).toBeGreaterThan(60);
  const x = Math.min(box.x + box.width * .15, viewport.width - 20);
  const before = await settledScroll(page);
  await touchGesture(page, session, [{
    from: { x, y: bottom }, to: { x, y: bottom - distance },
  }]);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 40);
  return settledScroll(page);
}

async function expectOnScreen(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

for (const map of maps) {
  test(`${map.name} explorer has reachable controls and restores focus and page position`, async ({ page }) => {
    await page.goto(map.path);
    const explore = page.locator('#map-explore');
    await expect(explore).toBeVisible();
    await expect(explore).toHaveAccessibleName('Explore map');
    await explore.scrollIntoViewIfNeeded();
    const before = await settledScroll(page);
    const svg = page.locator('#map-svg');
    const originalView = (await svg.getAttribute('viewBox'))!;
    await explore.tap();
    const dialog = page.locator('#map-explorer');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-map-explorer-canvas] #map-frame')).toBeVisible();
    await expect(page.locator('#map-svg')).toHaveCount(1);
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    const done = dialog.getByRole('button', { name: 'Done', exact: true });
    for (const control of [done, dialog.locator('#map-zoom-in'), dialog.locator('#map-zoom-out'), dialog.locator('#map-zoom-reset')]) {
      await expectOnScreen(page, control);
    }
    if (map.path !== '/map/') {
      const key = dialog.locator('.map-explorer-key');
      const disclosure = key.locator('summary');
      await expect(disclosure).toHaveText('Map key');
      await disclosure.tap();
      await expect(key).toHaveAttribute('open', '');
      expect(await key.locator('ol li').count()).toBeGreaterThan(0);
      for (const control of [done, dialog.locator('#map-zoom-in'), dialog.locator('#map-zoom-out'), dialog.locator('#map-zoom-reset')]) {
        await expectOnScreen(page, control);
      }
      await disclosure.tap();
    }
    await dialog.locator('#map-zoom-in').tap();
    await expect(svg).not.toHaveAttribute('viewBox', originalView);
    await dialog.locator('#map-zoom-reset').tap();
    await expect(svg).toHaveAttribute('viewBox', originalView);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      // Native dialogs may tab into browser chrome, represented by BODY.
      // They must never transfer focus to an inert background control.
      expect(await dialog.evaluate(element => element.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
    }
    await explore.evaluate(element => (element as HTMLElement).focus());
    await expect(explore).not.toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(explore).toBeFocused();
    expect(Math.abs((await settledScroll(page)) - before)).toBeLessThanOrEqual(1);
    await expect(svg).toHaveAttribute('data-exploring', 'false');
    await expect(page.locator('[data-map-explorer-canvas] #map-frame')).toHaveCount(0);
    await explore.tap();
    await expect(dialog).toBeVisible();
    await done.tap();
    await expect(dialog).toBeHidden();
    await expect(explore).toBeFocused();
    expect(Math.abs((await settledScroll(page)) - before)).toBeLessThanOrEqual(1);
  });

  test(`${map.name} native swipes scroll the page before and after closing Explorer`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native multi-contact input uses the Chromium DevTools protocol.');
    await page.goto(map.path);
    await expect(page.getByRole('button', { name: 'Explore map', exact: true })).toBeVisible();
    const session = await page.context().newCDPSession(page);
    const svg = page.locator('#map-svg');
    const originalView = (await svg.getAttribute('viewBox'))!;
    const originalURL = page.url();
    await page.evaluate(() => {
      const state = window as unknown as { nativeScrollPointers: Array<{ type: string; trusted: boolean }> };
      state.nativeScrollPointers = [];
      for (const type of ['pointerdown', 'pointercancel']) {
        document.addEventListener(type, event => state.nativeScrollPointers.push({ type, trusted: event.isTrusted }), true);
      }
    });
    try {
      await swipePageMap(page, session);
      await expect(svg).toHaveAttribute('viewBox', originalView);
      expect(page.url()).toBe(originalURL);
      const nativeEvents = await page.evaluate(() => (window as unknown as {
        nativeScrollPointers: Array<{ type: string; trusted: boolean }>;
      }).nativeScrollPointers);
      expect(nativeEvents.some(event => event.type === 'pointerdown' && event.trusted)).toBe(true);
      expect(nativeEvents.some(event => event.type === 'pointercancel' && event.trusted)).toBe(true);
      await page.getByRole('button', { name: 'Explore map', exact: true }).tap();
      await expect(page.locator('#map-explorer')).toBeVisible();
      await page.locator('[data-map-explorer-close]').tap();
      await expect(page.locator('#map-explorer')).toBeHidden();
      await swipePageMap(page, session);
      await expect(svg).toHaveAttribute('viewBox', originalView);
      expect(page.url()).toBe(originalURL);
      if (map.path === '/map/') {
        const marker = page.locator('.map-marker[data-slug="phandalin"] circle.hit');
        await marker.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const markerBox = (await marker.boundingBox())!;
        const start = { x: markerBox.x + markerBox.width / 2, y: markerBox.y + markerBox.height / 2 };
        const scrollBefore = await settledScroll(page);
        await touchGesture(page, session, [{ from: start, to: { x: start.x, y: start.y - 120 } }]);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 40);
        await settledScroll(page);
        await expect(page.locator('#map-panel-detail')).toBeHidden();
        await expect(svg).toHaveAttribute('viewBox', originalView);
        expect(page.url()).toBe(originalURL);
      }
    } finally {
      await session.detach().catch(() => {});
    }
  });

  test(`${map.name} native Explorer drag and pinch move only the map`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native multi-contact input uses the Chromium DevTools protocol.');
    await page.goto(map.path);
    await page.getByRole('button', { name: 'Explore map', exact: true }).tap();
    const dialog = page.locator('#map-explorer');
    await expect(dialog).toBeVisible();
    const svg = dialog.locator('#map-svg');
    const session = await page.context().newCDPSession(page);
    const lockedScroll = await settledScroll(page);
    const browserScale = await page.evaluate(() => visualViewport!.scale);
    const box = (await svg.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const originalView = (await svg.getAttribute('viewBox'))!;
    const originalURL = page.url();
    try {
      await dialog.locator('#map-zoom-in').tap();
      const beforeDrag = (await svg.getAttribute('viewBox'))!;
      const dragStart = { x: center.x + 30, y: center.y + 15 };
      const dragEnd = { x: center.x - 30, y: center.y - 15 };
      const dragAnchor = await svg.evaluate((element, point) => {
        const mapPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!.inverse());
        return { x: mapPoint.x, y: mapPoint.y };
      }, dragStart);
      await touchGesture(page, session, [{
        from: dragStart, to: dragEnd,
      }]);
      await expect(svg).not.toHaveAttribute('viewBox', beforeDrag);
      const dragAnchorAfter = await svg.evaluate((element, point) => {
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!);
        return { x: screenPoint.x, y: screenPoint.y };
      }, dragAnchor);
      expect(Math.hypot(dragAnchorAfter.x - dragEnd.x, dragAnchorAfter.y - dragEnd.y)).toBeLessThan(4);
      await expect(dialog).toBeVisible();
      expect(page.url()).toBe(originalURL);
      expect(Math.abs((await settledScroll(page)) - lockedScroll)).toBeLessThanOrEqual(1);
      await dialog.locator('#map-zoom-reset').tap();
      await expect(svg).toHaveAttribute('viewBox', originalView);
      const anchor = await svg.evaluate((element, point) => {
        const mapPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!.inverse());
        return { x: mapPoint.x, y: mapPoint.y };
      }, center);
      await touchGesture(page, session, [
        { from: { x: center.x - 30, y: center.y }, to: { x: center.x - 75, y: center.y } },
        { from: { x: center.x + 30, y: center.y }, to: { x: center.x + 75, y: center.y } },
      ]);
      await expect.poll(async () => Number((await svg.getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(Number(originalView.split(' ')[2]) * .8);
      const anchorAfter = await svg.evaluate((element, point) => {
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!);
        return { x: screenPoint.x, y: screenPoint.y };
      }, anchor);
      expect(Math.hypot(anchorAfter.x - center.x, anchorAfter.y - center.y)).toBeLessThan(4);
      // A stationary first finger and a moving second finger translate the
      // gesture centroid. Its original map point should follow that centroid.
      await dialog.locator('#map-zoom-reset').tap();
      await touchGesture(page, session, [
        { from: { x: center.x - 30, y: center.y }, to: { x: center.x - 30, y: center.y } },
        { from: { x: center.x + 30, y: center.y }, to: { x: center.x + 90, y: center.y } },
      ]);
      const translatedAnchor = await svg.evaluate((element, point) => {
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!);
        return { x: screenPoint.x, y: screenPoint.y };
      }, anchor);
      expect(Math.hypot(translatedAnchor.x - (center.x + 30), translatedAnchor.y - center.y)).toBeLessThan(4);
      expect(await page.evaluate(() => visualViewport!.scale)).toBeCloseTo(browserScale, 4);
      expect(Math.abs((await settledScroll(page)) - lockedScroll)).toBeLessThanOrEqual(1);
      await expect(dialog).toBeVisible();
      expect(page.url()).toBe(originalURL);
      if (map.path === '/map/') await expect(page.locator('#map-panel-detail')).toBeHidden();
    } finally {
      await session.detach().catch(() => {});
    }
  });
}

test('a fresh marker tap after a native pan closes Explorer and focuses place details', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The preceding native pan uses the Chromium DevTools protocol.');
  await page.goto('/map/');
  await page.getByRole('button', { name: 'Explore map', exact: true }).tap();
  const dialog = page.locator('#map-explorer');
  const svg = dialog.locator('#map-svg');
  await expect(dialog).toBeVisible();
  const box = (await svg.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  try {
    await dialog.locator('#map-zoom-in').tap();
    await touchGesture(page, session, [{
      from: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      to: { x: box.x + box.width / 2 - 35, y: box.y + box.height / 2 - 40 },
    }]);
    await expect(dialog).toBeVisible();
    await expect(page.locator('#map-panel-detail')).toBeHidden();
    await dialog.locator('#map-zoom-reset').tap();
    await svg.locator('.map-marker[data-slug="phandalin"] circle.hit').tap();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#map-panel-detail')).toBeVisible();
    await expect(page.locator('#map-detail-title')).toHaveText('Phandalin');
    await expect(page.locator('#map-detail-title')).toBeFocused();
    await expect(page.locator('#map-svg')).toHaveAttribute('data-exploring', 'false');
  } finally {
    await session.detach().catch(() => {});
  }
});

test('phone marker choice closes Explorer and Search Escape leaves it open', async ({ page }) => {
  await page.goto('/map/');
  await page.getByRole('button', { name: 'Explore map', exact: true }).tap();
  const dialog = page.locator('#map-explorer');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Search the chronicle' });
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await expect(dialog).toBeVisible();
  await dialog.locator('.map-marker[data-slug="phandalin"] circle.hit').tap();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#map-detail-title')).toHaveText('Phandalin');
  await expect(page.locator('#map-detail-title')).toBeFocused();
});

test('short landscape phones keep Done and zoom controls in the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/map/');
  await page.getByRole('button', { name: 'Explore map', exact: true }).tap();
  const dialog = page.locator('#map-explorer');
  await expect(dialog).toBeVisible();
  await expectOnScreen(page, dialog.getByRole('button', { name: 'Done', exact: true }));
  for (const id of ['map-zoom-in', 'map-zoom-out', 'map-zoom-reset']) {
    await expectOnScreen(page, dialog.locator(`#${id}`));
  }
  const canvas = (await dialog.locator('#map-svg').boundingBox())!;
  expect(canvas.height).toBeGreaterThan(100);
  await dialog.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Explore map', exact: true })).toBeFocused();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`local Map key at 200% text preserves controls and canvas on ${viewport.width}×${viewport.height} phones`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/map/dwarven-excavation/');
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await page.locator('#map-explore').tap();
    const dialog = page.locator('#map-explorer');
    await expect(dialog).toBeVisible();
    await dialog.locator('.map-explorer-key summary').tap();
    await expect(dialog.locator('.map-explorer-key')).toHaveAttribute('open', '');
    for (const control of [
      dialog.getByRole('button', { name: 'Done', exact: true }),
      ...['map-zoom-in', 'map-zoom-out', 'map-zoom-reset'].map(id => dialog.locator(`#${id}`)),
    ]) await expectOnScreen(page, control);
    const canvas = (await dialog.locator('#map-svg').boundingBox())!;
    expect(canvas.height).toBeGreaterThanOrEqual(120);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Done', exact: true }).tap();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#map-explore')).toBeFocused();
  });
}
