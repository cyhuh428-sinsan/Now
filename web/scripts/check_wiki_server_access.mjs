import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-protocol.js',import.meta.url),'utf8'),box);
try{vm.runInContext(await fs.readFile(new URL('../vendor/wiki-server-access.js',import.meta.url),'utf8'),box);}catch(e){if(e.code!=='ENOENT')throw e;}
assert.equal(typeof box.NowWikiServerAccess?.create,'function','server proof adapter required');
const id=webcrypto.randomUUID(),instance=webcrypto.randomUUID(),revision=webcrypto.randomUUID(),branch=webcrypto.randomUUID();
const now='2026-11-01T00:00:00.000000Z',note={id:1,owner_id:'alice',local_id:id,device_id:'one',note_type:'tree',title:'Evidence',content:'Exact server evidence',source:'manual',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
const current={status:'ok',snapshot:{schema_version:1,note},head_revision_id:revision,head_version:1,crypto_epoch:0,history_generation:1,protection_state:'legacy',identity_state:'coherent',replica_count:1,inventory_revision_ids:[revision],has_replica_variants:false};
let key='alice',scenario='',reads=[],currentReads=0;
const api={context:()=>({owner:'alice',device:'one',url:'https://synthetic.invalid',enabled:true,online:true}),contextKey:()=>key,
  request:async(path,method,body)=>{
    reads.push({path,method});assert.equal(method,'GET','proof never writes');
    if(path==='/api/v1/server')return {status:'ok',capabilities:{wiki_document_schema:2,wiki_operations_v1:scenario!=='unsupported',wiki_operation_manifest_schema:scenario==='old-manifest'?1:2}};
    if(path==='/api/v2/notes/current'){
      currentReads++;const result=structuredClone(current);
      if(scenario==='fence')result.crypto_transition={transition_id:webcrypto.randomUUID(),state:'prepared',preparation_only:true};
      if(scenario==='changed'&&currentReads>1)result.head_version++;
      if(scenario==='late')key='bob';return result;
    }
    if(path==='/api/v2/notes/crypto-transitions/status')return {server_instance_id:scenario==='instance-changed'&&currentReads>1?webcrypto.randomUUID():instance,preparation_only:true,
      ...Object.fromEntries(['head_revision_id','head_version','crypto_epoch','history_generation','protection_state','identity_state','inventory_revision_ids'].map(k=>[k,current[k]])),current_exists:true};
    if(path==='/api/v2/notes/revisions')return {status:'ok',items:body.cursor?[{revision_ref:{kind:'offline_branch',id:branch},representation_epoch:scenario==='past-protected'?1:0}]:[{revision_ref:{kind:'note_revision',id:revision},representation_epoch:0}],
      next_cursor:body.cursor?null:'second-page',crypto_epoch:0,history_generation:1};
    if(path==='/api/v2/notes/revision'){
      const snapshot=structuredClone(current.snapshot);if(scenario==='old-cipher'&&body.revision_id===branch)snapshot.note.content='NOW_ENCRYPTED_V1:synthetic';
      return {status:'ok',revision_ref:{kind:body.revision_kind,id:body.revision_id},snapshot,crypto_epoch:0};
    }
    throw Error('unexpected_request:'+path);
  }};
const access=box.NowWikiServerAccess.create(api);
const proof=await access.inspect(id,{content:note.content,revisionId:revision,headVersion:1});
assert.equal(proof.instance,instance);assert.equal(proof.safety.lineage,false);assert.equal(reads.filter(r=>r.path.endsWith('/revision')).length,2);
for(const test of ['unsupported','old-manifest','fence','past-protected','old-cipher','changed','instance-changed','late']){
  scenario=test;key='alice';reads=[];currentReads=0;await assert.rejects(()=>access.inspect(id,{content:note.content,revisionId:revision,headVersion:1}),undefined,test);
}
scenario='old-manifest';key='alice';currentReads=0;await access.inspect(id,{content:note.content,revisionId:revision,headVersion:1},{policy:1});
assert.equal(typeof access.verifyReceipt,'function','strict operation receipt verifier required');
const wiki=webcrypto.randomUUID(),manifest={schema_version:1,owner_id:'alice',device_id:'one',operation_id:webcrypto.randomUUID(),mutation_id:webcrypto.randomUUID(),commit_mutation_id:webcrypto.randomUUID(),abort_mutation_id:webcrypto.randomUUID(),kind:'ingest',inputs:[{id:'s1',kind:'note',origin:'server',note_ref:{owner_id:'alice',local_id:id},source_revision_id:revision,head_version:1,content_hash:'a'.repeat(64)}],draft_bindings:[],changes:[{wiki_id:wiki,action:'create_draft',note_mutation_id:webcrypto.randomUUID(),base_head_revision_id:null,base_head_version:0,base_index_version:0,base_document_version:0,result_document_hash:'b'.repeat(64)}]};
manifest.manifest_hash=await box.NowNoteProtectionProtocol.hashJson(manifest);
const page={status:'ok',wiki_operation:true,operation_id:manifest.operation_id,manifest_hash:manifest.manifest_hash,wiki_id:wiki,mutation_id:manifest.changes[0].note_mutation_id,result_revision_id:webcrypto.randomUUID(),result_head_version:1,result_inventory_revision_ids:[],crypto_epoch:0,history_generation:1,document_version:1,index_version:1,document_schema_floor:2,result_document_hash:'b'.repeat(64)};
page.result_inventory_revision_ids=[page.result_revision_id];
const receipt={status:'ok',wiki_operation:true,operation_id:manifest.operation_id,manifest_hash:manifest.manifest_hash,state:'committed',pages:[page]};
assert.equal(access.verifyReceipt(receipt,manifest).state,'committed');
for(const mutate of [v=>v.pages[0].result_document_hash='c'.repeat(64),v=>v.pages[0].mutation_id=webcrypto.randomUUID(),v=>v.pages[0].document_version=2,v=>v.pages[0].extra='forbidden',v=>v.pages=[]]){
  const wrong=structuredClone(receipt);mutate(wrong);assert.throws(()=>access.verifyReceipt(wrong,manifest));
}
let writes=0,statusReads=0;
const remote=box.NowWikiServerAccess.create({...api,request:async(path,method)=>{
  if(path==='/api/v1/server')return {status:'ok',capabilities:{wiki_document_schema:2,wiki_operations_v1:true,wiki_operation_manifest_schema:2}};
  if(path==='/api/v2/notes/crypto-transitions/status')return {server_instance_id:instance,preparation_only:true,current_exists:false};
  if(method==='POST'){writes++;throw Error('synthetic response lost');}
  statusReads++;return {status:'ok',operation_id:manifest.operation_id,state:'committed',manifest_hash:manifest.manifest_hash,manifest,receipt};
}});key='alice';
await assert.rejects(()=>remote.abort(manifest,instance),/response lost/);assert.equal(writes,1);assert.equal(statusReads,0,'no automatic status or repeated write');
assert.equal((await remote.status(manifest,instance)).receipt.state,'committed');assert.equal(writes,1);assert.equal(statusReads,1,'explicit status returns original receipt even after source deletion');
console.log('Wiki server access: fresh capabilities/instance, all revision pages, old cipher/fence/epoch, changed and late contexts PASS (synthetic HTTP only)');
