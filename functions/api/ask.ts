// POST /api/ask — "Ask the Chronicle".
//
// A Cloudflare Pages Function. It retrieves the handful of published entries
// that bear on a question, hands only those to Llama 3.3 70B through the
// Workers AI binding, and returns the answer with the entries it drew from.
//
// Three things shape this file, all of them measured rather than assumed
// (see docs/ROADMAP.md for the probe results):
//
//  - The model's context window is 24,000 tokens and Cloudflare counts
//    `max_tokens` against it: exceed the sum and the call fails 413/5021.
//    The whole campaign is ~27,600 real tokens, so it does NOT fit; retrieval
//    is what makes this work at all, not an optimisation.
//  - Retrieval also makes it cheap. Observed cost is ~124 Neurons per
//    question at these prompt sizes, so the free 10,000/day is ~80 questions.
//  - There is no API key anywhere here. The binding is the credential, so
//    there is nothing to leak and nothing to rotate.
//
// Spoiler-safety is inherited, not re-implemented: the model can only ever see
// documents that /search-index.json was allowed to contain, and that index is
// built from published entries only (src/lib/search-index.ts).

import { contentTokens, index, pickAny } from '../../src/lib/search-rank';
import type { Indexed, SearchDoc } from '../../src/lib/search-rank';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Measured ceiling for MODEL: input + max_tokens must stay under this. */
const CONTEXT_LIMIT = 24_000;
const MAX_OUTPUT = 400;
/** Room for the system rules, the question, and estimate drift. */
const SAFETY_MARGIN = 1_500;
/**
 * What we will actually spend on retrieved entries. Five typical entries run
 * ~5,000 tokens, so 12,000 is roomy; the ceiling is what keeps us legal if
 * MAX_OUTPUT or the budget is ever raised without re-checking the arithmetic.
 */
const CONTEXT_BUDGET = Math.min(12_000, CONTEXT_LIMIT - MAX_OUTPUT - SAFETY_MARGIN);

const MAX_QUESTION_CHARS = 400;
const MAX_ENTRIES = 5;
/** Below this the best match is noise; answer without spending a call. */
const MIN_RELEVANCE = 12;

const NOT_RECORDED = 'The chronicle does not record that.';

/**
 * Token estimate, calibrated against what Cloudflare actually counted during
 * the probe (it read ~28,900 tokens where chars/3.6 predicted 32,000).
 * Deliberately used only to stay inside a budget with room to spare.
 */
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const SYSTEM_RULES = [
  'You are the chronicler of a Dungeons & Dragons campaign website.',
  'Answer using ONLY the chronicle entries given below.',
  'Never invent names, events, places, or details, and never use knowledge of the',
  'published Dragon of Icespire Peak module — if it is not in the entries, it has',
  'not happened to this party yet and must not be mentioned.',
  `If the entries do not answer the question, reply exactly: "${NOT_RECORDED}"`,
  'Never speculate about what will happen next or what the party has not found.',
  'Be concise: three sentences at most, in the past tense, no headings or lists.',
].join(' ');

interface AiBinding {
  run(
    model: string,
    input: { messages: { role: string; content: string }[]; max_tokens?: number }
  ): Promise<{ response?: string; usage?: Record<string, unknown> }>;
}

interface Env {
  AI?: AiBinding;
}

interface FunctionContext {
  request: Request;
  env: Env;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

// Kept warm across requests on the same isolate; the index only changes on a
// deploy, which starts a new one.
let cachedIndex: Indexed[] | null = null;

async function loadIndex(request: Request): Promise<Indexed[]> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch(new URL('/search-index.json', request.url).toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`index fetch failed: ${res.status}`);
  cachedIndex = index((await res.json()) as SearchDoc[]);
  return cachedIndex;
}

/**
 * The retrieved entries, formatted for the model and trimmed to the budget.
 * Entries are added whole while they fit — a half-truncated recap invites the
 * model to guess at the rest, which is the one thing it must not do.
 */
function buildContext(hits: { doc: Indexed }[]) {
  const used: Indexed[] = [];
  let spent = 0;

  for (const { doc } of hits) {
    const block = `## ${doc.title} (${doc.kind})\n${doc.text}`;
    const cost = estimateTokens(block);
    if (spent + cost > CONTEXT_BUDGET) {
      if (used.length > 0) break;
      // A single entry larger than the whole budget: take the opening, which
      // is where a recap's summary sits.
      used.push({ ...doc, text: doc.text.slice(0, CONTEXT_BUDGET * 4) });
      spent = CONTEXT_BUDGET;
      break;
    }
    used.push(doc);
    spent += cost;
  }

  const text = used.map((d) => `## ${d.title} (${d.kind})\n${d.text}`).join('\n\n');
  return { text, used, tokens: spent };
}

export const onRequestPost = async (context: FunctionContext): Promise<Response> => {
  const { request, env } = context;

  // Same-origin only. Not a security boundary on its own — it just keeps the
  // endpoint from being trivially embedded in someone else's page.
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'Cross-origin requests are not accepted.' }, 403);
  }

  if (!env.AI) {
    return json(
      { error: 'The chronicler is not configured on this deployment.' },
      503
    );
  }

  let question = '';
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === 'string' ? body.question.trim() : '';
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  if (question.length === 0) return json({ error: 'Ask something first.' }, 400);
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ error: `Keep it under ${MAX_QUESTION_CHARS} characters.` }, 400);
  }

  let docs: Indexed[];
  try {
    docs = await loadIndex(request);
  } catch {
    return json({ error: 'The chronicle could not be read just now.' }, 502);
  }

  const hits = pickAny(docs, contentTokens(question), MAX_ENTRIES, MIN_RELEVANCE);

  // Nothing relevant: say so rather than asking a model to confirm it. Honest,
  // instant, and it spends no Neurons on questions the chronicle can't answer.
  if (hits.length === 0) {
    return json({ answer: NOT_RECORDED, sources: [], consulted: 0 });
  }

  const { text, used, tokens } = buildContext(hits);

  let answer: string;
  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: `${SYSTEM_RULES}\n\nCHRONICLE ENTRIES:\n\n${text}` },
        { role: 'user', content: question },
      ],
      max_tokens: MAX_OUTPUT,
    });
    answer = (result.response ?? '').trim();
  } catch {
    // Out of Neurons for the day, or the model is briefly unavailable. The
    // reader still has search, so point them at it rather than at an error.
    return json(
      { error: 'The chronicler is resting. Search still works — try the results above.' },
      503
    );
  }

  if (!answer) {
    return json({ error: 'The chronicler had nothing to say. Try rephrasing.' }, 502);
  }

  return json({
    answer,
    // Only the entries the model actually read, so a citation can't point at
    // something it never saw.
    sources: used.map((d) => ({ title: d.title, kind: d.kind, href: d.href })),
    consulted: used.length,
    contextTokens: tokens,
  });
};

// A bare GET is a person poking the URL, not the site calling it.
export const onRequestGet = (): Response =>
  json({ error: 'POST a JSON body of {"question": "..."} to ask.' }, 405);
