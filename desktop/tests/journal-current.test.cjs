const {test}=require('node:test');
const assert=require('node:assert/strict');
const parts=require('../../web/vendor/document-parts.js');
const account=JSON.stringify(['https://qa.invalid','alice']);
const other=JSON.stringify(['https://qa.invalid','bob']);
function fixture(){
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',source:'manual',title:id,content:'current '+id});
  const entry=id=>({raw:note(id),draft:note(id),base:{head_revision_id:'r1',crypto_epoch:0,inventory_revision_ids:['r1'],snapshot:{note:note(id)}},
    revisions:[{snapshot:{note:{content:'OLD_HISTORY_BODY'}}}],outbox:[],receipts:[{body:'RECEIPT_BODY'}],dirty:false,localOnly:true,conflict:null});
  const wiki=entry('wiki:x');wiki.draft.source='wiki-artifact';wiki.draft.content='WIKI_BODY';
  return {schema_version:1,contexts:{[account]:{notes:{a:entry('a'),'wiki:x':wiki}},[other]:{notes:{foreign:{body:'FOREIGN_BODY'}}}}};
}
function read(value,who=account){
  const physical=parts.encode(value),ids=[],steps=parts.currentSteps(who);let step=steps.next();
  while(!step.done){const id=step.value;ids.push(id);assert.ok(!id.includes('revisions')&&!id.includes('receipts')&&!id.includes('inventory_revision_ids')&&!id.includes('snapshot'));
    assert.ok(!id.includes(other.replaceAll('"','\\"')));step=steps.next(physical.get(id));}
  return {value:step.value,ids};
}
test('current preview reads active-account current DTOs, not histories, Wiki bodies or foreign accounts',()=>{
  const result=read(fixture());assert.equal(result.value.projection,'journal_current_v1');assert.equal(result.value.supported,true);
  assert.deepEqual(Object.keys(result.value.notes),['a']);assert.equal(result.value.notes.a.draft.content,'current a');
  assert.deepEqual(result.value.wikiIds,['wiki:x']);
  assert.equal(result.value.notes.a.projection,'current_v1');assert.equal(result.value.notes.a.pending,0);
  assert.equal(JSON.stringify(result.value).includes('OLD_HISTORY_BODY'),false);assert.equal(JSON.stringify(result.value).includes('WIKI_BODY'),false);
  assert.ok(!result.ids.includes(JSON.stringify(['contexts',account,'notes','wiki:x','draft'])));
});
test('current preview is explicitly unavailable for protection, unknown metadata or unsupported root, never empty success',()=>{
  for(const change of [r=>r.protection_operations={},r=>r.extension={},r=>r.contexts[account].legacy_pending={},
    r=>r.contexts[account].notes.a.protection_record={},r=>r.contexts[account].notes.a.base.crypto_epoch=1,
    r=>r.contexts[account].notes.a.draft.content='NOW_ENCRYPTED_V1:secret',r=>r.schema_version=2]){
    const root=fixture();change(root);const result=read(root).value;assert.equal(result.supported,false);assert.equal(Object.hasOwn(result,'notes'),false);
  }
  assert.throws(()=>read(fixture(),'not-an-account'),/account/i);
  assert.equal(read({schema_version:1,contexts:{}},JSON.stringify(['',''])).value.supported,true);
  assert.equal(read(null).value.supported,true);
});

test('known Wiki metadata does not force normal-note histories into memory or authorize a lightweight Wiki view',()=>{
  const root=fixture();
  root.contexts[account].wiki_lifecycle={one:{pending:null,version:1,deleted_at:null,local_only:true}};
  root.contexts[account].wiki_ingest_operations={one:{state:'committed',body:'UNREAD_WIKI_OPERATION_BODY'}};
  const result=read(root);assert.equal(result.value.supported,true);assert.equal(result.value.notes.a.draft.content,'current a');
  assert.equal(result.value.wikiIndexSupported,false);assert.equal(JSON.stringify(result.value).includes('UNREAD_WIKI_OPERATION_BODY'),false);
  assert.ok(result.ids.every(id=>!id.includes('"wiki_lifecycle","one"')&&!id.includes('"wiki_ingest_operations","one"')));
  root.contexts[account].future_metadata={unknown:true};assert.equal(read(root).value.supported,false);
});
test('current preview rejects broken selected structure and preserves absent-account distinction',()=>{
  const root=fixture();root.contexts[account].notes.a.draft.owner_id='bob';assert.equal(read(root).value.supported,false);
  assert.deepEqual(read({schema_version:1,contexts:{}}).value.notes,{});
  const physical=parts.encode(fixture());physical.delete(JSON.stringify(['contexts',account,'notes','a','raw']));
  const steps=parts.currentSteps(account);let step=steps.next();assert.throws(()=>{while(!step.done)step=steps.next(physical.get(step.value));},/part/i);
});
test('current preview validates the shared note directory once, with linear work as notes double',()=>{
  function count(size){
    const root=fixture(),item=root.contexts[account].notes.a;
    root.contexts[account].notes=Object.fromEntries(Array.from({length:size},(_,i)=>{const id='n'+i;return [id,{...item,raw:{...item.raw,local_id:id},draft:{...item.draft,local_id:id}}];}));
    const physical=parts.encode(root),directory=physical.get(JSON.stringify(['contexts',account,'notes']));let visits=0;
    directory.entries=directory.entries.map(entry=>new Proxy(entry,{get(target,key,receiver){if(key==='0')visits++;return Reflect.get(target,key,receiver);}}));
    const steps=parts.currentSteps(account);let step=steps.next();while(!step.done)step=steps.next(physical.get(step.value));
    assert.equal(Object.keys(step.value.notes).length,size);return visits;
  }
  const small=count(60),large=count(120);assert.ok(large<=small*2.2,`directory validation grew ${small} -> ${large}`);
  assert.ok(large<120*15,`directory validation repeated ${large} times`);
});

test('normal sync errors do not force full history loading or leak error details into the preview',()=>{
  const root=fixture(),entry=root.contexts[account].notes.a;
  entry.error={code:'request_failed',message:'PRIVATE_ERROR_DETAIL'};
  const result=read(root);
  assert.equal(result.value.supported,true);
  assert.equal(JSON.stringify(result.value).includes('PRIVATE_ERROR_DETAIL'),false);
  assert.equal(result.value.notes.a.draft.content,'current a');
  for(const invalid of ['text',[],{code:'request_failed',message:'x',extension:true},{code:{},message:'x'}]){
    entry.error=invalid;assert.equal(read(root).value.supported,false);
  }
});

test('known conflicts are projected as a flag without reading saved remote or local conflict bodies',()=>{
  const root=fixture(),entry=root.contexts[account].notes.a;
  entry.conflict={code:'version_conflict',base:{private:'UNREAD_BASE'},local:{private:'UNREAD_LOCAL'},remote:{private:'UNREAD_REMOTE'}};
  entry.archived_outbox=[{private:'UNREAD_ARCHIVED_REQUEST'}];
  entry.comparison={snapshot:{note:{content:'UNREAD_COMPARISON'}}};
  const result=read(root);
  assert.equal(result.value.supported,true);
  assert.equal(result.value.notes.a.conflicted,true);
  assert.ok(!JSON.stringify(result.value).includes('UNREAD_'));
  assert.ok(result.ids.every(id=>!id.includes('"conflict","')&&!id.includes('"archived_outbox","')));
  entry.conflict.extension=true;assert.equal(read(root).value.supported,false);
  delete entry.conflict.extension;entry.comparison=[];assert.equal(read(root).value.supported,false);
});
