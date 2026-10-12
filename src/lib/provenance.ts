import { recapScenes } from './recap-scenes.ts';
import { isSessionPublished } from './session-publication.ts';

export type ReferenceSession = {
  id: string;
  body?: string;
  data: { sessionNumber: number; title: string; draft?: boolean };
};
export type ReferenceCharacter = { id: string; data: { name: string } };
export type SceneCitation = { sessionId: string; sceneId: string };
export type EvidenceBasis = 'observed' | 'reported' | 'inferred';
export type EvidenceTopic = 'temple' | 'exchange';

export type EvidenceClaim = {
  id: string;
  topic: EvidenceTopic;
  title: string;
  statement: string;
  basis: EvidenceBasis;
  /** Explicitly authored witnesses/readers/thinkers; null means not recorded. */
  witnesses: readonly string[] | null;
  witnessNote: string;
  citations: readonly SceneCitation[];
  /** A telling adds recipients, never retroactive eyewitnesses. */
  tellings: readonly {
    citation: SceneCitation;
    recipients: readonly string[];
    note: string;
  }[];
  limits: string;
};

export type BriefingItem = {
  id: string;
  title: string;
  text: string;
  citations: readonly SceneCitation[];
};

export type ResolvedCitation = SceneCitation & {
  href: string;
  sessionNumber: number;
  sceneLabel: string;
};
export type NamedCharacter = { id: string; name: string };
export type ResolvedEvidenceClaim = Omit<EvidenceClaim, 'citations' | 'witnesses' | 'tellings'> & {
  citations: ResolvedCitation[];
  witnesses: NamedCharacter[] | null;
  tellings: { citation: ResolvedCitation; recipients: NamedCharacter[]; note: string }[];
  recordedFor: string[];
};

/** Reference validity is checked at build time; it does not prove a claim true. */
export function referenceResolver(
  sessions: readonly ReferenceSession[],
  characters: readonly ReferenceCharacter[],
  reviewedThrough: string,
) {
  const sessionById = new Map(sessions.map(session => [session.id, session]));
  const characterById = new Map(characters.map(character => [character.id, character]));
  const checkpoint = sessionById.get(reviewedThrough);
  if (!checkpoint || !isSessionPublished(checkpoint)) {
    throw new Error(`Player reference reviewedThrough must be a published recap: ${reviewedThrough}`);
  }
  const scenesById = new Map<string, ReturnType<typeof recapScenes>>();

  function citation(source: SceneCitation, context: string): ResolvedCitation {
    const session = sessionById.get(source.sessionId);
    if (!session || !isSessionPublished(session)) {
      throw new Error(`${context}: citation must reference a published recap (${source.sessionId})`);
    }
    if (session.data.sessionNumber > checkpoint!.data.sessionNumber) {
      throw new Error(`${context}: citation is newer than reviewedThrough (${source.sessionId})`);
    }
    let scenes = scenesById.get(session.id);
    if (!scenes) {
      scenes = recapScenes(session.body ?? '');
      scenesById.set(session.id, scenes);
    }
    const scene = scenes.find(scene => scene.id === source.sceneId);
    if (!scene) throw new Error(`${context}: missing scene ${source.sceneId} in ${source.sessionId}`);
    return {
      ...source,
      href: `/sessions/${session.id}/#${scene.id}`,
      sessionNumber: session.data.sessionNumber,
      sceneLabel: scene.label,
    };
  }

  function named(ids: readonly string[], context: string): NamedCharacter[] {
    if (!ids.length) throw new Error(`${context}: use null for witnesses not recorded; lists cannot be empty`);
    const seen = new Set<string>();
    return ids.map(id => {
      const character = characterById.get(id);
      if (!character || seen.has(id)) throw new Error(`${context}: unknown or repeated character ${id}`);
      seen.add(id);
      return { id, name: character.data.name };
    });
  }

  return { checkpoint, citation, named };
}

function filled(value: string, context: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${context}: text must not be empty`);
}

export function resolveEvidenceClaims(
  claims: readonly EvidenceClaim[],
  sessions: readonly ReferenceSession[],
  characters: readonly ReferenceCharacter[],
  reviewedThrough: string,
): ResolvedEvidenceClaim[] {
  const resolver = referenceResolver(sessions, characters, reviewedThrough);
  const seen = new Set<string>();
  return claims.map(claim => {
    const context = `Evidence claim ${claim.id}`;
    if (!/^[a-z][a-z0-9-]*$/.test(claim.id) || seen.has(claim.id)) throw new Error(`${context}: invalid or duplicate ID`);
    seen.add(claim.id);
    if (!['temple', 'exchange'].includes(claim.topic)) throw new Error(`${context}: unknown topic`);
    if (!['observed', 'reported', 'inferred'].includes(claim.basis)) throw new Error(`${context}: unknown basis`);
    for (const [field, value] of Object.entries({ title: claim.title, statement: claim.statement, witnessNote: claim.witnessNote, limits: claim.limits })) {
      filled(value, `${context}.${field}`);
    }
    if (!claim.citations.length) throw new Error(`${context}: at least one scene citation is required`);
    const citations = claim.citations.map(source => resolver.citation(source, context));
    const earliest = Math.min(...citations.map(source => source.sessionNumber));
    const witnesses = claim.witnesses === null ? null : resolver.named(claim.witnesses, `${context}.witnesses`);
    const tellings = claim.tellings.map(telling => {
      filled(telling.note, `${context}.telling`);
      const citation = resolver.citation(telling.citation, context);
      if (citation.sessionNumber < earliest) throw new Error(`${context}: telling precedes the establishing source`);
      return { citation, recipients: resolver.named(telling.recipients, `${context}.recipients`), note: telling.note };
    });
    const recordedFor = [...new Set([...(witnesses ?? []).map(character => character.id), ...tellings.flatMap(telling => telling.recipients.map(character => character.id))])];
    return { ...claim, citations, witnesses, tellings, recordedFor };
  });
}

export function resolveBriefingItems(
  items: readonly BriefingItem[],
  sessions: readonly ReferenceSession[],
  characters: readonly ReferenceCharacter[],
  reviewedThrough: string,
) {
  const resolver = referenceResolver(sessions, characters, reviewedThrough);
  const seen = new Set<string>();
  return items.map(item => {
    if (!/^[a-z][a-z0-9-]*$/.test(item.id) || seen.has(item.id)) throw new Error(`Briefing: invalid or duplicate ID ${item.id}`);
    seen.add(item.id);
    filled(item.title, `Briefing ${item.id}.title`);
    filled(item.text, `Briefing ${item.id}.text`);
    if (!item.citations.length) throw new Error(`Briefing ${item.id}: at least one scene citation is required`);
    return { ...item, citations: item.citations.map(source => resolver.citation(source, `Briefing ${item.id}`)) };
  });
}
