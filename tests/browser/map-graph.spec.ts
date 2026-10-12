import { test, expect, type Locator, type Page } from '@playwright/test';

const place = {
  title: 'Umbrage Hill', kind: 'Place', href: '/map/#umbrage-hill',
  text: 'The recorded visit to Umbrage Hill.',
};

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/ask', route => route.abort());
  await page.route('**/search-index.json', route => route.fulfill({ json: [place] }));
});

async function showGraph(page: Page) {
  const expand = page.locator('#graph-expand');
  if (await expand.isVisible()) {
    await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.locator('#graph-frame')).toBeVisible();
}

async function expectDetailFocus(detail: Locator) {
  await expect(detail).toBeVisible();
  await expect(detail.locator('h2')).toBeFocused();
}

async function expectInactiveControls(controls: Locator) {
  await expect.poll(() => controls.evaluateAll(elements => elements
    .filter(element => element.getAttribute('tabindex') !== '-1' || element.getAttribute('aria-hidden') !== 'true')
    .map(element => element.getAttribute('aria-label'))
  )).toEqual([]);
}

test('invisible event pins and future places are absent from keyboard and accessible controls', async ({ page }) => {
  await page.goto('/map/');
  const pins = page.locator('#map-svg .map-pin');
  expect(await pins.count()).toBeGreaterThan(0);
  await expectInactiveControls(pins);
  const accessibleControls = page.locator('#map-svg').getByRole('button');
  await expect(accessibleControls).toHaveCount(await page.locator('#map-svg .map-marker').count());

  const slider = page.getByRole('slider', { name: 'Replay the campaign session by session' });
  await slider.focus();
  let reachedMarker = false;
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({
      hidden: document.activeElement?.matches('.map-pin, .scrub-off, [aria-hidden="true"]'),
      marker: document.activeElement?.matches('.map-marker[tabindex="0"]'),
    }));
    expect(focus.hidden).toBe(false);
    reachedMarker ||= !!focus.marker;
  }
  expect(reachedMarker).toBe(true);

  await slider.focus();
  await slider.press('Home');
  const future = page.locator('#map-svg .map-marker.scrub-off');
  expect(await future.count()).toBeGreaterThan(0);
  await expectInactiveControls(future);
  const futureLabels = await future.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
  const accessibleLabels = await accessibleControls.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
  for (const label of futureLabels) expect(accessibleLabels).not.toContain(label);
  await slider.press('End');
  await expect(page.locator('#map-svg .map-marker.scrub-off')).toHaveCount(0);
  await expect(page.locator('.map-marker[data-slug="mountains-toe-gold-mine"]')).toHaveAttribute('tabindex', '0');

  // Zoom exposes the pins, so they must become keyboard and accessible controls again.
  await page.locator('#map-zoom-in').click();
  await page.locator('#map-zoom-in').click();
  await expect(pins.first()).toHaveAttribute('tabindex', '0');
  await expect(pins.first()).not.toHaveAttribute('aria-hidden', 'true');
  const revealedLabel = (await pins.first().getAttribute('aria-label'))!;
  await expect(page.getByRole('button', { name: revealedLabel, exact: true })).toHaveCount(1);
});

test('viewing a later place advances replay and returns focus to the location picker', async ({ page }) => {
  await page.goto('/map/');
  const slider = page.getByRole('slider', { name: 'Replay the campaign session by session' });
  await slider.focus();
  await slider.press('Home');
  const marker = page.locator('.map-marker[data-slug="mountains-toe-gold-mine"]');
  await expect(marker).toHaveClass(/scrub-off/);
  const picker = page.locator('#map-location');
  await picker.focus();
  await picker.press('ArrowDown');
  await expect(picker).toBeFocused();
  await expect(page.locator('#map-panel-detail')).toBeHidden();
  await picker.selectOption('mountains-toe-gold-mine');
  await expect(picker).toBeFocused();
  await expect(page.locator('#map-panel-detail')).toBeHidden();
  const viewPlace = page.locator('#map-location-open');
  await page.locator('#map-zoom-in').click();
  await expect(picker).toHaveValue('mountains-toe-gold-mine');
  await expect(viewPlace).toBeEnabled();
  await viewPlace.click();
  const detail = page.locator('#map-panel-detail');
  await expect(detail.locator('h2')).toContainText('Toe Gold Mine');
  await expectDetailFocus(detail);
  await expect(marker).not.toHaveClass(/scrub-off/);
  await expect(marker).not.toHaveAttribute('aria-hidden', 'true');
  await expect(slider).not.toHaveValue('0');
  await detail.getByRole('button', { name: 'Back to legend' }).click();
  await expect(detail).toBeHidden();
  await expect(picker).toBeFocused();
});

test('closing a revealed event pin restores focus to its visible place marker', async ({ page }) => {
  await page.goto('/map/');
  const marker = page.locator('.map-marker[data-slug="phandalin"]');
  await marker.focus();
  await marker.press('Enter');
  const pin = page.locator('.map-pin[data-open="phandalin"]').first();
  await expect(pin).toHaveAttribute('tabindex', '0');
  await pin.focus();
  await pin.press('Enter');
  await expectDetailFocus(page.locator('#map-panel-detail'));
  await page.keyboard.press('Escape');
  await expect(page.locator('#map-panel-detail')).toBeHidden();
  await expect(pin).toHaveAttribute('aria-hidden', 'true');
  await expect(marker).toBeFocused();
});

for (const canvas of ['map', 'graph'] as const) {
  test(`${canvas} details take focus on selection and return it on dismissal`, async ({ page }) => {
    await page.goto(`/${canvas}/`);
    if (canvas === 'graph') await showGraph(page);
    const origin = canvas === 'map'
      ? page.locator('.map-marker[data-slug="phandalin"]')
      : page.locator('.g-node[data-node="npc:adabra-gwynn"]');
    const detail = page.locator(`#${canvas}-panel-detail`);
    await origin.focus();
    await origin.press('Enter');
    await expectDetailFocus(detail);
    await detail.getByRole('button', { name: 'Back to legend' }).focus();
    await page.keyboard.press('Enter');
    await expect(detail).toBeHidden();
    await expect(origin).toBeFocused();

    await origin.press('Space');
    await expectDetailFocus(detail);
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(origin).toBeFocused();

    await origin.locator('circle.hit, circle.g-hit').click();
    await expectDetailFocus(detail);
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(origin).toBeFocused();
  });

  test(`Escape closes Search without dismissing the selected ${canvas} detail`, async ({ page }) => {
    await page.goto(`/${canvas}/`);
    if (canvas === 'graph') await showGraph(page);
    const origin = canvas === 'map'
      ? page.locator('.map-marker[data-slug="phandalin"]')
      : page.locator('.g-node[data-node="npc:adabra-gwynn"]');
    const detail = page.locator(`#${canvas}-panel-detail`);
    await origin.focus();
    await origin.press('Enter');
    await expectDetailFocus(detail);
    const title = await detail.locator('h2').textContent();
    const selectedURL = page.url();
    const opener = page.locator('[data-search-open]:visible').first();
    await opener.click();
    await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Search the chronicle' }).getByRole('combobox').press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeHidden();
    await expect(detail).toBeVisible();
    await expect(detail.locator('h2')).toHaveText(title!);
    expect(page.url()).toBe(selectedURL);
    await expect(opener).toBeFocused();
    // Escape must be contained throughout the dialog, including its controls.
    await opener.click();
    await page.getByRole('button', { name: 'Close search' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeHidden();
    await expect(detail).toBeVisible();
    expect(page.url()).toBe(selectedURL);
    await expect(opener).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(origin).toBeFocused();
  });

  test(`${canvas} permits browser touch scrolling without moving its default view`, async ({ page }) => {
    await page.goto(`/${canvas}/`);
    if (canvas === 'graph') await showGraph(page);
    const svg = page.locator(`#${canvas}-svg`);
    const before = await svg.getAttribute('viewBox');
    const touchAction = await svg.evaluate(element => getComputedStyle(element).touchAction);
    expect(touchAction).toContain('pan-y');
    // Browser emulation cannot certify a physical-device scroll gesture. This
    // verifies the viewer does not consume touch movement while pan-y is allowed.
    await svg.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200, buttons: 1 });
    await svg.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100, buttons: 1 });
    await svg.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100, buttons: 0 });
    await expect(svg).toHaveAttribute('viewBox', before!);
    await page.locator(`#${canvas}-explore`).click();
    expect(await svg.evaluate(element => getComputedStyle(element).touchAction)).toBe('none');
  });
}

for (const canvas of [
  { name: 'region map', path: '/map/', id: 'map' },
  { name: 'relationship graph', path: '/graph/', id: 'graph' },
  { name: 'local map', path: '/map/phandalin/', id: 'map' },
]) {
  test(`${canvas.name} leaves ordinary wheel scrolling to the page and supports deliberate wheel zoom`, async ({ page, isMobile, browserName }) => {
    test.skip(isMobile && browserName === 'webkit', 'Playwright does not support mouse wheel input in mobile WebKit.');
    await page.goto(canvas.path);
    if (canvas.id === 'graph') await showGraph(page);
    const svg = page.locator(`#${canvas.id}-svg`);
    const explore = page.locator(`#${canvas.id}-explore`);
    await expect(explore).toHaveAttribute('aria-pressed', 'false');
    await svg.scrollIntoViewIfNeeded();
    await svg.hover({ position: { x: 10, y: 10 } });
    const before = await svg.getAttribute('viewBox');
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 160);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
    await expect(svg).toHaveAttribute('viewBox', before!);

    await svg.scrollIntoViewIfNeeded();
    await svg.hover({ position: { x: 10, y: 10 } });
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -160);
    await page.keyboard.up('Control');
    await expect(svg).not.toHaveAttribute('viewBox', before!);

    await page.locator(`#${canvas.id}-zoom-reset`).click();
    await expect(svg).toHaveAttribute('viewBox', before!);
    await explore.click();
    await expect(explore).toHaveAttribute('aria-pressed', 'true');
    await svg.hover({ position: { x: 10, y: 10 } });
    await page.mouse.wheel(0, -160);
    await expect(svg).not.toHaveAttribute('viewBox', before!);
  });

  test(`${canvas.name} supports zoom buttons and Explore keyboard and pointer panning`, async ({ page }) => {
    await page.goto(canvas.path);
    if (canvas.id === 'graph') await showGraph(page);
    const svg = page.locator(`#${canvas.id}-svg`);
    const explore = page.locator(`#${canvas.id}-explore`);
    const zoomIn = page.locator(`#${canvas.id}-zoom-in`);
    const reset = page.locator(`#${canvas.id}-zoom-reset`);
    const before = (await svg.getAttribute('viewBox'))!;
    await expect(explore).toHaveAttribute('aria-pressed', 'false');
    expect(await svg.evaluate(element => getComputedStyle(element).touchAction)).toContain('pan-y');
    await svg.focus();
    await svg.press('ArrowRight');
    await expect(svg).toHaveAttribute('viewBox', before);

    await zoomIn.click();
    await expect(svg).not.toHaveAttribute('viewBox', before);
    const zoomed = (await svg.getAttribute('viewBox'))!;
    await page.locator(`#${canvas.id}-zoom-out`).click();
    await expect(svg).not.toHaveAttribute('viewBox', zoomed);
    await reset.click();
    await expect(svg).toHaveAttribute('viewBox', before);

    await explore.click();
    await expect(explore).toHaveAttribute('aria-pressed', 'true');
    expect(await svg.evaluate(element => getComputedStyle(element).touchAction)).toBe('none');
    await svg.focus();
    await svg.press('ArrowRight');
    await expect(svg).not.toHaveAttribute('viewBox', before);

    await reset.click();
    await zoomIn.click();
    await svg.hover({ position: { x: 10, y: 10 } });
    const beforeDrag = (await svg.getAttribute('viewBox'))!;
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + 15, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + 65, box.y + 65, { steps: 3 });
    await page.mouse.up();
    await expect(svg).not.toHaveAttribute('viewBox', beforeDrag);

    await explore.click();
    await expect(explore).toHaveAttribute('aria-pressed', 'false');
    expect(await svg.evaluate(element => getComputedStyle(element).touchAction)).toContain('pan-y');
  });
}

for (const activation of ['click', 'keyboard']) {
  test(`a same-page Search ${activation} selects the map location and focuses its detail`, async ({ page }) => {
    // Keyboard activation also covers a result whose fragment is already current:
    // it still needs to dismiss Search and move focus into the selected details.
    await page.goto(activation === 'keyboard' ? '/map/#umbrage-hill' : '/map/');
    await page.locator('[data-search-open]:visible').first().click();
    const search = page.getByRole('dialog', { name: 'Search the chronicle' });
    const input = search.getByRole('combobox');
    await input.fill('Umbrage');
    await expect(search.getByRole('option')).toHaveCount(1);
    if (activation === 'click') await search.getByRole('option').click();
    else {
      await input.press('ArrowDown');
      await input.press('Enter');
    }
    await expect(page).toHaveURL(/\/map\/#umbrage-hill$/);
    await expect(page.getByRole('dialog', { name: 'Search the chronicle' })).toBeHidden();
    const detail = page.locator('#map-panel-detail');
    await expect(detail.locator('h2')).toHaveText('Umbrage Hill');
    await expectDetailFocus(detail);
    await expect(page.locator('.map-marker[data-slug="umbrage-hill"]')).toHaveClass(/selected/);
  });
}

test('releasing outside the graph before pointer capture cannot leave panning active', async ({ page }) => {
  await page.goto('/graph/');
  await showGraph(page);
  const svg = page.locator('#graph-svg');
  await page.locator('#graph-explore').click();
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  // A three-pixel move leaves the canvas before the drag-capture threshold.
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 2, box.y + box.height / 2);
  await page.mouse.up();
  const released = await svg.getAttribute('viewBox');
  await page.mouse.move(box.x + 50, box.y + box.height / 2 - 30);
  await page.mouse.move(box.x + 80, box.y + box.height / 2 - 50);
  await expect(svg).toHaveAttribute('viewBox', released!);
});

test('phone relationships begin with a readable list and an explicit graph expansion', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone layout only.');
  await page.goto('/graph/');
  const expand = page.locator('#graph-expand');
  await expect(expand).toHaveAccessibleName('Show relationship graph');
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#graph-frame')).toBeHidden();
  await expect(page.getByRole('button', { name: 'NPC: Adabra Gwynn', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Roll call by allegiance' })).toBeVisible();
  expect(await expand.evaluate(button => !!(
    document.querySelector('.graph-rollcall')!.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
  ))).toBe(true);
  await expand.focus();
  await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#graph-frame')).toBeVisible();
  await expect(expand).toBeFocused();
  await expect(page.getByRole('button', { name: 'NPC: Adabra Gwynn', exact: true })).toBeVisible();
});

test('phone journey selection shows its details before the journey and returns focus to the selected stop', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Phone layout only.');
  await page.goto('/map/');
  const stop = page.locator('.map-journey .mj-place[data-goto="umbrage-hill"]').first();
  await stop.focus();
  await stop.press('Enter');
  const detail = page.locator('#map-panel-detail');
  await expect(detail.locator('h2')).toHaveText('Umbrage Hill');
  await expectDetailFocus(detail);
  await expect(stop).toHaveAttribute('aria-pressed', 'true');
  const panelBox = (await page.locator('#map-panel').boundingBox())!;
  const journeyBox = (await page.locator('.map-journey').boundingBox())!;
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(journeyBox.y);
  await detail.getByRole('button', { name: 'Back to legend' }).click();
  await expect(detail).toBeHidden();
  await expect(stop).toBeFocused();
  await expect(stop).toHaveAttribute('aria-pressed', 'false');
});
