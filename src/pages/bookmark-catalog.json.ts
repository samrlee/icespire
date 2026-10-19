import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildBookmarkCatalog } from '../lib/bookmark-catalog';
import { url } from '../utils/url';

export const GET: APIRoute = async () => new Response(JSON.stringify(
  buildBookmarkCatalog(await getCollection('sessions'), url('/'))
), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
