import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveBriefingItems, resolveEvidenceClaims } from '../src/lib/provenance.ts';
import { catchUpThrough } from '../src/lib/catch-up.ts';
import { buildTableReference, readTableFacts } from '../src/lib/table-reference.ts';
import { evidenceClaims, briefingItems, referenceReview } from '../src/data/player-reference.ts';

const mark = (id, label = 'An established scene') => `<span id="${id}" data-scene-label="${label}" class="recap-scene-anchor" tabindex="-1"></span>\n\n`;
const fixtureSessions = [
  { id: 'first', data: { sessionNumber: 1, title: 'First', date: new Date('2026-01-01'), summary: 'Earlier summary' }, body: mark('scene-first') + 'Sage is mentioned, but mentioning her proves no knowledge.' },
  { id: 'draft', data: { sessionNumber: 2, title: 'DRAFT_TITLE_SENTINEL', draft: true, date: new Date('2026-01-02'), summary: 'DRAFT_SUMMARY_SENTINEL' }, body: mark('scene-draft') + 'DRAFT_PASSAGE_SENTINEL' },
  { id: 'later', data: { sessionNumber: 3, title: 'LATER_TITLE_SENTINEL', date: new Date('2026-01-03'), summary: 'LATER_SUMMARY_SENTINEL' }, body: mark('scene-later') + 'LATER_PASSAGE_SENTINEL' },
];
const characters = [{ id: 'dax', data: { name: 'Dax' } }, { id: 'sage', data: { name: 'Sage' } }, { id: 'bean', data: { name: 'Bean' } }];
const claim = {
  id: 'explicit-witness', topic: 'exchange', title: 'An authored observation', statement: 'Dax heard the statement.', basis: 'observed',
  witnesses: ['dax'], witnessNote: 'Dax is the explicitly recorded witness.', citations: [{ sessionId: 'first', sceneId: 'scene-first' }],
  tellings: [], limits: 'Mentions and attendance do not extend these witnesses.',
};

function content(collection) {
  return readdirSync(new URL(`../src/content/${collection}/`, import.meta.url)).filter(file => file.endsWith('.md')).map(file => {
    const raw = readFileSync(new URL(`../src/content/${collection}/${file}`, import.meta.url), 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert.ok(match, file);
    return { id: file.slice(0, -3), data: parse(match[1]), body: match[2] };
  });
}

test('the authored pilot and briefing resolve every real published scene and character', () => {
  const sessions = content('sessions');
  const roster = content('characters');
  const evidence = resolveEvidenceClaims(evidenceClaims, sessions, roster, referenceReview);
  const briefing = resolveBriefingItems(briefingItems, sessions, roster, referenceReview);
  assert.equal(evidence.length, evidenceClaims.length);
  assert.equal(briefing.length, briefingItems.length);
  for (const item of [...evidence, ...briefing]) for (const citation of item.citations) assert.match(citation.href, /^\/sessions\/[^#]+\/#scene-/);
  const townmaster = evidence.find(item => item.id === 'exchange-townmaster');
  assert.deepEqual(townmaster.witnesses.map(item => item.id), ['thom', 'bean-hootwhistle']);
  assert.ok(townmaster.recordedFor.includes('rut'));
  const ledger = evidence.find(item => item.id === 'exchange-payment-line');
  assert.deepEqual(ledger.recordedFor, ['bean-hootwhistle']);
  assert.equal(evidence.find(item => item.id === 'temple-earlier-statue').witnesses, null);
});

test('a recorded telling adds recipients without inventing earlier witnesses or knowledge from mentions', () => {
  const [resolved] = resolveEvidenceClaims([{ ...claim, tellings: [{ citation: { sessionId: 'later', sceneId: 'scene-later' }, recipients: ['bean'], note: 'Bean heard the later account.' }] }], fixtureSessions, characters, 'later');
  assert.deepEqual(resolved.witnesses.map(item => item.id), ['dax']);
  assert.deepEqual(resolved.recordedFor, ['dax', 'bean']);
  assert.ok(!resolved.recordedFor.includes('sage'));
});

test('provenance rejects unpublished, missing, obsolete and newer citations before rendering', () => {
  for (const citation of [{ sessionId: 'draft', sceneId: 'scene-draft' }, { sessionId: 'missing', sceneId: 'scene-first' }]) {
    assert.throws(() => resolveEvidenceClaims([{ ...claim, citations: [citation] }], fixtureSessions, characters, 'later'), /published recap/);
  }
  assert.throws(() => resolveEvidenceClaims([{ ...claim, citations: [{ sessionId: 'first', sceneId: 'scene-renamed' }] }], fixtureSessions, characters, 'later'), /missing scene/);
  assert.throws(() => resolveEvidenceClaims([{ ...claim, citations: [{ sessionId: 'later', sceneId: 'scene-later' }] }], fixtureSessions, characters, 'first'), /newer than/);
  assert.throws(() => resolveEvidenceClaims([claim], fixtureSessions, characters, 'draft'), /reviewedThrough/);
  assert.throws(() => resolveEvidenceClaims([{ ...claim, tellings: [{ citation: { sessionId: 'draft', sceneId: 'scene-draft' }, recipients: ['bean'], note: 'A hidden telling.' }] }], fixtureSessions, characters, 'later'), /published recap/);
  assert.throws(() => resolveBriefingItems([{ id: 'hidden', title: 'Hidden', text: 'HIDDEN_BRIEFING_SENTINEL', citations: [{ sessionId: 'draft', sceneId: 'scene-draft' }] }], fixtureSessions, characters, 'later'), /published recap/);
});

test('provenance validates observer IDs, unknown-witness markers and chronological tellings', () => {
  for (const witnesses of [[], ['missing'], ['dax', 'dax']]) assert.throws(() => resolveEvidenceClaims([{ ...claim, witnesses }], fixtureSessions, characters, 'later'), /empty|unknown or repeated/);
  assert.throws(() => resolveEvidenceClaims([claim, claim], fixtureSessions, characters, 'later'), /duplicate ID/);
  assert.throws(() => resolveEvidenceClaims([{ ...claim, citations: [] }], fixtureSessions, characters, 'later'), /citation is required/);
  assert.throws(() => resolveEvidenceClaims([{ ...claim, citations: [{ sessionId: 'later', sceneId: 'scene-later' }], tellings: [{ citation: { sessionId: 'first', sceneId: 'scene-first' }, recipients: ['sage'], note: 'Before the source.' }] }], fixtureSessions, characters, 'later'), /precedes/);
  assert.deepEqual(resolveEvidenceClaims([{ ...claim, witnesses: null }], fixtureSessions, characters, 'later')[0].recordedFor, []);
});

test('catch-up excludes draft content and all later prose, even from cutoff choices', () => {
  const result = catchUpThrough(fixtureSessions, 'first');
  assert.equal(result.entries.length, 1);
  assert.deepEqual(result.choices.map(item => item.id), ['first', 'later']);
  const output = JSON.stringify(result);
  for (const sentinel of ['DRAFT_TITLE_SENTINEL', 'DRAFT_SUMMARY_SENTINEL', 'DRAFT_PASSAGE_SENTINEL', 'LATER_TITLE_SENTINEL', 'LATER_SUMMARY_SENTINEL', 'LATER_PASSAGE_SENTINEL']) assert.ok(!output.includes(sentinel), sentinel);
  assert.throws(() => catchUpThrough(fixtureSessions, 'draft'), /published recap/);
  assert.throws(() => catchUpThrough(fixtureSessions, 'missing'), /published recap/);
  assert.equal(catchUpThrough([...fixtureSessions].reverse()).through.id, 'first');
  assert.deepEqual(catchUpThrough([]).entries, []);
});

test('table facts use the authoritative document and unpublished play cannot supply reminders', () => {
  const markdown = readFileSync(new URL('../docs/TABLE-FACTS.md', import.meta.url), 'utf8');
  const facts = readTableFacts(markdown);
  assert.equal(facts.dm, 'Owen');
  assert.equal(facts.edition, '2014 rules');
  assert.equal(facts.levelCap, 6);
  const sessions = content('sessions');
  const roster = content('characters');
  const npcs = content('npcs');
  const reference = buildTableReference(markdown, sessions, roster, npcs);
  assert.equal(reference.rules.length, 3); // Level cap is already displayed with the game.
  assert.equal(reference.reminders.length, 3);
  const drafts = sessions.map(session => ({ ...session, data: { ...session.data, draft: [0, 7, 8].includes(session.data.sessionNumber) } }));
  const withheld = buildTableReference(markdown, drafts, roster, npcs);
  assert.equal(withheld.game, undefined);
  assert.deepEqual(withheld.rules, []);
  assert.deepEqual(withheld.reminders, []);
});
