// Links the first mention of each known entity inside `.prose` and shows a
// preview card on hover/focus (or first tap, on touch screens). Entity data
// comes from the JSON island emitted by components/EntityLinks.astro.

type Entity = {
  name: string;
  type: string;
  href: string;
  sub?: string;
  note?: string;
  portrait?: string;
  previewPortrait?: { src: string; srcset: string };
  status?: string;
  statusLabel?: string;
  aliases: string[];
};

const dataEl = document.getElementById('entity-link-data');
if (dataEl?.textContent) {
  const entities: Entity[] = JSON.parse(dataEl.textContent);
  linkMentions(entities);
}

function linkMentions(entities: Entity[]) {
  const currentPath = location.pathname.replace(/\/$/, '');

  const aliasTo = new Map<string, number>();
  entities.forEach((entity, i) => {
    for (const alias of entity.aliases) {
      if (!aliasTo.has(alias)) aliasTo.set(alias, i);
    }
  });
  if (aliasTo.size === 0) return;

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = [...aliasTo.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
  // Custom boundaries instead of \b so accented names ("Facktoré") match.
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'gu');

  const linked = new Set<number>();

  for (const prose of document.querySelectorAll('.prose')) {
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest('a, code, pre, h1, h2, h3, h4')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    for (const node of textNodes) {
      const text = node.textContent ?? '';
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      const pieces: (string | HTMLAnchorElement)[] = [];
      let cursor = 0;
      while ((match = re.exec(text))) {
        const idx = aliasTo.get(match[0]);
        if (idx == null || linked.has(idx)) continue;
        const entity = entities[idx];
        if (entity.href.split('#')[0].replace(/\/$/, '') === currentPath) continue;
        linked.add(idx);
        pieces.push(text.slice(cursor, match.index));
        const a = document.createElement('a');
        a.className = 'entity-link';
        a.tabIndex = 0;
        a.href = entity.href;
        a.dataset.entity = String(idx);
        a.textContent = match[0];
        pieces.push(a);
        cursor = match.index + match[0].length;
      }
      if (cursor === 0) continue;
      pieces.push(text.slice(cursor));
      const frag = document.createDocumentFragment();
      for (const piece of pieces) frag.append(piece);
      node.replaceWith(frag);
    }
  }

  if (linked.size > 0) setupPopover(entities);
}

function setupPopover(entities: Entity[]) {
  const pop = document.createElement('span');
  pop.id = 'entity-preview';
  pop.setAttribute('role', 'group');
  pop.setAttribute('aria-labelledby', 'entity-preview-name');
  pop.className = 'entity-pop';
  pop.hidden = true;
  document.body.appendChild(pop);

  let hideTimer: number | undefined;
  let shownFor: HTMLElement | null = null;
  let hovered = false;
  let restoringFocus = false;
  let touchWasOpen = false;
  let touchLink: Element | null = null;

  const fill = (entity: Entity) => {
    pop.replaceChildren();

    const head = document.createElement('span');
    head.className = 'pop-head';
    const kicker = document.createElement('span');
    kicker.className = 'pop-kicker';
    kicker.textContent = entity.type;
    head.appendChild(kicker);
    if (entity.status && entity.statusLabel) {
      const pill = document.createElement('span');
      pill.className = `status-pill ${entity.status}`;
      pill.textContent = entity.statusLabel;
      head.appendChild(pill);
    }
    pop.appendChild(head);

    const body = document.createElement('span');
    body.className = 'pop-body';
    const textCol = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'pop-name';
    name.id = 'entity-preview-name';
    name.textContent = entity.name;
    textCol.appendChild(name);
    if (entity.sub) {
      const sub = document.createElement('span');
      sub.className = 'pop-sub';
      sub.textContent = entity.sub;
      textCol.appendChild(sub);
    }
    if (entity.note) {
      const note = document.createElement('span');
      note.className = 'pop-note';
      note.textContent = entity.note;
      textCol.appendChild(note);
    }
    const open = document.createElement('a');
    open.className = 'pop-open';
    open.tabIndex = 0;
    open.href = entity.href;
    open.textContent = entity.type === 'Location' ? 'On the map →' : 'Open page →';
    textCol.appendChild(open);
    body.appendChild(textCol);
    if (entity.portrait) {
      const img = document.createElement('img');
      img.className = 'pop-portrait';
      img.src = entity.previewPortrait?.src ?? entity.portrait;
      if (entity.previewPortrait) {
        img.srcset = entity.previewPortrait.srcset;
        img.sizes = '72px';
      }
      img.width = 72;
      img.height = 96;
      img.decoding = 'async';
      img.alt = '';
      body.appendChild(img);
    }
    pop.appendChild(body);
  };

  const position = (link: HTMLElement) => {
    const rect = link.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - popRect.width - 8);
    const below = rect.bottom + 8 + popRect.height < window.innerHeight;
    const top = below ? rect.bottom + 8 : rect.top - popRect.height - 8;
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, top)}px`;
  };

  const show = (link: HTMLElement) => {
    window.clearTimeout(hideTimer);
    if (link.dataset.entity === undefined) return;
    const idx = Number(link.dataset.entity);
    const entity = entities[idx];
    // A .entity-link that didn't come from linkMentions (hand-written in prose,
    // say) carries no index — there's nothing to preview, so leave it be.
    if (!entity || (shownFor === link && !pop.hidden)) return;
    shownFor?.removeAttribute('aria-controls');
    fill(entity);
    // Phrasing content beside the trigger preserves paragraph validity and Tab order.
    link.after(pop);
    link.setAttribute('aria-controls', pop.id);
    shownFor = link;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    position(link);
    pop.style.visibility = '';
  };

  const hide = (restore = false) => {
    window.clearTimeout(hideTimer);
    const trigger = shownFor;
    shownFor = null;
    hovered = false;
    pop.hidden = true;
    trigger?.removeAttribute('aria-controls');
    if (restore && trigger) {
      restoringFocus = true;
      trigger.focus({ preventScroll: true });
      restoringFocus = false;
    }
  };
  const scheduleHide = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!hovered && document.activeElement !== shownFor && !pop.contains(document.activeElement)) hide();
    }, 200);
  };

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const link = (event.target as Element).closest?.('.entity-link');
    hovered = (!!shownFor && link === shownFor) || pop.contains(event.target as Node);
    if (link instanceof HTMLElement) {
      show(link);
      hovered = true;
    } else if (!hovered) scheduleHide();
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch') return;
    const next = event.relatedTarget as Node | null;
    hovered = !!next && (!!shownFor?.contains(next) || pop.contains(next));
    if (!hovered) scheduleHide();
  });

  document.addEventListener('focusin', (event) => {
    if (restoringFocus) return;
    const link = (event.target as Element).closest?.('.entity-link');
    if (link instanceof HTMLElement) show(link);
    else if (!pop.contains(event.target as Node)) scheduleHide();
  });
  document.addEventListener('focusout', scheduleHide);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pop.hidden) {
      event.preventDefault();
      hide(pop.contains(document.activeElement));
    }
  });
  // Snapshot before touch-generated focus so the first tap always previews.
  // Keyboard Enter and mouse clicks remain ordinary link navigation.
  document.addEventListener('pointerdown', event => {
    const link = (event.target as Element).closest?.('.entity-link');
    touchLink = event.pointerType === 'touch' ? link ?? null : null;
    touchWasOpen = event.pointerType === 'touch' && link === shownFor && !pop.hidden;
    if (!link && !pop.contains(event.target as Node)) hide();
  });
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest?.('.entity-link');
    // WebKit can deliver a MouseEvent click without pointerType after touch.
    if (event.detail > 0 && link === touchLink && link instanceof HTMLElement && !touchWasOpen) {
      event.preventDefault();
      show(link);
    }
    touchWasOpen = false;
    touchLink = null;
  });
  document.addEventListener('pointercancel', () => { touchLink = null; });
  const reposition = () => { if (!pop.hidden && shownFor) position(shownFor); };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);
}
