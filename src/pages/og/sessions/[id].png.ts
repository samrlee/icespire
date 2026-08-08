import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard } from '../../../lib/og';

// One social-preview PNG per session, generated at build time as
// /og/sessions/<id>.png. The session page points its og:image here so a shared
// recap link carries that session's own title (see src/pages/sessions/[id].astro).
export async function getStaticPaths() {
  const sessions = await getCollection('sessions');
  return sessions.map((session) => ({ params: { id: session.id }, props: { session } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { session } = props as { session: Awaited<ReturnType<typeof getCollection<'sessions'>>>[number] };
  const date = session.data.date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const png = await renderOgCard({
    kicker: `Session ${session.data.sessionNumber}`,
    title: session.data.title,
    subtitle: date,
  });
  // Wrap in a plain Uint8Array: a Node Buffer's ArrayBufferLike type isn't a
  // valid Response BodyInit, but the underlying bytes are identical.
  //
  // In a static build these headers never reach a client — the body is written
  // to dist/og/sessions/<id>.png and the response is discarded. Cache policy for
  // this path lives in public/_headers, where Cloudflare Pages will read it.
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
