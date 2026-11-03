const {createDocumentStore}=require('./document-store.cjs');
const parts=require('./app/document-parts.js');
const journalWindow=require('./app/journal-window.js');
const {createHash}=require('node:crypto');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stamp=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');

function createPartitionedStore(filename){
  const store=createDocumentStore(filename),cache=new Map();
  let version=store.dataVersion();
  let currentCertificate=null;
  function certificate(key,account,token){
    return currentCertificate?.key===key&&currentCertificate.account===account&&currentCertificate.stamp===token
      &&currentCertificate.dataVersion===store.dataVersion()?currentCertificate.view:null;
  }
  function certify(key,current,token){
    currentCertificate={key,account:current.account,stamp:token,dataVersion:store.dataVersion(),view:{projection:current.projection,
      supported:current.supported,account:current.account,syncSupported:current.syncSupported,
      notes:Object.fromEntries(Object.keys(current.notes||{}).map(id=>[id,null]))}};
  }
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
    readWindow(key,request){return store.snapshot(()=>{
      const manifest=store.manifest(key),token=stamp(manifest);
      if(token!==request.stamp)throw Error('Document journal changed; reopen before reading');
      const cache=new Map(),steps=journalWindow.readSteps(request,certificate(key,request.account,token),current=>certify(key,current,token));let step=steps.next();
      while(!step.done){if(!cache.has(step.value))cache.set(step.value,store.read(key,step.value)?.value);step=steps.next(cache.get(step.value));}
      return {window:step.value,manifest,stamp:token};
    });},
    writeWindow(key,request,options){return this.writePath(key,null,null,null,{...options,window:request});},
    createWindow(key,request,{additional=[]}={}){
      const manifest=store.snapshot(()=>{const rows=store.manifest(key);if(stamp(rows)!==request.stamp)throw Error('Document journal changed; reopen before creating');return rows;});
      return this.writePath(key,null,null,null,{manifest,additional,window:{...request,insert:true}});
    },
    readHistoryPage(key,request){return store.snapshot(()=>{
      if(stamp(store.manifest(key))!==request.stamp)throw Error('Document journal changed; reopen before paging');
      const cache=new Map(),steps=parts.historyPageSteps(request);let step=steps.next();
      while(!step.done){const id=step.value;if(!cache.has(id))cache.set(id,store.read(key,id)?.value);step=steps.next(cache.get(id));}
      return step.value;
    });},
    readNote(key,account,id,expectedStamp){return store.snapshot(()=>{
      const manifest=store.manifest(key),token=stamp(manifest);
      if(token!==expectedStamp)throw Error('Document journal changed; reopen before reading');
      const cache=new Map(),read=id=>{if(!cache.has(id))cache.set(id,store.read(key,id)?.value);return cache.get(id);};
      const steps=parts.currentSteps(account);let step=steps.next();while(!step.done)step=steps.next(read(step.value));
      if(!step.value.supported||!Object.hasOwn(step.value.notes,id))throw Error('선택 메모의 전체 상태를 먼저 확인하세요.');
      const selected=parts.select(['contexts',account,'notes',id],read);if(!selected.found)throw Error('Missing selected note');
      return {entry:selected.value,manifest,stamp:token};
    });},
    read(key){return structuredClone(load(key).value);},
    readCurrent(key,account){return store.snapshot(()=>{
      const steps=parts.currentSteps(account),cache=new Map();let step=steps.next();
      if(!store.hasScope(key))return {projection:'journal_current_v1',supported:true,account,notes:{},stamp:stamp([])};
      while(!step.done){const id=step.value;if(!cache.has(id))cache.set(id,store.read(key,id)?.value);step=steps.next(cache.get(id));}
      const token=stamp(store.manifest(key));certify(key,step.value,token);return {...step.value,stamp:token};
    });},
    readSnapshot(key){return store.snapshot(()=>{
      const rows=store.scan(key),manifest=rows.map(row=>[row.id,row.version]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
      return {value:rows.length?parts.decode(new Map(rows.map(row=>[row.id,row.value]))):null,manifest,stamp:stamp(manifest)};
    });},
    readPath(key,path,shallow=false){
      if(!Array.isArray(path)||path.some(key=>typeof key!=='string'))throw Error('Invalid document path');
      return store.snapshot(()=>{
        const steps=parts.selectSteps(path,shallow);let step=steps.next();
        if(!store.hasScope(key))return {projection:'path_v1',stamp:stamp([]),found:false,...(shallow&&!path.length?{partIds:[]}: {})};
        while(!step.done)step=steps.next(store.read(key,step.value)?.value);
        const manifest=store.manifest(key);
        return {projection:'path_v1',stamp:stamp(manifest),...step.value,...(shallow&&!path.length?{partIds:manifest.map(([id])=>id)}:{})};
      });
    },
    write(key,value,expected){return this.commit([{key,value,expected}]);},
    writePath(key,path,expected,value,{manifest=null,additional=[],window=null}={}){
      let promotedCertificate=null;
      const plan=store.snapshot(()=>{
        if(window&&!manifest)throw Error('A journal Window requires a complete revision manifest');
        const token=window?stamp(manifest):null;
        const proof=window?certificate(key,window.account,token):null,inspected=current=>certify(key,current,token);
        const checks=[],reads=new Map(),steps=window?(window.insert?journalWindow.insertSteps(window,proof,inspected):journalWindow.writeSteps(window,proof,inspected)):parts.replaceSteps(path,expected,value);let step=steps.next();
        while(!step.done){
          const id=step.value,row=reads.has(id)?reads.get(id):store.read(key,id);reads.set(id,row);
          if(!row)throw Error('Missing document part');
          checks.push({scope:key,id,...row});step=steps.next(row.value);
        }
        if(window){
          const range=step.value.range,ids=manifest.map(([id])=>id).filter(id=>id===range.id||id.startsWith(range.prefix)).sort();
          if(!same(journalWindow.visibleIds(ids,range),range.ids))throw Error('Document Window parts conflict');
          range.ids=ids;
        }
        const extras=[];
        for(const update of additional){
          if(update.key===key)throw Error('Duplicate document scope');
          const rows=store.scan(update.key),before=new Map(rows.map(row=>[row.id,row.value]));
          if(!same(rows.length?parts.decode(before):null,update.expected))throw Error('Document metadata changed');
          checks.push(...rows.map(row=>({scope:update.key,...row})));
          extras.push(...parts.delta(before,parts.encode(update.value)).map(change=>({scope:update.key,id:change.id,kind:change.remove?'remove':'put',value:change.value,
            expectedVersion:rows.find(row=>row.id===change.id)?.version||0})));
        }
        return {...step.value,checks,extras};
      });
      const actions=plan.changes.map(change=>({scope:key,id:change.id,kind:change.remove?'remove':'put',value:change.value,
        expectedVersion:plan.checks.find(row=>row.scope===key&&row.id===change.id)?.version||0})).concat(plan.extras);
      try{
        const versions=store.commit(actions,{checks:plan.checks,ranges:[{scope:key,...plan.range}],manifests:manifest?[{scope:key,rows:manifest}]:[]});
        const nextManifest=manifest?new Map(manifest):null;
        actions.forEach((action,i)=>{if(nextManifest&&action.scope===key)action.kind==='remove'?nextManifest.delete(action.id):nextManifest.set(action.id,versions[i]);});
        const rows=nextManifest?[...nextManifest].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0):null,token=rows?stamp(rows):null;
        if(window&&currentCertificate){
          promotedCertificate={...currentCertificate,stamp:token,dataVersion:store.dataVersion(),view:{...currentCertificate.view,
            notes:window.insert?{...currentCertificate.view.notes,[window.id]:null}:currentCertificate.view.notes}};
        }
        return {projection:'path_write_v1',partsWritten:actions.length,bytesWritten:Buffer.byteLength(JSON.stringify(actions)),...(rows?{manifest:rows,stamp:token}:{})};
      }finally{cache.clear();currentCertificate=promotedCertificate;}
    },
    commit(updates,{journal=null}={}){
      let guarded=null;
      if(journal)guarded=store.snapshot(()=>{
        const rows=store.manifest(journal.key);
        if(typeof journal.stamp!=='string'||stamp(rows)!==journal.stamp)throw Error('Document journal changed; reopen before saving settings');
        const steps=journalWindow.settingsSteps();let step=steps.next();
        while(!step.done)step=steps.next(store.read(journal.key,step.value)?.value);
        return {scope:journal.key,rows};
      });
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
      if(!actions.length&&!guarded)return {partsWritten:0,bytesWritten:0};
      let versions;
      try{versions=store.commit(actions,{manifests:guarded?[guarded]:[],checks:guarded?[{scope:guarded.scope,id:'$root',...store.read(guarded.scope,'$root')}]:[]});}catch(error){cache.clear();throw error;}
      actions.forEach((action,i)=>{
        const rows=pending.find(item=>item.key===action.scope).rows;
        action.kind==='remove'?rows.delete(action.id):rows.set(action.id,versions[i]);
      });
      for(const {key,value,after,rows} of pending)cache.set(key,{rows,parts:after,value:structuredClone(value)});
      return {partsWritten:actions.length,bytesWritten:Buffer.byteLength(JSON.stringify(actions))};
    },
    inspect(key){return store.scan(key);},
    close(){cache.clear();currentCertificate=null;store.close();},
  };
}
module.exports={createPartitionedStore};
