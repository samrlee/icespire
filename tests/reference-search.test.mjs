import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReferenceSearchDocs } from '../src/lib/reference-search.ts';
import { index } from '../src/lib/search-rank.ts';
import { retrieveAsk } from '../src/lib/ask-retrieval.ts';
import { buildAskContext } from '../src/lib/ask-context.ts';

const reference = {
  checkpoint: { id: 'session-9', data: { sessionNumber: 9 } },
  briefing: [{ title: 'Escort reward', text: 'The escort reward remained unpaid.' }],
  evidence: [{
    id: 'ledger', title: 'A reported ledger entry', basis: 'reported',
    statement: 'Bean read a ledger entry.', witnessNote: 'Only Bean read the entry.',
    limits: 'The entry did not establish payment.', witnesses: [{ id: 'bean', name: 'Bean' }],
    tellings: [{ citation: { sessionNumber: 9 }, recipients: [{ id: 'thom', name: 'Thom' }], note: 'Thom heard Bean’s account.' }],
  }],
};

test('indexed reference prose carries the review checkpoint and knowledge limits', () => {
  const docs = buildReferenceSearchDocs(reference, 'session-9');
  assert.equal(docs.length, 2);
  for (const doc of docs) {
    assert.match(doc.sub, /checked through Session 9/);
    assert.match(doc.text, /checked through Session 9/);
    assert.doesNotMatch(doc.text, /newer recap|still reflect/);
  }
  const evidence = docs.find(doc => doc.kind === 'Evidence');
  assert.match(evidence.text, /Basis: reported/);
  assert.match(evidence.text, /not a complete record of anyone’s knowledge/);
  assert.match(evidence.text, /An omitted claim does not prove that character is ignorant/);
  assert.match(evidence.text, /Explicitly recorded for Bean/);
  assert.match(evidence.text, /Thom heard Bean’s account/);
  assert.match(evidence.text, /did not establish payment/);
});

test('a newer published recap adds each page’s stale notice to indexed prose and Ask context', () => {
  const docs = buildReferenceSearchDocs({ ...reference, newerRecap: { data: { sessionNumber: 10 } } }, 'session-9');
  assert.match(docs[0].text, /The reminders still reflect Session 9\. Read the latest recap and the current snapshot before using them for play\./);
  assert.match(docs[1].text, /A newer recap is available\. This pilot still reflects Session 9\./);
  for (const question of ['What about the escort reward?', 'What did Bean read?']) {
    const { hits, terms } = retrieveAsk(index(docs), question);
    assert.ok(hits.length > 0);
    const context = buildAskContext(hits, terms, 12000);
    assert.match(context.text, /newer recap/);
    assert.match(context.text, /Session 9/);
    assert.ok(context.passages.every(passage => passage.excerpt.includes('Session 9')));
  }
});

test('a snapshot mismatch warns about briefing reminders without mislabelling the historical pilot', () => {
  const [briefing, evidence] = buildReferenceSearchDocs(reference, 'session-8');
  assert.match(briefing.text, /The reminders still reflect Session 9/);
  assert.match(briefing.sub, /snapshot and reminder checkpoints differ/);
  assert.doesNotMatch(evidence.text, /newer recap/);
  assert.match(evidence.text, /checked through Session 9/);
});

test('bounded excerpts cannot remove the stale status from the supplied source heading', () => {
  const longReference = { ...reference, newerRecap: { data: { sessionNumber: 10 } }, evidence: [],
    briefing: [{ title: 'Road notes', text: 'They travelled along the road. '.repeat(500) + 'The escort reward remained unpaid.' }],
  };
  const docs = index(buildReferenceSearchDocs(longReference, 'session-9'));
  const { hits, terms } = retrieveAsk(docs, 'What about the escort reward?');
  const context = buildAskContext(hits, terms, 1000);
  assert.equal(context.used.length, 1);
  assert.match(context.text, /The escort reward remained unpaid/);
  assert.match(context.text, /Reminders checked through Session 9 · A newer recap is available/);
  assert.ok(context.tokens <= 1000);
});
