// Limit bytes before JSON parsing, including bodies without Content-Length.
// 4 KiB accommodates 400 characters even when every UTF-16 unit is JSON-escaped.
export const MAX_ASK_BODY_BYTES = 4096;

export class AskBodyTooLarge extends Error {}

export function acceptsAskOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) return true; // Preserve non-browser clients.
  try {
    const parsed = new URL(origin);
    return origin === parsed.origin && parsed.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readAskBody(request: Request): Promise<unknown> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > MAX_ASK_BODY_BYTES) {
    void request.body?.cancel().catch(() => {});
    throw new AskBodyTooLarge();
  }
  if (!request.body) throw new SyntaxError('Missing body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_ASK_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new AskBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
