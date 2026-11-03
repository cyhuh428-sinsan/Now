const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function extract(source,name){
  const match=new RegExp('\\n(?:async )?function '+name+'\\(').exec(source);assert.ok(match,name);
  const rest=source.slice(match.index),next=/\n(?:async )?function [A-Za-z]/.exec(rest.slice(1));
  return next?rest.slice(0,next.index+1):rest;
}
for(const target of ['web/app.js','desktop/app/app.js'])test(target+' loads primary DTOs without reading/normalizing the history before its safe hydration gate',async()=>{
  const source=fs.readFileSync(target,'utf8'),reads=[],state={data:{}},box={state,NOTE_HISTORY_KEY:'history',STORAGE_KEY:'primary',
    protectionBootstrapPending:true,protectionBootstrapScopes:[],isHostedWebClient:()=>false,
    readStorage:async key=>{reads.push(key);if(key==='history')throw Error('early full history read');return {tree:[{id:'a',content:'UNMODIFIED'}]};},
    normalizeData:()=>{throw Error('premature normalization');},persist:()=>{throw Error('premature write');},clearStorage:()=>{throw Error('unexpected removal');}};
  vm.createContext(box);vm.runInContext(extract(source,'load'),box);await box.load();
  assert.deepEqual(reads,['primary']);assert.equal(state.data.tree[0].content,'UNMODIFIED');assert.equal(box.protectionBootstrapPending,true);
});
for(const target of ['web/app.js','desktop/app/app.js'])test(target+' keeps bootstrap normalization and source writes closed until the full journal is verified',()=>{
  const source=fs.readFileSync(target,'utf8');let deferred=true,unsupported=false,normalizations=0,writes=0;
  const box={protectionBootstrapPending:true,protectionBootstrapScopes:[],noteHistoryStartupReady:true,state:{data:{}},STORAGE_KEY:'data',
    noteHistory:{deferred:()=>deferred,status:()=>({unsupported}),protectionOperations:()=>({})},normalizeData:()=>{normalizations++;},
    isHostedWebClient:()=>false,writeStorage:()=>{assert.equal(box.protectionBootstrapPending,false);writes++;},persistSettings:()=>{writes++;}};
  vm.createContext(box);vm.runInContext(extract(source,'finishNoteHistoryBootstrap'),box);
  box.finishNoteHistoryBootstrap();assert.equal(box.protectionBootstrapPending,true);assert.equal(normalizations,0);assert.equal(writes,0);
  deferred=false;unsupported=true;assert.throws(()=>box.finishNoteHistoryBootstrap(),/이력|보존/);assert.equal(writes,0);
  unsupported=false;box.finishNoteHistoryBootstrap();assert.equal(normalizations,1);assert.equal(writes,2);assert.equal(box.protectionBootstrapPending,false);
});
for(const target of ['web/app.js','desktop/app/app.js'])test(target+' rejects analysis approval if its identity or protection changes during hydration',async()=>{
  const source=fs.readFileSync(target,'utf8');
  for(const changed of ['locked','capability','auth','device','generation','replacement']){
    let release,entered,writes=0;const ready=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
    const job={id:1,note_local_id:'absent',result_json:'result'},context={url:'https://qa.invalid',owner:'alice',auth:'one',device:'one',enabled:true};
    const box={state:{data:{tree:[]},settings:{server:{analysisJobs:[job]}}},noteProtectionViewGeneration:0,noteHistoryCaptureEpoch:0,
      noteHistoryContext:()=>context,noteHistory:{ensure:async()=>{entered();await gate;}},findTreeNode:()=>null,noteProtectionBlocked:()=>false,
      extractServerAnalysisResultText:()=> 'SYNTHETIC_RESULT',showNotice:()=>{},createRecoverySnapshot:()=>{writes++;},
      createNode:()=>({id:'created'}),extractTags:()=>[],formatServerJobTime:()=> 'now',t:k=>k,persist:()=>{writes++;},persistSettings:()=>{},
      setServerMessage:()=>{},renderTree:()=>{},renderServerSettings:()=>{},showSaved:()=>{},elements:{treeSavedLabel:{}}};
    vm.createContext(box);vm.runInContext(extract(source,'approveAnalysisResult'),box);
    const pending=box.approveAnalysisResult(job);await ready;
    if(changed==='locked')job.locked=true;if(changed==='capability')job.required_capability='protected';
    if(changed==='auth')context.auth='new';if(changed==='device')context.device='new';if(changed==='generation')box.noteProtectionViewGeneration++;
    if(changed==='replacement')box.state.settings.server.analysisJobs=[{...job,locked:true}];
    release();await assert.rejects(pending,/변경|승인|보호/);assert.equal(writes,0);assert.equal(box.state.data.tree.length,0);
  }
});
for(const target of ['web/app.js','desktop/app/app.js'])test(target+' does not report saved before deferred bootstrap writes finish',async()=>{
  const source=fs.readFileSync(target,'utf8');let release;
  const pending=new Promise(r=>{release=r;}),writes=new Set([pending]),label={textContent:''};
  const box={noteHistory:{failure:()=>''},noteHistoryContext:()=>({owner:'alice',auth:'one'}),noteHistoryCaptureChain:Promise.resolve(),
    storagePendingWrites:writes,noteHistoryLastError:'',t:()=> 'saved'};
  vm.createContext(box);vm.runInContext(extract(source,'showSaved'),box);box.showSaved(label);
  await Promise.resolve();await Promise.resolve();assert.equal(label.textContent,'저장 중');
  writes.delete(pending);release();await new Promise(r=>setImmediate(r));assert.equal(label.textContent,'saved');
});
