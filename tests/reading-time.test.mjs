import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingMinutes } from '../src/lib/reading-time.ts';

test('omit short recaps and round longer estimates upward at 200 words/minute', () => {
  assert.equal(readingMinutes(''), null);
  assert.equal(readingMinutes('word '.repeat(499)), null);
  assert.equal(readingMinutes('word '.repeat(500)), 3);
  assert.equal(readingMinutes('word '.repeat(600)), 3);
  assert.equal(readingMinutes('word '.repeat(601)), 4);
});

test('count visible prose instead of HTML attributes, comments, images or code', () => {
  const noise = 'ignore '.repeat(600);
  const html = `<p>${'word '.repeat(499)}</p><!-- ${noise} -->
  <img alt="${noise}" src="/image.webp"><script>${noise}</script><style>${noise}</style>
  <pre>${noise}</pre><code>${noise}</code><span hidden>${noise}</span><template>${noise}</template>`;
  assert.equal(readingMinutes(html), null);
  assert.equal(readingMinutes(html + '<a href="/a-long-url/">Facktoré</a>'), 3);
});

test('preserve inline words, decode entities and separate block boundaries', () => {
  const html = '<p>Facktoré’s sword-hand</p><p>snow<em>fall</em>&nbsp;again</p>';
  assert.equal(readingMinutes(html.repeat(125)), 3); // Four words per repetition.
  assert.equal(readingMinutes(html.repeat(124)), null);
});
