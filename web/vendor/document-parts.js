/* Lossless JSON parts. Stable paths keep unrelated documents out of writes. */
(() => {
  'use strict';
  const encode = value => {
    const parts = new Map(),ancestors=new Set();
    function visit(value, path) {
      if(typeof value?.toJSON==='function')value=value.toJSON(path.at(-1)||'');
      if (value === null || typeof value !== 'object') {
        if (!['string','boolean','number'].includes(typeof value) && value !== null) throw Error('Non-JSON document value');
        if (typeof value === 'number' && !Number.isFinite(value))value=null;
        return {value};
      }
      const id=JSON.stringify(path), array=Array.isArray(value);
      if (!array && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error('Non-JSON object');
      if(ancestors.has(value))throw Error('Cyclic document value');ancestors.add(value);
      const keys=array?Array.from({length:value.length},(_,i)=>String(i)):Object.keys(value);
      const omitted=item=>['undefined','function','symbol'].includes(typeof item);
      const entries=keys.filter(key=>array||!omitted(value[key])).map(key=>[key,visit(array&&omitted(value[key])?null:value[key],[...path,key])]);
      ancestors.delete(value);
      parts.set(id,{type:array?'array':'object',entries});
      return {ref:id};
    }
    parts.set('$root',visit(value,[]));
    return parts;
  };
  const decode = parts => {
    const seen=new Set();
    function visit(descriptor) {
      if (!descriptor || typeof descriptor!=='object') throw Error('Invalid document part');
      if (Object.keys(descriptor).length===1 && Object.hasOwn(descriptor,'value')) return descriptor.value;
      if (Object.keys(descriptor).join(',')!=='ref' || typeof descriptor.ref!=='string' || seen.has(descriptor.ref)) throw Error('Invalid document reference');
      seen.add(descriptor.ref);
      const part=parts.get(descriptor.ref);
      if (!part || !['array','object'].includes(part.type) || !Array.isArray(part.entries)) throw Error('Missing document part');
      const value=part.type==='array'?[]:{}, keys=new Set();
      for (const entry of part.entries) {
        if (!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0])) throw Error('Invalid document field');
        const [key,item]=entry;keys.add(key);
        if(part.type==='array' && key!==String(value.length))throw Error('Invalid document array');
        Object.defineProperty(value,key,{value:visit(item),enumerable:true,writable:true,configurable:true});
      }
      return value;
    }
    const result=visit(parts.get('$root'));
    if(seen.size+1!==parts.size)throw Error('Orphan document parts');
    return result;
  };
  const delta = (before,after) => {
    const result=[];
    for(const [id,value] of after)if(JSON.stringify(before.get(id))!==JSON.stringify(value))result.push({id,value});
    for(const id of before.keys())if(!after.has(id))result.push({id,remove:true});
    return result;
  };
  // Yield exact record IDs so both SQLite and IDB can read one consistent subtree.
  function* selectSteps(path,shallow=false,validated=null){
    if(!Array.isArray(path)||path.some(key=>typeof key!=='string'))throw Error('Invalid document path');
    path=[...path];
    function descriptor(value,expected){
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1)throw Error('Invalid document descriptor');
      if(Object.hasOwn(value,'value')){
        const item=value.value;
        if(item!==null&&!['string','boolean','number'].includes(typeof item)||typeof item==='number'&&!Number.isFinite(item))throw Error('Invalid document value');
        return false;
      }
      if(Object.keys(value)[0]!=='ref'||value.ref!==JSON.stringify(expected))throw Error('Invalid document reference');
      return true;
    }
    function* visit(value,location,offset){
      if(!descriptor(value,location))return offset<path.length?{found:false}:{found:true,value:value.value};
      const known=validated?.get(value.ref),part=known?.part||(yield value.ref);
      let fields=known?.fields;
      if(!known){
        if(!part||Object.keys(part).sort().join(',')!=='entries,type'||!['array','object'].includes(part.type)||!Array.isArray(part.entries))throw Error('Missing or invalid document part');
        const keys=new Set();fields=validated?new Map():null;
        for(const [index,entry] of part.entries.entries()){
          if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||keys.has(entry[0])
            ||part.type==='array'&&entry[0]!==String(index))throw Error('Invalid document field');
          keys.add(entry[0]);descriptor(entry[1],[...location,entry[0]]);fields?.set(entry[0],[entry[0],entry[1]]);
        }
        validated?.set(value.ref,{part,fields});
      }
      if(offset<path.length){
        const entry=fields?fields.get(path[offset]):part.entries.find(([key])=>key===path[offset]);
        return entry?yield* visit(entry[1],[...location,entry[0]],offset+1):{found:false};
      }
      if(shallow)return {found:true,part};
      const result=part.type==='array'?[]:{};
      for(const [key,item] of part.entries){
        const child=yield* visit(item,[...location,key],offset);
        Object.defineProperty(result,key,{value:child.value,enumerable:true,writable:true,configurable:true});
      }
      return {found:true,value:result};
    }
    return yield* visit(yield '$root',[],0);
  }
  function select(path,read){
    const steps=selectSteps(path);let step=steps.next();
    while(!step.done)step=steps.next(read(step.value));
    return step.value;
  }
  // Read-only startup projection; it deliberately cannot become a write/archive baseline.
  function* currentSteps(account){
    let identity;
    try{identity=JSON.parse(account);}catch{throw Error('Invalid journal account');}
    if(!Array.isArray(identity)||identity.length!==2||identity.some(v=>typeof v!=='string')||JSON.stringify(identity)!==account)
      throw Error('Invalid journal account');
    const unavailable=()=>({projection:'journal_current_v1',supported:false});
    // This cache belongs to one immutable storage snapshot, never to a later read.
    const validated=new Map();
    function* object(path){const row=yield* selectSteps(path,true,validated);return row.part?.type==='object'?new Map(row.part.entries):null;}
    function* value(path){return (yield* selectSteps(path,false,validated)).value;}
    const rootRow=yield* selectSteps([],true,validated);
    if(rootRow.found&&rootRow.value===null)return {projection:'journal_current_v1',supported:true,account,notes:{}};
    const root=rootRow.part?.type==='object'?new Map(rootRow.part.entries):null;
    if(!root||[...root.keys()].sort().join(',')!=='contexts,schema_version'||(yield* value(['schema_version']))!==1)return unavailable();
    const contexts=yield* object(['contexts']);if(!contexts)return unavailable();
    const notes={},wikiIds=[];
    if(!contexts.has(account))return {projection:'journal_current_v1',supported:true,account,notes};
    const bucket=yield* object(['contexts',account]);
    const wikiMetadata=['wiki_lifecycle','wiki_ingest_operations'];
    if(!bucket||!bucket.has('notes')||[...bucket.keys()].some(key=>key!=='notes'&&!wikiMetadata.includes(key)))return unavailable();
    for(const key of wikiMetadata)if(bucket.has(key)&&!(yield* object(['contexts',account,key])))return unavailable();
    const wikiIndexSupported=bucket.size===1;
    const path=['contexts',account,'notes'],entries=yield* object(path);if(!entries)return unavailable();
    const allowed=new Set(['raw','draft','base','revisions','outbox','receipts','conflict','dirty','localOnly','needsBaseline','replicaSelected','edit_generation','completed_outbox','archived_outbox','comparison','wiki_source_snapshot','error']);
    for(const id of entries.keys()){
      const location=[...path,id],entry=yield* object(location);
      if(!entry||[...entry.keys()].some(k=>!allowed.has(k))||['raw','draft','base','revisions','outbox','receipts'].some(k=>!entry.has(k)))return unavailable();
      if(entry.has('error')){
        const error=yield* object([...location,'error']);
        if(!error||[...error.keys()].sort().join(',')!=='code,message'
          ||typeof(yield* value([...location,'error','code']))!=='string'
          ||typeof(yield* value([...location,'error','message']))!=='string')return unavailable();
      }
      if(entry.has('wiki_source_snapshot')&&(!id.startsWith('wiki-source:')||!(yield* object([...location,'wiki_source_snapshot']))))return unavailable();
      const base=yield* object([...location,'base']);
      if(!base||(yield* value([...location,'base','crypto_epoch']))!==0)return unavailable();
      if(/^wiki(?:[-:]|$)/.test(id)){wikiIds.push(id);continue;}
      const draft=yield* value([...location,'draft']),raw=yield* value([...location,'raw']);
      if([draft,raw].some(n=>!n||Array.isArray(n)||n.owner_id!==identity[1]||n.local_id!==id
        ||!['tree','daily','worklog'].includes(n.note_type)||typeof n.content!=='string'||n.content.startsWith('NOW_ENCRYPTED_')))return unavailable();
      if([draft,raw].some(n=>String(n.source||'').startsWith('wiki')))continue;
      const pending=yield* selectSteps([...location,'outbox'],true,validated);
      if(pending.part?.type!=='array')return unavailable();
      let conflicted=false;
      if(entry.has('conflict')){
        const row=yield* selectSteps([...location,'conflict'],true,validated);
        if(row.value!==null){
          const conflict=row.part?.type==='object'?new Map(row.part.entries):null;
          if(!conflict||!conflict.has('local')||!conflict.has('remote')
            ||[...conflict.keys()].some(key=>!['code','base','local','remote'].includes(key))
            ||conflict.has('code')&&typeof(yield* value([...location,'conflict','code']))!=='string')return unavailable();
          conflicted=true;
        }
      }
      if(entry.has('archived_outbox')&&(yield* selectSteps([...location,'archived_outbox'],true,validated)).part?.type!=='array')return unavailable();
      if(entry.has('comparison')&&!(yield* object([...location,'comparison'])))return unavailable();
      const head=yield* value([...location,'base','head_revision_id']);
      const localOnly=entry.has('localOnly')?yield* value([...location,'localOnly']):undefined;
      const needsBaseline=entry.has('needsBaseline')?yield* value([...location,'needsBaseline']):undefined;
      const replicaSelected=entry.has('replicaSelected')?yield* value([...location,'replicaSelected']):undefined;
      Object.defineProperty(notes,id,{enumerable:true,value:{projection:'current_v1',raw,draft,base:{head_revision_id:head,crypto_epoch:0},
        localOnly,skipAutomaticSync:Boolean(!needsBaseline&&(conflicted||!replicaSelected||localOnly)),
        dirty:entry.has('dirty')?yield* value([...location,'dirty']):undefined,pending:pending.part.entries.length,conflicted}});
    }
    return {projection:'journal_current_v1',supported:true,account,notes,wikiIds,wikiIndexSupported,
      wikiIndexMetadata:wikiMetadata.filter(key=>bucket.has(key)),syncSupported:wikiIndexSupported&&entries.size===Object.keys(notes).length};
  }
  function* historyPageSteps({account,id,stamp,cursor=null,limit=50}){
    const fail=()=>Error('이력 페이지의 저장 기준이 다릅니다. 다시 열어 확인하세요.');
    if(typeof id!=='string'||!id||typeof stamp!=='string'||!stamp||!Number.isInteger(limit)||limit<1||limit>100)throw fail();
    const current=yield* currentSteps(account);
    if(!current.supported||!Object.hasOwn(current.notes,id))throw fail();
    const path=['contexts',account,'notes',id,'revisions'],validated=new Map();
    const selected=yield* selectSteps(path,true,validated),array=selected.part;
    if(!selected.found||array?.type!=='array')throw fail();
    const total=array.entries.length;let before=total;
    if(cursor!==null){
      if(typeof cursor!=='string'||cursor.length>16384)throw fail();
      let value;try{value=JSON.parse(cursor);}catch{throw fail();}
      if(!Array.isArray(value)||value.length!==5||value[0]!=='history_page_v1'||value[1]!==account||value[2]!==id||value[3]!==stamp
        ||!Number.isInteger(value[4])||value[4]<0||value[4]>total)throw fail();
      before=value[4];
    }
    const start=Math.max(0,before-limit),items=[];
    for(let index=before-1;index>=start;index--){
      const row=yield* selectSteps([...path,String(index)],false,validated),revision=row.value;
      if(!row.found||!revision||typeof revision!=='object'||Array.isArray(revision)||!revision.snapshot?.note||typeof revision.snapshot.note!=='object'||Array.isArray(revision.snapshot.note))throw fail();
      items.push(revision);
    }
    return {projection:'history_page_v1',account,id,stamp,total,items,nextCursor:start?JSON.stringify(['history_page_v1',account,id,stamp,start]):null};
  }
  function* replaceSteps(path,expected,next){
    if(!Array.isArray(path)||!path.length||path.some(key=>typeof key!=='string'))throw Error('A nonempty document path is required');
    path=[...path];
    const before=new Map(),reader=selectSteps(path);let step=reader.next();
    while(!step.done){const id=step.value,value=yield id;before.set(id,value);step=reader.next(value);}
    if(!step.value.found||JSON.stringify(step.value.value)!==JSON.stringify(expected))throw Error('Document path conflict');
    const id=JSON.stringify(path),prefix=id.slice(0,-1)+',',parent=JSON.stringify(path.slice(0,-1));
    const rebase=descriptor=>Object.hasOwn(descriptor,'value')?{value:descriptor.value}:{ref:JSON.stringify([...path,...JSON.parse(descriptor.ref)])};
    const encoded=encode(next),after=new Map();
    for(const [key,part]of encoded)if(key!=='$root')after.set(JSON.stringify([...path,...JSON.parse(key)]),
      {type:part.type,entries:part.entries.map(([field,value])=>[field,rebase(value)])});
    const container=before.get(parent);
    after.set(parent,{type:container.type,entries:container.entries.map(([field,value])=>[field,field===path.at(-1)?rebase(encoded.get('$root')):value])});
    const old=new Map([...before].filter(([key])=>key===parent||key===id||key.startsWith(prefix)));
    return {changes:delta(old,after),range:{id,prefix,ids:[...old.keys()].filter(key=>key!==parent).sort()}};
  }
  globalThis.NowDocumentParts={encode,decode,delta,selectSteps,select,replaceSteps,currentSteps,historyPageSteps};
  if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.NowDocumentParts;
})();
