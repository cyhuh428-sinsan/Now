/* Browser journal: strict transaction acknowledgement; retained legacy is a separate protection copy. */
(() => {
  'use strict';
  const fail = () => new Error('브라우저 이력 저장본을 확인하지 못했습니다. 원본을 보존했으며 다시 열어 확인하세요.');
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const parse = raw => raw === null ? null : JSON.parse(raw);
  const hash = async raw => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(raw)))),b=>b.toString(16).padStart(2,'0')).join('');
  const active = guard => { if (guard?.active && !guard.active()) throw fail(); };
  const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  function protectionPatch(patch) {
    if (!patch || Object.keys(patch).sort().join(',') !== 'after,path' || !Array.isArray(patch.path)
      || patch.path.length < 4 || patch.path.some(k=>typeof k==='string'?['__proto__','constructor','prototype'].includes(k):!Number.isInteger(k)||k<0)) throw fail();
    const attribution=patch.path.at(-1)==='protectionScope';
    let scope,path=patch.path;
    if(attribution){
      globalThis.NowNoteProtectionState.validateScope(patch.after);scope=patch.after;path=path.slice(0,-1);
    }else{
      if(!globalThis.NowNoteProtectionState?.protectedRecord(patch.after)||Object.hasOwn(patch.after,'children'))throw fail();
      scope=patch.after.protection_record.scope;
    }
    if(path.at(-4)!=='contexts'||path.at(-3)!==JSON.stringify([scope.url.replace(/\/+$/,''),scope.owner])
      ||path.at(-2)!=='notes'||path.at(-1)!==scope.local_id)throw fail();
    return patch;
  }
  function patches(before,after,path=[],result=[]) {
    if(same(before,after))return result;
    if(after && typeof after==='object' && Object.hasOwn(after,'protection_record')){
      result.push(protectionPatch({path,after:structuredClone(after)}));return result;
    }
    if(!before || !after || typeof before!=='object' || typeof after!=='object'
      || Array.isArray(before)!==Array.isArray(after) || Object.keys(before).some(key=>!Object.hasOwn(after,key)))throw fail();
    for(const key of Object.keys(after)){
      const target=[...path,Array.isArray(after)?Number(key):key];
      if(!Object.hasOwn(before,key)){
        if(key!=='protectionScope'||Array.isArray(after))throw fail();
        result.push(protectionPatch({path:target,after:structuredClone(after[key])}));
      }else patches(before[key],after[key],target,result);
    }
    return result;
  }
  function apply(raw,redo) {
    const value=parse(raw);
    for(const patch of redo.patches){
      protectionPatch(patch);
      let parent=value;
      for(const key of patch.path.slice(0,-1)){
        if(!parent || !Object.hasOwn(parent,key))throw fail();parent=parent[key];
      }
      if(!parent || (!Object.hasOwn(parent,patch.path.at(-1))&&patch.path.at(-1)!=='protectionScope'))throw fail();
      parent[patch.path.at(-1)]=structuredClone(patch.after);
    }
    return JSON.stringify(value);
  }
  const validate = row => {
    if (!row || row.schema_version !== 1 || Object.keys(row).sort().join(',')!=='legacy_hash,redo,schema_version,value'
      || !(row.value === null || typeof row.value === 'string') || !digest(row.legacy_hash) || !Array.isArray(row.redo)) throw fail();
    parse(row.value);
    const seen=new Set();let previous;
    for(const redo of row.redo){
      if(!redo || Object.keys(redo).sort().join(',')!=='from,patches,to' || !digest(redo.from) || !digest(redo.to)
        || redo.from===redo.to || seen.has(redo.from) || seen.has(redo.to) || (previous&&previous!==redo.from)
        || !Array.isArray(redo.patches) || !redo.patches.length)throw fail();
      let binding;const paths=[];
      for(const patch of redo.patches){
        protectionPatch(patch);
        const attribution=patch.path.at(-1)==='protectionScope',r=patch.after.protection_record;
        const next=attribution?JSON.stringify(['attribution',patch.after]):JSON.stringify([r.operation_id,r.scope]);
        if(binding&&binding!==next)throw fail();binding=next;
        if(paths.some(p=>p.every((part,i)=>patch.path[i]===part)||patch.path.every((part,i)=>p[i]===part)))throw fail();
        paths.push(patch.path);
      }
      seen.add(redo.from);previous=redo.to;
    }
    if(previous&&previous!==row.legacy_hash)throw fail();
    return row;
  };
  function create({indexedDB,localStorage,lock,key}) {
    let connection;
    const database = () => connection ||= new Promise((resolve,reject) => {
      if (!indexedDB || !lock) { reject(fail()); return; }
      const request = indexedDB.open('nownote.journal.v1',2);
      let blocked=false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('journals')) request.result.createObjectStore('journals');
        if (!request.result.objectStoreNames.contains('documents')) request.result.createObjectStore('documents');
      };
      request.onblocked = () => { blocked=true; reject(fail()); };
      request.onerror = () => reject(fail());
      request.onsuccess = () => {
        const db=request.result;
        if(blocked){db.close();return;}
        db.onversionchange=()=>db.close();
        resolve(db);
      };
    });
    const transaction=globalThis.NowDocumentTransactions.create({database,key});
    // Call only inside the shared legacy-key lock. Hashing must not suspend an IDB transaction.
    async function settled(guard) {
      active(guard);
      let raw=localStorage.getItem(key), legacyHash=await hash(raw);
      active(guard);
      let row=await transaction(false,value=>value,guard);
      const unchanged=()=>{active(guard);if(localStorage.getItem(key)!==raw)throw fail();};
      unchanged();
      if(row===undefined){
        parse(raw);
        row=await transaction(true,current=>{
          unchanged();if(current!==undefined)throw fail();
          return {schema_version:1,value:raw,legacy_hash:legacyHash,redo:[]};
        },guard);
      }else{
        validate(row);
        if(row.legacy_hash!==legacyHash){
          const start=row.redo.findIndex(item=>item.from===legacyHash);
          if(start<0)throw fail();
          let restored=raw;
          for(const redo of row.redo.slice(start)){
            if(await hash(restored)!==redo.from)throw fail();
            restored=apply(restored,redo);
            if(await hash(restored)!==redo.to)throw fail();
          }
          unchanged();
          localStorage.setItem(key,restored);
          if(localStorage.getItem(key)!==restored)throw fail();
          raw=restored;
        }
      }
      unchanged();return {row,raw};
    }
    function selective(action,guard){
      return lock(async()=>{
        active(guard);
        // Retained legacy cannot be integrity-checked without loading its whole body.
        // Keep that profile on the established full-read path until migration is verified.
        const unchanged=()=>{
          active(guard);
          const count=localStorage.length;
          if(!Number.isSafeInteger(count)||count<0||typeof localStorage.key!=='function')throw fail();
          for(let i=0;i<count;i++)if(localStorage.key(i)===key)throw fail();
        };
        unchanged();const legacyHash=await hash(null);
        unchanged();
        const result=await action(metadata=>{
          unchanged();
          if(metadata===undefined)return;
          if(!metadata||Object.keys(metadata).sort().join(',')!=='legacy_hash,redo,schema_version')throw fail();
          const row=validate({...metadata,value:null});
          if(row.legacy_hash!==legacyHash)throw fail();
        });
        try{unchanged();}catch(error){if(result?.projection==='path_write_v1'&&result.partsWritten>0)error.committed=true;throw error;}
        return result;
      });
    }
    const fullWrite=(expected,next,guard)=>lock(async()=>{
      const {row,raw}=await settled(guard);
      if(!same(parse(row.value),expected))throw fail();
      const value=JSON.stringify(next);parse(value);
      await transaction(true,current=>{
        active(guard);if(!same(current,row)||localStorage.getItem(key)!==raw)throw fail();
        return {...current,value};
      },guard);
      return {revision:transaction.revision,scoped:raw===null};
    });
    return {
      selectNote(request,guard){
        const {account,id,stamp}=structuredClone(request);
        return selective(async check=>{
          if(typeof stamp!=='string'||typeof id!=='string')throw fail();
          const current=await transaction.readCurrent(account,guard,check);
          if(!current.supported||current.stamp!==stamp||!Object.hasOwn(current.notes,id))throw fail();
          const selected=await transaction.readPath(['contexts',account,'notes',id],guard,check);
          const root={schema_version:1,contexts:{[account]:{notes:{[id]:selected.value}}}};
          if(!selected.found||selected.stamp!==stamp||!NowJournalWrites.eligible(root,account,id,selected.value))throw fail();
          return {entry:selected.value,stamp,revision:stamp,scoped:true};
        },guard);
      },
      read: () => lock(async()=> (await settled()).row.value),
      readSnapshot:guard=>lock(async()=>{const {row,raw}=await settled(guard);return {value:parse(row.value),revision:transaction.revision,stamp:transaction.revision,scoped:raw===null};}),
      writeSnapshot:fullWrite,
      replaceNote(request,guard){
        const {account,id,expected,next,revision}=structuredClone(request),root={schema_version:1,contexts:{[account]:{notes:{[id]:expected}}}};
        if(typeof revision!=='string'||!NowJournalWrites.eligible(root,account,id,next))return Promise.reject(fail());
        return selective(check=>transaction.writePath(['contexts',account,'notes',id],expected,next,guard,check,{revision}),guard)
          .then(result=>({revision:result.stamp,stamp:result.stamp,scoped:true}));
      },
      readPath: (path,guard) => selective(check=>transaction.readPath(path,guard,check),guard),
      readCurrent: (account,guard) => selective(check=>transaction.readCurrent(account,guard,check),guard),
      writePath(path,expected,next,guard){
        const selection=Array.isArray(path)?[...path]:path,before=structuredClone(expected),after=structuredClone(next);
        return selective(check=>transaction.writePath(selection,before,after,guard,check),guard);
      },
      write: async(expected,next,guard)=>{await fullWrite(expected,next,guard);},
      casLegacy: (expected,next,guard) => lock(async()=>{
        const {row,raw}=await settled(guard);
        if(!same(parse(raw),expected))throw fail();
        const value=JSON.stringify(next), nextHash=await hash(value), delta=patches(expected,next);active(guard);
        const redo={from:row.legacy_hash,to:nextHash,patches:delta};
        if(!delta.length || apply(raw,redo)!==value)throw fail();
        validate({...row,legacy_hash:nextHash,redo:[...row.redo,redo]});
        await transaction(true,current=>{
          active(guard);if(!same(current,row)||localStorage.getItem(key)!==raw)throw fail();
          return {...current,legacy_hash:nextHash,redo:[...current.redo,redo]};
        },guard);
        active(guard);if(localStorage.getItem(key)!==raw)throw fail();
        localStorage.setItem(key,value);
        if(localStorage.getItem(key)!==value)throw fail();
        active(guard);
      }),
    };
  }
  globalThis.NowBrowserHistoryStorage={create};
})();
