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
    const headerKey=[key,'retained-header-v1'],originalKey=[key,'retained-original-v1'];
    const marker=header=>JSON.stringify({schema_version:241,storage:'indexeddb-retained-v1',id:header.id});
    async function retainedTransaction(full,guard,write=null){
      const db=await database();active(guard);
      return new Promise((resolve,reject)=>{
        let tx,error,result;
        try{
          tx=db.transaction('journals',write?'readwrite':'readonly',write?{durability:'strict'}:undefined);
          tx.onabort=()=>reject(error||fail());tx.onerror=()=>{error=fail();};
          tx.oncomplete=()=>{try{active(guard);resolve(result);}catch(e){if(write)e.committed=true;reject(e);}};
          if(write&&tx.durability!=='strict')throw fail();
          const store=tx.objectStore('journals'),values={},requests=[['physical',store.get(key)],['header',store.get(headerKey)],
            ['original',full?store.get(originalKey):store.getKey(originalKey)]];let remaining=requests.length;
          for(const [name,request]of requests)request.onsuccess=()=>{
            try{
              values[name]=request.result;if(--remaining)return;active(guard);
              result=write?write(values,store):values;
            }catch(e){error=e;tx.abort();}
          };
        }catch(e){error=e;if(tx){try{tx.abort();}catch{reject(e);}}else reject(e);}
      });
    }
    async function retainedState(guard,full=false){
      const state=await retainedTransaction(full,guard),{header,physical,original}=state;
      if(header===undefined){if(original!==undefined)throw fail();return null;}
      if(!header||Object.keys(header).sort().join(',')!=='format,hash,id,phase'||header.format!==1
        ||typeof header.id!=='string'||!/^[0-9a-f-]{36}$/.test(header.id)||!digest(header.hash)
        ||!['prepared','ready'].includes(header.phase)||original===undefined||physical?.format!==2
        ||physical.row?.legacy_hash!==header.hash)throw fail();
      validate({...physical.row,value:null});
      if(full){
        if(!original||Object.keys(original).sort().join(',')!=='format,id,raw'||original.format!==1
          ||original.id!==header.id||typeof original.raw!=='string'||await hash(original.raw)!==header.hash)throw fail();
        parse(original.raw);active(guard);
      }
      return state;
    }
    async function finishRetained(state,guard){
      if(!state)return null;
      const expected=marker(state.header),raw=localStorage.getItem(key);active(guard);
      if(state.header.phase==='ready'){if(raw!==expected)throw fail();return state;}
      const canonical=await transaction(false,value=>value,guard);
      unfinished(parse(canonical.value));
      if(transaction.revision!==state.physical.stamp)throw fail();
      if(raw!==expected&&raw!==state.original.raw)throw fail();
      if(raw!==expected){localStorage.setItem(key,expected);if(localStorage.getItem(key)!==expected)throw fail();}
      const header={...state.header,phase:'ready'};
      await retainedTransaction(true,guard,(current,store)=>{
        if(localStorage.getItem(key)!==expected||!same(current,state))throw fail();
        store.put(header,headerKey);return null;
      });
      return {...state,header};
    }
    function unfinished(value){
      if(typeof value==='string'){try{unfinished(JSON.parse(value));}catch(error){if(error?.message==='retained_pending')throw error;}return;}
      if(!value||typeof value!=='object')return;
      if(Object.hasOwn(value,'protection_operations')){
        const operations=value.protection_operations;
        if(!operations||typeof operations!=='object'||Array.isArray(operations)
          ||Object.values(operations).some(item=>item?.phase!=='complete'))throw Error('retained_pending');
      }
      for(const child of Object.values(value))unfinished(child);
    }
    // Call only inside the shared legacy-key lock. Hashing must not suspend an IDB transaction.
    async function settled(guard) {
      active(guard);
      const retained=await retainedState(guard,true);
      if(retained){
        const state=await finishRetained(retained,guard),row=await transaction(false,value=>value,guard);
        if(localStorage.getItem(key)!==marker(state.header)||row.legacy_hash!==state.header.hash)throw fail();
        validate(row);return {row,raw:state.original.raw,retained:state.header};
      }
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
        const retained=await retainedState(guard);
        if(retained&&retained.header.phase!=='ready')throw fail();
        const unchanged=()=>{
          active(guard);
          const count=localStorage.length;
          if(!Number.isSafeInteger(count)||count<0||typeof localStorage.key!=='function')throw fail();
          let found=false;
          for(let i=0;i<count;i++)if(localStorage.key(i)===key)found=true;
          if(retained){if(!found||localStorage.getItem(key)!==marker(retained.header))throw fail();}
          else if(found)throw fail();
        };
        unchanged();const legacyHash=retained?retained.header.hash:await hash(null);
        unchanged();
        const result=await action(metadata=>{
          unchanged();
          if(metadata===undefined){if(retained)throw fail();return;}
          if(!metadata||Object.keys(metadata).sort().join(',')!=='legacy_hash,redo,schema_version')throw fail();
          const row=validate({...metadata,value:null});
          if(row.legacy_hash!==legacyHash)throw fail();
        });
        try{unchanged();}catch(error){if(result?.projection==='path_write_v1'&&result.partsWritten>0)error.committed=true;throw error;}
        return result;
      });
    }
    const fullWrite=(expected,next,guard)=>lock(async()=>{
      const {row,raw,retained}=await settled(guard),local=retained?marker(retained):raw;
      if(!same(parse(row.value),expected))throw fail();
      const value=JSON.stringify(next);parse(value);
      await transaction(true,current=>{
        active(guard);if(!same(current,row)||localStorage.getItem(key)!==local)throw fail();
        return {...current,value};
      },guard);
      return {revision:transaction.revision,scoped:raw===null||Boolean(retained)};
    });
    return {
      retainLegacy: (options,guard)=>lock(async()=>{
        if(options?.syntheticLegacy!==true)throw fail();active(guard);
        const existing=await retainedState(guard,true);
        if(existing){await finishRetained(existing,guard);return;}
        const raw=localStorage.getItem(key);if(raw===null)throw fail();unfinished(parse(raw));
        const {row}=await settled(guard),legacyHash=await hash(raw);unfinished(parse(row.value));active(guard);
        if(row.legacy_hash!==legacyHash||localStorage.getItem(key)!==raw)throw fail();
        const original={format:1,id:crypto.randomUUID(),raw},header={format:1,id:original.id,hash:legacyHash,phase:'prepared'};
        await retainedTransaction(true,guard,(current,store)=>{
          if(current.header!==undefined||current.original!==undefined||current.physical?.stamp!==transaction.revision
            ||!same(current.physical?.row,{schema_version:row.schema_version,legacy_hash:row.legacy_hash,redo:row.redo})
            ||localStorage.getItem(key)!==raw)throw fail();
          store.put(original,originalKey);store.put(header,headerKey);return null;
        });
        await finishRetained(await retainedState(guard,true),guard);
      }),
      readOriginal: guard=>lock(async()=>{
        const retained=await retainedState(guard,true);
        if(!retained)return (await settled(guard)).raw;
        return (await finishRetained(retained,guard)).original.raw;
      }),
      verifyRetainedOriginal: guard=>lock(async()=>{
        const retained=await retainedState(guard,true);
        if(!retained)return false;
        await finishRetained(retained,guard);return true;
      }),
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
      readSnapshot:guard=>lock(async()=>{const {row,raw,retained}=await settled(guard);return {value:parse(row.value),revision:transaction.revision,stamp:transaction.revision,scoped:raw===null||Boolean(retained)};}),
      writeSnapshot:fullWrite,
      replaceNote(request,guard){
        const {account,id,expected,next,revision}=structuredClone(request),root={schema_version:1,contexts:{[account]:{notes:{[id]:expected}}}};
        if(typeof revision!=='string'||!NowJournalWrites.eligible(root,account,id,next))return Promise.reject(fail());
        return selective(check=>transaction.writePath(['contexts',account,'notes',id],expected,next,guard,check,{revision}),guard)
          .then(result=>({revision:result.stamp,stamp:result.stamp,scoped:true}));
      },
      readPath: (path,guard) => selective(check=>transaction.readPath(path,guard,check),guard),
      readDirectory: (path,guard) => selective(check=>transaction.readDirectory(path,guard,check),guard),
      readHistoryPage: (request,guard) => selective(check=>transaction.readHistoryPage(request,guard,check),guard),
      readCurrent: (account,guard) => selective(check=>transaction.readCurrent(account,guard,check),guard),
      writePath(path,expected,next,guard){
        const selection=Array.isArray(path)?[...path]:path,before=structuredClone(expected),after=structuredClone(next);
        return selective(check=>transaction.writePath(selection,before,after,guard,check),guard);
      },
      write: async(expected,next,guard)=>{await fullWrite(expected,next,guard);},
      casLegacy: (expected,next,guard) => lock(async()=>{
        const {row,raw,retained}=await settled(guard);
        if(!same(parse(raw),expected))throw fail();
        const value=JSON.stringify(next), nextHash=await hash(value), delta=patches(expected,next);active(guard);
        const redo={from:row.legacy_hash,to:nextHash,patches:delta};
        if(!delta.length || apply(raw,redo)!==value)throw fail();
        validate({...row,legacy_hash:nextHash,redo:[...row.redo,redo]});
        if(retained){
          const state=await retainedState(guard,true),local=marker(retained);
          await retainedTransaction(true,guard,(current,store)=>{
            if(!same(current,state)||localStorage.getItem(key)!==local||state.original.raw!==raw)throw fail();
            const metadata={...current.physical.row,legacy_hash:nextHash,redo:[...current.physical.row.redo,redo]};
            validate({...metadata,value:null});
            store.put({...current.physical,stamp:crypto.randomUUID(),row:metadata},key);
            store.put({...current.original,raw:value},originalKey);store.put({...current.header,hash:nextHash},headerKey);
            return null;
          });return;
        }
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
