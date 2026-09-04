import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../lib/search-index';

// The search index, emitted as one static JSON file at /search-index.json.
// The palette fetches it the first time someone opens search, not on page
// load — it is the only weight search adds, and most visits never pay it.
export const GET: APIRoute = async () => {
  const docs = await buildSearchIndex();
  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
