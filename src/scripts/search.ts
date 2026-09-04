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
    askBox && dialog.dataset.ask ? createAsk(askBox, dialog.dataset.ask) : null;
  let docs: Indexed[] | null = null;
  let loading: Promise<void> | null = null;
  let hits: Hit[] = [];
  let active = -1;

  const load = () => {
    if (loading) return loading;
    loading = fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw: SearchDoc[]) => {
        docs = index(raw);
      })
      .catch(() => {
        docs = [];
        statusLine.textContent = "The index didn't load. Try reloading the page.";
      });
    return loading;
  };

  const open = () => {
    if (dialog.open) return;
    dialog.showModal();
    input.select();
    void load().then(() => {
      // The reader may have typed while the index was still in flight.
      if (dialog.open && input.value.trim()) render();
    });
  };

  for (const button of openers) {
    button.addEventListener('click', open);
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
    list.replaceChildren();
    statusLine.textContent = '';
    ask?.clear();
    hits = [];
    active = -1;
  });

  input.addEventListener('input', render);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (hits.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((active + step + hits.length) % hits.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      list.children[active]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    input.removeAttribute('aria-activedescendant');

    const query = input.value.trim();

    if (tokens.length === 0) {
      statusLine.textContent = '';
      ask?.clear();
      hits = [];
      return;
    }
    if (!docs) {
      statusLine.textContent = 'Loading the chronicle…';
      hits = [];
      return;
    }

    hits = pickAll(docs, tokens, MAX_HITS);
    // Match on everything the reader typed, but only mark the words that
    // carry meaning — highlighting every "the" in a typed-out question is
    // noise, and the Ask box invites exactly those questions.
    const marks = contentTokens(input.value);
    // Offered either way — a question the keyword list can't answer is exactly
    // where asking earns its keep.
    ask?.offer(query);

    if (hits.length === 0) {
      statusLine.textContent = `Nothing in the chronicle matches “${query}”.`;
      return;
    }

    statusLine.textContent = `${hits.length} result${hits.length === 1 ? '' : 's'}.`;
    hits.forEach((hit, i) => list.append(row(hit, marks, i)));
    setActive(0);
  }
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
