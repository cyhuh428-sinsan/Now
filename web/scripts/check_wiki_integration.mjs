import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
const id='wiki:11111111-1111-4111-8111-111111111111';
const ctx={url:'https://example.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true,headers:{}};
const note={id:null,owner_id:'alice',local_id:id,device_id:'one',note_type:'tree',title:'AI Wiki '+id.slice(5),
  content:'{"drafts":["preserve exact"]}',source:'wiki-artifact',parent_local_id:null,level:1,deleted_at:null};
for(const surface of ['web','desktop/app']){
  const app=await read(surface+'/app.js');
  assert.ok(app.includes('initializeWikiNotebook()'),surface+': product startup must consume the wiki notebook');
  assert.ok(app.includes('createWikiNotebook({'),surface+': product must use the existing durable journal adapter');
  assert.ok(app.includes('wikiUI?.check()'),surface+': account/protection context changes must invalidate displayed wiki text');
  const viewStart=app.indexOf('function wikiViewKey()'),viewEnd=app.indexOf('\nfunction wikiSourceNote(',viewStart);
  let actor='one';
  const viewBox=vm.createContext({noteHistoryContext:()=>({...ctx,device:actor}),noteHistoryCaptureEpoch:0,noteProtectionViewGeneration:0});
  vm.runInContext(app.slice(viewStart,viewEnd),viewBox);
  const firstKey=vm.runInContext('wikiViewKey()',viewBox);actor='two';
  assert.notEqual(vm.runInContext('wikiViewKey()',viewBox),firstKey,surface+': a changed actor must invalidate pending consent and results');
  const captureStart=app.indexOf('function noteHistoryCaptureDrafts('),captureEnd=app.indexOf('\nasync function noteHistoryFlush()',captureStart);
  const box=vm.createContext({structuredClone,crypto:webcrypto,vaultHistoryApplying:false,noteHistoryProjection:false,
    noteHistoryContext:()=>ctx,noteHistoryCaptureEpoch:0,noteHistoryProjectionScope:'',noteHistoryCaptureChain:Promise.resolve(),
    noteHistoryEnrolling:new Set(),noteHistoryTimers:new Map(),noteHistoryRemoteCache:new Map(),noteHistoryLastError:'',
    noteHistoryWireNotes:()=>[],noteProtectionBlocked:()=>false,state:{data:{tree:[]},settings:{server:{}}},
    findTreeNode:()=>null,isTreeNodeSharedForServer:()=>false,findLocalNoteForServerNote:()=>null,noteTitle:x=>x,
    tagsFromServerNote:()=>[],setTimeout:()=>{throw Error('unexpected wiki projection edit');},
    showNotice:()=>{},renderSyncStatusIndicator:()=>{}});
  vm.runInContext(await read('web/vendor/note-history-state.js'),box);
  const journal=box.NowNoteHistory.create({context:()=>ctx,request:async()=>{throw Error('network forbidden');},write:async()=>{}});
  await journal.track(note,null,{localOnly:true});
  box.noteHistory=journal;
  vm.runInContext(app.slice(captureStart,captureEnd),box);
  vm.runInContext('noteHistoryCaptureDrafts()',box);await box.noteHistoryCaptureChain;
  assert.equal(journal.view(id).draft.content,note.content,surface+': absent from tree must not erase wiki');
  assert.equal(journal.view(id).draft.deleted_at,null,surface+': absent from tree must not delete wiki');
  const projectStart=app.indexOf('function noteHistoryProject('),projectEnd=app.indexOf('\nfunction noteHistoryAcceptRemote(',projectStart);
  const project=vm.createContext({noteHistoryContext:()=>ctx,noteHistory:{view:()=>({})},
    findTreeNode:()=>{throw Error('wiki must never project into normal tree');}});
  vm.runInContext(app.slice(projectStart,projectEnd),project);project.wikiNote=note;
  vm.runInContext('noteHistoryProject(wikiNote)',project);
  const requestStart=app.indexOf('async function noteHistoryRequest('),requestEnd=app.indexOf('\nfunction noteHistoryWireNotes()',requestStart);
  let requested;
  const requestBox=vm.createContext({URLSearchParams,AbortSignal,noteHistory:{legacyPending:()=>null},
    fetch:async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({status:'ok'})};}});
  vm.runInContext(app.slice(requestStart,requestEnd),requestBox);
  requestBox.ctx=ctx;requestBox.body={local_id:id,owner_id:ctx.owner,note};
  await vm.runInContext("noteHistoryRequest(ctx,'current','PUT',body)",requestBox);
  assert.equal(requested.url,ctx.url+'/api/v1/wikis/'+id.slice(5)+'/current');
  await vm.runInContext("noteHistoryRequest(ctx,'revisions/import','POST',body)",requestBox);
  assert.equal(requested.url,ctx.url+'/api/v1/wikis/'+id.slice(5)+'/revisions/import');
  await vm.runInContext("noteHistoryRequest(ctx,'current','GET',body)",requestBox);
  assert.ok(requested.url.startsWith(ctx.url+'/api/v2/notes/current?'));
}
console.log('Wiki journal integration: no tree projection/deletion, dedicated publication/import routes PASS');
