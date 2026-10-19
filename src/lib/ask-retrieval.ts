import { contentTokens, pickAny } from './search-rank.ts';
import type { Hit, Indexed } from './search-rank.ts';

export type AskHit = Hit & { overview?: boolean };

const parentHref = (doc: Indexed) => doc.href.split('#')[0];
const sessionNumber = (doc: Indexed) => doc.sessionNumber ?? Number(doc.sub?.match(/^Session (\d+)\b/)?.[1] ?? NaN);
const overview = (doc: Indexed): AskHit => ({ doc: { ...doc, text: doc.summary || doc.text,
  textLc: (doc.summary || doc.text).toLowerCase() }, score: 40, at: -1, overview: true });
const exactTerm = (text: string, term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text.toLowerCase());
};

/** Rank only the already published index. Intent changes selection, never gates. */
export function retrieveAsk(docs: Indexed[], question: string, maximum = 5): { hits: AskHit[]; terms: string[] } {
  let terms = contentTokens(question, false);
  if (maximum <= 0) return { hits: [], terms };

  // Bare present-tense questions have no keywords after stop-word removal.
  // Keep them narrow: a named session or historical qualifier needs historical
  // evidence, even when the reader also writes "now" or "left off".
  const currentLocation = /\bcurrent\s+(?:party\s+)?(?:location|position|state)\b/i.test(question);
  const historicalLocation = (/\bwhere\b/i.test(question) || currentLocation) && /\bsession\s+\d+\b|\b(?:before|after|during|when|previously|earlier|yesterday|ago|then)\b|\blast\s+(?:session|time|week|month|night)\b/i.test(question);
  const bareLocation = /^\s*(?:please\s+)?where\s+(?:are\s+we|is\s+the\s+party)(?:\s+at)?\s*[?!.]*\s*$/i.test(question);
  // A time/location question needs the explicitly sourced continuation point,
  // rather than whichever old recap happens to contain the word "now".
  if (!historicalLocation && (bareLocation || currentLocation || /\bwhere\b.*\b(?:we|party)\b.*\b(?:now|currently)\b|\bwhere\b.*\b(?:left|leave)\s+off\b/i.test(question))) {
    const state = docs.find(doc => doc.currentState === true || doc.href.endsWith('/campaign/#where-we-left-off'));
    return { hits: state ? [{ doc: state, score: 40, at: -1 }] : [], terms };
  }

  const recaps = docs.filter(doc => doc.kind === 'Recap');
  const numbered = question.match(/\bsession\s+(\d+)\b/i);
  let scoped: Indexed | undefined;
  if (numbered) {
    scoped = recaps.find(doc => sessionNumber(doc) === Number(numbered[1]));
    // An unavailable session is not permission to substitute another session.
    if (!scoped) return { hits: [], terms };
    let scopedQuestion = question.replace(numbered[0], '');
    // These phrases ask for the recap's continuation point, not prose containing
    // the words "current location" or "leave off". Preserve named detail terms.
    if (historicalLocation) scopedQuestion = scopedQuestion.replace(/\bcurrent\s+(?:party\s+)?(?:location|position|state)\b|\b(?:left|leave)\s+off\b/gi, '');
    terms = contentTokens(scopedQuestion, false);
    const details = terms.filter(term => !['summary', 'summarize', 'recap', 'overview', 'played', 'play',
      'describe', 'during', 'date', 'day', 'time', 'title', 'name', 'events', 'main', 'key', 'occurred', "what's"].includes(term));
    if (!details.length) {
      return { hits: [overview(scoped)], terms };
    }
  } else {
    const named = recaps.find(doc => question.toLowerCase().includes(doc.title.toLowerCase()));
    if (named) {
      scoped = named;
      const offset = question.toLowerCase().indexOf(named.title.toLowerCase());
      terms = contentTokens(question.slice(0, offset) + question.slice(offset + named.title.length), false);
      if (!terms.length) return { hits: [overview(named)], terms };
    } else {
      // Two distinctive title terms can identify a recap, but each scene must
      // still earn its rank from its own prose instead of a duplicated title.
      const titleMatches = recaps.filter(doc => terms.length >= 2 && terms.every(term => exactTerm(doc.title, term)));
      if (titleMatches.length === 1) scoped = titleMatches[0];
    }
  }

  const partParents = new Set(docs.filter(doc => doc.kind === 'Recap part').map(parentHref));
  const eligible = docs.filter(doc => (!scoped || parentHref(doc) === scoped.href)
    && (!historicalLocation || !(doc.currentState === true || doc.href.endsWith('/campaign/#where-we-left-off')))
    && (doc.kind !== 'Recap' || !partParents.has(doc.href)));
  const rankedDocs = eligible.map(doc => doc.kind === 'Recap part'
    ? { ...doc, titleLc: (doc.sceneLabel ?? doc.title.split(' — ').at(-1) ?? '').toLowerCase() }
    : doc);
  // Four is one complete-word occurrence in prose. The old floor of twelve
  // excluded every one-keyword body match, even an explicitly recorded fact.
  const evidence = rankedDocs.filter(doc => terms.some(term =>
    exactTerm(doc.titleLc, term) || exactTerm(doc.subLc, term) || exactTerm(doc.textLc, term)));
  const ranked = pickAny(evidence, terms, maximum, 4);
  const original = new Map(eligible.map(doc => [doc.href, doc]));
  const primary = ranked.map(hit => ({ ...hit, doc: original.get(hit.doc.href)! }));
  const selected = primary.slice(0, Math.min(2, maximum));
  const seen = new Set(selected.map(hit => hit.doc.href));
  const append = (doc: Indexed, score: number) => {
    if (selected.length < maximum && !seen.has(doc.href)) {
      selected.push({ doc, score, at: -1 }); seen.add(doc.href);
    }
  };
  for (const hit of [...selected]) {
    if (hit.doc.kind !== 'Recap part') continue;
    const siblings = eligible.filter(doc => doc.kind === 'Recap part' && parentHref(doc) === parentHref(hit.doc));
    const position = siblings.findIndex(doc => doc.href === hit.doc.href);
    // A scene beginning "the others" or "a second bag" depends on what came
    // immediately before it. Keep that evidence and its own stable source link.
    if (position > 0) append(siblings[position - 1], hit.score);
    if (position + 1 < siblings.length) append(siblings[position + 1], hit.score);
  }
  for (const hit of primary) append(hit.doc, hit.score);
  return { hits: selected, terms };
}
