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
  const pop = document.createElement('div');
  pop.className = 'entity-pop';
  pop.hidden = true;
  document.body.appendChild(pop);

  let hideTimer: number | undefined;
  let shownFor: HTMLElement | null = null;
  const touchOnly = matchMedia('(hover: none)').matches;

  const fill = (entity: Entity) => {
    pop.replaceChildren();

    const head = document.createElement('div');
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

    const body = document.createElement('div');
    body.className = 'pop-body';
    const textCol = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pop-name';
    name.textContent = entity.name;
    textCol.appendChild(name);
    if (entity.sub) {
      const sub = document.createElement('div');
      sub.className = 'pop-sub';
      sub.textContent = entity.sub;
      textCol.appendChild(sub);
    }
    if (entity.note) {
      const note = document.createElement('div');
      note.className = 'pop-note';
      note.textContent = entity.note;
      textCol.appendChild(note);
    }
    const open = document.createElement('a');
    open.className = 'pop-open';
    open.href = entity.href;
    open.textContent = entity.type === 'Location' ? 'On the map →' : 'Open page →';
    textCol.appendChild(open);
    body.appendChild(textCol);
    if (entity.portrait) {
      const img = document.createElement('img');
      img.className = 'pop-portrait';
      img.src = entity.portrait;
      img.alt = '';
      body.appendChild(img);
    }
    pop.appendChild(body);
  };

  const show = (link: HTMLElement) => {
    window.clearTimeout(hideTimer);
    const idx = Number(link.dataset.entity);
    const entity = entities[idx];
    // A .entity-link that didn't come from linkMentions (hand-written in prose,
    // say) carries no index — there's nothing to preview, so leave it be.
    if (!entity) return;
    fill(entity);
    shownFor = link;
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    const rect = link.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - popRect.width - 8);
    const below = rect.bottom + 8 + popRect.height < window.innerHeight;
    const top = below ? rect.bottom + 8 : rect.top - popRect.height - 8;
    pop.style.left = `${left + window.scrollX}px`;
    pop.style.top = `${top + window.scrollY}px`;
    pop.style.visibility = '';
  };

  const scheduleHide = () => {
    hideTimer = window.setTimeout(() => {
      pop.hidden = true;
      shownFor = null;
    }, 200);
  };

  document.addEventListener('pointerover', (event) => {
    const link = (event.target as Element).closest?.('.entity-link');
    if (link instanceof HTMLElement) show(link);
    else if (!pop.contains(event.target as Node) && !pop.hidden) scheduleHide();
  });
  pop.addEventListener('pointerover', () => window.clearTimeout(hideTimer));
  pop.addEventListener('pointerleave', scheduleHide);

  document.addEventListener('focusin', (event) => {
    const link = (event.target as Element).closest?.('.entity-link');
    if (link instanceof HTMLElement) show(link);
    else if (!pop.contains(event.target as Node)) scheduleHide();
  });

  // On touch screens the first tap previews; the card's own link navigates.
  if (touchOnly) {
    document.addEventListener('click', (event) => {
      const link = (event.target as Element).closest?.('.entity-link');
      if (link instanceof HTMLElement && shownFor !== link) {
        event.preventDefault();
        show(link);
      } else if (!(event.target as Element).closest?.('.entity-pop, .entity-link')) {
        pop.hidden = true;
        shownFor = null;
      }
    });
  }
}
