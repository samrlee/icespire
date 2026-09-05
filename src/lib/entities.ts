// The site's cast of named things — party, NPCs, factions, and discovered
// locations — with the aliases each one answers to.
//
// Two features read this. `components/EntityLinks.astro` ships it to the
// browser to auto-link the first mention of each entity inside `.prose`;
// `components/DramatisPersonae.astro` matches it against a recap's Markdown
// at build time to work out who appears in that session. Both want the same
// aliases and the same collision rules, so they live here rather than in
// either caller.
import { getCollection } from 'astro:content';
import { url } from '../utils/url';

export type EntityType = 'Party' | 'NPC' | 'Faction' | 'Location';

export type Entity = {
  name: string;
  type: EntityType;
  href: string;
  sub?: string;
  note?: string;
  portrait?: string;
  status?: string;
  statusLabel?: string;
  aliases: string[];
};

// Single capitalized words too generic to link on their own (they still
// match as part of a full name).
const STOP_TOKENS = new Set([
  'the', 'and', 'king', 'queen', 'guildmaster', 'guard', 'lady', 'lord',
  'white', 'dragon', 'gold', 'mine', 'camp', 'hill', 'tower', 'temple',
  'ruined', 'lodge', 'ranch', 'hold', 'shrine', 'hunting', 'storms',
  'excavation', 'barrow', 'trail', 'peak', 'circle', 'orc',
]);

const npcStatusLabels: Record<string, string> = {
  ally: 'Ally',
  hostile: 'Hostile',
  unresolved: 'Unresolved Thread',
  'at-large': 'At Large',
  neutral: 'Neutral',
  deceased: 'Deceased',
};

// Full display name plus any distinctive single-word aliases ("Thornton",
// "Dazlyn"). Curly apostrophes also get a straight-quote variant so prose
// typed either way matches.
export function nameVariants(name: string): string[] {
  const out = new Set<string>([name]);
  if (name.includes('’')) out.add(name.replaceAll('’', "'"));
  // "The Zhentarim" should also match mid-sentence: "the Zhentarim".
  if (name.startsWith('The ')) out.add(`the ${name.slice(4)}`);
  const cleaned = name.replace(/\(.*?\)/g, ' ').replace(/["“”]/g, ' ');
  for (const token of cleaned.split(/[\s&·,]+/)) {
    if (token.length < 3) continue;
    if (STOP_TOKENS.has(token.toLowerCase())) continue;
    if (!/^\p{Lu}/u.test(token)) continue;
    out.add(token);
  }
  return [...out];
}

export async function buildEntities(): Promise<Entity[]> {
  const entities: Entity[] = [];

  for (const c of await getCollection('characters')) {
    entities.push({
      name: c.data.name,
      type: 'Party',
      href: url(`/characters/${c.id}/`),
      sub: `${c.data.ancestry} ${c.data.class} · played by ${c.data.player}`,
      note: c.data.tagline,
      portrait: c.data.portrait ? url(c.data.portrait) : undefined,
      aliases: nameVariants(c.data.name),
    });
  }

  for (const n of await getCollection('npcs')) {
    entities.push({
      name: n.data.name,
      type: 'NPC',
      href: url(`/npcs/${n.id}/`),
      sub: [n.data.role, n.data.affiliation].filter(Boolean).join(' · '),
      note: n.data.note,
      portrait: n.data.portrait ? url(n.data.portrait) : undefined,
      status: n.data.status,
      statusLabel: npcStatusLabels[n.data.status],
      aliases: nameVariants(n.data.name),
    });
  }

  for (const f of await getCollection('factions')) {
    entities.push({
      name: f.data.name,
      type: 'Faction',
      href: url(`/factions/${f.id}/`),
      sub: [f.data.type, f.data.alignment].filter(Boolean).join(' · '),
      note: f.data.summary,
      aliases: nameVariants(f.data.name),
    });
  }

  // Locations the party hasn't discovered stay unlinked (and unspoiled).
  for (const l of await getCollection('locations')) {
    if (l.data.status === 'unknown') continue;
    entities.push({
      name: l.data.name,
      type: 'Location',
      href: url(`/map/#${l.id}`),
      sub: l.data.kind,
      note: l.data.summary,
      aliases: nameVariants(l.data.name),
    });
  }

  resolveAliasCollisions(entities);
  return entities;
}

// Resolve aliases claimed by more than one entity ("Zhentarim" the faction
// vs. "The Zhentarim Guard" NPC; "Gnomengarde" the place vs. the faction):
// the alias goes to the entity whose proper name — minus a leading "The" —
// is the alias itself, ties to the first-declared entity. With no such
// owner, the alias is too ambiguous and nobody gets it.
function resolveAliasCollisions(entities: Entity[]): void {
  const aliasOwners = new Map<string, number[]>();
  entities.forEach((e, i) => {
    for (const a of new Set(e.aliases)) {
      aliasOwners.set(a, [...(aliasOwners.get(a) ?? []), i]);
    }
  });
  for (const [alias, owners] of aliasOwners) {
    if (owners.length === 1) continue;
    const winner = owners.find(
      (i) => entities[i].name === alias || entities[i].name.replace(/^The /, '') === alias
    );
    for (const i of owners) {
      if (i !== winner) {
        entities[i].aliases = entities[i].aliases.filter((a) => a !== alias);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build-time matching
// ---------------------------------------------------------------------------

// Markdown, reduced to the prose a reader actually sees. Code is dropped
// outright (a fenced block is not narration); the callout blocks in recaps are
// HTML wrappers around real sentences, so tags go and their text stays.
function proseOf(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

// One regex over every alias, longest first so "Bean Hootwhistle" wins over
// "Bean". Custom boundaries instead of \b so accented names ("Facktoré")
// match — the same rule the browser-side linker uses.
function aliasPattern(entities: Entity[]): { re: RegExp; aliasTo: Map<string, number> } | null {
  const aliasTo = new Map<string, number>();
  entities.forEach((entity, i) => {
    for (const alias of entity.aliases) {
      if (!aliasTo.has(alias)) aliasTo.set(alias, i);
    }
  });
  if (aliasTo.size === 0) return null;

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = [...aliasTo.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');
  return {
    re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'gu'),
    aliasTo,
  };
}

/**
 * The entities named in a chunk of Markdown, in the order they first appear.
 *
 * Detection only — it never rewrites the text. A name has to be written out
 * for its owner to be counted, so an NPC referred to only as "the innkeeper"
 * is missed. That is the intended failure: a cast list that guesses is worse
 * than one that under-reports, and the fix is to use the name in the recap.
 */
export function matchEntities(markdown: string, entities: Entity[]): Entity[] {
  const compiled = aliasPattern(entities);
  if (!compiled) return [];
  const { re, aliasTo } = compiled;

  const text = proseOf(markdown);
  const seen = new Set<number>();
  const found: Entity[] = [];
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const idx = aliasTo.get(match[0]);
    if (idx == null || seen.has(idx)) continue;
    seen.add(idx);
    found.push(entities[idx]);
  }
  return found;
}
