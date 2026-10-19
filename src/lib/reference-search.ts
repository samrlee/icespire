import type { SearchDoc } from './search-rank.ts';
import type { ResolvedEvidenceClaim } from './provenance.ts';

type SearchReference = {
  checkpoint: { id: string; data: { sessionNumber: number } };
  newerRecap?: { data: { sessionNumber: number } };
  briefing: readonly { title: string; text: string }[];
  evidence: readonly ResolvedEvidenceClaim[];
};

/** Match the reference pages' limits before admitting their prose to Ask. */
export function buildReferenceSearchDocs(reference: SearchReference, snapshotSourceId: string): SearchDoc[] {
  const number = reference.checkpoint.data.sessionNumber;
  const snapshotMismatch = snapshotSourceId !== reference.checkpoint.id;
  const briefingNotice = reference.newerRecap || snapshotMismatch
    ? `The reminders still reflect Session ${number}. Read the latest recap and the current snapshot before using them for play.` : '';
  const evidenceNotice = reference.newerRecap
    ? `A newer recap is available. This pilot still reflects Session ${number}.` : '';
  // Headings remain in a bounded Ask context even if a long entry is excerpted.
  const briefingStatus = reference.newerRecap ? ' · A newer recap is available.'
    : snapshotMismatch ? ' · The snapshot and reminder checkpoints differ.' : '';
  const docs: SearchDoc[] = [{
    title: 'Before the next session', kind: 'Page',
    sub: `Reminders checked through Session ${number}${briefingStatus}`,
    href: '/briefing/',
    text: [`Selected reminders checked through Session ${number}.`, briefingNotice,
      ...reference.briefing.map(item => `${item.title}. ${item.text}`)].filter(Boolean).join(' '),
  }];
  for (const claim of reference.evidence) {
    docs.push({ title: claim.title, kind: 'Evidence',
      sub: `${claim.basis} · checked through Session ${number}${reference.newerRecap ? ' · A newer recap is available.' : ''}`,
      href: `/evidence/#${claim.id}`,
      text: [`A curated pilot checked through Session ${number}.`, evidenceNotice,
        'This is a selection of consequential claims, not a complete record of anyone’s knowledge. An omitted claim does not prove that character is ignorant.',
        `Basis: ${claim.basis}.`, claim.statement, claim.witnessNote, claim.limits,
        `Explicitly recorded for ${claim.witnesses?.map(character => character.name).join(', ') || 'no individually identified witnesses'}.`,
        ...claim.tellings.map(telling => `Session ${telling.citation.sessionNumber}: ${telling.recipients.map(character => character.name).join(', ')}. ${telling.note}`)]
        .filter(Boolean).join(' '),
    });
  }
  return docs;
}
