// Ranking shared by the ⌘K palette (scripts/search.ts, in the browser) and
// the Ask endpoint (functions/api/ask.ts, on Cloudflare). Pure functions over
// plain data — no DOM, no Astro, no Cloudflare — so both can import it.
//
// The two callers want different strictness, which is the reason this file
// exists rather than one shared `search()`:
//
//   pickAll  — the palette. Every term must land somewhere, so typing
//              "dax mine" narrows to entries with both.
//   pickAny  — the endpoint. A question is mostly filler ("what did the party
//              find in the temple?"), so demanding every word matches would
//              return nothing for almost every question ever asked.

export type SearchDoc = {
  title: string;
  kind: string;
  sub?: string;
  href: string;
  text: string;
};

/** A doc plus the lowercased copies we match against, folded once at load. */
export type Indexed = SearchDoc & {
  titleLc: string;
  subLc: string;
  textLc: string;
};

export type Hit = {
  doc: Indexed;
  score: number;
  /** Where in the body text the best match landed, for the snippet. */
  at: number;
};

export function index(docs: SearchDoc[]): Indexed[] {
  return docs.map((d) => ({
    ...d,
    titleLc: d.title.toLowerCase(),
    subLc: (d.sub ?? '').toLowerCase(),
    textLc: d.text.toLowerCase(),
  }));
}

/** Query text to the distinct lowercase terms worth matching on. */
export function tokenize(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean))];
}

// Question scaffolding. These carry no signal about *which* entry is wanted,
// and left in they drag in every document that happens to contain "party".
const STOP = new Set([
  'a', 'about', 'after', 'all', 'am', 'an', 'and', 'any', 'anyone', 'are', 'as', 'at',
  'be', 'been', 'before', 'but', 'by', 'can', 'did', 'do', 'does', 'for', 'from', 'get',
  'give', 'had', 'happen', 'happened', 'has', 'have', 'he', 'her', 'him', 'his', 'how',
  'i', 'if', 'in', 'inside', 'into', 'is', 'it', 'its', 'know', 'me', 'much', 'my',
  'of', 'on', 'one', 'or', 'our', 'out', 'over', 'party', 'please', 'said', 'say', 'she',
  'so', 'some', 'tell', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'thing', 'things', 'this', 'to', 'told', 'up', 'us', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'your',
]);

/** Tokens with the question scaffolding removed; falls back if nothing is left. */
export function contentTokens(query: string): string[] {
  const all = tokenize(query);
  const kept = all.filter((t) => t.length > 2 && !STOP.has(t));
  return kept.length > 0 ? kept : all;
}

/**
 * Where `needle` sits in `haystack`, how often, and whether any occurrence
 * starts a word — a match on "Dax" should beat one buried inside "Daxholm".
 */
export function matchIn(haystack: string, needle: string) {
  let idx = haystack.indexOf(needle);
  let count = 0;
  let first = -1;
  let boundary = false;
  while (idx !== -1 && count < 20) {
    count++;
    const starts = idx === 0 || !/[\p{L}\p{N}]/u.test(haystack[idx - 1]);
    if (first === -1 || (starts && !boundary)) {
      first = idx;
      boundary = boundary || starts;
    }
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return { count, first, boundary };
}

/**
 * What one term is worth against one document. Weights just say where a hit
 * counts most: a name beats a subtitle, which beats a mention buried in prose.
 */
function scoreTerm(doc: Indexed, token: string) {
  const title = matchIn(doc.titleLc, token);
  const subtitle = matchIn(doc.subLc, token);
  const body = matchIn(doc.textLc, token);
  let score = 0;

  if (doc.titleLc === token) score += 40;
  else if (title.count > 0) score += title.boundary ? 16 : 7;
  if (subtitle.count > 0) score += subtitle.boundary ? 4 : 2;
  if (body.count > 0) score += (body.boundary ? 3 : 1) + Math.min(body.count, 4);

  return { score, at: body.count > 0 ? body.first : -1 };
}

const byScore = (a: Hit, b: Hit) =>
  b.score - a.score || a.doc.title.localeCompare(b.doc.title);

/** Entries matching EVERY term. The palette's behaviour. */
export function pickAll(docs: Indexed[], tokens: string[], max: number): Hit[] {
  const hits: Hit[] = [];

  for (const doc of docs) {
    let score = 0;
    let at = -1;
    let matchedAll = true;

    for (const token of tokens) {
      const term = scoreTerm(doc, token);
      if (term.score === 0) {
        matchedAll = false;
        break;
      }
      if (at === -1) at = term.at;
      score += term.score;
    }

    if (matchedAll) hits.push({ doc, score, at });
  }

  return hits.sort(byScore).slice(0, max);
}

/**
 * Entries matching ANY term, best first. Used to gather reading material for
 * a question, so `minScore` matters: below it we have nothing worth showing a
 * model, and answering "the chronicle doesn't record that" straight away is
 * both more honest and free.
 */
export function pickAny(
  docs: Indexed[],
  tokens: string[],
  max: number,
  minScore = 0
): Hit[] {
  const hits: Hit[] = [];

  for (const doc of docs) {
    let score = 0;
    let at = -1;
    let matched = 0;

    for (const token of tokens) {
      const term = scoreTerm(doc, token);
      if (term.score === 0) continue;
      matched++;
      if (at === -1) at = term.at;
      score += term.score;
    }

    // Matching more of the question beats matching one word very often.
    if (matched > 0) hits.push({ doc, score: score * (1 + (matched - 1) * 0.5), at });
  }

  return hits.filter((h) => h.score >= minScore).sort(byScore).slice(0, max);
}
