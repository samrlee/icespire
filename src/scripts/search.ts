// The ⌘K palette. Everything the site publishes is in one JSON file
// (/search-index.json, built by lib/search-index.ts); this fetches it on the
// first open and ranks it in the browser. No server, no runtime dependency —
// which is the whole point: search costs nothing to run and can't be abused.
//
// The ranking itself lives in lib/search-rank.ts, shared with the Ask
// endpoint so both retrieve from the index by the same rules.

import { contentTokens, index, pickAll, tokenize } from '../lib/search-rank';
import type { Hit, Indexed, SearchDoc } from '../lib/search-rank';
import { createAsk } from './ask';

const MAX_HITS = 8;
const SNIPPET_RADIUS = 90;

const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
const input = document.querySelector<HTMLInputElement>('#search-input');
const list = document.querySelector<HTMLElement>('#search-results');
const statusLine = document.querySelector<HTMLElement>('#search-status');
const askBox = document.querySelector<HTMLElement>('#search-ask');
const intro = document.querySelector<HTMLElement>('#search-intro');
const openers = document.querySelectorAll<HTMLButtonElement>('[data-search-open]');

if (dialog && input && list && statusLine) {
  wire(dialog, input, list, statusLine);
}

function wire(
  dialog: HTMLDialogElement,
  input: HTMLInputElement,
  list: HTMLElement,
  statusLine: HTMLElement
) {
  const indexUrl = dialog.dataset.index ?? '/search-index.json';
  // The Ask panel is optional: without the endpoint configured the palette is
  // exactly the search it was before.
  const ask =
    askBox && dialog.dataset.ask ? createAsk(askBox, dialog.dataset.ask, query => { input.value = query; limit = MAX_HITS; render(); input.focus(); }) : null;
  let docs: Indexed[] | null = null;
  let loading: Promise<void> | null = null;
  let state: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  const retry = dialog.querySelector<HTMLButtonElement>('[data-search-retry]');
  const filters = dialog.querySelector<HTMLElement>('#search-filters');
  const filterNote = dialog.querySelector<HTMLElement>('#search-filter-note');
  const more = dialog.querySelector<HTMLButtonElement>('[data-search-more]');
  let kind = '';
  let limit = MAX_HITS;
  let hits: Hit[] = [];
  let active = -1;
  let returnFocus: HTMLElement | null = null;

  const load = () => {
    if (loading) return loading;
    if (state === 'ready') return Promise.resolve();
    state = 'loading';
    ask?.prepare();
    render();
    loading = fetch(indexUrl, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(async (raw: unknown) => {
        if (!Array.isArray(raw) || !raw.every(isSearchDoc)) {
          throw new Error('Invalid search index');
        }
        docs = index(raw);
        await ask?.setCorpus(raw);
        filters?.replaceChildren();
        for (const value of ['', ...new Set(raw.map(doc => doc.kind).sort())]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'search-close';
          button.textContent = value || 'All types';
          button.dataset.kind = value;
          button.setAttribute('aria-controls', 'search-results');
          button.addEventListener('click', () => {
            kind = value;
            limit = MAX_HITS;
            render();
          });
          filters?.append(button);
        }
        state = 'ready';
      })
      .catch(() => {
        state = 'error';
      })
      .finally(() => {
        loading = null;
        if (dialog.open) render();
      });
    return loading;
  };

  const open = (opener?: HTMLElement) => {
    if (dialog.open) return;
    returnFocus = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialog.showModal();
    if (state === 'ready') { state = 'idle'; docs = null; }
    input.select();
    render();
    if (state === 'idle') void load();
  };

  retry?.addEventListener('click', () => {
    input.focus();
    void load();
  });
  more?.addEventListener('click', () => {
    limit += MAX_HITS;
    render();
    // Keep focus available even when the final batch hides this button.
    input.focus();
  });

  // Virtual keyboards can submit without the input's Enter keydown. Submitting
  // a query must never dismiss the dialog or implicitly run a model request.
  dialog.querySelector('form')?.addEventListener('submit', (e) => e.preventDefault());
  dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());

  for (const button of openers) {
    button.addEventListener('click', () => open(button));
  }

  // ⌘K / Ctrl-K anywhere, and a bare "/" when the reader isn't already typing.
  document.addEventListener('keydown', (e) => {
    const typing =
      document.activeElement instanceof HTMLElement &&
      (document.activeElement.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      dialog.open ? dialog.close() : open();
    } else if (e.key === '/' && !typing && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  // Clicking the backdrop — anywhere outside the panel — dismisses.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    input.value = '';
    kind = '';
    limit = MAX_HITS;
    if (filters) filters.hidden = true;
    if (filterNote) filterNote.hidden = true;
    if (more) more.hidden = true;
    list.replaceChildren();
    statusLine.textContent = '';
    ask?.clear();
    hits = [];
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (intro) intro.hidden = false;
    if (retry) retry.hidden = true;
    // WebKit does not necessarily focus a clicked button before showModal().
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  });

  for (const example of document.querySelectorAll<HTMLButtonElement>('[data-search-example]')) {
    example.addEventListener('click', () => {
      input.value = example.textContent?.trim() ?? '';
      limit = MAX_HITS;
      input.focus();
      render();
    });
  }

  input.addEventListener('input', () => {
    limit = MAX_HITS;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (hits.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0
        ? (step > 0 ? 0 : hits.length - 1)
        : (active + step + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) (list.children[active] as HTMLAnchorElement)?.click();
    }
  });

  function setActive(next: number) {
    active = next;
    const rows = Array.from(list.children) as HTMLElement[];
    rows.forEach((row, i) => {
      row.classList.toggle('is-active', i === active);
      row.setAttribute('aria-selected', i === active ? 'true' : 'false');
    });
    if (active >= 0) {
      rows[active]?.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', rows[active].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render() {
    const tokens = tokenize(input.value);
    list.replaceChildren();
    active = -1;
    hits = [];
    input.removeAttribute('aria-activedescendant');

    const query = input.value.trim();
    if (more) more.hidden = true;
    if (filters) {
      filters.hidden = state !== 'ready' || tokens.length === 0;
      for (const button of filters.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.kind === kind));
      }
    }
    if (filterNote) filterNote.hidden = state !== 'ready' || tokens.length === 0 || !kind;
    if (intro) intro.hidden = tokens.length > 0;
    if (retry) retry.hidden = state !== 'error';

    if (state !== 'ready') {
      ask?.clear();
      statusLine.textContent = state === 'error'
        ? "The chronicle couldn't load. Try again."
        : 'Loading the chronicle…';
      return;
    }

    if (tokens.length === 0) {
      statusLine.textContent = '';
      ask?.clear();
      hits = [];
      return;
    }
    const eligible = (docs ?? []).filter(doc => !kind || doc.kind === kind);
    const matches = pickAll(eligible, tokens, eligible.length);
    hits = matches.slice(0, limit);
    // Match on everything the reader typed, but only mark the words that
    // carry meaning — highlighting every "the" in a typed-out question is
    // noise, and the Ask box invites exactly those questions.
    const marks = contentTokens(input.value);
    // Offered either way — a question the keyword list can't answer is exactly
    // where asking earns its keep.
    ask?.offer(query);

    if (hits.length === 0) {
      statusLine.textContent = kind
        ? `No ${kind} results match “${query}”. Try All types.`
        : `Nothing in the chronicle matches “${query}”.`;
      return;
    }

    statusLine.textContent = hits.length < matches.length
      ? `Showing ${hits.length} of ${matches.length} results.`
      : `${hits.length} result${hits.length === 1 ? '' : 's'}.`;
    if (more) more.hidden = hits.length >= matches.length;
    hits.forEach((hit, i) => list.append(row(hit, marks, i)));
    // Typing is not a choice to navigate. Only arrow keys select a result.
  }
}

function isSearchDoc(value: unknown): value is SearchDoc {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;
  return ['title', 'kind', 'href', 'text'].every((key) => typeof doc[key] === 'string')
    && (doc.sub === undefined || typeof doc.sub === 'string');
}

function row(hit: Hit, tokens: string[], i: number): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'search-hit';
  a.id = `search-hit-${i}`;
  a.href = hit.doc.href;
  a.setAttribute('role', 'option');
  a.setAttribute('aria-selected', 'false');

  const head = document.createElement('span');
  head.className = 'search-hit-head';
  const title = document.createElement('span');
  title.className = 'search-hit-title';
  title.append(highlight(hit.doc.title, tokens));
  const kind = document.createElement('span');
  kind.className = 'search-hit-kind';
  kind.textContent = hit.doc.kind;
  head.append(title, kind);
  a.append(head);

  if (hit.doc.sub) {
    const sub = document.createElement('span');
    sub.className = 'search-hit-sub';
    sub.textContent = hit.doc.sub;
    a.append(sub);
  }

  const text = snippet(hit.doc.text, hit.at);
  if (text) {
    const line = document.createElement('span');
    line.className = 'search-hit-snippet';
    line.append(highlight(text, tokens));
    a.append(line);
  }

  return a;
}

/** A window of body text around the match, trimmed to whole words. */
function snippet(text: string, at: number): string {
  if (!text) return '';
  if (at < 0) return text.slice(0, SNIPPET_RADIUS * 2).trim() + (text.length > SNIPPET_RADIUS * 2 ? '…' : '');

  let start = Math.max(0, at - SNIPPET_RADIUS);
  let end = Math.min(text.length, at + SNIPPET_RADIUS);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > at) end = space;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Wraps each matched term in <mark>. Built from DOM nodes rather than an HTML
 * string so campaign prose can never smuggle markup into the palette.
 */
function highlight(text: string, tokens: string[]): DocumentFragment {
  const lower = text.toLowerCase();
  const spans: [number, number][] = [];

  for (const token of tokens) {
    let idx = lower.indexOf(token);
    while (idx !== -1) {
      spans.push([idx, idx + token.length]);
      idx = lower.indexOf(token, idx + token.length);
    }
  }

  const frag = document.createDocumentFragment();
  if (spans.length === 0) {
    frag.append(text);
    return frag;
  }

  // Overlapping terms ("dragon" and "drag") would otherwise mark twice.
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }

  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) frag.append(text.slice(cursor, start));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, end);
    frag.append(mark);
    cursor = end;
  }
  if (cursor < text.length) frag.append(text.slice(cursor));
  return frag;
}
