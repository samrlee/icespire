import { getCollection } from 'astro:content';
import { buildEntities, matchEntities } from './entities';
import { isSessionPublished } from './session-publication';
import { url } from '../utils/url';
import { recapScenes } from './recap-scenes';

type RecapMention = { title: string; number: number; date: string; href: string; scenes: { label: string; href: string }[] };

async function buildRecapMentions() {
  const entities = await buildEntities();
  const sessions = (await getCollection('sessions', isSessionPublished))
    .sort((a, b) => b.data.sessionNumber - a.data.sessionNumber);
  const mentions = new Map<string, RecapMention[]>();
  for (const session of sessions) {
    for (const entity of matchEntities(session.body ?? '', entities)) {
      if (entity.type !== 'Party' && entity.type !== 'NPC') continue;
      const recaps = mentions.get(entity.href) ?? [];
      recaps.push({
        title: session.data.title,
        number: session.data.sessionNumber,
        date: session.data.date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
        href: url(`/sessions/${session.id}/`),
        scenes: recapScenes(session.body ?? '').filter(scene => matchEntities(scene.body, entities).some(match => match.href === entity.href))
          .map(scene => ({ label: scene.label, href: url(`/sessions/${session.id}/#${scene.id}`) })),
      });
      mentions.set(entity.href, recaps);
    }
  }
  return mentions;
}

// Reuse one index during builds; edits in development must be reflected immediately.
let built: ReturnType<typeof buildRecapMentions> | undefined;
export async function recapMentions(href: string) {
  const index = await (import.meta.env.PROD ? (built ??= buildRecapMentions()) : buildRecapMentions());
  return index.get(href) ?? [];
}
