import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBookmarkCatalog } from '../src/lib/bookmark-catalog.ts';
import { BOOKMARK_STORAGE_KEY, MAX_BOOKMARKS, parseBookmarks, parseBookmarkCatalog, readBookmarks, writeBookmarks } from '../src/lib/bookmarks.ts';

const marker = (id, label='The alibi') => `<span id="scene-${id}" data-scene-label="${label}" class="recap-scene-anchor" tabindex="-1"></span>\n\n`;
const session = { id: 'session-9', data: { sessionNumber: 9, title: 'The ninth recap' }, body: marker('stable') + 'Published testimony.' };
const scene = buildBookmarkCatalog([session]).scenes[0];
const record = { ...scene, note: '<img src=x onerror=alert(1)>', updatedAt: '2026-10-12T00:00:00.000Z' };
delete record.href;

test('catalog excludes drafts and source fingerprints survive insertion but detect edits', () => {
  const draft = { ...session, id: 'session-10', data: { ...session.data, sessionNumber: 10, draft: true } };
  assert.deepEqual(buildBookmarkCatalog([session, draft]).scenes.map(s=>s.sessionId), ['session-9']);
  const inserted = buildBookmarkCatalog([{ ...session, body: marker('new', 'Inserted') + 'Another scene.\n\n' + session.body }]);
  assert.equal(inserted.scenes.find(s=>s.sceneId==='scene-stable').fingerprint, scene.fingerprint);
  assert.notEqual(buildBookmarkCatalog([{...session,body:marker('stable')+'Changed testimony.'}]).scenes[0].fingerprint, scene.fingerprint);
  assert.equal(buildBookmarkCatalog([{...session,data:{...session.data,title:'Retitled recap'}}]).scenes[0].sceneId,scene.sceneId);
});
test('catalog validates published identities and exact same-site source URLs', () => {
  assert.deepEqual(parseBookmarkCatalog(buildBookmarkCatalog([session])).scenes, [scene]);
  assert.equal(parseBookmarkCatalog(buildBookmarkCatalog([session], '/chronicle/'), '/chronicle/').scenes[0].href, '/chronicle/sessions/session-9/#scene-stable');
  for(const href of ['javascript:alert(1)','//elsewhere.example/','/sessions/session-9/#scene-other','/\\elsewhere.example/']) assert.throws(()=>parseBookmarkCatalog({version:1,scenes:[{...scene,href}]}));
  assert.throws(()=>parseBookmarkCatalog({version:1,scenes:[scene,scene]}));
});
test('browser records are bounded and malformed data is preserved instead of repaired silently', () => {
  const raw=JSON.stringify({version:1,bookmarks:[record]});
  assert.equal(parseBookmarks(raw)[0].note, record.note);
  for(const bad of ['broken', JSON.stringify({version:2,bookmarks:[]}), JSON.stringify({version:1,bookmarks:[record,record]}), JSON.stringify({version:1,bookmarks:[{...record,note:'x'.repeat(2001)}]}), ' '.repeat(256*1024+1)]) assert.throws(()=>parseBookmarks(bad));
  const many=Array.from({length:MAX_BOOKMARKS+1},(_,i)=>({...record,sceneId:`scene-part-${i}`}));
  assert.throws(()=>parseBookmarks(JSON.stringify({version:1,bookmarks:many})));
  let stored='broken';const storage={getItem(){return stored;},setItem(_key,value){stored=value;},removeItem(){stored=null;}};
  assert.equal(readBookmarks(storage).state,'invalid');assert.equal(stored,'broken');
  assert.equal(readBookmarks({getItem(){throw new Error('Blocked');}}).state,'blocked');
});
test('writes happen only when requested and failed writes preserve the original record', () => {
  let raw=null;let writes=0;const storage={getItem(){return raw;},setItem(key,value){assert.equal(key,BOOKMARK_STORAGE_KEY);writes++;raw=value;},removeItem(key){assert.equal(key,BOOKMARK_STORAGE_KEY);writes++;raw=null;}};
  assert.deepEqual(readBookmarks(storage),{state:'ready',bookmarks:[]});assert.equal(writes,0);
  writeBookmarks(storage,[record]);const saved=raw;assert.equal(writes,1);
  assert.throws(()=>writeBookmarks({...storage,setItem(){throw new DOMException('Full','QuotaExceededError');}},[{...record,note:'unsaved'}]));assert.equal(raw,saved);
  writeBookmarks(storage,[]);assert.equal(raw,null);
});
