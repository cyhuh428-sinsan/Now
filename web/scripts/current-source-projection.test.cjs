const {test}=require('node:test'),assert=require('node:assert/strict'),parts=require('../vendor/document-parts.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
function fixture(change=()=>{}){
  const note=(id,source='manual')=>({owner_id:'alice',local_id:id,note_type:'tree',source,content:'current'});
  const entry=(id,source)=>({raw:note(id,source),draft:note(id,source),base:{crypto_epoch:0,head_revision_id:null},revisions:[{snapshot:{note:{content:'UNREAD_HISTORY'}}}],outbox:[],receipts:[]});
  const normal=entry('a'),source=entry('wiki-source:file','wiki-source-snapshot');source.wiki_source_snapshot={schema_version:1,id:'file',manifest:{opaque:'UNREAD_SOURCE'},extraction:{opaque:'UNREAD_SOURCE'}};
  const root={schema_version:1,contexts:{[account]:{notes:{a:normal,'wiki-source:file':source}}}};change(root,normal,source);
  const encoded=parts.encode(root),steps=parts.currentSteps(account),reads=[];let step=steps.next();while(!step.done){reads.push(step.value);step=steps.next(encoded.get(step.value));}return {result:step.value,reads};
}
test('file snapshot metadata does not force unrelated normal history/source bodies into startup memory',()=>{
  const {result,reads}=fixture();assert.equal(result.supported,true);assert.deepEqual(Object.keys(result.notes),['a']);assert.deepEqual(result.wikiIds,['wiki-source:file']);assert.equal(result.syncSupported,false);
  assert.ok(reads.every(id=>!id.includes('"revisions"')&&!id.includes('"wiki_source_snapshot","')&&!id.includes('"wiki-source:file","draft"')));
});
test('a misplaced or malformed snapshot marker remains full-validation only',()=>{
  assert.equal(fixture((_root,normal,source)=>{normal.wiki_source_snapshot=source.wiki_source_snapshot;}).result.supported,false);
  assert.equal(fixture((_root,_normal,source)=>{source.wiki_source_snapshot='broken';}).result.supported,false);
});
