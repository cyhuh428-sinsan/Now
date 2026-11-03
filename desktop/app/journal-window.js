/* A selected journal suffix never becomes a complete archive or full-write baseline. */
(() => {
  'use strict';
  const parts=globalThis.NowDocumentParts||(typeof require==='function'?require('./document-parts.js'):null);
  const policy=globalThis.NowJournalWrites||(typeof require==='function'?require('./journal-writes.js'):null);
  const arrays=['revisions','receipts','completed_outbox','archived_outbox'];
  const fields=new Set(['raw','draft','base','revisions','outbox','receipts','conflict','dirty','localOnly','needsBaseline','replicaSelected','edit_generation','completed_outbox','archived_outbox','comparison','error']);
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const fail=()=>Error('부분 이력의 저장 기준이 다릅니다. 원본과 편집본을 보존했습니다.');
  function currentEligible(value){
    const object=item=>item&&typeof item==='object'&&!Array.isArray(item);
    if(Object.keys(value).some(key=>!fields.has(key)))return false;
    if(Object.hasOwn(value,'error')&&(!object(value.error)||Object.keys(value.error).sort().join(',')!=='code,message'
      ||typeof value.error.code!=='string'||typeof value.error.message!=='string'))return false;
    if(Object.hasOwn(value,'conflict')&&value.conflict!==null&&(!object(value.conflict)
      ||!Object.hasOwn(value.conflict,'local')||!Object.hasOwn(value.conflict,'remote')
      ||Object.keys(value.conflict).some(key=>!['code','base','local','remote'].includes(key))
      ||Object.hasOwn(value.conflict,'code')&&typeof value.conflict.code!=='string'))return false;
    if(Object.hasOwn(value,'comparison')&&!object(value.comparison))return false;
    return arrays.every(key=>!Object.hasOwn(value,key)||Array.isArray(value[key]));
  }
  function encodeAt(input,path,offsets={},before=new Map()){
    const shifted=relative=>relative.length>1&&arrays.includes(relative[0])
      ?[relative[0],String(Number(relative[1])+(offsets[relative[0]]||0)),...relative.slice(2)]:relative;
    const descriptor=value=>Object.hasOwn(value,'ref')?{ref:JSON.stringify([...path,...shifted(JSON.parse(value.ref))])}:value;
    const after=new Map();
    for(const [key,value]of parts.encode(input)){
      if(key==='$root')continue;
      const relative=JSON.parse(key),location=[...path,...shifted(relative)];
      let entries=value.entries.map(([field,item])=>[relative.length===1&&arrays.includes(relative[0])
        ?String(Number(field)+(offsets[relative[0]]||0)):field,descriptor(item)]);
      if(relative.length===1&&arrays.includes(relative[0])){
        const old=before.get(JSON.stringify([...path,relative[0]]));
        entries=[...(old?.entries||[]).slice(0,offsets[relative[0]]||0),...entries];
      }
      after.set(JSON.stringify(location),{type:value.type,entries});
    }
    return after;
  }
  function visibleIds(ids,range){
    return ids.filter(id=>{
      let path;try{path=JSON.parse(id);}catch{return true;}
      if(!Array.isArray(path)||JSON.stringify(path)!==id)return true;
      return !range.opaque.some(item=>path.length>item.path.length&&item.path.every((key,index)=>path[index]===key)
        &&/^(0|[1-9][0-9]*)$/.test(path[item.path.length])&&Number(path[item.path.length])<item.count);
    }).sort();
  }
  function* readSteps({account,id,offsets=null},certified=null,inspected=()=>{}){
    if(typeof id!=='string'||!id)throw fail();
    const current=certified||(yield* parts.currentSteps(account));
    if(!current.supported||!Object.hasOwn(current.notes,id)||!current.syncSupported)throw fail();
    if(current.account!==account)throw fail();inspected(current);
    const path=['contexts',account,'notes',id],validated=new Map();
    const row=yield* parts.selectSteps(path,true,validated);
    if(row.part?.type!=='object')throw fail();
    const fields=new Map(row.part.entries),limits={},containers=new Map();
    for(const key of arrays){
      if(!fields.has(key)){limits[key]=0;continue;}
      const selected=yield* parts.selectSteps([...path,key],true,validated);
      if(selected.part?.type!=='array')throw fail();
      containers.set(key,selected.part);limits[key]=selected.part.entries.length;
    }
    if(!fields.has('revisions')||!fields.has('receipts'))throw fail();
    let firstPending=Math.max(0,limits.revisions-1);
    for(let index=0;index<limits.revisions;index++){
      const metadata=yield* parts.selectSteps([...path,'revisions',String(index)],true,validated);
      if(metadata.part?.type!=='object'||!metadata.part.entries.some(([key])=>key==='snapshot'))throw fail();
      const imported=yield* parts.selectSteps([...path,'revisions',String(index),'imported'],false,validated);
      if(imported.value!==true)firstPending=Math.min(firstPending,index);
    }
    const selected=offsets?structuredClone(offsets):{...limits,revisions:firstPending};
    if(!selected||Object.keys(selected).sort().join(',')!==[...arrays].sort().join(',')
      ||arrays.some(key=>!Number.isSafeInteger(selected[key])||selected[key]<0||selected[key]>limits[key])
      ||selected.revisions>firstPending)throw fail();
    const entry={};
    for(const [key]of fields){
      let value;
      if(arrays.includes(key)){
        value=[];
        for(let index=selected[key];index<limits[key];index++){
          const item=yield* parts.selectSteps([...path,key,String(index)],false,validated);
          if(!item.found)throw fail();value.push(item.value);
        }
      }else{
        const item=yield* parts.selectSteps([...path,key],false,validated);
        if(!item.found)throw fail();value=item.value;
      }
      Object.defineProperty(entry,key,{value,enumerable:true,writable:true,configurable:true});
    }
    return {projection:'journal_window_v1',account,id,offsets:selected,entry};
  }
  function* writeSteps({account,id,expected,next},certified=null,inspected=()=>{}){
    if(expected?.projection!=='journal_window_v1'||expected.account!==account||expected.id!==id)throw fail();
    const before=new Map(),reader=readSteps({account,id,offsets:expected.offsets},certified,inspected);let step=reader.next();
    while(!step.done){const key=step.value,value=yield key;before.set(key,value);step=reader.next(value);}
    if(Object.keys(expected).sort().join(',')!=='account,entry,id,offsets,projection'
      ||!same(step.value.entry,expected.entry)||arrays.some(key=>step.value.offsets[key]!==expected.offsets[key])
      ||!next||typeof next!=='object'||Array.isArray(next))throw fail();
    const rootValue={schema_version:1,contexts:{[account]:{notes:{[id]:expected.entry}}}};
    if(!policy.eligible(rootValue,account,id,next)||!currentEligible(next))throw fail();
    for(const key of arrays){
      const previous=expected.entry[key];
      if(previous===undefined){if(next[key]!==undefined&&!Array.isArray(next[key]))throw fail();continue;}
      if(!Array.isArray(next[key])||next[key].length<previous.length)throw fail();
      for(let index=0;index<previous.length;index++){
        if(key==='revisions'){
          if(!same(previous[index].snapshot,next[key][index]?.snapshot)||previous[index].revision_id!==next[key][index]?.revision_id)throw fail();
          if(previous[index].import_request!==undefined&&!same(previous[index].import_request,next[key][index].import_request))throw fail();
        }else if(!same(previous[index],next[key][index]))throw fail();
      }
    }
    for(const operation of expected.entry.outbox){
      if(typeof operation.id!=='string'||!operation.id||!operation.body)throw fail();
      const queued=next.outbox.find(item=>item.id===operation.id);
      const completed=(next.completed_outbox||[]).find(item=>item.id===operation.id);
      const retained=queued||completed;
      if(!retained||retained.revision_id!==operation.revision_id||retained.operation!==operation.operation
        ||retained.body?.mutation_id!==operation.body.mutation_id||operation.sent&&(!retained.sent||!same(retained.body,operation.body))
        ||completed&&!same(completed.body,operation.body))throw fail();
    }
    const path=['contexts',account,'notes',id],root=JSON.stringify(path),prefix=root.slice(0,-1)+',';
    const after=encodeAt(next,path,expected.offsets,before);
    const visible=new Map();
    for(const [key,value]of before){
      if(key!==root&&!key.startsWith(prefix))continue;
      const relative=JSON.parse(key).slice(path.length);
      if(relative.length>1&&arrays.includes(relative[0])&&Number(relative[1])<expected.offsets[relative[0]])continue;
      visible.set(key,value);
    }
    return {changes:parts.delta(visible,after),range:{id:root,prefix,ids:[...visible.keys()].sort(),
      opaque:arrays.filter(key=>expected.offsets[key]>0).map(key=>({path:[...path,key],count:expected.offsets[key]}))}};
  }
  function* insertSteps({account,id,next},certified=null,inspected=()=>{}){
    if(typeof id!=='string'||!id||/^wiki(?:[-:]|$)/.test(id))throw fail();
    const current=certified||(yield* parts.currentSteps(account));
    if(!current.supported||!current.syncSupported||current.account!==account||Object.hasOwn(current.notes,id))throw fail();
    inspected(current);
    const rootValue={schema_version:1,contexts:{[account]:{notes:{[id]:next}}}};
    const allowed=['raw','draft','base','revisions','outbox','receipts','conflict','dirty','localOnly','needsBaseline','replicaSelected'];
    if(!policy.eligible(rootValue,account,id,next)||Object.keys(next).some(key=>!allowed.includes(key))
      ||['revisions','outbox','receipts'].some(key=>next[key].length!==0)||next.conflict!==null
      ||['dirty','localOnly','needsBaseline','replicaSelected'].some(key=>typeof next[key]!=='boolean'))throw fail();
    const parent=['contexts',account,'notes'],directory=yield* parts.selectSteps(parent,true);
    if(directory.part?.type!=='object'||directory.part.entries.some(([key])=>key===id))throw fail();
    const path=[...parent,id],root=JSON.stringify(path),after=encodeAt(next,path);
    const changes=[{id:JSON.stringify(parent),value:{type:'object',entries:[...directory.part.entries,[id,{ref:root}]]}},
      ...[...after].map(([id,value])=>({id,value}))];
    return {changes,range:{id:root,prefix:root.slice(0,-1)+',',ids:[],opaque:[]}};
  }
  function* settingsSteps(){
    const root=yield* parts.selectSteps([],true);
    if(root.part?.type!=='object'||root.part.entries.map(([key])=>key).sort().join(',')!=='contexts,schema_version'
      ||(yield* parts.selectSteps(['schema_version'])).value!==1
      ||(yield* parts.selectSteps(['contexts'],true)).part?.type!=='object')
      throw Error('Protection or unsupported journal metadata prevents settings save');
    return true;
  }
  const api={readSteps,writeSteps,insertSteps,visibleIds,settingsSteps};globalThis.NowJournalWindow=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
