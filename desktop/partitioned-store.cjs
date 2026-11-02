const {createDocumentStore}=require('./document-store.cjs');
const parts=require('./app/document-parts.js');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function createPartitionedStore(filename){
  const store=createDocumentStore(filename),cache=new Map();
  let version=store.dataVersion();
  function load(key){
    if(typeof key!=='string'||!key)throw Error('Storage key is required');
    const current=store.dataVersion();
    if(current!==version){cache.clear();version=current;}
    if(!cache.has(key)){
      const rows=store.scan(key),values=new Map(rows.map(row=>[row.id,row.value]));
      cache.set(key,{rows:new Map(rows.map(row=>[row.id,row.version])),parts:values,
        value:rows.length?parts.decode(values):null});
    }
    return cache.get(key);
  }
  return {
    read(key){return structuredClone(load(key).value);},
    readPath(key,path){
      if(!Array.isArray(path)||path.some(key=>typeof key!=='string'))throw Error('Invalid document path');
      return store.snapshot(()=>({projection:'path_v1',...(store.hasScope(key)
        ?parts.select(path,id=>store.read(key,id)?.value):{found:false})}));
    },
    write(key,value,expected){return this.commit([{key,value,expected}]);},
    writePath(key,path,expected,value){
      const plan=store.snapshot(()=>{
        const checks=[],steps=parts.replaceSteps(path,expected,value);let step=steps.next();
        while(!step.done){
          const id=step.value,row=store.read(key,id);
          if(!row)throw Error('Missing document part');
          checks.push({scope:key,id,...row});step=steps.next(row.value);
        }
        return {...step.value,checks};
      });
      const actions=plan.changes.map(change=>({scope:key,id:change.id,kind:change.remove?'remove':'put',value:change.value,
        expectedVersion:plan.checks.find(row=>row.id===change.id)?.version||0}));
      try{
        store.commit(actions,{checks:plan.checks,ranges:[{scope:key,...plan.range}]});
        return {projection:'path_write_v1',partsWritten:actions.length,bytesWritten:Buffer.byteLength(JSON.stringify(actions))};
      }finally{cache.clear();}
    },
    commit(updates){
      if(!Array.isArray(updates)||new Set(updates.map(item=>item.key)).size!==updates.length)throw Error('Invalid storage transaction');
      const pending=[],actions=[];
      for(const {key,value,expected} of updates){
        const before=load(key);
        if(expected!==undefined&&!same(before.value,expected))throw Error('Storage changed in another window. No data was overwritten.');
        const after=parts.encode(value),changes=parts.delta(before.parts,after);
        actions.push(...changes.map(change=>({scope:key,id:change.id,kind:change.remove?'remove':'put',
          value:change.value,expectedVersion:before.rows.get(change.id)||0})));
        pending.push({key,value,after,rows:new Map(before.rows)});
      }
      if(!actions.length)return {partsWritten:0,bytesWritten:0};
      let versions;
      try{versions=store.commit(actions);}catch(error){cache.clear();throw error;}
      actions.forEach((action,i)=>{
        const rows=pending.find(item=>item.key===action.scope).rows;
        action.kind==='remove'?rows.delete(action.id):rows.set(action.id,versions[i]);
      });
      for(const {key,value,after,rows} of pending)cache.set(key,{rows,parts:after,value:structuredClone(value)});
      return {partsWritten:actions.length,bytesWritten:Buffer.byteLength(JSON.stringify(actions))};
    },
    inspect(key){return store.scan(key);},
    close(){cache.clear();store.close();},
  };
}
module.exports={createPartitionedStore};
