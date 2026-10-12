import { test, expect, type Page } from '@playwright/test';

const key = 'icespire-bookmarks-v1';
const first = {
  sessionId: 'session-9', sceneId: 'scene-s5eb65c4ad3', sessionNumber: 9,
  sessionTitle: 'The ninth recap', sceneLabel: 'The search for the others',
  href: '/sessions/session-9/#scene-s5eb65c4ad3', fingerprint: 'a'.repeat(64),
};
const second = { ...first, sceneId: 'scene-sa6a70d9cc0', sceneLabel: 'The alibi', href: '/sessions/session-9/#scene-sa6a70d9cc0' };
const catalog = { version: 1, scenes: [first, second] };
const saved = (note = 'Ask about Norbus next session.') => {
  const { href: _href, ...source } = first;
  return { ...source, note, updatedAt: '2026-10-12T00:00:00.000Z' };
};
const read = (page: Page) => page.evaluate(key => localStorage.getItem(key), key);
async function seed(page: Page, bookmarks = [saved()]) {
  await page.goto('/bookmarks/');
  await page.evaluate(({ key, bookmarks }) => localStorage.setItem(key, JSON.stringify({ version: 1, bookmarks })), { key, bookmarks });
  await page.reload();
}
async function open(page: Page) {
  await page.goto('/sessions/session-9/');
  const trigger = page.getByRole('button', { name: 'Bookmark a recap part', exact: true });
  await expect(trigger).toBeEnabled(); await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Bookmark recap part' })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/bookmark-catalog.json', route => route.fulfill({ json: catalog }));
});

test('saving is explicit, persists across pages and returns focus to the opener', async ({ page }) => {
  await open(page);
  expect(await read(page)).toBeNull();
  await page.getByLabel('Personal note (optional)').fill('A private thought, not a campaign fact.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await read(page)).toBeNull();
  await expect(page.getByRole('button', { name: 'Bookmark a recap part', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Bookmark a recap part', exact: true }).click();
  await page.getByLabel('Recap part', { exact: true }).selectOption(`${first.sessionId}::${first.sceneId}`);
  await page.getByLabel('Personal note (optional)').fill('Bring this up next session.');
  await page.getByRole('button', { name: 'Save on this browser', exact: true }).click();
  await expect(page.locator('#bookmark-editor')).toBeHidden();
  const record = JSON.parse((await read(page))!).bookmarks[0];
  expect(record.note).toBe('Bring this up next session.'); expect(record.sceneId).toBe(first.sceneId);
  await page.goto('/bookmarks/');
  await expect(page.locator('.bookmark-entry')).toHaveCount(1);
  await expect(page.locator('.bookmark-note-text')).toHaveText('Bring this up next session.');
  await expect(page.locator('.bookmark-entry a')).toHaveAttribute('href', first.href);
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await expect(page.getByLabel('Personal note (optional)')).toBeFocused();
  await page.getByLabel('Personal note (optional)').fill('Updated only after choosing save.');
  expect(JSON.parse((await read(page))!).bookmarks[0].note).toBe('Bring this up next session.');
  await page.getByRole('button', { name: 'Update on this browser', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
  expect(JSON.parse((await read(page))!).bookmarks[0].note).toBe('Updated only after choosing save.');
});

test('a part control chooses its stable ID and keyboard cancellation preserves data', async ({ page }) => {
  await page.goto('/sessions/session-9/');
  const trigger = page.locator(`.scene-bookmark-trigger[data-bookmark-scene-id="${second.sceneId}"]`);
  await expect(trigger).toBeEnabled(); await trigger.focus(); await trigger.press('Enter');
  await expect(page.getByLabel('Recap part', { exact: true })).toHaveValue(`${second.sessionId}::${second.sceneId}`);
  await page.getByLabel('Personal note (optional)').fill('Unsaved draft.');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused(); expect(await read(page)).toBeNull();
});

test('changed sources use current titles and retain notes until reviewed explicitly', async ({ page }) => {
  await seed(page);
  await page.route('**/bookmark-catalog.json', route => route.fulfill({ json: { version: 1, scenes: [{ ...first, sessionTitle: 'A revised title', sceneLabel: 'A revised part label', fingerprint: 'b'.repeat(64) }] } }));
  await page.reload();
  await expect(page.locator('.bookmark-entry a')).toHaveText('Session 9 — A revised title');
  await expect(page.locator('.bookmark-part')).toHaveText('A revised part label');
  await expect(page.locator('.bookmark-entry .bookmark-warning')).toContainText('changed since it was saved');
  await expect(page.locator('.bookmark-note-text')).toHaveText('Ask about Norbus next session.');
  expect(JSON.parse((await read(page))!).bookmarks[0].fingerprint).toBe(first.fingerprint);
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByLabel('Personal note (optional)').fill('An edited note still needs source review.');
  await page.getByRole('button', { name: 'Update on this browser', exact: true }).click();
  await expect(page.locator('.bookmark-entry .bookmark-warning')).toContainText('changed since it was saved');
  await page.getByRole('button', { name: 'Mark source reviewed', exact: true }).click();
  await expect(page.locator('.bookmark-entry .bookmark-warning')).toHaveCount(0);
  expect(JSON.parse((await read(page))!).bookmarks[0].fingerprint).toBe('b'.repeat(64));
  await expect(page.locator('.bookmark-note-text')).toHaveText('An edited note still needs source review.');
});

test('removed or unpublished parts retain notes without trusting saved navigation URLs', async ({ page }) => {
  await seed(page);
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!); data.bookmarks[0].href = 'javascript:alert(1)'; localStorage.setItem(key, JSON.stringify(data));
  }, key);
  await page.route('**/bookmark-catalog.json', route => route.fulfill({ json: { version: 1, scenes: [] } }));
  await page.reload();
  await expect(page.locator('.bookmark-entry a')).toHaveCount(0);
  await expect(page.locator('.bookmark-entry .bookmark-warning')).toContainText('no longer available');
  await expect(page.locator('.bookmark-note-text')).toContainText('Norbus');
  await expect(page.getByRole('button', { name: 'Mark source reviewed' })).toHaveCount(0);
});

test('offline publication checks disable links but allow private-note updates and explicit retry', async ({ page }) => {
  await seed(page);
  await page.route('**/bookmark-catalog.json', route => route.abort()); await page.reload();
  await expect(page.locator('[data-bookmark-status]')).toContainText('could not load');
  await expect(page.locator('.bookmark-entry a')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByLabel('Personal note (optional)').fill('A note updated offline.');
  await page.getByRole('button', { name: 'Update on this browser', exact: true }).click();
  await expect(page.locator('.bookmark-note-text')).toHaveText('A note updated offline.');
  await page.route('**/bookmark-catalog.json', route => route.fulfill({ json: catalog }));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.bookmark-entry a')).toHaveAttribute('href', first.href);
});

test('invalid catalog URLs leave notes safe and source links unavailable', async ({ page }) => {
  await seed(page);
  await page.route('**/bookmark-catalog.json', route => route.fulfill({ json: { version: 1, scenes: [{ ...first, href: '//elsewhere.example/' }] } }));
  await page.reload();
  await expect(page.locator('[data-bookmark-status]')).toContainText('could not load');
  await expect(page.locator('.bookmark-entry a')).toHaveCount(0);
});

test('note markup stays text and forget controls preserve deliberate keyboard focus', async ({ page }) => {
  const malicious = '<img src=x onerror="window.bookmarkInjected=true"><script>window.bookmarkInjected=true</script>';
  await seed(page, [saved(malicious)]);
  await expect(page.locator('.bookmark-note-text')).toHaveText(malicious);
  await expect(page.locator('.bookmark-entry img, .bookmark-entry script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { bookmarkInjected?: boolean }).bookmarkInjected)).toBeUndefined();
  await page.getByRole('button', { name: 'Forget all bookmarks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep bookmarks', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Keep bookmarks', exact: true }).click();
  expect(await read(page)).not.toBeNull();
  await page.getByRole('button', { name: 'Forget bookmark', exact: true }).click();
  expect(await read(page)).toBeNull();
  await expect(page.locator('[data-bookmark-count]')).toBeFocused();
});

test('malformed storage is kept until the user confirms forgetting all', async ({ page }) => {
  await page.goto('/bookmarks/'); await page.evaluate(key => localStorage.setItem(key, 'broken JSON'), key); await page.reload();
  await expect(page.locator('[data-bookmark-status]')).toContainText('cannot be read'); expect(await read(page)).toBe('broken JSON');
  await page.getByRole('button', { name: 'Forget all bookmarks', exact: true }).click();
  expect(await read(page)).toBe('broken JSON');
  await page.getByRole('button', { name: 'Confirm forget all', exact: true }).click();
  expect(await read(page)).toBeNull(); await expect(page.locator('[data-bookmark-count]')).toBeFocused();
});

test('blocked storage disables saving without breaking recap reading', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.goto('/sessions/session-9/');
  await expect(page.getByRole('button', { name: 'Bookmark a recap part', exact: true })).toBeDisabled();
  await expect(page.locator('[data-bookmark-status]')).toContainText('prevents access');
  await expect(page.locator('.session-layout > .prose')).toBeVisible();
});

test('full storage keeps the unsaved note and previous saved data', async ({ page }) => {
  await seed(page); const before = await read(page);
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) { if(name === key) throw new DOMException('Full','QuotaExceededError'); return original.call(this,name,value); };
  }, key);
  await page.reload(); await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByLabel('Personal note (optional)').fill('Keep this unsaved draft.');
  await page.getByRole('button', { name: 'Update on this browser', exact: true }).click();
  await expect(page.locator('[data-bookmark-editor-status]')).toContainText('may be full or blocked');
  await expect(page.getByLabel('Personal note (optional)')).toHaveValue('Keep this unsaved draft.'); expect(await read(page)).toBe(before);
});

test('another tab cannot lose an unsaved draft or the editor cancellation focus', async ({ page }) => {
  await seed(page);
  const other = await page.context().newPage(); await other.goto('/bookmarks/');
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByLabel('Personal note (optional)').fill('Keep my unsaved draft.');
  await other.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!); data.bookmarks[0].note = 'Saved from another tab.'; localStorage.setItem(key, JSON.stringify(data));
  }, key);
  await expect(page.locator('[data-bookmark-status]')).toContainText('another tab');
  await expect(page.getByLabel('Personal note (optional)')).toHaveValue('Keep my unsaved draft.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit note', exact: true })).toBeFocused();
  await expect(page.locator('.bookmark-note-text')).toHaveText('Saved from another tab.');
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await other.evaluate(key => localStorage.removeItem(key), key);
  await expect(page.locator('.bookmark-entry')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-bookmark-count]')).toBeFocused();
  await other.close();
});

test('the bookmark limit is explicit and leaves saved records unchanged', async ({ page }) => {
  await seed(page, Array.from({length:50},(_,index)=>({...saved(),sceneId:`scene-old-${index}`}))); const before = await read(page);
  await page.goto('/sessions/session-9/'); await expect(page.getByRole('button', { name: 'Bookmark a recap part', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Bookmark a recap part', exact: true }).click(); await page.getByRole('button', { name: 'Save on this browser', exact: true }).click();
  await expect(page.locator('[data-bookmark-editor-status]')).toContainText('already has 50 bookmarks'); expect(await read(page)).toBe(before);
});

test('without JavaScript the recap remains readable and saving controls stay hidden', async ({ browser, baseURL }) => {
  const context = await browser.newContext({javaScriptEnabled:false,baseURL}); const page = await context.newPage();
  await page.goto('/sessions/session-9/');
  // Playwright's text and injected accessibility helpers skip <noscript>.
  // Check its native DOM text and visible box with scripting disabled.
  const fallback = page.locator('.scene-bookmarks noscript');
  expect(await fallback.textContent()).toContain('JavaScript is required');
  await expect(fallback).toBeVisible();
  await expect(page.locator('[data-bookmark-tools]')).toBeHidden();
  await expect(page.locator('.scene-bookmark-trigger')).toHaveCount(0);
  await expect(page.locator('.session-layout > .prose')).toBeVisible(); await context.close();
});
