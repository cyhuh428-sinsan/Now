/* Full archives are assembled from validated documents, never from a partial journal. */
(() => {
  'use strict';
  const full=()=>Object.assign(Error('전체 백업 검증 경로가 필요합니다.'),{code:'backup_full_required'});
  const fail=()=>Error('백업 중 저장 상태가 변경되었거나 손상되었습니다. 파일을 만들지 않았습니다.');
  function create({directory,read,validateMetadata}){
    async function exportHistory(stamp,guard){
      const active=()=>{if(guard?.active&&!guard.active())throw fail();};
      const get=async(path,shallow=false)=>{
        active();const result=await (shallow?directory:read)(path,guard);active();
        if(result.stamp!==stamp)throw fail();return result;
      };
      const keys=result=>{
        if(!result.found||result.part?.type!=='object'||!Array.isArray(result.part.entries))throw full();
        return result.part.entries.map(([key])=>key);
      };
      const root=await get([],true);
      const inventory=(row,expected)=>{
        if(!Array.isArray(row.partIds)||JSON.stringify([...row.partIds].sort())!==JSON.stringify([...expected].sort()))throw fail();
      };
      if(!root.found||root.value===null){inventory(root,root.found?['$root']:[]);return new Blob(['{"schema_version":1,"contexts":{}}'],{type:'application/json'});}
      if(keys(root).sort().join(',')!=='contexts,schema_version')throw full();
      if((await get(['schema_version'])).value!==1)throw full();
      const accounts=keys(await get(['contexts'],true)),plans=[];
      for(const account of accounts){
        let identity;try{identity=JSON.parse(account);}catch{throw full();}
        if(!Array.isArray(identity)||identity.length!==2||identity.some(x=>typeof x!=='string')||JSON.stringify(identity)!==account)throw full();
        const fields=keys(await get(['contexts',account],true));
        if(!fields.includes('notes')||fields.some(key=>!['notes','wiki_lifecycle','wiki_ingest_operations'].includes(key)))throw full();
        const metadata=[];
        for(const field of fields.filter(key=>key!=='notes')){
          if(typeof validateMetadata!=='function')throw full();
          metadata.push({field,ids:keys(await get(['contexts',account,field],true))});
        }
        plans.push({account,identity,ids:keys(await get(['contexts',account,'notes'],true)),metadata});
      }
      const chunks=['{"schema_version":1,"contexts":{'],expected=new Set(['$root','[]','["contexts"]']);
      for(const [index,{account,identity,ids,metadata}]of plans.entries()){
        expected.add(JSON.stringify(['contexts',account]));expected.add(JSON.stringify(['contexts',account,'notes']));
        chunks.push((index?',':'')+JSON.stringify(account)+':{"notes":{');
        for(const [offset,id]of ids.entries()){
          const selected=await get(['contexts',account,'notes',id]);if(!selected.found)throw fail();
          const entry=selected.value;
          if(entry?.protection_record||entry?.protectionScope||entry?.base?.crypto_epoch!==0)throw full();
          const validator=NowNoteHistory.create({initial:{schema_version:1,contexts:{[account]:{notes:{[id]:entry}}}},
            context:()=>({url:identity[0],owner:identity[1],enabled:true}),request:async()=>{throw fail();},write:async()=>{throw fail();}});
          if(validator.status().unsupported)throw fail();
          for(const key of NowDocumentParts.encode(entry).keys())if(key!=='$root')expected.add(JSON.stringify(['contexts',account,'notes',id,...JSON.parse(key)]));
          chunks.push(new Blob([(offset?',':'')+JSON.stringify(id)+':'+JSON.stringify(entry)]));
        }
        chunks.push('}');
        for(const {field,ids:metadataIds} of metadata){
          const prefix=['contexts',account,field];expected.add(JSON.stringify(prefix));chunks.push(','+JSON.stringify(field)+':{');
          for(const [offset,id] of metadataIds.entries()){
            const selected=await get([...prefix,id]);if(!selected.found)throw fail();
            if(await validateMetadata({account,identity,field,id,value:selected.value})!==true)throw full();active();
            for(const key of NowDocumentParts.encode(selected.value).keys())if(key!=='$root')expected.add(JSON.stringify([...prefix,id,...JSON.parse(key)]));
            chunks.push(new Blob([(offset?',':'')+JSON.stringify(id)+':'+JSON.stringify(selected.value)]));
          }
          chunks.push('}');
        }
        chunks.push('}');
      }
      chunks.push('}}');inventory(root,expected);inventory(await get([],true),expected);active();
      return new Blob(chunks,{type:'application/json'});
    }
    return {read:exportHistory};
  }
  globalThis.NowHistoryBackup={create};
})();
