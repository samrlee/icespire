import type { CollectionEntry } from 'astro:content';
import { resolveSessionParty } from './session-party.ts';
import { isSessionPublished } from './session-publication.ts';
import { recapScenes } from './recap-scenes.ts';

type Collections = 'sessions' | 'characters' | 'npcs' | 'factions' | 'lore' | 'locations' | 'journey';
export type CampaignCollections = { [K in Collections]: CollectionEntry<K>[] };

/** Existence is not publication, participation, or proof of a campaign fact. */
export function contentReferenceErrors(content: CampaignCollections): string[] {
  const errors: string[] = [];
  const sessions = new Map<number, string>();
  const journeys = new Map<number, string>();
  const players = new Set(content.characters.map(entry => entry.data.player));
  const factions = new Set(content.factions.map(entry => entry.id));
  const lore = new Set(content.lore.map(entry => entry.id));
  const locations = new Set(content.locations.map(entry => entry.id));
  const publishedSessions = new Set(content.sessions.filter(isSessionPublished).map(entry => entry.id));
  for (const collection of ['characters', 'npcs'] as const) {
    for (const entry of content[collection]) {
      if (entry.data.reviewedThrough !== undefined && !publishedSessions.has(entry.data.reviewedThrough)) {
        errors.push(`${collection}/${entry.id}: reviewedThrough must reference a published session ID (${JSON.stringify(entry.data.reviewedThrough)})`);
      }
    }
  }
  const duplicate = (seen: Map<number, string>, number: number, source: string, field: string) => {
    const previous = seen.get(number);
    if (previous !== undefined) errors.push(`${source}: duplicate ${field} ${number} (also ${previous})`);
    else seen.set(number, source);
  };
  const reference = <T extends string | number>(known: { has(value: T): boolean }, value: T | undefined, source: string, field: string) => {
    if (value === undefined) return;
    if (!known.has(value)) errors.push(`${source}: ${field} references missing entry ${JSON.stringify(value)}`);
  };
  for (const entry of content.sessions) {
    const source = `sessions/${entry.id}`;
    try { recapScenes(entry.body ?? ''); } catch (error) { errors.push(`${source}: ${(error as Error).message}`); }
    duplicate(sessions, entry.data.sessionNumber, source, 'sessionNumber');
    for (const player of entry.data.playersPresent) reference(players, player, source, 'playersPresent');
    errors.push(...resolveSessionParty(entry, content.characters).errors.map(error => `${source}: ${error}`));
  }
  for (const entry of content.journey) {
    const source = `journey/${entry.id}`;
    duplicate(journeys, entry.data.session, source, 'session');
    reference(sessions, entry.data.session, source, 'session');
    for (const slug of entry.data.route) reference(locations, slug, source, 'route');
    for (const event of entry.data.events) reference(locations, event.at, source, 'events.at');
  }
  for (const entry of content.npcs) {
    reference(factions, entry.data.faction, `npcs/${entry.id}`, 'faction');
    reference(sessions, entry.data.firstAppearance, `npcs/${entry.id}`, 'firstAppearance');
  }
  for (const entry of content.locations) {
    reference(factions, entry.data.faction, `locations/${entry.id}`, 'faction');
    reference(lore, entry.data.lore, `locations/${entry.id}`, 'lore');
    reference(sessions, entry.data.firstVisited, `locations/${entry.id}`, 'firstVisited');
  }
  return errors.sort();
}

export function contentImages(content: CampaignCollections): { source: string; path: string }[] {
  const images: { source: string; path: string }[] = [];
  for (const collection of ['characters', 'npcs'] as const) {
    for (const entry of content[collection]) {
      if (entry.data.portrait) images.push({ source: `${collection}/${entry.id}: portrait`, path: entry.data.portrait });
    }
  }
  for (const entry of content.sessions) {
    for (const encounter of entry.data.encounters) {
      images.push({ source: `sessions/${entry.id}: encounters.image (${encounter.name})`, path: encounter.image });
    }
  }
  return images;
}
