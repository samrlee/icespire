import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAskContext, relevantPassages, estimateTokens } from '../src/lib/ask-context.ts';
import { index } from '../src/lib/search-rank.ts';

const doc = (text, title = 'Session recap') => index([{ title, kind: 'Recap', href: '/sessions/test/', text }])[0];
const filler = Array.from({ length: 200 }, (_, i) => `They walked along the road past milestone ${i}. `).join('');

test('retrieves late evidence with attribution and consequences instead of the opening', () => {
  const source = doc(filler + 'Bean opened the ledger. Thornton owed fifty gold. Only Bean saw the debt. ');
  const result = buildAskContext([{ doc: source }], ['thornton', 'debt'], 1000);
  assert.match(result.text, /Thornton owed fifty gold/);
  assert.match(result.text, /Only Bean saw/);
  assert.match(result.text, /Bean opened/);
  assert.doesNotMatch(result.text, /milestone 0\./);
  assert.equal(result.used[0], source);
  assert.ok(result.tokens <= 1000);
});

test('keeps short entries whole', () => {
  const source = doc('Harbin agreed to pay. He had not paid.');
  assert.equal(relevantPassages(source, ['harbin']), source.text);
});

test('deduplicates overlapping windows and preserves original order', () => {
  const source = doc('Thornton made an offer. Bean declined. Thornton changed the terms. ' + filler + 'Thornton finally agreed. Bean left.');
  const result = relevantPassages(source, ['thornton'], 1500);
  assert.equal(result.split('Bean declined.').length - 1, 1);
  assert.ok(result.indexOf('made an offer') < result.indexOf('finally agreed'));
  assert.match(result, /\[…\]/);
});

test('skips an unfit entry and still admits a later short entry', () => {
  const enormous = doc('x'.repeat(20000), 'Oversized');
  const small = doc('Bean found the ledger.', 'Ledger');
  const result = buildAskContext([{ doc: enormous }, { doc: small }], ['ledger'], 100);
  assert.deepEqual(result.used, [small]);
  assert.ok(result.tokens <= 100);
});

test('accounts for headings and separators at tight budgets', () => {
  for (const budget of [0, 1, 20, 50, 100, 200]) {
    const result = buildAskContext([{ doc: doc('Bean read the ledger.') }, { doc: doc('Thom waited.') }], ['bean'], budget);
    assert.ok(estimateTokens(result.text) <= budget);
    assert.equal(result.tokens, estimateTokens(result.text));
  }
});

test('no supplied published evidence means no context or sources', () => {
  assert.deepEqual(buildAskContext([], ['axeholm'], 1000), { text: '', used: [], tokens: 0 });
  assert.equal(relevantPassages(doc(filler), ['axeholm'], 500), '');
});
