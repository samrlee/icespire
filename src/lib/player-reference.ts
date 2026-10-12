import { getCollection } from 'astro:content';
import { evidenceClaims, briefingItems, briefingEvidenceIds, referenceReview } from '../data/player-reference';
import { resolveBriefingItems, resolveEvidenceClaims, referenceResolver } from './provenance';
import { isSessionPublished } from './session-publication';

export async function getPlayerReference() {
  const [sessions, characters] = await Promise.all([getCollection('sessions'), getCollection('characters')]);
  const evidence = resolveEvidenceClaims(evidenceClaims, sessions, characters, referenceReview);
  const briefing = resolveBriefingItems(briefingItems, sessions, characters, referenceReview);
  const checkpoint = referenceResolver(sessions, characters, referenceReview).checkpoint;
  const briefingEvidence = briefingEvidenceIds.map(id => {
    const claim = evidence.find(claim => claim.id === id);
    if (!claim) throw new Error(`Briefing references missing evidence claim ${id}`);
    return claim;
  });
  const newest = sessions.filter(isSessionPublished)
    .sort((a, b) => b.data.sessionNumber - a.data.sessionNumber)[0];
  return { evidence, briefing, briefingEvidence, checkpoint, newerRecap: newest && newest.data.sessionNumber > checkpoint.data.sessionNumber ? newest : undefined,
    characters: characters.map(character => ({ id: character.id, name: character.data.name })).sort((a, b) => a.name.localeCompare(b.name)) };
}
