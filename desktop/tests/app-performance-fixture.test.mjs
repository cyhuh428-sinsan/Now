import {test} from 'node:test';import assert from 'node:assert/strict';import {makeFixture} from '../scripts/app-performance-fixture.mjs';
test('performance fixture has matching current notes and valid linked history without accounts, keys or a server',()=>{
  const value=makeFixture(1),root=value.values['nownote.history.v1'],notes=root.contexts[JSON.stringify(['','local_user'])].notes;
  assert.equal(Object.keys(notes).length,20);assert.equal(value.values['nownote.web.settings.v1'].server.mode,'local');
  for(const row of value.values['nownote.web.v1'].tree){const entry=notes[row.id];assert.equal(entry.draft.content,row.content);assert.equal(entry.raw.content,row.content);
    assert.equal(entry.revisions.length,6);assert.deepEqual(entry.revisions.at(-1).snapshot.note,entry.draft);assert.equal(entry.outbox.length,0);
    for(let i=1;i<entry.revisions.length;i++)assert.equal(entry.revisions[i].parent_ref.id,entry.revisions[i-1].revision_id);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(root))>1024*1024);assert.throws(()=>makeFixture(2));
});
