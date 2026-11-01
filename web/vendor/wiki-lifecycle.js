/* Account journal metadata only. Wiki bodies and protection dependencies never move. */
(() => {
  'use strict';
  const copy=value=>structuredClone(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const localId=value=>/^wiki:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const rejected=new Set(['version_conflict','resource_deleted','resource_not_deleted','resource_limit','idempotency_mismatch','crypto_transition_in_progress']);
  const fail=()=>new Error('위키 휴지통 상태를 확인하지 못했습니다. 원문과 요청은 보존했습니다.');
  const fields=(value,names)=>{if(!object(value)||!same(Object.keys(value).sort(),[...names].sort()))throw fail();};
  function validate(row){
    fields(row,['local_only','version','deleted_at','pending']);
    if(typeof row.local_only!=='boolean'||!Number.isSafeInteger(row.version)||row.version<1
      ||row.deleted_at!==null&&(typeof row.deleted_at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(row.deleted_at)||!Number.isFinite(Date.parse(row.deleted_at))))throw fail();
    if(row.pending!==null){
      const op=row.pending;fields(op,['action','base_version','mutation_id','device_id','rejected']);
      if(row.local_only||!['trash','restore'].includes(op.action)||!Number.isSafeInteger(op.base_version)||op.base_version<1
        ||!uuid(op.mutation_id)||typeof op.device_id!=='string'||!op.device_id||op.device_id.length>120
        ||op.rejected!==null&&!rejected.has(op.rejected))throw fail();
    }
    return row;
  }
  const validateMap=map=>{if(!object(map))throw fail();for(const [id,row]of Object.entries(map)){if(!localId(id))throw fail();validate(row);}return map;};
  function acknowledge(current,row){
    if(current.version===row.version&&current.deleted_at!==row.deleted_at)throw fail();
    return current.version>row.version?{...current,pending:null}:row;
  }
  function validateRestore(current,incoming){
    const pending=(root,visit)=>{
      for(const [account,value]of Object.entries(root?.contexts||{}))
        for(const [id,row]of Object.entries(validateMap(value.wiki_lifecycle||{})))if(row.pending)visit(account,id,row);
    };
    const missing=()=>{throw new Error('확인되지 않은 위키 휴지통 요청을 백업으로 교체할 수 없습니다. 기존 자료를 보존했습니다.');};
    pending(current,(account,id,row)=>{if(!same(incoming?.contexts?.[account]?.wiki_lifecycle?.[id],row))missing();});
    const roots=value=>[value,...(value?.recovery_archives||[]).flatMap(roots)];
    const restored=roots(incoming);
    for(const root of roots(current).slice(1))pending(root,(account,id,row)=>{
      if(!restored.some(value=>same(value?.contexts?.[account]?.wiki_lifecycle?.[id],row)))missing();
    });
  }
  function create(api){
    function action(){
      const ctx={...api.context()},key=api.contextKey(),h=api.history();
      if(!ctx.enabled||!ctx.owner)throw fail();
      const check=()=>{if(key!==api.contextKey()||!api.context().enabled)throw fail();return true;};
      return {ctx,h,check,key:NowNoteHistory.key(ctx)};
    }
    function snapshot(a){
      a.check();const data=a.h.export();
      if(data?.schema_version!==1||!object(data.contexts))throw fail();
      const map=validateMap(data.contexts[a.key]?.wiki_lifecycle||{});
      return {data,map};
    }
    async function save(a,data,map){
      a.check();validateMap(map);
      const next=copy(data);next.contexts[a.key]||={notes:{}};next.contexts[a.key].wiki_lifecycle=copy(map);
      await a.h.replaceProtectionStore(data,next,{active:a.check});a.check();
    }
    function state(id){
      if(!api.context().enabled)return null;
      if(!localId(id))throw fail();const a=action();return copy(snapshot(a).map[id]||null);
    }
    const blocked=id=>{const row=state(id);return Boolean(row&&(row.deleted_at||row.pending));};
    async function remote(a,value,id){
      if(!object(value)||value.owner_id!==a.ctx.owner||!uuid(value.id)||'wiki:'+value.id!==(id||'wiki:'+value.id)
        ||![1,2].includes(value.schema_version)||!object(value.payload)||value.payload.artifact_local_id!=='wiki:'+value.id
        ||!Array.isArray(value.payload.dependencies)||value.payload.dependencies.some(ref=>ref.owner_id!==a.ctx.owner||typeof ref.local_id!=='string'))throw fail();
      if(value.schema_version===2){await NowNoteWiki.validateLink(value.payload,a.ctx);a.check();}
      if((value.schema_version===2)!==Object.hasOwn(value.payload,'document_schema_floor'))throw fail();
      return validate({local_only:false,version:value.version,deleted_at:value.deleted_at,pending:null});
    }
    async function observe(resources){
      const a=action(),{data,map}=snapshot(a),next=copy(map);
      if(!Array.isArray(resources))throw fail();
      for(const value of resources){
        const row=await remote(a,value),id='wiki:'+value.id,old=next[id];
        if(old?.local_only)throw fail();
        if(old&&old.version>row.version)continue;
        if(old&&old.version===row.version&&old.deleted_at!==row.deleted_at)throw fail();
        next[id]={...row,pending:copy(old?.pending||null)};
      }
      if(!same(map,next))await save(a,data,next);
    }
    async function localOrigin(a,id){
      const entry=snapshot(a).data.contexts[a.key]?.notes?.[id];
      if(entry?.localOnly===true)return true;
      if(entry?.protection_record){
        NowNoteProtectionState.protectedRecord(entry);
        const local=await NowNoteWiki.localProtectionScope(a.ctx,id);a.check();
        if(entry.protection_record.scope.instance===local.instance)return true;
      }
      return false;
    }
    async function send(a,id){
      const before=snapshot(a).map[id],op=copy(before?.pending);
      if(!op||op.rejected)throw new Error('서버의 현재 상태를 확인한 뒤 다시 선택하세요.');
      if(!a.ctx.online)throw new Error('서버 연결 후 같은 요청을 다시 확인하세요.');
      let response;
      try{
        response=await api.request(a.ctx,id,op.action,{owner_id:a.ctx.owner,schema_version:1,base_version:op.base_version,
          mutation_id:op.mutation_id,device_id:op.device_id});a.check();
      }catch(error){
        a.check();
        if([409,423].includes(error.status)&&rejected.has(error.code)){
          const {data,map}=snapshot(a);
          if(!same(map[id]?.pending,op))throw fail();
          const next=copy(map);next[id].pending.rejected=error.code;await save(a,data,next);
        }
        throw error;
      }
      if(response?.status!=='ok'||response.mutation_id!==op.mutation_id)throw fail();
      const row=await remote(a,response.resource,id);
      if(row.version!==op.base_version+1||Boolean(row.deleted_at)!==(op.action==='trash'))throw fail();
      const {data,map}=snapshot(a),current=map[id];
      if(!same(current?.pending,op))throw fail();
      const next=copy(map);next[id]=acknowledge(current,row);
      await save(a,data,next);return copy(next[id]);
    }
    async function move(id,operation){
      if(!localId(id)||!['trash','restore'].includes(operation))throw fail();
      const a=action(),local=await localOrigin(a,id);a.check();
      const {data,map}=snapshot(a),old=map[id];
      if(Object.values(a.h.protectionOperations()).some(m=>m.scope.owner===a.ctx.owner&&m.scope.url.replace(/\/+$/,'')===a.ctx.url.replace(/\/+$/,'')
        &&m.scope.local_id===id&&m.phase!=='complete'))throw new Error('진행 중인 위키 보호를 먼저 완료하세요.');
      if(old?.pending)throw new Error('보존된 요청을 먼저 다시 확인하세요.');
      if(Boolean(old?.deleted_at)!==(operation==='restore'))throw fail();
      if(local){
        if(old&&!old.local_only)throw fail();
        const next=copy(map);next[id]={local_only:true,version:(old?.version||0)+1,
          deleted_at:operation==='trash'?new Date().toISOString():null,pending:null};
        await save(a,data,next);return copy(next[id]);
      }
      if(!old||old.local_only)throw new Error('서버 위키 목록을 먼저 동기화하세요.');
      const next=copy(map);next[id].pending={action:operation,base_version:old.version,mutation_id:crypto.randomUUID(),device_id:a.ctx.device,rejected:null};
      await save(a,data,next);
      if(a.ctx.online)return send(a,id);
      return copy(next[id]);
    }
    async function reconcile(id){
      const a=action(),op=snapshot(a).map[id]?.pending;
      if(!op?.rejected)throw fail();
      const response=await api.read(a.ctx,id);a.check();
      const row=await remote(a,response.resource,id),{data,map}=snapshot(a);
      if(!same(map[id]?.pending,op))throw fail();
      const next=copy(map);next[id]=acknowledge(map[id],row);await save(a,data,next);return copy(next[id]);
    }
    function validateIncoming(incoming){
      const current=api.history().export();
      validateRestore(current,{...incoming,recovery_archives:[...(current?.recovery_archives||[]),...(incoming?.recovery_archives||[]),{contexts:current?.contexts||{}}]});
    }
    return {state,blocked,observe,move,reconcile,validateRestore:validateIncoming,retry:id=>send(action(),id),async sync(){
      const a=action();for(const [id,row]of Object.entries(snapshot(a).map))if(row.pending&&!row.pending.rejected)await send(a,id);
    }};
  }
  globalThis.NowWikiLifecycle={create,validateRestore};
})();
