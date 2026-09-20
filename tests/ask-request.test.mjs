import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from '../functions/api/ask.ts';
import { MAX_ASK_BODY_BYTES } from '../src/lib/ask-request.ts';

const site = 'https://chronicle.example';
function request(body = '{"question":"dragon"}', headers = {}) {
  return new Request(site + '/api/ask', { method: 'POST', body, headers, duplex: 'half' });
}
async function reject(t, req, status) {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Rejected input fetched the index'); });
  const res = await onRequestPost({ request: req, env: { AI: { run: () => assert.fail('Rejected input called AI') } } });
  assert.equal(res.status, status);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(res.headers.get('Content-Type'), /application\/json/);
  assert.equal(typeof (await res.json()).error, 'string');
}

test('invalid, opaque, cross-origin and non-origin URL headers return 403', async t => {
  for (const origin of ['null', '', 'garbage', 'https://elsewhere.example', 'http://chronicle.example', site + ':444', site + '/path', site + '/', 'https://user@chronicle.example', site + ' https://elsewhere.example']) {
    await reject(t, request(undefined, { Origin: origin }), 403);
  }
});

test('invalid JSON and body shapes return controlled 400 responses', async t => {
  for (const body of ['{', '', 'null', '[]', '42', '"dragon"', '{}', '{"question":4}', '{"question":"   "}', JSON.stringify({ question: 'x'.repeat(401) })]) {
    await reject(t, request(body), 400);
  }
});

test('oversized Content-Length is rejected without reading the stream', async t => {
  let cancelled = false;
  const body = new ReadableStream({ pull() { assert.fail('Must reject before reading'); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  await reject(t, request(body, { 'Content-Length': String(MAX_ASK_BODY_BYTES + 1) }), 413);
  assert.equal(cancelled, true);
});

test('actual streamed bytes are bounded with missing or misleading Content-Length', async t => {
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024).fill(32)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    await reject(t, request(body, headers), 413);
    assert.equal(pulls, 5);
    assert.equal(cancelled, true);
  }
});

test('byte limit counts UTF-8 bytes rather than JavaScript characters', async t => {
  const body = JSON.stringify({ question: 'dragon', padding: '雪'.repeat(1400) });
  assert.ok(body.length < MAX_ASK_BODY_BYTES);
  await reject(t, request(body), 413);
});

test('stream errors and invalid UTF-8 return 400', async t => {
  await reject(t, request(new ReadableStream({ start(c) { c.error(new Error('disconnected')); } })), 400);
  await reject(t, request(new Uint8Array([0xff])), 400);
});

test('valid origin or absent origin preserves bounded questions and model behavior', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([
    { title: 'Dragon', kind: 'Lore', href: '/lore/dragon/', text: 'Dragon dragon dragon.' },
  ])));
  const AI = { async run(_model, input) {
    calls++;
    assert.equal(input.messages.at(-1).content, 'dragon');
    assert.match(input.messages[0].content, /agreement or price is not a completed action or payment/);
    assert.match(input.messages[0].content, /Do not infer a character knew/);
    return { response: 'A recorded dragon.' };
  } };
  const small = JSON.stringify({ question: ' dragon ' });
  const exact = small + ' '.repeat(MAX_ASK_BODY_BYTES - new TextEncoder().encode(small).length);
  for (const headers of [{}, { Origin: site }]) {
    const res = await onRequestPost({ request: request(exact, headers), env: { AI } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).answer, 'A recorded dragon.');
  }
  assert.equal(calls, 2);
});
