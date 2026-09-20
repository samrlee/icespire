import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/ask.ts';
import { corpusVersion } from '../src/lib/ask-safety.ts';

test('Ask uses published scene records as sources and preserves evidence distinctions', async t => {
  const evidence = 'The dragon payment was discussed. Thornton reported the dragon had left. They agreed fifty gold for the dragon news, but no payment was made. Only Bean heard the dragon report.';
  const docs = [
    { title: 'Dragon recap', kind: 'Recap', href: '/sessions/example/', text: evidence },
    { title: 'Dragon recap — Part 1', kind: 'Recap part', href: '/sessions/example/#scene-fixed', text: evidence },
  ];
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  let calls = 0;
  const response = await onRequestPost({
    request: new Request('https://chronicle.example/api/ask', { method: 'POST', body: JSON.stringify({ question: 'dragon payment' }) }),
    env: { AI: { async run(_model, input) {
      calls++;
      assert.ok(input.messages[0].content.includes(evidence));
      assert.match(input.messages[0].content, /name the speaker for reports/);
      assert.match(input.messages[0].content, /not a completed action or payment/);
      assert.match(input.messages[0].content, /knowledge is not recorded/);
      return { response: 'The payment was agreed but not made.' };
    } } },
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(data.sources, [{ title: docs[1].title, kind: 'Recap part', href: docs[1].href }]);
  assert.equal(data.corpusVersion, await corpusVersion(docs));
});
