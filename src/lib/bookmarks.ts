/** Private browser records contain no navigation URLs. Publication is checked separately. */
export const BOOKMARK_STORAGE_KEY = 'icespire-bookmarks-v1';
export const MAX_BOOKMARKS = 50;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_BOOKMARK_BYTES = 256 * 1024;

export type Bookmark = {
  sessionId: string;
  sceneId: string;
  fingerprint: string;
  sessionNumber: number;
  sessionTitle: string;
  sceneLabel: string;
  note: string;
  updatedAt: string;
};
export type BookmarkScene = Omit<Bookmark, 'note' | 'updatedAt'> & { href: string };
export type BookmarkCatalog = { version: 1; scenes: BookmarkScene[] };
export type BookmarkRead = { state: 'ready'; bookmarks: Bookmark[] } | { state: 'invalid' | 'blocked'; bookmarks: []; message: string };

const sessionPattern = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;
const scenePattern = /^scene-[a-z][a-z0-9-]*$/;
const fingerprintPattern = /^[a-f0-9]{64}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const shortText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const identity = (value: Record<string, unknown>) => shortText(value.sessionId, 160) && sessionPattern.test(value.sessionId)
  && shortText(value.sceneId, 128) && scenePattern.test(value.sceneId)
  && typeof value.fingerprint === 'string' && fingerprintPattern.test(value.fingerprint)
  && Number.isInteger(value.sessionNumber) && (value.sessionNumber as number) >= 0 && (value.sessionNumber as number) <= 100000
  && shortText(value.sessionTitle, 300) && shortText(value.sceneLabel, 200);

export const bookmarkId = (value: Pick<Bookmark, 'sessionId' | 'sceneId'>) => `${value.sessionId}::${value.sceneId}`;

export function parseBookmarks(raw: string | null): Bookmark[] {
  if (raw === null) return [];
  if (new TextEncoder().encode(raw).byteLength > MAX_BOOKMARK_BYTES) throw new Error('Saved bookmark data is too large.');
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Array.isArray(value.bookmarks) || value.bookmarks.length > MAX_BOOKMARKS) throw new Error('Invalid bookmark data.');
  const seen = new Set<string>();
  return value.bookmarks.map((record: unknown) => {
    if (!object(record) || !identity(record) || typeof record.note !== 'string' || record.note.length > MAX_NOTE_LENGTH
      || typeof record.updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.updatedAt)
      || !Number.isFinite(Date.parse(record.updatedAt))) throw new Error('Invalid bookmark record.');
    const entry: Bookmark = {
      sessionId: record.sessionId as string, sceneId: record.sceneId as string, fingerprint: record.fingerprint as string,
      sessionNumber: record.sessionNumber as number, sessionTitle: record.sessionTitle as string, sceneLabel: record.sceneLabel as string,
      note: record.note, updatedAt: record.updatedAt,
    };
    if (seen.has(bookmarkId(entry))) throw new Error('Duplicate bookmark record.');
    seen.add(bookmarkId(entry));
    return entry;
  });
}

export function readBookmarks(storage: Pick<Storage, 'getItem'>): BookmarkRead {
  let raw: string | null;
  try { raw = storage.getItem(BOOKMARK_STORAGE_KEY); }
  catch { return { state: 'blocked', bookmarks: [], message: 'This browser prevents access to saved bookmarks. Nothing has been changed.' }; }
  try { return { state: 'ready', bookmarks: parseBookmarks(raw) }; }
  catch { return { state: 'invalid', bookmarks: [], message: 'Saved bookmark data cannot be read. It has not been changed. Forget all bookmarks to reset it.' }; }
}

export function writeBookmarks(storage: Pick<Storage, 'setItem' | 'removeItem'>, bookmarks: Bookmark[]): void {
  const raw = JSON.stringify({ version: 1, bookmarks });
  // Validate both browser limits and the shape before touching storage.
  parseBookmarks(raw);
  if (bookmarks.length) storage.setItem(BOOKMARK_STORAGE_KEY, raw);
  else storage.removeItem(BOOKMARK_STORAGE_KEY);
}

/** The current catalog must supply a matching local recap/fragment URL. */
export function parseBookmarkCatalog(value: unknown, base = '/'): BookmarkCatalog {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.scenes) || value.scenes.length > 5000) throw new Error('Invalid bookmark catalog.');
  if (!base.startsWith('/') || base.startsWith('//') || !base.endsWith('/') || /[?#\\]/.test(base)) throw new Error('Invalid site base.');
  const seen = new Set<string>();
  const scenes = value.scenes.map((record: unknown): BookmarkScene => {
    if (!object(record) || !identity(record)) throw new Error('Invalid recap part.');
    const expected = `${base}sessions/${record.sessionId}/#${record.sceneId}`;
    if (record.href !== expected) throw new Error('Unsafe recap URL.');
    const entry: BookmarkScene = {
      sessionId: record.sessionId as string, sceneId: record.sceneId as string, fingerprint: record.fingerprint as string,
      sessionNumber: record.sessionNumber as number, sessionTitle: record.sessionTitle as string, sceneLabel: record.sceneLabel as string,
      href: expected,
    };
    if (seen.has(bookmarkId(entry))) throw new Error('Duplicate catalog part.');
    seen.add(bookmarkId(entry));
    return entry;
  });
  return { version: 1, scenes };
}
