import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/ask', route => route.abort());
});

const entries = [
  { kind: 'NPC', value: 'npc:adabra-gwynn', title: 'Adabra Gwynn', node: 'npc:adabra-gwynn', link: 'Full entry →', href: '/npcs/adabra-gwynn/' },
  { kind: 'party member', value: 'character:bean-hootwhistle', title: 'Bean Hootwhistle', node: 'party', link: 'Character entry →', href: '/characters/bean-hootwhistle/' },
  { kind: 'faction', value: 'faction:gnomengarde', title: 'Gnomengarde', node: 'faction:gnomengarde', link: 'Codex entry →', href: '/factions/gnomengarde/' },
];

async function showGraph(page: Page) {
  const expand = page.locator('#graph-expand');
  if (await expand.isVisible() && await expand.getAttribute('aria-expanded') === 'false') await expand.click();
  await expect(page.locator('#graph-frame')).toBeVisible();
}

async function openExplorer(page: Page) {
  await showGraph(page);
  const explore = page.locator('#graph-explore');
  await expect(explore).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(explore).toHaveAttribute('aria-controls', 'map-explorer');
  await explore.tap();
  const dialog = page.getByRole('dialog', { name: 'Relationships', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function expectReachable(page: Page, control: Locator) {
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

for (const entry of entries) {
  test(`relationship lookup opens ${entry.kind} details without requiring the phone drawing`, async ({ page, isMobile }) => {
    await page.goto('/graph/');
    const picker = page.getByRole('combobox', { name: 'Find a person or faction' });
    const view = page.getByRole('button', { name: 'View relationships', exact: true });
    const detail = page.locator('#graph-panel-detail');
    await expect(picker).toBeVisible();
    await expect(view).toBeDisabled();
    await picker.focus();
    await picker.press('ArrowDown');
    await expect(picker).toBeFocused();
    await expect(detail).toBeHidden();
    await picker.selectOption(entry.value);
    await expect(picker).toBeFocused();
    await expect(view).toBeEnabled();
    await expect(detail).toBeHidden();
    if (isMobile) {
      await expect(page.locator('#graph-canvas')).toBeHidden();
      await expect(page.locator('#graph-expand')).toHaveAttribute('aria-expanded', 'false');
    }
    await view.focus();
    await page.keyboard.press('Enter');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { level: 2 })).toHaveText(entry.title);
    await expect(detail.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(detail.getByRole('link', { name: entry.link, exact: true })).toHaveAttribute('href', entry.href);
    await expect(page.locator(`.g-node[data-node="${entry.node}"]`)).toHaveAttribute('aria-pressed', 'true');
    if (isMobile) await expect(page.locator('#graph-canvas')).toBeHidden();
    await detail.getByRole('button', { name: 'Back to legend' }).click();
    await expect(detail).toBeHidden();
    await expect(picker).toBeFocused();
    await expect(page.locator('.g-node[aria-pressed="true"]')).toHaveCount(0);
  });
}

test('changing a pending lookup preserves the current detail until View is activated', async ({ page, isMobile }) => {
  await page.goto('/graph/');
  const picker = page.locator('#graph-person');
  const view = page.locator('#graph-person-open');
  const title = page.locator('#graph-detail-title');
  await picker.selectOption('npc:adabra-gwynn');
  await view.click();
  await expect(title).toHaveText('Adabra Gwynn');
  await picker.focus();
  await picker.selectOption('faction:gnomengarde');
  await expect(picker).toBeFocused();
  await expect(title).toHaveText('Adabra Gwynn');
  await expect(page.locator('.g-node[data-node="npc:adabra-gwynn"]')).toHaveAttribute('aria-pressed', 'true');
  await picker.selectOption('');
  await expect(view).toBeDisabled();
  await expect(title).toHaveText('Adabra Gwynn');
  await picker.selectOption('faction:gnomengarde');
  await view.click();
  await expect(title).toHaveText('Gnomengarde');
  await expect(title).toBeFocused();
  if (isMobile) await expect(page.locator('#graph-canvas')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#graph-panel-detail')).toBeHidden();
  await expect(picker).toBeFocused();
});

test('phone relationship Explorer has reachable zoom and Done controls and isolates Search Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wide screens explore the drawing inline.');
  await page.goto('/graph/');
  await showGraph(page);
  const explore = page.locator('#graph-explore');
  await explore.scrollIntoViewIfNeeded();
  const pageScroll = await page.evaluate(() => scrollY);
  const dialog = await openExplorer(page);
  const svg = dialog.locator('#graph-svg');
  const originalView = (await svg.getAttribute('viewBox'))!;
  await expect(svg).toBeFocused();
  await expect(page.locator('#graph-svg')).toHaveCount(1);
  for (const control of [
    dialog.getByRole('button', { name: 'Done', exact: true }),
    ...['graph-zoom-in', 'graph-zoom-out', 'graph-zoom-reset'].map(id => dialog.locator(`#${id}`)),
  ]) await expectReachable(page, control);
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).tap();
  await expect(svg).not.toHaveAttribute('viewBox', originalView);
  await dialog.getByRole('button', { name: 'Zoom out', exact: true }).tap();
  await dialog.getByRole('button', { name: 'Reset view', exact: true }).tap();
  await expect(svg).toHaveAttribute('viewBox', originalView);
  await svg.focus();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Search the chronicle' });
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(svg).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(explore).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - pageScroll)).toBeLessThanOrEqual(1);
  await expect(page.locator('#graph-canvas #graph-frame')).toBeVisible();
  await expect(page.locator('#graph-svg')).toHaveAttribute('data-exploring', 'false');
  await explore.tap();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(dialog).toBeHidden();
  await expect(explore).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - pageScroll)).toBeLessThanOrEqual(1);
});

test('phone node selection closes Explorer before focusing its page detail', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wide screens use inline node selection.');
  await page.goto('/graph/');
  const dialog = await openExplorer(page);
  await page.evaluate(() => {
    const state = window as unknown as { relationshipFocus: Array<{ id: string; modalOpen: boolean }> };
    state.relationshipFocus = [];
    document.addEventListener('focusin', event => {
      const target = event.target as HTMLElement;
      if (target.id === 'graph-detail-title') state.relationshipFocus.push({ id: target.id, modalOpen: !!document.querySelector('dialog[open]') });
    });
  });
  await dialog.locator('.g-node[data-node="npc:adabra-gwynn"] circle.g-hit').tap();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#graph-detail-title')).toHaveText('Adabra Gwynn');
  await expect(page.locator('#graph-detail-title')).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as {
    relationshipFocus: Array<{ id: string; modalOpen: boolean }>;
  }).relationshipFocus)).toEqual([{ id: 'graph-detail-title', modalOpen: false }]);
  await expect(page.locator('#graph-person')).toHaveValue('npc:adabra-gwynn');
  await expect(page.locator('#graph-canvas #graph-frame')).toBeVisible();
  await page.locator('#graph-panel-detail').getByRole('button', { name: 'Back to legend' }).click();
  await expect(page.locator('.g-node[data-node="npc:adabra-gwynn"]')).toBeFocused();
});

async function nativeTouch(page: Page, session: CDPSession, contacts: Array<{
  from: { x: number; y: number }; to: { x: number; y: number };
}>) {
  const points = (progress: number) => contacts.map((contact, id) => ({
    id: id + 1,
    x: contact.from.x + (contact.to.x - contact.from.x) * progress,
    y: contact.from.y + (contact.to.y - contact.from.y) * progress,
  }));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
  try {
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step / 8) });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
  } finally {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

test('native phone relationship drag and pinch track the gesture without moving the page', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native multi-contact input requires phone Chromium CDP.');
  await page.goto('/graph/');
  const dialog = await openExplorer(page);
  const svg = dialog.locator('#graph-svg');
  const box = (await svg.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const originalView = (await svg.getAttribute('viewBox'))!;
  const pageScroll = await page.evaluate(() => scrollY);
  const browserScale = await page.evaluate(() => visualViewport!.scale);
  const session = await page.context().newCDPSession(page);
  try {
    await dialog.locator('#graph-zoom-in').tap();
    const from = { x: center.x + 24, y: center.y + 12 };
    const to = { x: center.x - 24, y: center.y - 12 };
    const anchor = await svg.evaluate((element, point) => {
      const mapPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!.inverse());
      return { x: mapPoint.x, y: mapPoint.y };
    }, from);
    await nativeTouch(page, session, [{ from, to }]);
    const afterDrag = await svg.evaluate((element, point) => {
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform((element as SVGSVGElement).getScreenCTM()!);
      return { x: screenPoint.x, y: screenPoint.y };
    }, anchor);
    expect(Math.hypot(afterDrag.x - to.x, afterDrag.y - to.y)).toBeLessThan(4);
    await dialog.locator('#graph-zoom-reset').tap();
    await nativeTouch(page, session, [
      { from: { x: center.x - 30, y: center.y }, to: { x: center.x - 70, y: center.y } },
      { from: { x: center.x + 30, y: center.y }, to: { x: center.x + 70, y: center.y } },
    ]);
    expect(Number((await svg.getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(Number(originalView.split(' ')[2]) * .8);
    await expect(dialog).toBeVisible();
    await expect(page.locator('#graph-panel-detail')).toBeHidden();
    expect(await page.evaluate(() => scrollY)).toBe(pageScroll);
    expect(await page.evaluate(() => visualViewport!.scale)).toBeCloseTo(browserScale, 4);
  } finally {
    await session.detach().catch(() => {});
  }
});

test('shrinking an explored desktop graph moves focus to its visible phone expansion control', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop inline exploration is the starting state.');
  await page.goto('/graph/');
  await page.locator('#graph-explore').click();
  const svg = page.locator('#graph-svg');
  await svg.focus();
  await expect(svg).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#graph-canvas')).toBeHidden();
  await expect(svg).toHaveAttribute('data-exploring', 'false');
  await expect(page.locator('#graph-expand')).toBeFocused();
});

test('native phone node taps tolerate contact jitter smaller than the drag threshold', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native contact jitter requires phone Chromium CDP.');
  await page.goto('/graph/');
  const dialog = await openExplorer(page);
  const hit = dialog.locator('.g-node[data-node="npc:adabra-gwynn"] circle.g-hit');
  const box = (await hit.boundingBox())!;
  const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...origin }] });
    for (const offset of [2, -2, 2, -2, 0]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: origin.x + offset, y: origin.y }] });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dialog).toBeHidden();
    await expect(page.locator('#graph-detail-title')).toHaveText('Adabra Gwynn');
    await expect(page.locator('#graph-detail-title')).toBeFocused();
  } finally {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
    await session.detach().catch(() => {});
  }
});

test('browser page zoom keeps Explorer exits and keyboard-revealed zoom controls usable', async ({ page, isMobile, browserName }) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native browser pinch input requires phone Chromium CDP.');
  test.setTimeout(60_000);
  for (const scenario of [
    { path: '/graph/', kind: 'graph', id: 'graph' },
    { path: '/map/dwarven-excavation/', kind: 'map', id: 'map' },
  ]) {
    const target = await page.context().newPage();
    const session = await target.context().newCDPSession(target);
    try {
      await target.route('https://**', route => route.abort());
      await target.route('**/api/ask', route => route.abort());
      await target.goto(scenario.path);
      await target.evaluate(() => document.fonts.ready);
      const viewport = target.viewportSize()!;
      const center = { x: viewport.width / 2, y: viewport.height * .42 };
      const points = (progress: number) => [
        { id: 1, x: center.x - 30 - 60 * progress, y: center.y },
        { id: 2, x: center.x + 30 + 60 * progress, y: center.y },
      ];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
      for (let step = 1; step <= 12; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(step / 12) });
        await target.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(await target.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1.5);
      // Isolate the viewer layout under native browser zoom. Activation does
      // not rely on Playwright's touch-coordinate handling after page scaling.
      if (scenario.kind === 'graph') await target.locator('#graph-expand').evaluate(element => (element as HTMLElement).click());
      await target.locator(`#${scenario.id}-explore`).evaluate(element => (element as HTMLElement).click());
      const dialog = target.locator('#map-explorer');
      await expect(dialog).toBeVisible();
      if (scenario.kind === 'map') {
        await dialog.locator('.map-explorer-key summary').evaluate(element => (element as HTMLElement).click());
        await expect(dialog.locator('.map-explorer-key')).toHaveAttribute('open', '');
      }
      const insideVisibleArea = (control: Locator) => expect.poll(() => control.evaluate(element => {
        const view = visualViewport!;
        const rect = element.getBoundingClientRect();
        const frame = element.closest('.map-frame, .graph-frame')?.getBoundingClientRect();
        const toolbar = element.closest<HTMLElement>('.map-controls, .graph-controls');
        const clip = toolbar?.getBoundingClientRect();
        return rect.left >= view.offsetLeft - 1 && rect.right <= view.offsetLeft + view.width + 1
          && rect.top >= view.offsetTop - 1 && rect.bottom <= view.offsetTop + view.height + 1
          && (!frame || (rect.left >= frame.left - 1 && rect.right <= frame.right + 1
            && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1))
          && (!toolbar || !clip || (rect.left >= clip.left + toolbar.clientLeft - 1
            && rect.right <= clip.left + toolbar.clientLeft + Math.min(toolbar.clientWidth, clip.width) + 1));
      })).toBe(true);
      const done = dialog.getByRole('button', { name: 'Done', exact: true });
      await insideVisibleArea(done);
      const toolbar = dialog.getByRole('group', { name: `${scenario.kind === 'graph' ? 'Graph' : 'Map'} zoom controls` });
      await toolbar.focus();
      await expect(toolbar).toBeFocused();
      const svg = dialog.locator(`#${scenario.id}-svg`);
      const originalView = (await svg.getAttribute('viewBox'))!;
      for (const name of ['Zoom in', 'Zoom out', 'Reset view']) {
        await target.keyboard.press('Tab');
        const control = toolbar.getByRole('button', { name, exact: true });
        await expect(control).toBeFocused();
        await insideVisibleArea(control);
        const before = (await svg.getAttribute('viewBox'))!;
        await target.keyboard.press('Enter');
        if (name === 'Reset view') await expect(svg).toHaveAttribute('viewBox', originalView);
        else await expect(svg).not.toHaveAttribute('viewBox', before);
      }
      await done.focus();
      await target.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
    } finally {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
      await session.detach().catch(() => {});
      await target.close();
    }
  }
});
