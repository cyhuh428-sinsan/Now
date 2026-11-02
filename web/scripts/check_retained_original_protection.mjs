import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),doc=require('../../desktop/document-file.cjs');
const root=path.resolve(import.meta.dirname,'../..'),qa='D:/tmp/nownote-241-migration';
const DATA='nownote.web.v1',HISTORY='nownote.history.v1',SETTINGS='nownote.web.settings.v1',LIBRARY='nownote.library.v1';
fs.mkdirSync(qa,{recursive:true});
for(const file of ['web/app.js','desktop/app/app.js']){
  const dir=fs.mkdtempSync(path.join(qa,'protection-')),store=path.join(dir,'store.json');
  const scope={url:'https://synthetic.invalid',owner:'alice',instance:'11111111-1111-4111-8111-111111111111',local_id:'target',device:'qa'};
  const context={...scope,enabled:true,auth:'synthetic-only'},plaintext='RETAINED_ORIGINAL_BODY_0946';
  const old={version:1,updatedAt:null,unknown:{keep:[1,null]},values:{[DATA]:{tree:[{id:'target',title:'Synthetic old note',content:plaintext,parentId:null,level:1,children:[]},{id:'other',content:'KEEP_OTHER',children:[]}]},[HISTORY]:{schema_version:1,contexts:{}}}};
  fs.writeFileSync(store,JSON.stringify(old,null,3));doc.initialize(store,{syntheticLegacy:true});
  let interrupt=false;
  const storage={read:async key=>doc.readKey(store,key),write:async(key,value,options)=>{doc.writeKey(store,key,value,options?.expectedValue);return {ok:true};},
    original:{read:async key=>doc.readOriginal(store,key),cas:async(key,value,expected)=>{
      if(interrupt&&JSON.stringify(value).includes('NOW_ENCRYPTED_V1:')){interrupt=false;throw Error('synthetic_original_interruption');}
      return doc.casOriginal(store,key,value,expected);
    }}};
  const box=vm.createContext({structuredClone,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,
    isDesktopClient:()=>true,isHostedWebClient:()=>false,window:{nownoteDesktop:{storage}},
    STORAGE_KEY:DATA,SETTINGS_KEY:SETTINGS,NOTE_HISTORY_KEY:HISTORY,LIBRARY_STORAGE_KEY:LIBRARY,
    DESKTOP_STORAGE_KEYS:new Set([DATA,SETTINGS,HISTORY,LIBRARY]),state:{data:{tree:[]},settings:{}},
    localStorage:{getItem:()=>null},navigator:{locks:{request:(_key,action)=>action()}},invalidateNoteProtectionSupport:()=>{}});
  try{
    for(const name of ['note-protection-protocol.js','note-protection-state.js','note-protection-client.js','note-history-state.js'])
      vm.runInContext(fs.readFileSync(path.join(root,'web/vendor',name),'utf8'),box);
    const source=fs.readFileSync(path.join(root,file),'utf8'),start=source.indexOf('function protectionStorageAdapters()'),end=source.indexOf('\nfunction initializeNoteProtection()',start);
    assert(start>0&&end>start);vm.runInContext(source.slice(start,end),box);
    let expected=doc.readKey(store,HISTORY);
    const journal=()=>box.NowNoteHistory.create({initial:doc.readKey(store,HISTORY),context:()=>context,request:async()=>{throw Error('No network allowed');},
      write:async value=>{doc.writeKey(store,HISTORY,value,expected);expected=structuredClone(value);}});
    box.noteHistory=journal();
    const stores=()=>box.protectionStorageAdapters();
    assert.equal(stores().filter(item=>item.name.startsWith('original:')).length,4);
    const client=box.NowNoteProtectionClient.create({context:()=>context,stores});
    const copies=await client.copies(scope);assert(copies.some(item=>item.store==='original:'+DATA));
    await client.confirm(scope,copies,copies.map(item=>item.id));
    let committed=false;
    const remote={drainPrepare:async()=>({state:'ready',pending_count:0}),drainStatus:async()=>({state:'ready',pending_count:0}),fresh:async()=>({verified:true}),
      prepare:async()=>({operation_id:'synthetic',state:'prepared',promoted:true}),stage:async()=>({verified:true}),
      status:async()=>({state:committed?'committed':'prepared',receipt_matches_current:true,receipt:committed?{operation_id:'synthetic'}:null}),
      commit:async()=>{committed=true;return remote.status();}};
    const controller=()=>box.NowNoteProtectionState.create({context:()=>context,journal:box.noteHistory,stores,remote,preflight:async()=>{}});
    let protection=controller();
    const operation=await protection.start(scope,{schema_version:3,purpose:'mixed_conversion'},'synthetic-only');
    interrupt=true;await assert.rejects(()=>protection.resume(operation,'synthetic-only',async()=>({synthetic:true})),/synthetic_original_interruption/);
    assert.equal(protection.status(operation).phase,'applying');
    assert(fs.readFileSync(store+'.original-v1.json','utf8').includes(plaintext));
    doc.closeAll();doc.initialize(store);box.noteHistory=journal();protection=controller();
    await protection.resume(operation,'synthetic-only',async()=>({synthetic:true}));
    assert.equal(protection.status(operation).phase,'complete');
    const original=doc.readOriginal(store,DATA);
    assert(original.tree[0].protection_record);assert.equal(original.tree[1].content,'KEEP_OTHER');
    assert(!fs.readFileSync(store+'.original-v1.json','utf8').includes(plaintext));
    assert(!JSON.stringify(doc.read(store)).includes(plaintext));
    assert.deepEqual(JSON.parse(fs.readFileSync(store+'.original-v1.json')).unknown,old.unknown);
    fs.unlinkSync(store+'.original-v1.json');
    await assert.rejects(()=>client.copies(scope),/original/i);
    console.log(file+': retained original discovery/confirmation, crypto settlement interruption/restart, required-copy refusal PASS');
  }finally{
    doc.closeAll();const relative=path.relative(fs.realpathSync(qa),fs.realpathSync(dir));
    if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe cleanup');
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
