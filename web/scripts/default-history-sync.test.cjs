const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(surface,{notes=[],deferred=true,supported=true,pending=null,appliedCount=0}={}){
  const source=fs.readFileSync(require('node:path').resolve(__dirname,'../../'+surface+'/app.js'),'utf8');
  const start=source.indexOf('async function syncWebNotesToServer('),end=source.indexOf('\nfunction classifySyncFailureAction',start);
  let legacy=0,completed=0,applied=0,requests=[],persisted=0,captured=0;const noop=()=>{};
  const scope={url:'https://qa.invalid',owner:'alice',auth:'synthetic',enabled:true};
  const box=vm.createContext({vaultHistoryApplying:false,serverSyncRunning:false,serverSyncQueued:false,noteHistoryCaptureEpoch:0,
    requireProtectionSettled:noop,noteHistoryCaptureChain:Promise.resolve(),noteHistoryContext:()=>scope,
    NowNoteHistory:{key:c=>JSON.stringify([c.url,c.owner])},NowLibrary:{key:()=>''},libraryContext:()=>({}),
    state:{settings:{server:{mode:'server',url:scope.url,ownerId:'alice',deviceId:'qa'}}},
    noteHistory:{status:()=>({}),suspended:()=>false,sync:async()=>{},legacyPending:()=>pending,deferred:()=>deferred,syncSupported:()=>supported,
      beginLegacy:async body=>{legacy++;return pending||{id:'fixed',body};},completeLegacy:async()=>{completed++;}},
    noteHistoryController:{resume:async()=>{}},normalizeOwnerId:x=>x,buildServerSyncNotes:()=>notes,serverAuthHeaders:()=>({}),
    renderServerStatus:noop,persistSettings:noop,renderServerSettings:noop,renderServerMeta:noop,render:noop,persist:()=>{persisted++;},noteHistoryCaptureDrafts:()=>{captured++;},t:x=>x,
    fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({pushed_notes:[],pulled_notes:[],server_time:'now'})};},
    applyPulledServerNotes:()=>{applied++;return {applied:appliedCount};},libraryStore:null,markServerSyncedNotes:noop,setServerMessage:noop,setServerRawMessage:noop,classifySyncFailureAction:()=>''});
  vm.runInContext(source.slice(start,end),box);
  return {run:()=>vm.runInContext('syncWebNotesToServer(undefined,{skipFormSave:true})',box),stats:()=>({legacy,completed,applied,requests,persisted,captured})};
}
for(const surface of ['web','desktop/app']){
  test(surface+': an empty legacy pull after a proven deferred sync never writes the whole legacy journal',async()=>{
    const f=fixture(surface);await f.run();const result=f.stats();assert.equal(result.legacy,0);assert.equal(result.completed,0);assert.equal(result.applied,1);assert.deepEqual(result.requests[0].notes,[]);assert.equal(result.persisted,0);assert.equal(result.captured,1);
  });
  test(surface+': legacy writes, uncertain metadata and prior immutable requests keep their durable boundary',async()=>{
    const pending={id:'original',body:{owner_id:'alice',notes:[],unknown:'preserve-fixed-body'}};
    for(const options of [{notes:[{local_id:'unmanaged'}]},{supported:false},{deferred:false},{pending}]){
      const f=fixture(surface,options);await f.run();const result=f.stats();assert.equal(result.legacy,1);assert.equal(result.completed,1);assert.equal(result.applied,1);
      if(options.pending)assert.deepEqual(result.requests[0],pending.body);
    }
  });
  test(surface+': newly pulled documents keep the full bootstrap persistence path',async()=>{
    const f=fixture(surface,{appliedCount:1});await f.run();assert.equal(f.stats().persisted,1);assert.equal(f.stats().captured,0);
  });
}
