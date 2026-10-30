import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let passed=0;
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8'),start=source.indexOf('async function prepareProtectedImport(');
  assert.ok(start>=0,'actual app must load original protected pending branches before MI selection');
  const tail=source.slice(start),end=/\n(?:async )?function [A-Za-z]/.exec(tail);
  const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
  for(const name of ['note-protection-protocol','note-protection-state','note-protection-client','note-history-state'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
  const Q=box.NowNoteProtectionProtocol,H=box.NowNoteHistory;
  const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',device:'current-device',instance:uid(1)};
  let current=true;
  box.protectionActionGuard=()=>()=>{if(!current)throw Error('scope_changed');};
  box.noteProtectionInternalEnabled=true;box.noteHistoryCaptureChain=Promise.resolve();box.storagePendingWrites=new Set();
  box.serverSyncRunning=false;box.noteProtectionEditSession=null;
  const note={id:99,owner_id:'alice',local_id:'memo',device_id:'physical-device',note_type:'tree',title:'Original',content:'PRIVATE\r\n',
    parent_local_id:null,level:1,tags:null,source:null,deleted_at:null,client_updated_at:null,created_at:'2026-10-30T00:00:00.000001Z',updated_at:'2026-10-30T00:00:00.000002Z'};
  const value={raw:note,draft:{...note,content:'Unsent'},base:{inventory_revision_ids:[]},revisions:[{revision_id:uid(10),parent_ref:null,snapshot:{schema_version:1,note},imported:false}],
    outbox:[{revision_id:uid(10),sent:false,body:{owner_id:'alice',local_id:'memo',device_id:'capture-device'}}],receipts:[],dirty:true,protectionScope:scope};
  let record;
  async function local(v){record={protection_record:{schema_version:1,scope,operation_id:uid(2),ciphertext:await Q.encryptContent(JSON.stringify({schema_version:1,scope,operation_id:uid(2),value:v}),'archive-key')}};}
  await local(value);
  box.noteHistory={export:()=>({contexts:{[H.key(scope)]:{notes:{memo:record}}}}),legacyPending:()=>false,failure:()=>null};
  box.noteProtectionClient=box.NowNoteProtectionClient.create({context:()=>({...scope,auth:'token'}),stores:()=>[]});
  const info={scope,pending:null,catalog:{catalog_digest:'a'.repeat(64),context:{base:{head_version:2,head_revision_id:null,crypto_epoch:2,history_generation:3,protection_state:'protected',inventory_revision_ids:[],identity_state:'branch_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1},entries:[]}};
  vm.runInContext(tail.slice(0,end.index)+'\nglobalThis.prepare=prepareProtectedImport;',box);
  const before=JSON.stringify(record),result=await box.prepare(info,async()=> 'archive-key');
  assert.equal(result.branches[0].origin_device_id,'capture-device');assert.equal(result.branches[0].snapshot.note.device_id,'physical-device');
  assert.equal(result.branches[0].snapshot.note.id,99);assert.equal(JSON.stringify(record),before);passed++;
  const unknown=structuredClone(value);unknown.outbox[0].sent=true;await local(unknown);
  await assert.rejects(box.prepare(info,async()=> 'archive-key'),/original_request_unconfirmed/);passed++;
  const missing=structuredClone(value);missing.outbox=[];await local(missing);
  await assert.rejects(box.prepare(info,async()=> 'archive-key'),/origin_device/);passed++;
  const conflicting=structuredClone(value);conflicting.revisions[0].origin_device_id='other-device';await local(conflicting);
  await assert.rejects(box.prepare(info,async()=> 'archive-key'),/origin_device/);passed++;
  await local(value);box.noteProtectionInternalEnabled=false;
  await assert.rejects(box.prepare(info,async()=> 'archive-key'),/not_enabled/);passed++;
  box.noteProtectionInternalEnabled=true;
  await assert.rejects(box.prepare(info,async()=>{current=false;return 'archive-key';}),/scope_changed/);passed++;
  current=true;await local(value);
  const importStart=source.indexOf('async function importProtectedBranches(');
  assert.ok(importStart>=0,'actual app must start the purpose-fixed MI controller for explicit branch selection');
  const importTail=source.slice(importStart),importEnd=/\n(?:async )?function [A-Za-z]/.exec(importTail);
  vm.runInContext(importTail.slice(0,importEnd.index)+'\nglobalThis.runImport=importProtectedBranches;',box);
  let started=0,resumed=0,captured;
  box.noteProtectionImport={start:async(s,i,key)=>{assert.equal(key,'bundle-key');started++;captured=structuredClone(i);return uid(30);},
    resume:async(id,key,build)=>{assert.equal(id,uid(30));assert.equal(typeof build,'function');resumed++;}};
  box.noteProtectionReader={read:async()=>{throw Error('no_existing_sources');}};
  assert.equal(await box.runImport(info,[uid(10)],'bundle-key',async()=> 'archive-key'),uid(30));
  assert.equal(captured.prepare.entries[0].origin_device_id,'capture-device');
  assert.equal(Q.canonicalJson(captured.local_record),Q.canonicalJson(record));
  assert.equal(captured.local_journal.outbox.length,1);assert.equal(Object.hasOwn(captured,'archiveKey'),false);
  assert.equal(started,1);assert.equal(resumed,1);passed++;
  await assert.rejects(box.runImport(info,[uid(10),uid(10)],'bundle-key',async()=> 'archive-key'),/selection/);assert.equal(started,1);passed++;
  await assert.rejects(box.runImport(info,[uid(99)],'bundle-key',async()=> 'archive-key'),/selection/);assert.equal(started,1);passed++;
  let adapters;
  box.NowNoteProtectionState={...box.NowNoteProtectionState,createImport:options=>{adapters=options;return {};}};
  box.noteProtectionIdentity={instance:scope.instance};box.noteProtectionViewGeneration=0;
  box.noteHistoryContext=()=>({...scope,enabled:true,auth:'token'});
  box.protectionStorageAdapters=()=>[];box.protectionTargetId=()=>scope.local_id;
  box.noteHistory=H.create({initial:{schema_version:1,contexts:{[H.key(scope)]:{notes:{memo:record}}}},
    context:()=>({...scope,enabled:true,auth:'token'}),request:async()=>{throw Error('no_network');},
    write:async data=>assert.equal(JSON.stringify(data).includes('PRIVATE'),false)});
  const initStart=source.indexOf('function initializeNoteProtection('),initTail=source.slice(initStart),initEnd=/\n(?:async )?function [A-Za-z]/.exec(initTail);
  vm.runInContext(initTail.slice(0,initEnd.index)+'\ninitializeNoteProtection();',box);
  assert.ok(adapters,'actual app initializes the purpose-fixed MI controller');
  const originalRecord=structuredClone(record),capturedLocal=await adapters.capture(scope,()=>true,{local_record:originalRecord});
  const base=info.catalog.context,operation_id=uid(30),mutation_id=uid(31);
  const receipt={schema_version:3,purpose:'mixed_offline_import',operation_id,mutation_id,owner_id:scope.owner,local_id:scope.local_id,server_instance_id:scope.instance,
    result:{...base,base:{...base.base,head_version:3,history_generation:4}}};
  const work={local_journal:structuredClone(value),branches:[result.branches[0]],new_branch_ids:[uid(10)],commit:{base,operation_id,mutation_id}};
  const settled=await adapters.settle(scope,capturedLocal,work,receipt,'bundle-key');
  assert.equal(JSON.stringify(settled).includes('PRIVATE'),false);
  await adapters.apply(scope,capturedLocal,{...work,local:settled},receipt,()=>true);
  const saved=box.noteHistory.export().contexts[H.key(scope)].notes.memo;
  const reopened=await box.noteProtectionClient.openArchive(scope,saved,'bundle-key');
  assert.equal(reopened.revisions[0].imported,true);assert.equal(reopened.draft.content,'Unsent');assert.equal(reopened.outbox.length,1);passed++;
}
const ui=await fs.readFile(new URL('../vendor/note-protection-ui.js',import.meta.url),'utf8');
assert.ok(ui.includes('data-action="imports"')&&ui.includes('data-action="import-selected"'),'MI requires explicit list/select/import controls, not automatic import');
assert.ok(ui.includes('api.importSelected')&&ui.includes('api.imports'),'controls must call actual app actions');
console.log('MI app selection source: '+passed+' PASS (actual Web/Desktop functions, cipher archive; synthetic source/storage; UI control presence only)');
