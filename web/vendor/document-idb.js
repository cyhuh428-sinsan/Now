/* Physical journal records are split; the protection protocol keeps its existing contract. */
(() => {
  'use strict';
  function create({database,key}) {
    let cached=null;
    async function transaction(write,transform,guard) {
      const db=await database();
      const active=()=>{if(guard?.active&&!guard.active())throw Error('Storage authentication changed');};
      active();
      return new Promise((resolve,reject)=>{
        let tx,error,result,nextCache;
        try{
          tx=db.transaction(['journals','documents'],write?'readwrite':'readonly',write?{durability:'strict'}:undefined);
          tx.onabort=()=>reject(error||Error('Document transaction aborted'));
          tx.onerror=()=>{error=Error('Document transaction failed');};
          tx.oncomplete=()=>{try{active();if(nextCache)cached=nextCache;resolve(result);}catch(e){reject(e);}};
          if(write&&tx.durability!=='strict')throw Error('Strict document durability is required');
          const journals=tx.objectStore('journals'),documents=tx.objectStore('documents');
          const fail=e=>{error=e;tx.abort();};
          function settle(physical,before,logical) {
            try{
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
    transaction.readPath=async function(path,guard,checkMetadata=()=>{}){
      const steps=NowDocumentParts.selectSteps(path);let step=steps.next();
      const db=await database(),active=()=>{if(guard?.active&&!guard.active())throw Error('Storage authentication changed');};
      active();
      return new Promise((resolve,reject)=>{
        let tx,error,result;
        try{
          tx=db.transaction(['journals','documents'],'readonly');
          tx.onabort=()=>reject(error||Error('Document read aborted'));
          tx.onerror=()=>{error=Error('Document read failed');};
          tx.oncomplete=()=>{try{active();resolve(result);}catch(e){reject(e);}};
          const fail=e=>{error=e;tx.abort();},journals=tx.objectStore('journals'),documents=tx.objectStore('documents');
          const metadata=journals.get(key);
          metadata.onsuccess=()=>{
            try{
              active();const physical=metadata.result;
              if(physical===undefined){
                checkMetadata(undefined);
                const count=documents.count(IDBKeyRange.bound([key],[key,[]]));
                count.onsuccess=()=>{try{
                  active();if(count.result!==0)throw Error('Document journal metadata is missing');
                  result={projection:'path_v1',stamp:null,found:false};
                }catch(e){fail(e);}};
                return;
              }
              if(physical.format!==2||typeof physical.stamp!=='string'||typeof physical.isNull!=='boolean'||!physical.row)throw Error('Unsupported document journal');
              checkMetadata(physical.row);
              function next(){
                if(step.done){result={projection:'path_v1',stamp:physical.stamp,...step.value};return;}
                const id=step.value,request=documents.get([key,id]);
                request.onsuccess=()=>{try{
                  active();const row=request.result;
                  if(row?.id!==id)throw Error('Missing document part');
                  if(id==='$root'&&physical.isNull&&(!row.value||Object.keys(row.value).length!==1
                    ||!Object.hasOwn(row.value,'value')||row.value.value!==null))throw Error('Invalid null document');
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
    };
    return transaction;
  }
  globalThis.NowDocumentTransactions={create};
})();
