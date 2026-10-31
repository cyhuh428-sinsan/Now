/* Adapter over the existing account-bound Note journal, not a second wiki store. */
globalThis.createWikiNotebook=function createWikiNotebook(api){
  const W=globalThis.NowNoteWiki,P=globalThis.NowNoteProtectionProtocol;
  const copy=value=>structuredClone(value);
  const idOf=value=>/^wiki:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  const scope=ctx=>({url:String(ctx.url||'').replace(/\/+$/,''),owner:ctx.owner});
  function action(){
    const ctx={...api.context()},key=api.contextKey();
    if(!ctx.enabled||!ctx.owner)throw Error('본인 계정으로 다시 인증하세요.');
    const check=()=>{if(api.contextKey()!==key||!api.context().enabled)throw Error('계정·서버가 변경되었습니다. 원문은 보존했습니다.');};
    return {ctx,check,h:api.history()};
  }
  function parse(content,ctx,local){
    if(typeof content!=='string'||new TextEncoder().encode(content).length>2097152)throw Error('위키 용량은2MiB를 넘을 수 없습니다.');
    const doc=JSON.parse(content);
    if(!doc||doc.schema_version!==1||'wiki:'+doc.wiki_id!==local||!Number.isSafeInteger(doc.document_version)
      ||doc.document_version<1||!Array.isArray(doc.drafts)||!doc.drafts.length||doc.drafts.length>1000
      ||!Array.isArray(doc.approvals)||doc.approvals.length>1000||!Array.isArray(doc.rejected_draft_ids)||doc.rejected_draft_ids.length>1000
      ||P.canonicalJson(doc.scope)!==P.canonicalJson(scope(ctx)))throw Error('위키 형식 또는 계정·서버가 다릅니다.');
    return doc;
  }
  async function source(id,a,forceServer=false){
    const note=api.source(id);
    if(!note||note.owner!==a.ctx.owner||note.status!=='ok'||note.protected)return note;
    if(note.origin!=='server'&&!forceServer)return copy(note);
    const item=a.h.view(id);
    if(a.ctx.online===false){
      return {...note,status:'unavailable'};
    }
    const current=await api.readCurrent(id);a.check();
    const raw=current.snapshot?.note;
    if(current.crypto_epoch>0||!raw||raw.deleted_at||raw.owner_id!==a.ctx.owner||raw.local_id!==id
      ||current.identity_state!=='coherent')return {...note,status:'unavailable'};
    if(raw.content!==note.content||item?.dirty||item?.outbox.length)
      return {...note,origin:'local',revisionId:null,headVersion:0};
    return {...note,content:raw.content,revisionId:current.head_revision_id,headVersion:current.head_version};
  }
  async function capture(ids){
    const a=action(),values=new Map();
    for(const id of ids){values.set(id,await source(id,a));a.check();}
    const result=await W.capture(ids,scope(a.ctx),id=>values.get(id));a.check();return result;
  }
  async function liveSources(draft,a,doc=null){
    const values=new Map(),refs=new Map();
    for(const ref of (doc?doc.drafts.flatMap(value=>value.source_manifest):draft.source_manifest)){
      if(ref.note_ref.owner_id!==a.ctx.owner)throw Error('원본 계정이 다릅니다.');
      const local=ref.note_ref.local_id;
      refs.set(local,ref.origin==='server'||refs.get(local)===true);
    }
    for(const [local,server] of refs){
      values.set(local,await source(local,a,server));a.check();
    }
    return values;
  }
  const sourcesAvailable=(values,owner)=>[...values.values()].every(note=>note?.owner===owner&&note.status==='ok'&&!note.protected);
  function canRead(doc){
    const ctx=api.context(),h=api.history(),local='wiki:'+doc.wiki_id;
    if(!ctx.enabled||P.canonicalJson(doc.scope)!==P.canonicalJson(scope(ctx))||h.blocked(local)||h.view(local)?.base.crypto_epoch>0)return false;
    return doc.drafts.flatMap(draft=>draft.source_manifest).every(ref=>{
      const note=api.source(ref.note_ref.local_id);
      return ref.note_ref.owner_id===ctx.owner&&note?.owner===ctx.owner&&note.status==='ok'&&!note.protected
        &&(ctx.online!==false||ref.origin!=='server');
    });
  }
  async function sourceStatus(draft,doc=null){
    const a=action();
    if(doc){
      if(!canRead(doc))return {available:false,stale:true,sources:[]};
      const item=a.h.view('wiki:'+doc.wiki_id);
      if(item&&!item.localOnly){
        if(a.ctx.online===false)return {available:false,stale:true,sources:[]};
        let remote;
        try{remote=await api.readRemote(doc.wiki_id);a.check();}
        catch(error){a.check();if(error.status!==404||item.base.head_revision_id||item.revisions.some(r=>r.imported))throw error;}
        if(remote){
          if(remote.artifact?.protected!==false||!remote.artifact.document||remote.resource?.deleted_at
            ||remote.source_status?.available!==true)return {available:false,stale:true,sources:[]};
          const approved=remote.artifact.document.approvals.at(-1)?.draft_id||remote.artifact.document.drafts.at(-1)?.id;
          if(approved===draft.id&&P.canonicalJson(remote.artifact.document)===P.canonicalJson(doc))
            return {available:true,stale:remote.source_status.stale,sources:[]};
        }
      }
    }
    const values=await liveSources(draft,a,doc);
    if(!sourcesAvailable(values,a.ctx.owner))return {available:false,stale:true,sources:[]};
    const result=await W.sourceStatus(draft,scope(a.ctx),id=>values.get(id));a.check();return result;
  }
  async function list({sync=false}={}){
    if(!api.context().enabled)return [];
    const a=action();
    if(sync){await a.h.sync();a.check();}
    const rows=new Map();
    const visibleRows=async()=>{
      const visible=[];
      for(const row of rows.values()){
        if(!row.document){visible.push(row);continue;}
        try{
          const state=await sourceStatus(row.document.drafts.at(-1),row.document);a.check();
          visible.push(state.available?row:{id:row.id,unavailable:true,error:'출처·보호 상태 확인 필요'});
        }catch{a.check();visible.push({id:row.id,unavailable:true,error:'출처 조회 실패 · 저장 원본 보존'});}
      }
      return visible;
    };
    const collect=()=>{
      const bucket=a.h.export()?.contexts?.[NowNoteHistory.key(a.ctx)]?.notes||{};
      for(const [local,item] of Object.entries(bucket)){
        if(!idOf(local))continue;
        if(a.h.blocked(local)||!item.draft){rows.set(local,{id:local.slice(5),protected:true});continue;}
        try{rows.set(local,{id:local.slice(5),document:parse(item.draft.content,a.ctx,local),
          pending:!item.localOnly&&Boolean(item.dirty||item.outbox.length),localOnly:item.localOnly,error:item.error?.code||item.conflict?.code});}
        catch{rows.set(local,{id:local.slice(5),protected:true,error:'위키 원본 형식 확인 필요'});}
      }
    };
    collect();
    if(a.ctx.online!==false){
      let remote;
      try{remote=await api.listRemote();a.check();}
      catch(error){a.check();if(!rows.size)throw error;return visibleRows();}
      for(const item of remote){
        const local='wiki:'+item.id;if(!idOf(local)||a.h.manages(local))continue;
        const result=await api.readRemote(item.id);a.check();
        if(result.artifact.protected||!result.artifact.document){rows.set(local,{id:item.id,protected:true});continue;}
        const current=await api.readCurrent(local);a.check();
        if(current.head_revision_id!==result.artifact.head_revision_id)throw Error('위키 판본이 변경되었습니다. 다시 동기화하세요.');
        parse(current.snapshot.note.content,a.ctx,local);
        await a.h.track(current.snapshot.note,current,{localOnly:false});a.check();
      }
      collect();
    }
    return visibleRows();
  }
  function append(before,doc){
    if(!before){
      if(doc.document_version!==1||doc.drafts.length!==1||doc.approvals.length||doc.rejected_draft_ids.length)throw Error('첫 위키는 초안으로 저장하세요.');
      return;
    }
    if(doc.document_version!==before.document_version+1||doc.wiki_id!==before.wiki_id
      ||P.canonicalJson(doc.scope)!==P.canonicalJson(before.scope))throw Error('위키 판본 충돌입니다.');
    const delta=['drafts','approvals','rejected_draft_ids'].map(name=>{
      if(P.canonicalJson(doc[name].slice(0,before[name].length))!==P.canonicalJson(before[name]))throw Error('저장된 위키 이력은 바꿀 수 없습니다.');
      return doc[name].length-before[name].length;
    });
    if(!['1,0,0','0,1,0','0,0,1'].includes(delta.join(',')))throw Error('위키 판본 충돌입니다.');
  }
  async function save(value){
    const a=action(),local='wiki:'+value.wiki_id,doc=parse(P.canonicalJson(value),a.ctx,local);
    if(!idOf(local)||a.h.blocked(local))throw Error('보호된 위키는 일반 저장할 수 없습니다.');
    const item=a.h.view(local),before=item?parse(item.draft.content,a.ctx,local):null;
    if(item?.conflict)throw Error('위키 판본 충돌을 먼저 확인하세요.');
    append(before,doc);
    const localOnly=doc.drafts.some(d=>d.source_manifest.some(ref=>ref.origin!=='server'));
    if(item&&!item.localOnly&&localOnly)throw Error('로컬 자료는 새 로컬 위키에 저장하세요. 서버 위키는 보존했습니다.');
    const visibility=await sourceStatus(doc.drafts.at(-1),doc);a.check();
    if(!visibility.available)throw Error('출처·보호 상태를 확인할 수 없어 위키를 저장하지 않았습니다.');
    const latest=a.h.view(local);
    if(a.h.blocked(local)||Boolean(latest)!==Boolean(item)
      ||(item&&(latest.draft.content!==item.draft.content||latest.localOnly!==item.localOnly)))throw Error('위키 판본 충돌입니다.');
    const now=new Date().toISOString();
    const note={...(item?.draft||{}),id:item?.draft.id||null,owner_id:a.ctx.owner,local_id:local,device_id:a.ctx.device,
      note_type:'tree',title:'AI Wiki '+doc.wiki_id,content:P.canonicalJson(doc),source:'wiki-artifact',
      parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:item?.draft.created_at||now,updated_at:now,client_updated_at:now};
    if(!item)await a.h.track(note,null,{localOnly});else await a.h.edit(note);
    a.check();await a.h.seal(local,'wiki_edit');a.check();
    if(!localOnly&&a.ctx.online!==false){await a.h.sync();a.check();}
    const stored=a.h.view(local);
    if(a.h.failure())throw Error(a.h.failure());
    return {document:copy(doc),localOnly,pending:!localOnly&&Boolean(stored?.outbox.length),error:stored?.conflict?.code||stored?.error?.code};
  }
  async function approve(value,draftId){
    const a=action(),doc=copy(value),draft=doc.drafts.find(d=>d.id===draftId),base=doc.approvals.at(-1)?.id||null;
    if(!draft||draft.base_approved_revision_id!==base||doc.rejected_draft_ids.includes(draftId)
      ||doc.approvals.some(row=>row.draft_id===draftId))throw Error('위키 승인 판본 충돌입니다.');
    const unsigned={...draft};delete unsigned.draft_hash;
    if(await P.hashJson(unsigned)!==draft.draft_hash)throw Error('위키 초안 해시가 다릅니다.');a.check();
    if(!canRead(doc))throw Error('원본·보호 상태를 확인할 수 없습니다.');
    const live=await liveSources(draft,a,doc),status=await W.sourceStatus(draft,scope(a.ctx),id=>live.get(id));a.check();
    if(!sourcesAvailable(live,a.ctx.owner))throw Error('원본·보호 상태를 확인할 수 없습니다.');
    if(!status.available||status.stale)throw Error('원본이 변경되었습니다. 갱신 후 검토하세요.');
    for(const citation of draft.citations){
      const manifest=draft.source_manifest.find(ref=>ref.id===citation.source_id);
      if(!manifest||!live.get(manifest.note_ref.local_id)?.content.includes(citation.quote))throw Error('인용문이 원본과 다릅니다.');
    }
    doc.document_version++;
    doc.approvals.push({id:crypto.randomUUID(),parent_approved_revision_id:base,draft_id:draftId,draft_hash:draft.draft_hash,
      source_manifest_hash:await P.hashJson(draft.source_manifest),approved_by:a.ctx.owner,approved_at:new Date().toISOString()});
    a.check();return save(doc);
  }
  async function reject(value,draftId){
    const doc=copy(value);
    if(!doc.drafts.some(d=>d.id===draftId)||doc.rejected_draft_ids.includes(draftId)||doc.approvals.some(a=>a.draft_id===draftId))
      throw Error('이미 승인·반려했거나 없는 초안입니다.');
    doc.document_version++;doc.rejected_draft_ids.push(draftId);return save(doc);
  }
  return {list,capture,sourceStatus,canRead,save,approve,reject};
};
