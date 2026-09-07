import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishedMapData } from '../src/lib/map-publication.ts';

const locations = ['visited', 'known', 'rumored', 'unknown'].map(status => ({
  id: status, data: { status },
}));
const leg = (session, route, events = []) => ({ data: { session, route, events } });

test('only visited locations and their published events enter map output', () => {
  const result = publishedMapData(locations, [leg(1, ['visited'], [
    {at:'visited', title:'Visible'}, {at:'known', title:'Hidden sighting'},
    {at:'rumored', title:'Hidden rumor'}, {at:'unknown', title:'Hidden secret'},
  ])], new Set([1]));
  assert.deepEqual(result.locations.map(l => l.id), ['visited']);
  assert.deepEqual(result.journey[0].data.events, [{at:'visited', title:'Visible'}]);
});

test('hidden waypoints neither serialize nor create shortcut route arcs', () => {
  const all = [...locations, {id:'second', data:{status:'visited'}}];
  const result = publishedMapData(all, [leg(1, ['visited', 'known', 'second'])], new Set([1]));
  assert.deepEqual(result.journey[0].segments, []);
  assert.deepEqual(result.journey[0].data.route, ['visited', 'second']);
  assert.ok(!JSON.stringify(result).includes('known'));
});

test('normal out-and-back travel remains ordered', () => {
  const all = [...locations, {id:'second', data:{status:'visited'}}];
  const result = publishedMapData(all, [leg(1, ['visited','second','visited'])], new Set([1]));
  assert.deepEqual(result.journey[0].segments, [['visited','second'],['second','visited']]);
});

test('draft or missing sessions cannot contribute routes or events', () => {
  const result = publishedMapData(locations, [leg(2, ['visited'], [{at:'visited',title:'Draft secret'}])], new Set([1]));
  assert.deepEqual(result.journey, []);
});

test('typos still fail the build instead of disappearing as hidden places', () => {
  assert.throws(() => publishedMapData(locations, [leg(1,['misspelled'])], new Set([1])), /unknown location slug/);
  assert.throws(() => publishedMapData(locations, [leg(1,[],[{at:'misspelled'}])], new Set([1])), /unknown location slug/);
});
