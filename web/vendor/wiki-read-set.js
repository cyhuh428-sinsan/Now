/* A feature-lifetime selection is not a complete journal or a write baseline. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  async function open({stamp,account,current,directory,read,guard}){
    const fail=()=>Error('위키 자료의 저장 기준이 변경되었습니다. 원본을 보존했으며 다시 확인하세요.');
    let identity;try{identity=JSON.parse(account);}catch{throw fail();}
    if(typeof stamp!=='string'||!Array.isArray(identity)||identity.length!==2||identity.some(value=>typeof value!=='string')||JSON.stringify(identity)!==account)throw fail();
    let closed=false;const cache=new Map();
    const close=()=>{closed=true;cache.clear();};
    const active=()=>{if(closed||guard?.active&&!guard.active()){close();throw fail();}};
    const checked=async(path,shallow)=>{
      active();try{
        const row=await (shallow?directory:read)(path);active();
        if(row?.projection!=='path_v1'||row.stamp!==stamp||row.found!==true)throw fail();
        if(shallow&&(row.part?.type!=='object'||!Array.isArray(row.part.entries)))throw fail();
        return row;
      }catch(error){close();throw error;}
    };
    active();const preview=await current(account,guard);active();
    if(preview?.projection!=='journal_current_v1')throw fail();
    if(preview.supported!==true)return null;
    if(preview.account!==account||preview.stamp!==stamp)throw fail();
    const accountPath=['contexts',account],notePath=[...accountPath,'notes'];
    const keys=row=>row.part.entries.map(([id])=>{if(typeof id!=='string')throw fail();return id;});
    const fields=new Set(keys(await checked(accountPath,true))),ids=new Set(keys(await checked(notePath,true)));
    if([...fields].some(key=>!['notes','wiki_lifecycle','wiki_ingest_operations'].includes(key)))throw fail();
    const operationPath=[...accountPath,'wiki_ingest_operations'];
    const operations=fields.has('wiki_ingest_operations')?new Set(keys(await checked(operationPath,true))):new Set();
    const checkStamp=()=>checked(accountPath,true);
    const absent=projection=>({projection,account,stamp,found:false});
    async function selected(kind,id,path,known){
      active();try{
        await checkStamp();if(!known.has(id))return absent(kind);
        const key=JSON.stringify(path);let value=cache.get(key);
        if(value===undefined){
          value=(await checked(path,false)).value;
          if(kind==='wiki_entry_v1'){
            const notes=[value?.raw,value?.draft,...(value?.revisions||[]).map(row=>row?.snapshot?.note)];
            if(!object(value)||value.protection_record||value.protectionScope||value.base?.crypto_epoch!==0
              ||notes.some(note=>!object(note)||note.owner_id!==identity[1]||note.local_id!==id||!['tree','daily','worklog'].includes(note.note_type)
                ||typeof note.content!=='string'||note.content.startsWith('NOW_ENCRYPTED_')))throw Object.assign(fail(),{code:'wiki_readset_unsupported'});
            const h=NowNoteHistory.create({initial:{schema_version:1,contexts:{[account]:{notes:{[id]:value}}}},context:()=>({url:identity[0],owner:identity[1],enabled:true}),
              request:async()=>{throw fail();},write:async()=>{throw fail();}});
            if(h.status().unsupported)throw Object.assign(fail(),{code:'wiki_readset_unsupported'});
          }
          await checkStamp();active();cache.set(key,copy(value));
        }
        return {projection:kind,account,stamp,found:true,value:copy(value)};
      }catch(error){close();throw error;}
    }
    return Object.freeze({projection:'wiki_readset_v1',account,stamp,close,
      async ids(){await checkStamp();return [...ids];},
      async operationIds(){await checkStamp();return [...operations];},
      entry:id=>selected('wiki_entry_v1',id,[...notePath,id],ids),
      operation:id=>selected('wiki_operation_v1',id,[...operationPath,id],operations),
      async lifecycle(){await checkStamp();return fields.has('wiki_lifecycle')?copy((await checked([...accountPath,'wiki_lifecycle'],false)).value):{};},
    });
  }
  function root(history,account){
    const value=history?.readOnlySnapshot?.();
    if(value?.projection!=='wiki_readset_v1'||value.account!==account||typeof value.stamp!=='string'
      ||value.data?.schema_version!==1||!object(value.data.contexts)||Object.keys(value.data.contexts).length!==1
      ||!object(value.data.contexts[account]?.notes))throw Error('위키 읽기 자료의 계정·저장 범위를 확인하세요.');
    return value.data;
  }
  globalThis.NowWikiReadSet={open,root};
})();
