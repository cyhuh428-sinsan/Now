/* Physical journal records are split; the protection protocol keeps its existing contract. */
(() => {
  'use strict';
  function create({database,key,onCommit=()=>{}}) {
    let cached=null,lastRevision=null;
    async function transaction(write,transform,guard) {
      const db=await database();
      const active=()=>{if(guard?.active&&!guard.active())throw Error('Storage authentication changed');};
      active();
      return new Promise((resolve,reject)=>{
        let tx,error,result,nextCache,revision=null;
        try{
          tx=db.transaction(['journals','documents'],write?'readwrite':'readonly',write?{durability:'strict'}:undefined);
          tx.onabort=()=>reject(error||Error('Document transaction aborted'));
          tx.onerror=()=>{error=Error('Document transaction failed');};
          tx.oncomplete=()=>{if(write)onCommit();lastRevision=revision;try{active();if(nextCache)cached=nextCache;resolve(result);}catch(e){if(write)e.committed=true;reject(e);}};
          if(write&&tx.durability!=='strict')throw Error('Strict document durability is required');
          const journals=tx.objectStore('journals'),documents=tx.objectStore('documents');
          const fail=e=>{error=e;tx.abort();};
          function settle(physical,before,logical) {
            try{
              revision=physical?.format===2?physical.stamp:null;
              active();result=transform(logical);
              if(!write)return;
              if(!result||!(result.value===null||typeof result.value==='string'))throw Error('Invalid journal value');
              const after=NowDocumentParts.encode(result.value===null?null:JSON.parse(result.value));
              for(const change of NowDocumentParts.delta(before,after)){
                const id=[key,change.id];
                if(change.remove)documents.delete(id);else documents.put({id:change.id,value:change.value},id);
              }
              const {value,...metadata}=result;
              const row={format:2,stamp:crypto.randomUUID(),isNull:value===null,row:metadata};
              revision=row.stamp;
              journals.put(row,key);
              nextCache={stamp:row.stamp,parts:after,value:result.value};
            }catch(e){fail(e);}
          }
          const request=journals.get(key);
          request.onsuccess=()=>{
            try{
              const physical=request.result;
              if(physical===undefined||physical.schema_version===1){settle(physical,new Map(),physical);return;}
              if(physical.format!==2||typeof physical.stamp!=='string'||typeof physical.isNull!=='boolean'||!physical.row)throw Error('Unsupported document journal');
              const finish=parts=>{
                const value=physical.isNull?null:JSON.stringify(NowDocumentParts.decode(parts));
                if(physical.isNull&&NowDocumentParts.decode(parts)!==null)throw Error('Invalid null document');
                settle(physical,parts,{...physical.row,value});
              };
              if(cached?.stamp===physical.stamp){finish(cached.parts);return;}
              const read=documents.getAll(IDBKeyRange.bound([key],[key,[]]));
              read.onsuccess=()=>{try{const parts=new Map(read.result.map(row=>[row.id,row.value]));finish(parts);}catch(e){fail(e);}};
            }catch(e){fail(e);}
          };
        }catch(e){error=e;if(tx){try{tx.abort();}catch{reject(e);}}else reject(e);}
      });
    }
    async function pathTransaction(path,guard,checkMetadata,patch=null,current=false,shallow=false,page=null){
      const steps=page?NowDocumentParts.historyPageSteps(page):current?NowDocumentParts.currentSteps(path):patch?NowDocumentParts.replaceSteps(path,patch.expected,patch.next):NowDocumentParts.selectSteps(path,shallow);let step=steps.next();
      const db=await database(),active=()=>{if(guard?.active&&!guard.active())throw Error('Storage authentication changed');};
      active();
      return new Promise((resolve,reject)=>{
        let tx,error,result;
        try{
          tx=db.transaction(['journals','documents'],patch?'readwrite':'readonly',patch?{durability:'strict'}:undefined);
          tx.onabort=()=>reject(error||Error('Document read aborted'));
          tx.onerror=()=>{error=Error('Document read failed');};
          tx.oncomplete=()=>{if(patch){cached=null;if(result?.partsWritten>0)onCommit();}try{active();resolve(result);}catch(e){if(patch&&result?.partsWritten>0)e.committed=true;reject(e);}};
          if(patch&&tx.durability!=='strict')throw Error('Strict document durability is required');
          const fail=e=>{error=e;tx.abort();},journals=tx.objectStore('journals'),documents=tx.objectStore('documents');
          const metadata=journals.get(key);
          metadata.onsuccess=()=>{
            try{
              active();const physical=metadata.result;
              if(physical===undefined){
                if(patch||page)throw Error('Document path conflict');
                checkMetadata(undefined);
                const count=documents.count(IDBKeyRange.bound([key],[key,[]]));
                count.onsuccess=()=>{try{
                  active();if(count.result!==0)throw Error('Document journal metadata is missing');
                  result=current?{projection:'journal_current_v1',stamp:null,supported:true,account:path,notes:{}}:{projection:'path_v1',stamp:null,found:false,...(shallow&&!path.length?{partIds:[]}: {})};
                }catch(e){fail(e);}};
                return;
              }
              if(physical.format!==2||typeof physical.stamp!=='string'||typeof physical.isNull!=='boolean'||!physical.row)throw Error('Unsupported document journal');
              if(patch?.revision!==null&&patch?.revision!==undefined&&patch.revision!==physical.stamp)throw Error('Document journal changed; reopen before saving');
              if(page&&page.stamp!==physical.stamp)throw Error('Document journal changed; reopen before paging');
              checkMetadata(physical.row);
              function apply(plan){
                const range=plan.range,keys=documents.getAllKeys(IDBKeyRange.bound([key,range.prefix],[key,range.prefix+'\uffff']));
                keys.onsuccess=()=>{
                  try{
                    active();
                    const exact=documents.getKey([key,range.id]);
                    exact.onsuccess=()=>{try{
                      active();const ids=keys.result.map(value=>{
                        if(!Array.isArray(value)||value.length!==2||value[0]!==key||typeof value[1]!=='string'||!value[1].startsWith(range.prefix))throw Error('Invalid document range');
                        return value[1];
                      });
                      if(exact.result!==undefined)ids.push(range.id);
                      if(JSON.stringify(ids.sort())!==JSON.stringify(range.ids))throw Error('Document parts conflict');
                      checkMetadata(physical.row);
                      for(const change of plan.changes){
                        if(change.remove)documents.delete([key,change.id]);else documents.put({id:change.id,value:change.value},[key,change.id]);
                      }
                      const stamp=plan.changes.length?crypto.randomUUID():physical.stamp;
                      if(plan.changes.length)journals.put({...physical,stamp},key);
                      result={projection:'path_write_v1',stamp,partsWritten:plan.changes.length};
                    }catch(e){fail(e);}};
                  }catch(e){fail(e);}
                };
              }
              const cache=new Map();
              function next(){
                if(step.done){
                  if(patch)apply(step.value);
                  else{
                    result={projection:'path_v1',stamp:physical.stamp,...step.value};
                    if(shallow&&!path.length){
                      const keys=documents.getAllKeys(IDBKeyRange.bound([key],[key,[]]));
                      keys.onsuccess=()=>{try{active();result.partIds=keys.result.map(value=>{
                        if(!Array.isArray(value)||value.length!==2||value[0]!==key||typeof value[1]!=='string')throw Error('Invalid document inventory');
                        return value[1];
                      });}catch(e){fail(e);}};
                    }
                  }
                  return;
                }
                if((current||page)&&cache.has(step.value)){step=steps.next(cache.get(step.value));next();return;}
                const id=step.value,request=documents.get([key,id]);
                request.onsuccess=()=>{try{
                  active();const row=request.result;
                  if(row?.id!==id)throw Error('Missing document part');
                  if(id==='$root'&&physical.isNull&&(!row.value||Object.keys(row.value).length!==1
                    ||!Object.hasOwn(row.value,'value')||row.value.value!==null))throw Error('Invalid null document');
                  if(current||page)cache.set(id,row.value);
                  step=steps.next(row.value);next();
                }catch(e){fail(e);}};
              }
              if(physical.isNull){
                const count=documents.count(IDBKeyRange.bound([key],[key,[]]));
                count.onsuccess=()=>{try{active();if(count.result!==1)throw Error('Invalid null document parts');next();}catch(e){fail(e);}};
              }else next();
            }catch(e){fail(e);}
          };
        }catch(e){error=e;if(tx){try{tx.abort();}catch{reject(e);}}else reject(e);}
      });
    }
    transaction.readPath=(path,guard,checkMetadata=()=>{})=>pathTransaction(path,guard,checkMetadata);
    transaction.readDirectory=(path,guard,checkMetadata=()=>{})=>pathTransaction(path,guard,checkMetadata,null,false,true);
    transaction.readHistoryPage=(request,guard,checkMetadata=()=>{})=>pathTransaction(null,guard,checkMetadata,null,false,false,structuredClone(request));
    transaction.readCurrent=(account,guard,checkMetadata=()=>{})=>pathTransaction(account,guard,checkMetadata,null,true);
    transaction.writePath=(path,expected,next,guard,checkMetadata=()=>{},options={})=>pathTransaction(path,guard,checkMetadata,
      {expected:structuredClone(expected),next:structuredClone(next),revision:options.revision??null});
    Object.defineProperty(transaction,'revision',{get:()=>lastRevision});
    return transaction;
  }
  globalThis.NowDocumentTransactions={create};
})();
