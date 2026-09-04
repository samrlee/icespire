import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import { url } from '../utils/url';

// Build-time search index. Everything the site publishes becomes one document
// here; the browser fetches the whole thing once and searches it locally, so
// there is no server, no runtime dependency, and nothing to rate-limit.
//
// The rule that matters: this indexes PUBLISHED content only. The repo holds
// plenty the site deliberately withholds — locations the party hasn't found,
// draft recaps — and search must never be the back door to it. Every filter
// below mirrors the one the corresponding page already applies, so a thing
// becomes searchable at exactly the moment it becomes visible. See the
// `published` helpers rather than reaching for a bare getCollection().

export type SearchDoc = {
  title: string;
  /** Short kind label, shown as the chip on a result row. */
  kind: string;
  /** Secondary line: role, ancestry, category — whatever the card shows. */
  sub?: string;
  href: string;
  /** Body prose, flattened to plain text, for matching and snippets. */
  text: string;
};

/**
 * Markdown (and the odd block of callout HTML) to the plain prose a reader
 * actually sees. Nothing here needs to be perfect — it feeds a substring
 * match and a snippet, not a renderer — but stray syntax makes for ugly
 * snippets and false matches on URLs, so the common shapes all come out.
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // Leading frontmatter, for the raw page files that still carry theirs.
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      // Images before links: the alt text is not prose worth matching.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Callout boxes and pull-quote footers are markup, their text is not.
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+\.\s+/gm, '')
      .replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s*\-_]*$/gm, ' ')
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

const KIND = {
  session: 'Recap',
  character: 'Party',
  npc: 'NPC',
  faction: 'Faction',
  lore: 'Lore',
  location: 'Place',
  page: 'Page',
} as const;

/** Joins the bits of a subtitle that exist, the way the cards do. */
const sub = (...parts: (string | undefined)[]) => {
  const line = parts.filter(Boolean).join(' · ');
  return line.length > 0 ? line : undefined;
};

export async function buildSearchIndex(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];

  // Recaps — drafts are hidden on /sessions/, so they stay unsearchable too.
  for (const s of await getCollection('sessions', ({ data }) => !data.draft)) {
    docs.push({
      title: s.data.title,
      kind: KIND.session,
      sub: sub(
        `Session ${s.data.sessionNumber}`,
        s.data.date.toLocaleDateString('en-US', { dateStyle: 'medium' })
      ),
      href: url(`/sessions/${s.id}/`),
      text: [s.data.summary, toPlainText(s.body ?? '')].filter(Boolean).join(' '),
    });
  }

  for (const c of await getCollection('characters')) {
    docs.push({
      title: c.data.name,
      kind: KIND.character,
      sub: sub(`${c.data.ancestry} ${c.data.class}`, `played by ${c.data.player}`),
      href: url(`/characters/${c.id}/`),
      text: [c.data.tagline, ...c.data.traits, toPlainText(c.body ?? '')]
        .filter(Boolean)
        .join(' '),
    });
  }

  for (const n of await getCollection('npcs')) {
    docs.push({
      title: n.data.name,
      kind: KIND.npc,
      sub: sub(n.data.role, n.data.affiliation),
      href: url(`/npcs/${n.id}/`),
      text: [n.data.note, toPlainText(n.body ?? '')].filter(Boolean).join(' '),
    });
  }

  for (const f of await getCollection('factions')) {
    docs.push({
      title: f.data.name,
      kind: KIND.faction,
      sub: sub(f.data.type, f.data.alignment),
      href: url(`/factions/${f.id}/`),
      text: [f.data.summary, toPlainText(f.body ?? '')].filter(Boolean).join(' '),
    });
  }

  for (const l of await getCollection('lore')) {
    docs.push({
      title: l.data.title,
      kind: KIND.lore,
      sub: l.data.category,
      href: url(`/lore/${l.id}/`),
      text: [l.data.summary, toPlainText(l.body ?? '')].filter(Boolean).join(' '),
    });
  }

  // Places the party hasn't discovered render nowhere on the map and must not
  // surface here either — the same `unknown` gate EntityLinks and the map use.
  for (const loc of await getCollection('locations')) {
    if (loc.data.status === 'unknown') continue;
    docs.push({
      title: loc.data.name,
      kind: KIND.location,
      sub: sub(loc.data.kind, loc.data.status === 'visited' ? undefined : loc.data.status),
      href: url(`/map/#${loc.id}`),
      text: [loc.data.summary, toPlainText(loc.body ?? '')].filter(Boolean).join(' '),
    });
  }

  // The campaign summary is a standalone Markdown page, not a collection
  // entry, so it is read from disk. Astro builds with the repo root as cwd
  // (same assumption src/lib/og.ts makes for its fonts).
  const campaign = readFileSync(join(process.cwd(), 'src/pages/campaign.md'), 'utf8');
  docs.push({
    title: 'Campaign Summary',
    kind: KIND.page,
    sub: 'The story so far',
    href: url('/campaign/'),
    text: toPlainText(campaign),
  });

  return docs;
}
