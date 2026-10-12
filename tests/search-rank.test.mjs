import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  foldSearchText, foldSearchTextWithOffsets, index, pickAll, pickAny,
  searchMatchSpans, tokenize,
} from '../src/lib/search-rank.ts';

test('composed, combining, unaccented and uppercase names share tokens and ranking', () => {
  const variants = ['Facktoré', 'Facktore', 'FACKTORE', 'Facktore\u0301'];
  assert.deepEqual(tokenize(variants.join(' ')), ['facktore']);
  const docs = index([
    { title: 'Facktoré', kind: 'NPC', href: '/npcs/facktore/', text: 'She left the workshop.' },
    { title: 'The workshop', kind: 'Recap', href: '/sessions/workshop/', text: 'Facktore\u0301 built a machine.' },
    { title: 'Norbus', kind: 'NPC', href: '/npcs/norbus/', text: 'He returned to the inn.' },
  ]);
  for (const variant of variants) {
    for (const pick of [pickAll, pickAny]) {
      const hits = pick(docs, tokenize(variant), 5);
      assert.deepEqual(hits.map(hit => hit.doc.href), ['/npcs/facktore/', '/sessions/workshop/']);
      assert.deepEqual(hits.map(hit => hit.score), [40, 4]);
    }
  }
  // Public callers supplying raw terms get the same normalization as tokenize.
  assert.equal(pickAny(docs, ['FACKTORÉ'], 1)[0].doc.href, '/npcs/facktore/');
});

test('body hits keep their original offset after removed accents and lowercase expansion', () => {
  const prefix = 'İe\u0301 '.repeat(130);
  const text = prefix + 'Sage spoke with Facktore\u0301.';
  const docs = index([{ title: 'Facktoré', kind: 'NPC', href: '/npcs/facktore/', text }]);
  const hit = pickAll(docs, tokenize('Facktore Sage'), 1)[0];
  assert.equal(hit.at, text.indexOf('Facktore'));
  assert.equal(pickAny(docs, tokenize('Sage'), 1)[0].at, text.indexOf('Sage'));
  assert.equal(docs[0].textLc.indexOf('sage'), prefix.length - 130);
  assert.deepEqual(searchMatchSpans(text, ['sage', 'facktore']).map(([start, end]) => text.slice(start, end)),
    ['Sage', 'Facktore\u0301']);
});

test('highlight ranges preserve original graphemes, astral prefixes and following text', () => {
  const text = '🧙 İNDİGO met Facktoré, Facktore\u0301 and café\u0301.';
  const spans = searchMatchSpans(text, tokenize('indigo facktore cafe'));
  assert.deepEqual(spans.map(([start, end]) => text.slice(start, end)),
    ['İNDİGO', 'Facktoré', 'Facktore\u0301', 'café\u0301']);
  assert.equal(spans[0][0], text.indexOf('İNDİGO'));
  assert.equal(spans[0][1], text.indexOf(' met'));
  assert.deepEqual(searchMatchSpans(text, ['sage', '\u0301', '']), []);
  assert.deepEqual(searchMatchSpans('Facktoré', ['facktore', 'fack', 'FACKTORÉ']), [[0, 8]]);
});

test('folded offsets cover Unicode decomposition and context-dependent casing', () => {
  const cases = ['Facktore\u0301', 'İstanbul', 'AΣ', '🧙 Sage', '\uac00 cafe\u0301', '\u0301a',
    'A\u0301B\u0308 C', '\r\nx\u0301\r\nY', '1️⃣a', 'a\u200Db\u200Dc', '\u0600A B', 'क्a', '🧙‍♀️ Sage', 'a\r\n\u0301b', 'a\r\nb'];
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const text of cases) {
    const folded = foldSearchTextWithOffsets(text);
    assert.equal(folded.text, foldSearchText(text));
    assert.equal(folded.starts.length, folded.text.length);
    assert.equal(folded.ends.length, folded.text.length);
    for (let i = 0; i < folded.text.length; i++) {
      assert.ok(folded.starts[i] >= 0 && folded.starts[i] < folded.ends[i]);
      assert.ok(folded.ends[i] <= text.length);
    }
    const originalRanges = [...graphemes.segment(text)].flatMap(({ segment, index }) =>
      Array.from({ length: foldSearchText(segment).length }, () => [index, index + segment.length]));
    assert.deepEqual(folded.starts.map((start, i) => [start, folded.ends[i]]), originalRanges);
  }
  assert.deepEqual(searchMatchSpans('AΣ', ['aς']), [[0, 2]]);
});

test('unaccented ranking and word-start preference remain unchanged', () => {
  const docs = index([
    { title: 'Dax', kind: 'Party', href: '/characters/dax/', text: 'Dax visited the mine.' },
    { title: 'A tale', kind: 'Recap', href: '/sessions/tale/', text: 'Adax saw Dax at the mine.' },
    { title: 'The mine', kind: 'Place', href: '/map/#mine', text: 'A quiet site.' },
  ]);
  assert.deepEqual(pickAll(docs, tokenize('dax mine'), 5).map(hit => [hit.doc.href, hit.score, hit.at]),
    [['/characters/dax/', 48, 0], ['/sessions/tale/', 9, 9]]);
  assert.deepEqual(pickAny(docs, tokenize('dax mine'), 5).map(hit => [hit.doc.href, hit.score]),
    [['/characters/dax/', 72], ['/map/#mine', 16], ['/sessions/tale/', 13.5]]);
});
