import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentReferenceErrors, contentImages } from '../src/lib/content-integrity.ts';
import { resolveSessionParty } from '../src/lib/session-party.ts';

const entry = (id, data) => ({ id, data });
function fixture() {
  return {
    sessions: [entry('nested/session-zero', { sessionNumber: 0, draft: true, playersPresent: ['Player'], encounters: [] })],
    characters: [entry('hero', { player: 'Player', portrait: '/images/hero.webp' })],
    npcs: [entry('witness', { faction: 'guild', firstAppearance: 0 })],
    factions: [entry('guild', {})], lore: [entry('rumor', {})],
    locations: [entry('hidden', { status: 'unknown', firstVisited: 0, lore: 'rumor', faction: 'guild' })],
    journey: [entry('trip', { session: 0, route: ['hidden'], events: [{ at: 'hidden' }] })],
  };
}

test('valid hidden/draft references, nested IDs, and session zero are accepted', () => {
  assert.deepEqual(contentReferenceErrors(fixture()), []);
});

test('profile review checkpoints require published session IDs, including nested session zero', () => {
  const content = fixture();
  content.characters[0].data.reviewedThrough = 'nested/session-zero';
  content.npcs[0].data.reviewedThrough = 'missing';
  assert.equal(contentReferenceErrors(content).length, 2);
  content.sessions[0].data.draft = false;
  content.npcs[0].data.reviewedThrough = 'nested/session-zero';
  assert.deepEqual(contentReferenceErrors(content), []);
});
test('duplicate session numbers and journey assignments name both sources', () => {
  const content = fixture();
  content.sessions.push(entry('duplicate', { ...content.sessions[0].data }));
  content.journey.push(entry('duplicate', { ...content.journey[0].data }));
  assert.deepEqual(contentReferenceErrors(content), [
    'journey/duplicate: duplicate session 0 (also journey/trip)',
    'sessions/duplicate: duplicate sessionNumber 0 (also sessions/nested/session-zero)',
  ]);
});
test('orphaned journeys and hidden route/event typos are diagnosed', () => {
  const content = fixture();
  content.journey[0].data = { session: 99, route: ['typo'], events: [{ at: 'also-typo' }] };
  const errors = contentReferenceErrors(content);
  assert.equal(errors.length, 3);
  assert.ok(errors.some(error => error.includes('session references missing entry 99')));
  assert.ok(errors.some(error => error.includes('route references missing entry "typo"')));
  assert.ok(errors.some(error => error.includes('events.at references missing entry "also-typo"')));
});
test('attendance and entity references are checked without inferring knowledge', () => {
  const content = fixture();
  content.sessions[0].data.playersPresent.push('Typo');
  content.npcs[0].data = { faction: 'missing', firstAppearance: 99 };
  content.locations[0].data = { faction: 'missing', lore: 'missing', firstVisited: 99 };
  const errors = contentReferenceErrors(content);
  assert.equal(errors.length, 6);
  for (const field of ['playersPresent', 'firstAppearance', 'firstVisited', 'lore', 'faction']) {
    assert.ok(errors.some(error => error.includes(field)));
  }
});
test('image inventory includes draft encounters and both portrait collections', () => {
  const content = fixture();
  content.npcs[0].data.portrait = '/images/witness.webp';
  content.sessions[0].data.encounters = [{ name: 'Creature', image: '/images/creature.webp' }];
  assert.equal(contentImages(content).length, 3);
  assert.ok(contentImages(content).some(image => image.source.includes('nested/session-zero') && image.path === '/images/creature.webp'));
});

test('replacement characters require explicit selection even for retired originals and draft recaps', () => {
  const content = fixture();
  content.characters[0].data.status = 'retired';
  content.characters.push(entry('replacement', { player: 'Player', status: 'active' }));
  assert.match(contentReferenceErrors(content).join('\n'), /playersPresent is ambiguous.*charactersPresent/);
  content.sessions[0].data.charactersPresent = ['hero'];
  assert.deepEqual(contentReferenceErrors(content), []);
  assert.deepEqual(resolveSessionParty(content.sessions[0], content.characters).party.map(c => c.id), ['hero']);
  content.sessions[0].data.charactersPresent = ['replacement'];
  assert.deepEqual(resolveSessionParty(content.sessions[0], content.characters).party.map(c => c.id), ['replacement']);
  content.sessions[0].data.charactersPresent = [];
  assert.deepEqual(resolveSessionParty(content.sessions[0], content.characters).party, []);
});

test('explicit cast rejects missing/duplicate IDs and remains separate from player attendance', () => {
  const content = fixture();
  content.sessions[0].data.charactersPresent = ['hero', 'hero', 'missing'];
  const errors = contentReferenceErrors(content);
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.includes('repeats character')));
  assert.ok(errors.some(error => error.includes('missing character')));
  content.sessions[0].data.charactersPresent = ['hero'];
  content.sessions[0].data.playersPresent = [];
  assert.deepEqual(contentReferenceErrors(content), []);
  assert.equal(resolveSessionParty(content.sessions[0], content.characters).party.length, 1);
});
