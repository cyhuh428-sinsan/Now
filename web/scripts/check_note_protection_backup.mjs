import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol','note-protection-state','note-history-state'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
const P=box.NowNoteProtectionState,H=box.NowNoteHistory,Q=box.NowNoteProtectionProtocol;
assert.equal(typeof P.validateBackupImport,'function','bulk restore must validate protected copies before replacing any store');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',device:'one',instance:uid(1)};
const note={owner_id:'alice',local_id:'memo',content:'SYNTHETIC-OLD-PLAINTEXT',title:'Title'};
const plain={raw:note,draft:note,base:{inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[],protectionScope:scope};
const cipher=await Q.encryptContent(JSON.stringify({schema_version:1,scope,operation_id:uid(2),value:plain}),'synthetic-backup-key');
const protectedItem={protection_record:{schema_version:1,scope,operation_id:uid(2),ciphertext:cipher}};
const history={schema_version:1,contexts:{[H.key(scope)]:{notes:{memo:protectedItem}}}};
const marker={schema_version:1,id:uid(3),scope,phase:'complete',cipher_bundle:cipher};
const markerOnly={schema_version:1,contexts:{},protection_operations:{[marker.id]:marker}};
assert.equal(P.validateBackupImport({history:markerOnly},{history:structuredClone(markerOnly)}),true,'completed marker-only analysis is protected source data');
const changedMarker=structuredClone(markerOnly);changedMarker.protection_operations[marker.id].cipher_bundle+='changed';
assert.throws(()=>P.validateBackupImport({history:markerOnly},{history:changedMarker}),/backup_operation_changed/);
const node={id:'memo',title:'보호된 메모',content:cipher,protection_record:protectedItem.protection_record,children:[]};
const current={data:{tree:[node]},history};
const good=structuredClone(current),before=JSON.stringify(current);
assert.equal(P.validateBackupImport(current,good),true);
assert.equal(JSON.stringify(current),before);
for(const invalid of ['x',[],null,1]){
  const malformed=structuredClone(good);malformed.history.protection_operations=invalid;
  assert.throws(()=>P.validateBackupImport(current,malformed),/backup_/);
}
for(const kind of ['tree','history','snapshot','missing','foreign']){
  const candidate=structuredClone(good);
  if(kind==='tree')candidate.data.tree=[{id:'memo',title:'Old',content:note.content,children:[]}];
  if(kind==='history')candidate.history.contexts[H.key(scope)].notes.memo=structuredClone(plain);
  if(kind==='snapshot')candidate.data.snapshots=[{data:{tree:[{id:'memo',content:note.content,children:[]}]}}];
  if(kind==='missing'){candidate.data.tree=[];candidate.history={schema_version:1,contexts:{}};}
  if(kind==='foreign'){
    candidate.data.tree[0].protection_record.scope={...scope,instance:uid(9)};
    candidate.history.contexts[H.key(scope)].notes.memo.protection_record.scope={...scope,instance:uid(9)};
  }
  assert.throws(()=>P.validateBackupImport(current,candidate),/backup_|scope/);
  assert.equal(JSON.stringify(current),before);
}
assert.equal(P.validateBackupImport({data:{tree:[]}},{data:{tree:[{id:'ordinary',content:'ordinary'}]}}),true);
let disk=structuredClone(history),failWrite=false;
const context=()=>({...scope,auth:'synthetic',enabled:true});
const journal=H.create({initial:history,context,request:async()=>{throw Error('no_network');},write:async value=>{
  if(failWrite)throw Error('synthetic_disk_failure');disk=structuredClone(value);
}});
assert.equal(typeof journal.validateImport,'function');
for(const invalid of ['x',[],null,1]){
  const malformed=structuredClone(history);malformed.protection_operations=invalid;
  await assert.rejects(journal.import(malformed),/형식|backup_/);
  assert.equal(JSON.stringify(journal.export()),JSON.stringify(history));
}
const empty=H.create({context,request:async()=>{throw Error('no_network');},write:async()=>{}});
assert.throws(()=>empty.validateImport(null),/형식/);
const incoming=structuredClone(history);incoming.contexts[H.key(scope)].notes.memo=plain;
await assert.rejects(journal.import(incoming),/backup_/);
assert.equal(JSON.stringify(journal.export()),JSON.stringify(history));
assert.equal(JSON.stringify(disk),JSON.stringify(history));
const misplaced={schema_version:1,contexts:{[H.key({...scope,owner:'bob'})]:{notes:{memo:protectedItem}}}};
await assert.rejects(journal.import(misplaced),/형식|backup_/);
assert.equal(JSON.stringify(journal.export()),JSON.stringify(history));
const malformed={schema_version:1,contexts:{invalid:{notes:{bad:{}}}}};
await assert.rejects(journal.import(malformed),/형식/);
failWrite=true;
await assert.rejects(journal.import(history),/synthetic_disk_failure/);
assert.equal(JSON.stringify(journal.export()),JSON.stringify(history));
assert.equal(JSON.stringify(disk),JSON.stringify(history));
failWrite=false;await journal.import(history);
assert.equal(journal.export().contexts[H.key(scope)].notes.memo.protection_record.ciphertext,cipher);
assert.equal(journal.export().recovery_archives[0].contexts[H.key(scope)].notes.memo.protection_record.ciphertext,cipher);
assert.equal(JSON.stringify(disk).includes(note.content),false);
const withMarker=structuredClone(history);withMarker.protection_operations={[marker.id]:marker};
const retained=H.create({initial:withMarker,context,request:async()=>{throw Error('no_network');},write:async()=>{}});
await retained.import(history);
assert.equal(retained.export().protection_operations[marker.id].cipher_bundle,cipher,'existing completed analysis marker must not be discarded by whole import');
for(const file of ['../app.js','../../desktop/app/app.js']){
  const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
  const extract=name=>{
    const start=source.search(new RegExp('(?:async )?function '+name+'\\('));
    assert.ok(start>=0,file+': actual JSON import must validate protected copies before any replacement');
    const tail=source.slice(start),end=/\n(?:async )?function [A-Za-z]/.exec(tail);
    return end?tail.slice(0,end.index):tail;
  };
  let invalidated=false,validated=0;
  const appBox=vm.createContext({structuredClone,Set,Promise,Object,NowNoteProtectionState:P,
    noteHistoryCaptureChain:Promise.resolve(),storagePendingWrites:new Set(),
    protectionActionGuard:()=>()=>{if(invalidated)throw Error('scope_changed');},requireProtectionSettled:()=>{},
    noteHistory:{validateImport:()=>{validated++;}},
    protectionStorageAdapters:()=>[
      {kind:'data',read:async()=>structuredClone(current.data)},
      {kind:'history',read:async()=>structuredClone(history)}]});
  vm.runInContext(extract('validateProtectedBackupImport')+'\nglobalThis.checkImport=validateProtectedBackupImport;',appBox);
  await appBox.checkImport(good);assert.equal(validated,1);
  const bad=structuredClone(good);bad.data.tree=[{id:'memo',content:note.content}];
  await assert.rejects(appBox.checkImport(bad),/backup_/);
  appBox.protectionStorageAdapters=()=>[{kind:'history',read:async()=>{invalidated=true;return structuredClone(history);}}];
  await assert.rejects(appBox.checkImport(good),/scope_changed/);
  const importing=extract('importData');
  const check=importing.indexOf('await validateProtectedBackupImport(parsed)');
  assert.ok(check>=0 && check<importing.indexOf('confirmAction('));
  assert.equal(importing.split('await validateProtectedBackupImport(parsed)').length-1,2,'revalidate after the confirmation wait');
  assert.ok(importing.lastIndexOf('await validateProtectedBackupImport(parsed)')<importing.indexOf('createRecoverySnapshot('));
  invalidated=false;
  let loaded,confirmations=0,recoveries=0,downloads=0,persisted=0,notices=[];
  const original=structuredClone(current.data);
  appBox.state={data:structuredClone(original)};appBox.noteHistoryCaptureEpoch=0;
  appBox.noteHistory=H.create({initial:history,context,request:async()=>{throw Error('no_network');},write:async()=>{}});
  appBox.protectionStorageAdapters=()=>[{kind:'data',read:async()=>structuredClone(appBox.state.data)},
    {kind:'history',read:async()=>appBox.noteHistory.export()}];
  appBox.FileReader=class {readAsText(file){this.result=file.body;loaded=this.onload();}};
  appBox.parseBackupData=parsed=>({data:parsed.data});appBox.backupSummary=()=>({tree:1});
  appBox.confirmAction=async()=>{confirmations++;return true;};appBox.t=x=>x;
  appBox.showNotice=text=>notices.push(text);appBox.createRecoverySnapshot=()=>{recoveries++;};
  appBox.downloadCurrentBackup=()=>{downloads++;};appBox.backupDataShape=data=>structuredClone(data);
  appBox.normalizeData=()=>{};appBox.persist=()=>{persisted++;};appBox.render=()=>{};
  vm.runInContext(importing+'\nglobalThis.importFile=importData;',appBox);
  const event=data=>({target:{files:[{name:'synthetic.json',body:JSON.stringify(data)}],value:'selected'}});
  appBox.importFile(event(bad));await loaded;
  assert.equal(confirmations,0);assert.equal(recoveries+downloads+persisted,0);
  assert.equal(JSON.stringify(appBox.state.data),JSON.stringify(original));
  assert.equal(JSON.stringify(appBox.noteHistory.export()),JSON.stringify(history));
  assert.ok(notices[0].includes('보호된 메모'));
  notices=[];appBox.confirmAction=async()=>{confirmations++;invalidated=true;return true;};
  appBox.importFile(event(good));await loaded;
  assert.equal(recoveries+downloads+persisted,0,'account change while confirmation waits must not replace any store');
  invalidated=false;appBox.confirmAction=async()=>{confirmations++;return true;};
  appBox.importFile(event(good));await loaded;
  assert.equal(recoveries,1);assert.equal(downloads,1);assert.equal(persisted,1);
  assert.equal(appBox.noteHistory.export().contexts[H.key(scope)].notes.memo.protection_record.ciphertext,cipher);
}
console.log('Protected backup guard: cipher roundtrip, plaintext/missing/foreign copies, malformed journal and failed-write preservation PASS');
