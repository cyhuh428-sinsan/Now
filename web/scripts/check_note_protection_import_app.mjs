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
  const info={scope,pending:null,catalog:{context:{base:{crypto_epoch:2}},entries:[]}};
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
}
console.log('MI app selection source: '+passed+' PASS (actual Web/Desktop functions, cipher archive; synthetic source/storage)');
