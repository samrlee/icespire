import { recapScenes } from './recap-scenes.ts';
import { isSessionPublished } from './session-publication.ts';

export type CatchUpSession = {
  id: string;
  body?: string;
  data: { sessionNumber: number; title: string; date: Date; summary?: string; draft?: boolean };
};

/** Only recaps supply this view; profiles, journeys and current state are excluded. */
export function catchUpThrough(sessions: readonly CatchUpSession[], throughId?: string) {
  const published = sessions.filter(isSessionPublished).sort((a, b) => a.data.sessionNumber - b.data.sessionNumber);
  const through = throughId === undefined ? published[0] : published.find(session => session.id === throughId);
  if (throughId !== undefined && !through) throw new Error(`Catch-up cutoff must be a published recap: ${throughId}`);
  // Options intentionally omit later recap titles and summaries: even labels can spoil.
  const choices = published.map(session => ({ id: session.id, number: session.data.sessionNumber, date: session.data.date }));
  const entries = through ? published.filter(session => session.data.sessionNumber <= through.data.sessionNumber).map(session => ({
    id: session.id, number: session.data.sessionNumber, title: session.data.title, summary: session.data.summary,
    date: session.data.date, scenes: recapScenes(session.body ?? ''),
  })) : [];
  return { through: through ? { id: through.id, number: through.data.sessionNumber } : undefined, choices, entries };
}
