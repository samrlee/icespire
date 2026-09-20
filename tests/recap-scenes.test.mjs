import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recapScenes } from '../src/lib/recap-scenes.ts';
import { corpusVersion, safeSourceHref, withDeadline } from '../src/lib/ask-safety.ts';
const mark = (id, label = 'Part 1') => `<span id="scene-${id}" data-scene-label="${label}" class="recap-scene-anchor" tabindex="-1"></span>\n\n`;

test('authored scene IDs survive labels, prose edits and insertions', () => {
  const before = recapScenes(mark('stable') + 'Original.\n\n---\n\n' + mark('later', 'Part 2') + 'Later.');
  const after = recapScenes(mark('stable', 'Renamed') + 'Edited.\n\n' + mark('new', 'Inserted') + 'New.\n\n' + mark('later', 'Part 3') + 'Later.');
  assert.equal(before[0].id, after[0].id);
  assert.equal(before[1].id, after[2].id);
  assert.match(before[0].body, /---/);
  assert.equal(after[0].label, 'Renamed');
});
test('scene parser rejects missing opening marker, duplicates and unsafe labels', () => {
  assert.throws(() => recapScenes('Prose\n' + mark('a')), /precede/);
  assert.throws(() => recapScenes(mark('a') + mark('a')), /Duplicate/);
  assert.throws(() => recapScenes(mark('a', '<script>')), /Invalid/);
  assert.deepEqual(recapScenes('Unsegmented fixture'), []);
});
test('source links are relative and versions change with corpus content', async () => {
  for (const href of ['//evil.example', 'javascript:alert(1)', '/\\evil.example', '/bad\npath', 'https://elsewhere/']) assert.equal(safeSourceHref(href), false);
  assert.equal(safeSourceHref('/sessions/nested/recap/#scene-stable'), true);
  assert.equal(await corpusVersion([{ text: 'A' }]), await corpusVersion([{ text: 'A' }]));
  assert.notEqual(await corpusVersion([{ text: 'A' }]), await corpusVersion([{ text: 'B' }]));
});
test('deadlines bound stalled providers without retrying work', async () => {
  assert.equal(await withDeadline(Promise.resolve('done'), 100), 'done');
  await assert.rejects(withDeadline(new Promise(() => {}), 10), /deadline/);
});
