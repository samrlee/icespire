import {
  BOOKMARK_STORAGE_KEY, MAX_BOOKMARKS, MAX_NOTE_LENGTH, bookmarkId,
  parseBookmarkCatalog, readBookmarks, writeBookmarks,
  type Bookmark, type BookmarkCatalog, type BookmarkRead, type BookmarkScene,
} from '../lib/bookmarks';

const root = document.querySelector<HTMLElement>('[data-bookmarks-root]');
if (root) initBookmarks(root);

function initBookmarks(root: HTMLElement) {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const tools = find<HTMLElement>('[data-bookmark-tools]');
  const status = find<HTMLElement>('[data-bookmark-status]');
  const retry = find<HTMLButtonElement>('[data-bookmark-retry]');
  const list = root.querySelector<HTMLUListElement>('[data-bookmark-list]');
  const count = root.querySelector<HTMLElement>('[data-bookmark-count]');
  const create = root.querySelector<HTMLButtonElement>('[data-bookmark-create]');
  const clear = root.querySelector<HTMLButtonElement>('[data-bookmark-clear]');
  const confirmation = root.querySelector<HTMLElement>('[data-bookmark-confirm]');
  const editor = find<HTMLDialogElement>('#bookmark-editor');
  const form = find<HTMLFormElement>('[data-bookmark-form]');
  const picker = find<HTMLElement>('[data-bookmark-picker]');
  const choice = find<HTMLSelectElement>('[data-bookmark-scene]');
  const note = find<HTMLTextAreaElement>('[data-bookmark-note]');
  const source = find<HTMLElement>('[data-bookmark-source]');
  const warning = find<HTMLElement>('[data-bookmark-warning]');
  const save = find<HTMLButtonElement>('[data-bookmark-save]');
  const forget = find<HTMLButtonElement>('[data-bookmark-forget]');
  const editorStatus = find<HTMLElement>('[data-bookmark-editor-status]');
  let state: BookmarkRead = read();
  let catalog: BookmarkCatalog | null = null;
  let catalogState: 'loading' | 'ready' | 'error' = 'loading';
  let catalogRequest: Promise<void> | null = null;
  let targetKey = '';
  let returnFocus: HTMLElement | null = null;
  let editingFromLibrary = false;
  const drafts = new Map<string, string>();
  const triggers: HTMLButtonElement[] = [];

  function read(): BookmarkRead {
    try { return readBookmarks(window.localStorage); }
    catch { return { state: 'blocked', bookmarks: [], message: 'This browser prevents access to saved bookmarks. Nothing has been changed.' }; }
  }
  const records = () => state.state === 'ready' ? state.bookmarks : [];
  const currentScene = (key: string) => catalog?.scenes.find(scene => bookmarkId(scene) === key);
  const savedRecord = (key: string) => records().find(record => bookmarkId(record) === key);
  const text = (tag: string, value: string, className = '') => {
    const node = document.createElement(tag); node.textContent = value; node.className = className; return node;
  };
  const action = (label: string, handler: () => void) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-ghost';
    button.textContent = label; button.addEventListener('click', handler); return button;
  };
  const displayTitle = (value: Bookmark | BookmarkScene) => `Session ${value.sessionNumber} — ${value.sessionTitle}`;
  const availability = (record: Bookmark, scene: BookmarkScene | undefined) => {
    if (!catalog) return catalogState === 'loading'
      ? 'Checking current publication. Source links are unavailable until the check finishes.'
      : 'Current publication could not be checked. Your note is kept; source links are unavailable.';
    if (!scene) return 'This part is no longer available in the published chronicle. Your note is kept; no source link is available.';
    if (record.fingerprint !== scene.fingerprint) return 'This recap part has changed since it was saved. Your note is unchanged. Read the current part before marking it reviewed.';
    return '';
  };

  function announce(message?: string) {
    if (message) { status.textContent = message; return; }
    if (state.state !== 'ready') { status.textContent = state.message; return; }
    status.textContent = catalogState === 'loading' ? 'Checking the current published recap parts…'
      : catalogState === 'error' ? 'The published recap list could not load. Your saved notes remain available; source links are disabled. Try again.' : '';
  }
  function focusAfterRemoval(index: number) {
    const buttons = list?.querySelectorAll<HTMLButtonElement>('[data-bookmark-edit]');
    const next = buttons?.[Math.min(index, buttons.length - 1)] ?? count ?? create;
    if (next) { if (!(next instanceof HTMLButtonElement)) next.tabIndex = -1; next.focus(); }
  }
  function render() {
    if (create) create.disabled = !catalog || state.state !== 'ready' || !catalog.scenes.some(scene => scene.sessionId === root.dataset.session);
    for (const trigger of triggers) trigger.disabled = !catalog || state.state !== 'ready' || !currentScene(`${root.dataset.session}::${trigger.dataset.bookmarkSceneId}`);
    retry.hidden = catalogState !== 'error' && state.state === 'ready';
    retry.disabled = catalogState === 'loading';
    if (!list || !count) return;
    list.replaceChildren();
    count.tabIndex = -1;
    count.textContent = state.state === 'ready'
      ? records().length ? `${records().length} saved bookmark${records().length === 1 ? '' : 's'}.` : 'No bookmarks saved yet. Open a recap and choose a part to save.'
      : 'Saved bookmarks could not be read.';
    if (clear) clear.hidden = state.state === 'blocked' || (state.state === 'ready' && records().length === 0);
    records().forEach((record, index) => {
      const key = bookmarkId(record); const scene = currentScene(key);
      const entry = document.createElement('li'); entry.className = 'bookmark-entry'; entry.dataset.bookmarkKey = key;
      const heading = document.createElement('h2');
      if (scene) { const link = document.createElement('a'); link.href = scene.href; link.textContent = displayTitle(scene); heading.append(link); }
      else heading.textContent = displayTitle(record);
      entry.append(heading, text('p', scene?.sceneLabel ?? record.sceneLabel, 'bookmark-part'));
      const message = availability(record, scene);
      if (message) entry.append(text('p', message, 'bookmark-warning'));
      entry.append(text('p', record.note || 'No personal note.', 'bookmark-note-text'));
      const actions = document.createElement('div'); actions.className = 'bookmark-actions';
      const edit = action('Edit note', () => openEditor(key, edit, true)); edit.dataset.bookmarkEdit = '';
      actions.append(edit);
      if (scene && scene.fingerprint !== record.fingerprint) actions.append(action('Mark source reviewed', () => {
        if (commit(entries => entries.map(item => bookmarkId(item) === key ? { ...item, fingerprint: scene.fingerprint, sessionTitle: scene.sessionTitle, sceneLabel: scene.sceneLabel, sessionNumber: scene.sessionNumber, updatedAt: new Date().toISOString() } : item))) {
          render(); announce('Source marked reviewed. Your personal note is unchanged.'); focusAfterRemoval(index);
        }
      }));
      actions.append(action('Forget bookmark', () => {
        if (commit(entries => entries.filter(item => bookmarkId(item) !== key))) { render(); announce('Bookmark and personal note forgotten.'); focusAfterRemoval(index); }
      }));
      entry.append(actions); list.append(entry);
    });
  }

  function commit(change: (entries: Bookmark[]) => Bookmark[]): boolean {
    state = read();
    if (state.state !== 'ready') { announce(); editorStatus.textContent = state.message; render(); return false; }
    try {
      const next = change(state.bookmarks);
      writeBookmarks(window.localStorage, next);
      state = { state: 'ready', bookmarks: next };
      return true;
    } catch {
      const message = 'This browser could not save that change. Previous bookmarks and your unsaved note are unchanged. Storage may be full or blocked.';
      announce(message); editorStatus.textContent = message; return false;
    }
  }

  function updateEditor(key: string) {
    targetKey = key;
    const record = savedRecord(key); const scene = currentScene(key);
    source.textContent = scene ? `${displayTitle(scene)} · ${scene.sceneLabel}` : record ? `${displayTitle(record)} · ${record.sceneLabel}` : '';
    note.value = drafts.get(key) ?? record?.note ?? '';
    const message = record ? availability(record, scene) : '';
    warning.textContent = message; warning.hidden = !message;
    save.textContent = record ? 'Update on this browser' : 'Save on this browser';
    save.disabled = state.state !== 'ready' || (!scene && !record);
    forget.hidden = !record;
    editorStatus.textContent = '';
  }
  function openEditor(key: string, opener: HTMLElement, library = false) {
    state = read();
    if (state.state !== 'ready') { render(); announce(); return; }
    editingFromLibrary = library; returnFocus = opener; drafts.clear();
    picker.hidden = library; choice.replaceChildren();
    if (!library) {
      const scenes = catalog?.scenes.filter(scene => scene.sessionId === root.dataset.session) ?? [];
      if (!scenes.length) { announce('This recap has no currently published parts available to bookmark.'); return; }
      for (const scene of scenes) { const option = document.createElement('option'); option.value = bookmarkId(scene); option.textContent = scene.sceneLabel; choice.append(option); }
      if (!scenes.some(scene => bookmarkId(scene) === key)) key = bookmarkId(scenes[0]);
      choice.value = key;
    } else if (!savedRecord(key)) { render(); announce('That bookmark is no longer saved on this browser.'); return; }
    updateEditor(key); editor.showModal();
    (library ? note : choice).focus();
  }
  function closeEditor() {
    const closingKey = targetKey;
    editor.close(); drafts.clear(); targetKey = '';
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else if (editingFromLibrary) {
      const replacement = [...(list?.querySelectorAll<HTMLElement>('[data-bookmark-key]') ?? [])]
        .find(entry => entry.dataset.bookmarkKey === closingKey)?.querySelector<HTMLButtonElement>('[data-bookmark-edit]');
      (replacement ?? count)?.focus({ preventScroll: true });
    } else create?.focus({ preventScroll: true });
    returnFocus = null;
  }
  choice.addEventListener('change', () => { drafts.set(targetKey, note.value); updateEditor(choice.value); });
  note.addEventListener('input', () => { drafts.set(targetKey, note.value); });
  find<HTMLButtonElement>('[data-bookmark-cancel]').addEventListener('click', closeEditor);
  editor.addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
  editor.addEventListener('click', event => {
    if (event.target !== editor) return;
    const bounds = editor.getBoundingClientRect();
    // The dialog's padding also targets the dialog. Only a real backdrop click
    // dismisses the editor; clicking its inner space must retain an unsaved note.
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) closeEditor();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (note.value.length > MAX_NOTE_LENGTH) { editorStatus.textContent = `Personal notes can contain up to ${MAX_NOTE_LENGTH.toLocaleString()} characters.`; note.focus(); return; }
    const scene = currentScene(targetKey); const original = savedRecord(targetKey); const value = note.value;
    if (!scene && !original) { editorStatus.textContent = 'This part is not currently available to bookmark.'; return; }
    let limitReached = false;
    const saved = commit(entries => {
      const existing = entries.find(entry => bookmarkId(entry) === targetKey);
      if (!existing && entries.length >= MAX_BOOKMARKS) { limitReached = true; throw new Error('Bookmark limit'); }
      if (!existing && !scene) throw new Error('Unavailable part');
      const record: Bookmark = existing ? { ...existing, note: value, updatedAt: new Date().toISOString() } : {
        sessionId: scene!.sessionId, sceneId: scene!.sceneId, fingerprint: scene!.fingerprint,
        sessionNumber: scene!.sessionNumber, sessionTitle: scene!.sessionTitle, sceneLabel: scene!.sceneLabel,
        note: value, updatedAt: new Date().toISOString(),
      };
      if (scene) { record.sessionTitle = scene.sessionTitle; record.sceneLabel = scene.sceneLabel; record.sessionNumber = scene.sessionNumber; }
      return existing ? entries.map(entry => bookmarkId(entry) === targetKey ? record : entry) : [...entries, record];
    });
    if (limitReached) { editorStatus.textContent = `This browser already has ${MAX_BOOKMARKS} bookmarks. Forget a bookmark before saving another.`; announce(editorStatus.textContent); return; }
    if (!saved) return;
    const index = records().findIndex(record => bookmarkId(record) === targetKey);
    closeEditor(); render(); announce('Bookmark saved on this browser.');
    if (editingFromLibrary) focusAfterRemoval(index);
  });
  forget.addEventListener('click', () => {
    const index = records().findIndex(record => bookmarkId(record) === targetKey);
    if (commit(entries => entries.filter(record => bookmarkId(record) !== targetKey))) {
      closeEditor(); render(); announce('Bookmark and personal note forgotten.');
      if (editingFromLibrary) focusAfterRemoval(index);
    }
  });

  create?.addEventListener('click', () => {
    const scene = catalog?.scenes.find(item => item.sessionId === root.dataset.session && `#${item.sceneId}` === location.hash);
    openEditor(scene ? bookmarkId(scene) : '', create);
  });
  if (root.dataset.session) for (const marker of document.querySelectorAll<HTMLElement>('.session-layout > .prose .recap-scene-anchor')) {
    const button = action('Bookmark this part', () => openEditor(`${root.dataset.session}::${marker.id}`, button));
    button.classList.add('scene-bookmark-trigger'); button.dataset.bookmarkSceneId = marker.id;
    button.setAttribute('aria-label', `Bookmark ${marker.dataset.sceneLabel ?? 'this recap part'}`);
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'bookmark-editor'); button.disabled = true;
    marker.after(button); triggers.push(button);
  }
  clear?.addEventListener('click', () => { confirmation!.hidden = false; find<HTMLButtonElement>('[data-bookmark-clear-cancel]').focus(); });
  root.querySelector<HTMLButtonElement>('[data-bookmark-clear-cancel]')?.addEventListener('click', () => { confirmation!.hidden = true; clear!.focus(); });
  root.querySelector<HTMLButtonElement>('[data-bookmark-clear-confirm]')?.addEventListener('click', () => {
    try {
      window.localStorage.removeItem(BOOKMARK_STORAGE_KEY); state = { state: 'ready', bookmarks: [] };
      confirmation!.hidden = true; render(); announce('All bookmarks and personal notes forgotten on this browser.');
      count!.focus();
    } catch { announce('This browser could not forget the saved bookmarks. Nothing has been changed.'); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== BOOKMARK_STORAGE_KEY && event.key !== null) return;
    state = read(); render(); announce(editor.open ? 'Bookmarks changed in another tab. Your unsaved note remains in this editor.' : undefined);
  });

  function loadCatalog(): Promise<void> {
    if (catalogRequest) return catalogRequest;
    catalog = null; catalogState = 'loading'; state = read(); render(); announce();
    const controller = new AbortController(); const deadline = window.setTimeout(() => controller.abort(), 10000);
    catalogRequest = fetch(root.dataset.catalog!, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable catalog');
        const raw = await response.text();
        if (new TextEncoder().encode(raw).byteLength > 1024 * 1024) throw new Error('Catalog too large');
        catalog = parseBookmarkCatalog(JSON.parse(raw), root.dataset.base ?? '/'); catalogState = 'ready';
      }).catch(() => { catalog = null; catalogState = 'error'; })
      .finally(() => { window.clearTimeout(deadline); catalogRequest = null; render(); announce(); });
    return catalogRequest;
  }
  retry.addEventListener('click', () => { void loadCatalog(); });
  tools.hidden = false; render(); announce(); void loadCatalog();
}
