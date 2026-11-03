const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
globalThis.crypto=require('node:crypto').webcrypto;
for(const name of ['note-history-state.js','history-snapshot.js','journal-writes.js','deferred-history.js','history-client.js'])require('../vendor/'+name);
const file=require('../../desktop/document-file.cjs'),{createHistorySession}=require('../../desktop/history-session.cjs');
test('shared client sync, edit, seal and cold read use Window IPC while preserving old bodies and requests',async()=>{
 const parent=path.resolve('D:/tmp/nownote-241-window-client');fs.mkdirSync(parent,{recursive:true});
 const own=fs.mkdtempSync(path.join(parent,'run-')),filename=path.join(own,'store.json'),key='nownote.history.v1',account=JSON.stringify(['https://qa.invalid','alice']),id='large';
 const note={owner_id:'alice',local_id:id,source:'manual',note_type:'tree',content:'current',title:'Synthetic'};
 const entry={raw:note,draft:structuredClone(note),base:{crypto_epoch:0,inventory_revision_ids:['head'],head_revision_id:'head',head_version:1},revisions:Array.from({length:10},(_,index)=>({revision_id:'old-'+index,imported:true,snapshot:{note:{...note,content:'old-'+index+'x'.repeat(8192)}}})),outbox:[],receipts:[{old:'receipt'}],completed_outbox:[{old:'completed'}],dirty:false,localOnly:false,needsBaseline:false,replicaSelected:true};
 const local={...structuredClone(entry),localOnly:true,raw:{...note,local_id:'local'},draft:{...note,local_id:'local'}};
 const root={schema_version:1,contexts:{[account]:{notes:{[id]:entry,local}}}};
 try{
  file.initialize(filename);file.writeKey(filename,key,root,null);let selected=0,full=0,remote={...note};
  const sender={},session=createHistorySession(()=>filename),context=()=>({url:'https://qa.invalid',owner:'alice',enabled:true,online:true,auth:'synthetic',device:'qa'});
  const backend={current:async account=>session.current(sender,account),select:async()=>{full++;throw Error('Old full-note path forbidden');},note:async()=>{throw Error('Old writer forbidden');},open:async()=>{throw Error('Whole journal forbidden');},
    selectWindow:async request=>{selected++;return session.selectWindow(sender,request);},noteWindow:async request=>session.noteWindow(sender,request)};
  const request=async(_ctx,route,method,body)=>{
   if(route==='revisions/import')return {imported_refs:body.entries.map(row=>({kind:'offline_branch',id:row.revision_id}))};
   if(route==='current'&&method==='GET')return {snapshot:{note:remote},crypto_epoch:0,head_revision_id:'head',head_version:1,inventory_revision_ids:['head'],replica_count:1};
   if(route==='current'&&method==='PUT'){remote={...remote,...body.note};return {mutation_id:body.mutation_id,result_revision_id:'new-head',result_head_version:2,result_inventory_revision_ids:['new-head'],crypto_epoch:0,history_generation:2};}
   throw Error('Unexpected synthetic request');
  };
  const {history}=await NowHistoryClient.create({backend,context,request});await history.sync();assert.equal(selected,1,'local-only no-op must not open history');
  await history.edit({...note,content:'한글 window edit'});await history.seal(id);await history.sync({onlyIds:[id]});
  assert.equal(full,0);assert.equal(history.deferred(),true);assert.equal(history.failure(),'');
  const saved=file.readKey(filename,key).contexts[account].notes[id];
  assert.deepEqual(saved.revisions.slice(0,10),entry.revisions);assert.deepEqual(saved.receipts[0],entry.receipts[0]);assert.deepEqual(saved.completed_outbox[0],entry.completed_outbox[0]);
  assert.equal(saved.outbox.length,0);assert.equal(saved.draft.content,'한글 window edit');assert.equal(saved.revisions.length,11);
  const cold=await NowHistoryClient.create({backend,context,request});assert.equal(cold.history.currentView(id).draft.content,'한글 window edit');
 }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(own)),parent);fs.rmSync(own,{recursive:true,force:true});}
});
