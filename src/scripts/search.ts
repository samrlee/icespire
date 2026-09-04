// The ⌘K palette. Everything the site publishes is in one JSON file
// (/search-index.json, built by lib/search-index.ts); this fetches it on the
// first open and ranks it in the browser. No server, no runtime dependency —
// which is the whole point: search costs nothing to run and can't be abused.

type SearchDoc = {
  title: string;
  kind: string;
  sub?: string;
  href: string;
  text: string;
};

/** A doc plus the lowercased copies we match against, folded once at load. */
type Indexed = SearchDoc & {
  titleLc: string;
  subLc: string;
  textLc: string;
};

type Hit = {
  doc: Indexed;
  score: number;
  /** Where in the body text the best match landed, for the snippet. */
  at: number;
};

const MAX_HITS = 8;
const SNIPPET_RADIUS = 90;

const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
const input = document.querySelector<HTMLInputElement>('#search-input');
const list = document.querySelector<HTMLElement>('#search-results');
const statusLine = document.querySelector<HTMLElement>('#search-status');
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
  let docs: Indexed[] | null = null;
  let loading: Promise<void> | null = null;
  let hits: Hit[] = [];
  let active = -1;

  const load = () => {
    if (loading) return loading;
    loading = fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw: SearchDoc[]) => {
        docs = raw.map((d) => ({
          ...d,
          titleLc: d.title.toLowerCase(),
          subLc: (d.sub ?? '').toLowerCase(),
          textLc: d.text.toLowerCase(),
        }));
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

    if (tokens.length === 0) {
      statusLine.textContent = '';
      hits = [];
      return;
    }
    if (!docs) {
      statusLine.textContent = 'Loading the chronicle…';
      hits = [];
      return;
    }

    hits = search(docs, tokens);
    if (hits.length === 0) {
      statusLine.textContent = `Nothing in the chronicle matches “${input.value.trim()}”.`;
      return;
    }

    statusLine.textContent = `${hits.length} result${hits.length === 1 ? '' : 's'}.`;
    hits.forEach((hit, i) => list.append(row(hit, tokens, i)));
    setActive(0);
  }
}

/** Query text to the distinct lowercase terms worth matching on. */
function tokenize(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean))];
}

/**
 * Where `needle` sits in `haystack`, how often, and whether any occurrence
 * starts a word — a match on "Dax" should beat one buried inside "Daxholm".
 */
function matchIn(haystack: string, needle: string) {
  let idx = haystack.indexOf(needle);
  let count = 0;
  let first = -1;
  let boundary = false;
  while (idx !== -1 && count < 20) {
    count++;
    const starts = idx === 0 || !/[\p{L}\p{N}]/u.test(haystack[idx - 1]);
    if (first === -1 || (starts && !boundary)) {
      first = idx;
      boundary = boundary || starts;
    }
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return { count, first, boundary };
}

/**
 * Every term has to land somewhere in a document for it to place at all, so
 * "dax mine" finds the recap that has both rather than everything with either.
 * Weights just say where a hit counts most: a name beats a subtitle, which
 * beats a mention buried in prose.
 */
function search(docs: Indexed[], tokens: string[]): Hit[] {
  const hits: Hit[] = [];

  for (const doc of docs) {
    let score = 0;
    let at = -1;
    let matchedAll = true;

    for (const token of tokens) {
      const title = matchIn(doc.titleLc, token);
      const subtitle = matchIn(doc.subLc, token);
      const body = matchIn(doc.textLc, token);
      let termScore = 0;

      if (doc.titleLc === token) termScore += 40;
      else if (title.count > 0) termScore += title.boundary ? 16 : 7;
      if (subtitle.count > 0) termScore += subtitle.boundary ? 4 : 2;
      if (body.count > 0) {
        termScore += (body.boundary ? 3 : 1) + Math.min(body.count, 4);
        if (at === -1) at = body.first;
      }

      if (termScore === 0) {
        matchedAll = false;
        break;
      }
      score += termScore;
    }

    if (matchedAll) hits.push({ doc, score, at });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, MAX_HITS);
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
