import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/ask.ts';
import { corpusVersion } from '../src/lib/ask-safety.ts';
import { index, contentTokens } from '../src/lib/search-rank.ts';
import { retrieveAsk } from '../src/lib/ask-retrieval.ts';

const evidence = 'The dragon payment was discussed. Thornton reported the dragon had left. They agreed fifty gold for the dragon news, but no payment was made. Only Bean heard the dragon report.';
const debtTitle = 'The Hidden Chamber, a Debt Paid, and a Dragon';
const docs = [
  { title: 'Dragon recap', kind: 'Recap', href: '/sessions/example/', text: evidence },
  { title: 'Dragon recap — Part 1', kind: 'Recap part', href: '/sessions/example/#scene-fixed', text: evidence },
  { title: 'Thom', kind: 'Party', href: '/characters/thom/', text: 'Thom sold the emerald for 350 gp to Barthen.' },
  { title: 'Session Zero', kind: 'Recap', href: '/sessions/session-0/', sessionNumber: 0, summary: 'They agreed the house rules.', sub: 'Session 0 · Jan 1, 2026', text: 'They agreed the house rules.' },
  { title: 'Session Zero — Part 1', kind: 'Recap part', href: '/sessions/session-0/#scene-rules', sessionNumber: 0, sceneLabel: 'Part 1', text: 'Tracking ammunition was not required.' },
  { title: 'The Town Finds Out', kind: 'Recap', href: '/sessions/session-8/', sessionNumber: 8, summary: 'Two invisible thieves entered an office.', sub: 'Session 8 · Sep 12, 2026', text: 'The party entered the office.' },
  { title: 'The Town Finds Out — Part 1', kind: 'Recap part', href: '/sessions/session-8/#scene-office', sessionNumber: 8, sceneLabel: 'Part 1', text: 'Bean entered the office.' },
  { title: 'An Alibi and an Escort', kind: 'Recap', href: '/sessions/session-9/', sessionNumber: 9, summary: 'Thom bought supplies, then the party reached the mine entrance.', sub: 'Session 9 · Sep 19, 2026', text: 'Thom bought supplies. The party reached the entrance.' },
  { title: 'An Alibi and an Escort — Part 1', kind: 'Recap part', href: '/sessions/session-9/#scene-shop', sessionNumber: 9, sceneLabel: 'Part 1', text: 'Thom bought supplies for 35 gp.' },
  { title: 'Where we left off', kind: 'Page', href: '/campaign/#where-we-left-off', currentState: true, text: 'As of Session 9, the party stood inside the mine entrance. No rooms had been observed. The escort reward remained unpaid.' },
  { title: debtTitle, kind: 'Recap', href: '/sessions/session-7/', sessionNumber: 7, text: 'They gave Norbus twenty-five gold and seventy tarnished silver.' },
  ...Array.from({ length: 12 }, (_, i) => ({ title: `${debtTitle} — Part ${i + 1}`, kind: 'Recap part',
    href: `/sessions/session-7/#scene-part-${i + 1}`, sessionNumber: 7, parentTitle: debtTitle, sceneLabel: `Part ${i + 1}`,
    text: i === 7 ? 'Harbin paid the party for warning the townspeople. He paid two bags of gold.'
      : i === 8 ? 'They gave Norbus twenty-five gold and seventy tarnished silver. He thanked them.'
      : i === 9 ? 'After the others left, Dax added a second bag of fifteen gold on top of what the party had paid. None of them saw it.'
      : 'The party continued along the road.' })),
];

function request(question) {
  return new Request('https://chronicle.example/api/ask', { method: 'POST', body: JSON.stringify({ question }) });
}

test('Ask uses published scene records as sources and preserves evidence distinctions', async t => {
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

test('known single-keyword facts reach the model instead of an unrecorded answer', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  for (const [question, quote] of [
    ['What happened to the emerald?', 'sold the emerald for 350 gp to Barthen'],
    ['What about ammunition?', 'Tracking ammunition was not required'],
  ]) {
    let calls = 0;
    const response = await onRequestPost({ request: request(question), env: { AI: { async run(_model, input) {
      calls++; assert.ok(input.messages[0].content.includes(quote)); return { response: 'An answer from the supplied evidence.' };
    } } } });
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.ok((await response.json()).sources.length > 0);
  }
});

test('current-location intent uses only the sourced continuation point', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  for (const question of ['Where are we now?', 'Where are we?', 'Where is the party?', 'Where are we at?', 'Where did we leave off?', 'What is the current party location?', 'What is our current position?', 'What is the current party state?']) {
    let calls = 0;
    const response = await onRequestPost({ request: request(question), env: { AI: { async run(_model, input) {
      calls++;
      assert.match(input.messages[0].content, /inside the mine entrance/);
      assert.match(input.messages[0].content, /No rooms had been observed/);
      assert.match(input.messages[0].content, /reward remained unpaid/);
      return { response: 'The party stood inside the entrance.' };
    } } } });
    assert.equal(calls, 1, question);
    assert.deepEqual((await response.json()).sources.map(source => source.href), ['/campaign/#where-we-left-off'], question);
  }
});

test('historical whereabouts never substitute the current snapshot', () => {
  for (const question of [
    'Where were we in Session 8?', 'Where is the party in Session 8?', 'Where was Bean in Session 8?',
    'Where are we now in Session 8?', 'Where did we leave off in Session 8?',
    'What was the current party location in Session 8?', 'What was our current location after Session 8?',
    'What was the current party position during Session 8?', 'What was the current party state in Session 8?',
    'Where were we before the mine?', 'Where was the party after the dragon report?',
  ]) {
    const result = retrieveAsk(index(docs), question);
    assert.ok(result.hits.every(hit => !hit.doc.currentState && !hit.doc.href.endsWith('/campaign/#where-we-left-off')), question);
    if (question.includes('Session 8')) {
      assert.ok(result.hits.length > 0, question);
      assert.ok(result.hits.every(hit => hit.doc.sessionNumber === 8), question);
    }
    if (question.includes('dragon report')) assert.ok(result.hits.length > 0, question);
    if (question.includes('Bean')) assert.ok(result.hits.some(hit => hit.doc.text.includes('Bean entered the office.')), question);
  }
});

test('numbered session overviews use the requested summary and date', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  assert.deepEqual(contentTokens('What happened in Session 9?'), ['session', '9']);
  for (const number of [8, 9]) {
    const recap = docs.find(doc => doc.kind === 'Recap' && doc.sessionNumber === number);
    const response = await onRequestPost({ request: request(`What happened in Session ${number}?`), env: { AI: { async run(_model, input) {
      assert.ok(input.messages[0].content.includes(recap.summary));
      assert.ok(input.messages[0].content.includes(recap.sub));
      assert.ok(!input.messages[0].content.includes('Session Zero'));
      return { response: 'The requested session overview.' };
    } } } });
    assert.deepEqual((await response.json()).sources.map(source => source.href), [recap.href]);
  }
  const detail = retrieveAsk(index(docs), 'What did Thom buy in Session 9?');
  assert.ok(detail.hits.length > 0);
  assert.ok(detail.hits.every(hit => hit.doc.sessionNumber === 9));
  for (const question of ['On what date was Session 9?', 'What happened during Session 9?', 'Describe Session 9.', 'What is the title of Session 9?']) {
    const overview = retrieveAsk(index(docs), question);
    assert.equal(overview.hits.length, 1);
    assert.equal(overview.hits[0].doc.href, '/sessions/session-9/');
    assert.equal(overview.hits[0].doc.text, docs.find(doc => doc.kind === 'Recap' && doc.sessionNumber === 9).summary);
  }
});

test('unavailable sessions and absent keywords never substitute unrelated evidence', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  for (const question of ['What happened in Session 99?', 'What is inside Axeholm?', 'What about emeraldine?', 'What about now?', 'What?']) {
    const response = await onRequestPost({ request: request(question), env: { AI: { run() { assert.fail('No published evidence may call the model'); } } } });
    const data = await response.json();
    assert.equal(data.answer, 'The chronicle does not record that.');
    assert.deepEqual(data.sources, []);
  }
});

test('duplicated recap titles cannot crowd out the preceding payment evidence', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(docs)));
  for (const question of ['How was the debt paid?', `In ${debtTitle}, what debt was paid?`]) {
    const response = await onRequestPost({ request: request(question), env: { AI: { async run(_model, input) {
      assert.match(input.messages[0].content, /twenty-five gold and seventy tarnished silver/);
      assert.match(input.messages[0].content, /fifteen gold/);
      assert.match(input.messages[0].content, /None of them saw it/);
      return { response: 'The party and Dax made separate payments.' };
    } } } });
    const data = await response.json();
    assert.ok(data.sources.some(source => source.href === '/sessions/session-7/#scene-part-9'));
    assert.ok(data.sources.some(source => source.href === '/sessions/session-7/#scene-part-10'));
    assert.ok(data.sources.length <= 5);
    assert.ok(data.sources.every(source => source.href.startsWith('/sessions/session-7/#')));
  }
});
