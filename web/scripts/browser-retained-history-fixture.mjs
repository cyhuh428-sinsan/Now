export async function verifyRetainedBrowserHistory(evaluate) {
  return evaluate(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message);},key='qa.history.retained';
    const account=JSON.stringify(['https://qa.invalid','alice']);
    const original={schema_version:1,contexts:{[account]:{notes:{a:{content:'original\\r\\ntext',revisions:['old'.repeat(70000)]}}}},extension:{keep:[null,false]}};
    const raw=JSON.stringify(original,null,2);localStorage.setItem(key,raw);
    let refuseMarker=false;
    const local={get length(){return localStorage.length;},key:i=>localStorage.key(i),getItem:k=>localStorage.getItem(k),setItem(k,v){if(refuseMarker)throw Error('qa_marker_interrupted');localStorage.setItem(k,v);}};
    const create=(k=key)=>NowBrowserHistoryStorage.create({indexedDB,localStorage:local,key:k,lock:fn=>navigator.locks.request(k,fn)});
    const store=create();await store.read();
    let gated=false;try{await store.retainLegacy();}catch{gated=true;}assert(gated,'retained conversion must be synthetic-gated');
    refuseMarker=true;let interrupted=false;try{await store.retainLegacy({syntheticLegacy:true});}catch{interrupted=true;}
    assert(interrupted&&localStorage.getItem(key)===raw,'prepared original must survive interrupted marker');
    refuseMarker=false;const resumed=create();await resumed.retainLegacy({syntheticLegacy:true});
    const marker=localStorage.getItem(key);assert(marker.length<300&&JSON.parse(marker).schema_version!==1,'old writer marker missing');
    assert(await resumed.readOriginal()===raw,'original exact bytes missing');
    let originalReads=0,wholeReads=0;
    const get=IDBObjectStore.prototype.get,getAll=IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.get=function(k){if(Array.isArray(k)&&k[0]===key&&k[1]==='retained-original-v1'){originalReads++;throw Error('whole original forbidden');}return get.call(this,k);};
    IDBObjectStore.prototype.getAll=function(...args){if(this.name==='documents'){wholeReads++;throw Error('whole history forbidden');}return getAll.apply(this,args);};
    let directory;
    try{directory=await resumed.readDirectory(['contexts',account,'notes']);}finally{IDBObjectStore.prototype.get=get;IDBObjectStore.prototype.getAll=getAll;}
    assert(directory.found&&originalReads===0&&wholeReads===0,'selective path loaded original/history');
    const changed=structuredClone(original);changed.contexts[account].notes.a.content='changed canonical';await resumed.write(original,changed);
    assert(JSON.parse(await create().read()).contexts[account].notes.a.content==='changed canonical','cold canonical loss');
    assert(await create().readOriginal()===raw,'ordinary edit rewrote preserved original');
    let stale=false;try{await create().write(original,original);}catch{stale=true;}assert(stale,'retained stale write accepted');
    localStorage.setItem(key,raw);let tampered=false;try{await create().readDirectory([]);}catch{tampered=true;}
    assert(tampered&&localStorage.getItem(key)===raw,'old writer overwrite must fail and preserve');localStorage.setItem(key,marker);
    const pendingKey='qa.history.pending',pending={schema_version:1,contexts:{},protection_operations:{x:{phase:'prepared'}}};
    localStorage.setItem(pendingKey,JSON.stringify(pending));let pendingBlocked=false;
    try{await create(pendingKey).retainLegacy({syntheticLegacy:true});}catch{pendingBlocked=true;}
    assert(pendingBlocked&&localStorage.getItem(pendingKey)===JSON.stringify(pending),'pending protection must block conversion');
    const scope={url:'https://qa.invalid',owner:'alice',instance:'11111111-1111-4111-8111-111111111111',local_id:'a',device:'qa'};
    const sealed=structuredClone(original);sealed.contexts[account].notes.a={protection_record:{schema_version:1,scope,operation_id:'qa-retained',ciphertext:'NOW_ENCRYPTED_V1:synthetic'}};
    await resumed.write(changed,sealed);await resumed.casLegacy(original,sealed);
    assert((await create().readOriginal())===JSON.stringify(sealed),'protection original CAS failed');
    assert(localStorage.getItem(key)===marker,'protection changed old-writer marker');
    assert(!(await create().read()).includes('oldoldold'),'canonical retained plaintext history');
    return {syntheticGate:gated,interrupted,resumed:true,originalBytes:true,selectiveNoOriginal:true,stale,tampered,pendingBlocked,protectedOriginal:true};
  })()`);
}
