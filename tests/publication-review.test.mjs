import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecord, reviewReport } from '../scripts/publication-review.mjs';

const md = data => `---\n${data}\n---\nBody draft: true is not frontmatter.\n`;
const initial = () => new Map([
  ['src/content/sessions/session-1.md', md('sessionNumber: 1\nplayersPresent: [Sam]')],
  ['src/content/characters/dax.md', md('player: Sam')],
  ['src/content/locations/mine.md', md('status: known\ninteriorSeen: false')],
  ['src/content/current-state/current.yaml', 'sourceSession: session-1\ngroups:\n  - characters: [dax]\n    location: mine'],
]);

test('unchanged records report no transitions and current snapshot', () => {
  const windows = new Map([...initial()].map(([file, text]) => [file, text.replaceAll('\n', '\r\n')]));
  const report = reviewReport(initial(), windows, 'base');
  assert.match(report, /No campaign files changed/);
  assert.match(report, /No publication gate changes/);
  assert.match(report, /current by source session number/);
  assert.match(report, /No collection-reference problems/);
});

test('nested YAML-comment drafts, visit/interior gates, removals and stale state are distinct', () => {
  const before = initial();
  const after = initial();
  after.set('src/content/sessions/nested/draft.md', md('sessionNumber: 3\ndraft: true # unpublished'));
  after.set('src/content/sessions/session-2.md', md('sessionNumber: 2'));
  after.set('src/content/locations/mine.md', md('status: visited\ninteriorSeen: true'));
  let report = reviewReport(before, after, 'base');
  assert.match(report, /Added: src\/content\/sessions\/nested\/draft.md/);
  assert.doesNotMatch(report, /Recap nested\/draft:/);
  assert.match(report, /Recap session-2: newly eligible/);
  assert.match(report, /Region marker mine: newly eligible/);
  assert.match(report, /Interior gate mine: newly eligible/);
  assert.match(report, /Snapshot is behind/);
  report = reviewReport(after, before, 'base');
  assert.match(report, /Deleted: src\/content\/sessions\/session-2.md/);
  assert.match(report, /Interior gate mine: no longer eligible/);
  assert.match(report, /Recap session-2: no longer eligible/);
});

test('missing references and invalid snapshot sources are visible; report escapes repository text', () => {
  const after = initial();
  after.set('src/content/npcs/<img>.md', md('faction: "<script>"'));
  after.set('src/content/current-state/current.yaml', 'sourceSession: absent\ngroups:\n  - characters: [dax, dax, missing]\n    location: nowhere');
  const report = reviewReport(initial(), after, '<base>');
  assert.match(report, /references missing entry/);
  assert.match(report, /unknown or repeated character dax/);
  assert.match(report, /unknown or repeated character missing/);
  assert.match(report, /unknown location nowhere/);
  assert.match(report, /source must reference a published recap/);
  assert.doesNotMatch(report, /<img>|<script>|<base>/);
  assert.match(report, /&#60;/);
});

test('only parsed frontmatter controls gates; malformed records fail explicitly', () => {
  assert.equal(parseRecord('nested.md', md('draft: false')).draft, false);
  assert.throws(() => parseRecord('bad.md', 'body'), /missing frontmatter/);
  assert.throws(() => parseRecord('bad.md', '---\ndraft: true'), /unclosed frontmatter/);
  assert.throws(() => parseRecord('bad.yaml', 'draft: [broken'));
  const after = initial();
  after.set('src/content/locations/mine.md', md('status: known\ninteriorSeen: true'));
  assert.match(reviewReport(initial(), after, 'base'), /No publication gate changes/);
});
