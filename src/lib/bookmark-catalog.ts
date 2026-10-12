import { createHash } from 'node:crypto';
import { recapScenes } from './recap-scenes.ts';
import { isSessionPublished } from './session-publication.ts';
import type { BookmarkCatalog } from './bookmarks';

type Session = { id: string; data: { draft?: boolean; sessionNumber: number; title: string }; body?: string };

/** The same parsed publication gate used by recap routes applies to every scene. */
export function buildBookmarkCatalog(sessions: Session[], base = '/'): BookmarkCatalog {
  return {
    version: 1,
    scenes: sessions.filter(isSessionPublished).sort((a, b) => b.data.sessionNumber - a.data.sessionNumber).flatMap(session =>
      recapScenes(session.body ?? '').map(scene => ({
        sessionId: session.id, sceneId: scene.id, sessionNumber: session.data.sessionNumber,
        sessionTitle: session.data.title, sceneLabel: scene.label,
        href: `${base}sessions/${session.id}/#${scene.id}`,
        fingerprint: createHash('sha256').update(JSON.stringify([scene.label, scene.body])).digest('hex'),
      }))
    ),
  };
}
