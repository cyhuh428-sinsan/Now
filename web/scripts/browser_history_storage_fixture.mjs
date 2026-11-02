import assert from 'node:assert/strict';

const originalExpression=`(()=>{
  const scope={url:'https://qa.invalid',owner:'ownerA',instance:'11111111-1111-4111-8111-111111111111',local_id:'a',device:'qa'};
  return {schema_version:1,contexts:{[JSON.stringify([scope.url,scope.owner])]:{notes:{a:{content:'BROWSER_HISTORY_OWN'}}},[JSON.stringify([scope.url,'ownerB'])]:{notes:{b:{content:'BROWSER_HISTORY_OTHER'}}}}};
})()`;

export async function seedBrowserHistoryBeforeMigration({evaluate}){
  await evaluate(`localStorage.setItem('qa.history.transaction',JSON.stringify(${originalExpression},null,2))`);
}

export async function verifyBrowserHistoryStorage({evaluate}){
  const result=await evaluate(`(async()=>{
    const key='qa.history.transaction', own='BROWSER_HISTORY_OWN', other='BROWSER_HISTORY_OTHER';
    const scope={url:'https://qa.invalid',owner:'ownerA',instance:'11111111-1111-4111-8111-111111111111',local_id:'a',device:'qa'};
    const accountA=JSON.stringify([scope.url,scope.owner]),accountB=JSON.stringify([scope.url,'ownerB']);
    const original={schema_version:1,contexts:{[accountA]:{notes:{a:{content:own}}},[accountB]:{notes:{b:{content:other}}}}};
    const raw=JSON.stringify(original,null,2);
    if(localStorage.getItem(key)!==raw)throw Error('qa_preexisting_legacy_not_durable');
    const make=()=>NowBrowserHistoryStorage.create({indexedDB,localStorage,key,lock:fn=>navigator.locks.request(key,fn)});
    const a=make(),b=make();
    if(await a.read()!==raw||localStorage.getItem(key)!==raw)throw Error('browser_migration');
    const changed=structuredClone(original);changed.contexts[accountA].notes.a.content=own+'_NEW';
    await a.write(original,changed);
    let stale=false;try{await b.write(original,original);}catch{stale=true;}
    if(!stale||await b.read()!==JSON.stringify(changed)||localStorage.getItem(key)!==raw)throw Error('browser_stale_cas');
    const divergentKey='qa.history.divergent';localStorage.setItem(divergentKey,raw);
    const divergent=NowBrowserHistoryStorage.create({indexedDB,localStorage,key:divergentKey,lock:fn=>navigator.locks.request(divergentKey,fn)});
    await divergent.read();localStorage.setItem(divergentKey,raw+' ');
    let diverged=false;try{await divergent.read();}catch{diverged=true;}
    if(!diverged)throw Error('browser_legacy_divergence');
    const sealed=structuredClone(changed);sealed.contexts[accountA].notes.a={protection_record:{schema_version:1,scope,operation_id:'qa-browser-protection',ciphertext:'NOW_ENCRYPTED_V1:synthetic-only'}};
    await a.write(changed,sealed);await a.casLegacy(original,sealed);
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nownote.journal.v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('qa_db_open'));});
    const read=()=>new Promise((resolve,reject)=>{const t=db.transaction('journals','readonly'),r=t.objectStore('journals').get(key);t.oncomplete=()=>resolve(r.result);t.onabort=()=>reject(Error('qa_db_read'));});
    const before=await read();
    const parts=await new Promise((resolve,reject)=>{const t=db.transaction('documents','readonly'),r=t.objectStore('documents').getAll(IDBKeyRange.bound([key],[key,[]]));t.oncomplete=()=>resolve(r.result);t.onabort=()=>reject(Error('qa_part_read'));});
    if(JSON.stringify(parts).includes(own)||!JSON.stringify(parts).includes(other)||before.row.redo.length!==1||before.format!==2)throw Error('browser_cipher_inventory');
    await new Promise((resolve,reject)=>{
      const t=db.transaction('journals','readwrite',{durability:'strict'});
      if(t.durability!=='strict'){reject(Error('qa_strict_unsupported'));return;}
      t.onabort=()=>resolve();t.oncomplete=()=>reject(Error('qa_expected_abort'));
      t.objectStore('journals').put({...before,value:JSON.stringify(original)},key);t.abort();
    });
    if(JSON.stringify(await read())!==JSON.stringify(before))throw Error('browser_aborted_transaction_changed_record');
    db.close();return {stale,diverged,cipher:true,other:true,aborted:true};
  })()`);
  assert.deepEqual(result,{stale:true,diverged:true,cipher:true,other:true,aborted:true});
}

export async function verifyBrowserHistoryStorageCold({evaluate}){
  assert.equal(await evaluate(`(async()=>{
    const key='qa.history.transaction',storage=NowBrowserHistoryStorage.create({indexedDB,localStorage,key,lock:fn=>navigator.locks.request(key,fn)});
    let raw;
    try{raw=await storage.read();}catch{throw Error(localStorage.getItem(key)===null?'qa_cold_legacy_absent':'qa_cold_legacy_unknown');}
    const value=JSON.parse(raw);
    const accountA=JSON.stringify(['https://qa.invalid','ownerA']),accountB=JSON.stringify(['https://qa.invalid','ownerB']);
    return value.contexts[accountA].notes.a.protection_record.ciphertext==='NOW_ENCRYPTED_V1:synthetic-only'
      &&value.contexts[accountB].notes.b.content==='BROWSER_HISTORY_OTHER'
      &&localStorage.getItem(key)===raw&&!raw.includes('BROWSER_HISTORY_OWN');
  })()`),true,'Cold strict journal, retained sealed copy and other account must survive');
}

export async function seedBrowserLegacyHistory({evaluate}){
  await evaluate(`(async()=>{
    if(isDesktopClient())return;
    await noteHistory.idle();
    if(localStorage.getItem(NOTE_HISTORY_KEY)!==null)throw Error('qa_legacy_not_empty');
    const raw=JSON.stringify(noteHistory.export());
    const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
    const from=await hash(null),to=await hash(raw);
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nownote.journal.v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('qa_seed_open'));});
    await new Promise((resolve,reject)=>{
      const t=db.transaction(['journals','documents'],'readwrite',{durability:'strict'}),store=t.objectStore('journals'),r=store.get(NOTE_HISTORY_KEY);
      t.oncomplete=resolve;t.onabort=()=>reject(Error('qa_seed_abort'));
      r.onsuccess=()=>{
        const row=r.result;if(row?.format!==2||row.row.legacy_hash!==from||row.row.redo.length){t.abort();return;}
        const parts=t.objectStore('documents').getAll(IDBKeyRange.bound([NOTE_HISTORY_KEY],[NOTE_HISTORY_KEY,[]]));
        parts.onsuccess=()=>{
          if(JSON.stringify(NowDocumentParts.decode(new Map(parts.result.map(item=>[item.id,item.value]))))!==raw){t.abort();return;}
          store.put({...row,stamp:crypto.randomUUID(),row:{...row.row,legacy_hash:to}},NOTE_HISTORY_KEY);
        };
      };
    });
    db.close();localStorage.setItem(NOTE_HISTORY_KEY,raw);
    if(!raw.includes('Durable Guide'))throw Error('qa_legacy_wiki_missing');
    await browserHistoryStorage().read();
  })()`);
}
