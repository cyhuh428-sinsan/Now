/* Adapter over the existing account-bound Note journal, not a second wiki store. */
globalThis.createWikiNotebook=function createWikiNotebook(api){
  const W=globalThis.NowNoteWiki,P=globalThis.NowNoteProtectionProtocol,L=api.lifecycle;
  if(!L)throw Error('위키 휴지통 저장 연결을 확인하세요.');
  const copy=value=>structuredClone(value);
  const idOf=value=>/^wiki:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  const scope=ctx=>({url:String(ctx.url||'').replace(/\/+$/,''),owner:ctx.owner});
  function action(){
    const ctx={...api.context()},key=api.contextKey();
    if(!ctx.enabled||!ctx.owner)throw Error('본인 계정으로 다시 인증하세요.');
    const check=()=>{if(api.contextKey()!==key||!api.context().enabled)throw Error('계정·서버가 변경되었습니다. 원문은 보존했습니다.');};
    return {ctx,check,h:api.history()};
  }
  async function parse(content,ctx,local){
    if(typeof content!=='string'||new TextEncoder().encode(content).length>2097152)throw Error('위키 용량은2MiB를 넘을 수 없습니다.');
    let doc;
    try{doc=await W.validateDocument(content,scope(ctx));}
    catch(error){if(/hash|binding/.test(error.message))throw Error('위키 검토 해시·연결이 다릅니다.');throw error;}
    if('wiki:'+doc.wiki_id!==local)throw Error('위키 형식 또는 계정·서버가 다릅니다.');
    return doc;
  }
  async function source(id,a,forceServer=false){
    const note=api.source(id);
    if(!note||note.owner!==a.ctx.owner||note.status!=='ok'||note.protected)return note;
    const file=a.h.view(id);
    if(file?.draft.source==='wiki-source-snapshot'){await NowNoteWikiSources.inspect(file,a.ctx);a.check();}
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
    for(const ref of (doc?doc.drafts.flatMap(W.evidenceOf):W.evidenceOf(draft))){
      if(ref.kind==='wiki')throw Error('고정 근거 위키의 판본을 먼저 확인하세요.');
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
    if(!ctx.enabled||P.canonicalJson(doc.scope)!==P.canonicalJson(scope(ctx))||L.blocked(local)||h.blocked(local)||h.view(local)?.base.crypto_epoch>0)return false;
    return doc.drafts.flatMap(W.evidenceOf).every(ref=>{
      if(ref.kind==='wiki'){
        const sourceLocal='wiki:'+ref.wiki_id,item=h.view(sourceLocal);
        return ref.owner_id===ctx.owner&&!L.blocked(sourceLocal)&&!h.blocked(sourceLocal)
          &&(item?!item.protectionScope&&item.base.crypto_epoch===0&&!item.draft.deleted_at:ref.origin==='server'&&ctx.online!==false)
          &&(ref.origin!=='server'||ctx.online!==false);
      }
      const note=api.source(ref.note_ref.local_id);
      return ref.note_ref.owner_id===ctx.owner&&note?.owner===ctx.owner&&note.status==='ok'&&!note.protected
        &&(ctx.online!==false||ref.origin!=='server');
    });
  }
  async function retainedStatus(draft,doc,a){
    const evidence=api.evidence||globalThis.NowWikiEvidence?.create(api),sources=[],cache=new Map();
    if(!evidence)return {available:false,stale:true,sources:[]};
    try{
      for(const item of (doc?doc.drafts:[draft])){
        const values=new Map();
        for(const value of W.evidenceOf(item)){
          const ref=value.kind?value:{...copy(value),kind:'note'},key=P.canonicalJson(ref);
          if(!cache.has(key)){cache.set(key,await evidence.resolve(ref));a.check();}
          const proof=cache.get(key);values.set(ref.id,proof);
          if(item.id===draft.id)sources.push({id:ref.id,status:proof.stale?'changed':'ok'});
        }
        for(const citation of item.citations){
          const proof=values.get(citation.evidence_id||citation.source_id),text=proof?.kind==='note'?proof.content:
            proof?.draft.sections.find(section=>section.id===citation.section_id)?.markdown;
          if(typeof text!=='string'||!text.includes(citation.quote))throw Error('wiki_quote_mismatch');
        }
      }
      return {available:true,stale:sources.some(source=>source.status==='changed'),sources};
    }catch{a.check();return {available:false,stale:true,sources:[]};}
  }
  async function sourceStatus(draft,doc=null){
    const a=action();
    if(doc&&L.blocked('wiki:'+doc.wiki_id))return {available:false,stale:true,sources:[]};
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
          if(approved===draft.id&&P.canonicalJson(remote.artifact.document)===P.canonicalJson(doc)){
            if(doc.schema_version===2){const result=await retainedStatus(draft,doc,a);a.check();return {...result,stale:result.stale||remote.source_status.stale};}
            return {available:true,stale:remote.source_status.stale,sources:[]};
          }
        }
      }
    }
    if(doc?.schema_version===2||draft.schema_version===2)return retainedStatus(draft,doc,a);
    const values=await liveSources(draft,a,doc);
    if(!sourcesAvailable(values,a.ctx.owner))return {available:false,stale:true,sources:[]};
    const refs=W.evidenceOf(draft).map(ref=>{const {kind,...legacy}=ref;return legacy;});
    const result=await W.sourceStatus({...draft,source_manifest:refs},scope(a.ctx),id=>values.get(id));a.check();return result;
  }
  async function list({sync=false}={}){
    if(!api.context().enabled)return [];
    const a=action();
    if(sync){await L.sync();a.check();await a.h.sync();a.check();}
    const rows=new Map();
    const rowState=(id,extra={})=>{
      const lifecycle=L.state('wiki:'+id);
      return {...extra,id,lifecycle,deleted:Boolean(lifecycle?.deleted_at||lifecycle?.pending?.action==='trash')};
    };
    const visibleRows=async()=>{
      const visible=[];
      for(const row of rows.values()){
        if(row.deleted||row.lifecycle?.pending){visible.push(rowState(row.id,{protected:row.protected,localOnly:row.localOnly,error:row.error}));continue;}
        if(!row.document){visible.push(row);continue;}
        try{
          const state=await sourceStatus(row.document.drafts.at(-1),row.document);a.check();
          visible.push(state.available?row:{id:row.id,unavailable:true,error:'출처·보호 상태 확인 필요'});
        }catch{a.check();visible.push({id:row.id,unavailable:true,error:'출처 조회 실패 · 저장 원본 보존'});}
      }
      return visible;
    };
    const collect=async()=>{
      const bucket=a.h.export()?.contexts?.[NowNoteHistory.key(a.ctx)]?.notes||{};
      for(const [local,item] of Object.entries(bucket)){
        if(!idOf(local))continue;
        const id=local.slice(5),metadata=rowState(id,{localOnly:item.localOnly});
        if(metadata.deleted||metadata.lifecycle?.pending){rows.set(local,metadata);continue;}
        if(globalThis.createWikiIngestNotebook?.blocks(a.h.export(),a.ctx,local)){rows.set(local,rowState(id,{unavailable:true,error:'원작업 상태·로컬 반영 확인 필요'}));continue;}
        if(a.h.blocked(local)||!item.draft){rows.set(local,rowState(id,{protected:true}));continue;}
        try{const document=await parse(item.draft.content,a.ctx,local);a.check();rows.set(local,rowState(id,{document,
          pending:!item.localOnly&&Boolean(item.dirty||item.outbox.length),localOnly:item.localOnly,error:item.error?.code||item.conflict?.code}));}
        catch{a.check();rows.set(local,{id:local.slice(5),protected:true,error:'위키 원본 형식 확인 필요'});}
      }
    };
    await collect();a.check();
    if(a.ctx.online!==false){
      let remote;
      try{remote=await api.listRemote();a.check();}
      catch(error){a.check();if(!rows.size)throw error;return visibleRows();}
      await L.observe(remote);a.check();
      for(const item of remote){
        const local='wiki:'+item.id;if(!idOf(local)||a.h.manages(local))continue;
        const metadata=rowState(item.id);
        if(a.h.blocked(local)){rows.set(local,rowState(item.id,{unavailable:true,error:'원작업 상태·로컬 반영 확인 필요'}));continue;}
        if(metadata.deleted||metadata.lifecycle?.pending){rows.set(local,metadata);continue;}
        const result=await api.readRemote(item.id);a.check();
        if(result.artifact.protected||!result.artifact.document){rows.set(local,rowState(item.id,{protected:true}));continue;}
        const current=await api.readCurrent(local);a.check();
        if(current.head_revision_id!==result.artifact.head_revision_id)throw Error('위키 판본이 변경되었습니다. 다시 동기화하세요.');
        await parse(current.snapshot.note.content,a.ctx,local);a.check();
        await a.h.track(current.snapshot.note,current,{localOnly:false});a.check();
      }
      await collect();a.check();
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
    const a=action(),local='wiki:'+value.wiki_id,doc=await parse(P.canonicalJson(value),a.ctx,local);a.check();
    if(doc.schema_version===2)throw Error('새 위키 판본은 검토한 일괄 반영 원장으로 저장하세요.');
    if(!idOf(local)||a.h.blocked(local)||L.blocked(local))throw Error('보호·휴지통 상태를 먼저 확인하세요. 일반 저장하지 않았습니다.');
    const item=a.h.view(local),before=item?await parse(item.draft.content,a.ctx,local):null;a.check();
    if(item?.conflict)throw Error('위키 판본 충돌을 먼저 확인하세요.');
    append(before,doc);
    const localOnly=doc.drafts.some(d=>d.source_manifest.some(ref=>ref.origin!=='server'));
    if(item&&!item.localOnly&&localOnly)throw Error('로컬 자료는 새 로컬 위키에 저장하세요. 서버 위키는 보존했습니다.');
    const visibility=await sourceStatus(doc.drafts.at(-1),doc);a.check();
    if(!visibility.available)throw Error('출처·보호 상태를 확인할 수 없어 위키를 저장하지 않았습니다.');
    const latest=a.h.view(local);
    if(a.h.blocked(local)||L.blocked(local)||Boolean(latest)!==Boolean(item)
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
    if(value.schema_version===2){if(!api.approveV2)throw Error('위키 일괄 승인 연결을 확인하세요.');return api.approveV2(value,draftId);}
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
    if(value.schema_version===2){if(!api.rejectV2)throw Error('위키 일괄 검토 연결을 확인하세요.');return api.rejectV2(value,draftId);}
    const doc=copy(value);
    if(!doc.drafts.some(d=>d.id===draftId)||doc.rejected_draft_ids.includes(draftId)||doc.approvals.some(a=>a.draft_id===draftId))
      throw Error('이미 승인·반려했거나 없는 초안입니다.');
    doc.document_version++;doc.rejected_draft_ids.push(draftId);return save(doc);
  }
  async function inspectProtected(value,local){
    const a=action(),doc=await parse(value,a.ctx,local);a.check();
    if(doc.schema_version===2)return copy(doc);
    if(!idOf(local))throw Error('위키 형식이 다릅니다.');
    const ids=new Set();
    for(const draft of doc.drafts){
      if(!draft||typeof draft.id!=='string'||ids.has(draft.id)||typeof draft.title!=='string'||typeof draft.topic!=='string'
        ||P.canonicalJson(draft.scope)!==P.canonicalJson(doc.scope)||!Array.isArray(draft.sections)||!draft.sections.length
        ||!Array.isArray(draft.citations)||!draft.citations.length||!Array.isArray(draft.source_manifest)||!draft.source_manifest.length)
        throw Error('위키 저장 형식이 다릅니다.');
      ids.add(draft.id);
      const refs=new Set(),citations=new Set();
      for(const ref of draft.source_manifest){
        if(!ref||typeof ref.id!=='string'||refs.has(ref.id)||ref.note_ref?.owner_id!==a.ctx.owner
          ||typeof ref.note_ref.local_id!=='string')throw Error('위키 출처 계정·형식이 다릅니다.');
        refs.add(ref.id);
      }
      for(const citation of draft.citations){
        if(!citation||typeof citation.id!=='string'||citations.has(citation.id)||typeof citation.quote!=='string'||!refs.has(citation.source_id))
          throw Error('위키 인용 형식이 다릅니다.');
        citations.add(citation.id);
      }
      if(draft.sections.some(section=>!section||typeof section.title!=='string'||typeof section.markdown!=='string'
        ||!Array.isArray(section.citation_ids)||section.citation_ids.some(id=>!citations.has(id))))
        throw Error('위키 절 형식이 다릅니다.');
      const unsigned=copy(draft);delete unsigned.draft_hash;
      if(await P.hashJson(unsigned)!==draft.draft_hash)throw Error('위키 초안 해시가 다릅니다.');a.check();
    }
    let parent=null;const approvals=new Set(),approvedDrafts=new Set();
    for(const row of doc.approvals){
      const draft=doc.drafts.find(d=>d.id===row?.draft_id);
      if(!draft||typeof row.id!=='string'||!row.id||approvals.has(row.id)||approvedDrafts.has(row.draft_id)
        ||row.approved_by!==a.ctx.owner||row.parent_approved_revision_id!==parent||draft.base_approved_revision_id!==parent
        ||row.draft_hash!==draft.draft_hash||row.source_manifest_hash!==await P.hashJson(draft.source_manifest))
        throw Error('위키 검토 해시·연결이 다릅니다.');
      a.check();approvals.add(row.id);approvedDrafts.add(row.draft_id);parent=row.id;
    }
    if(new Set(doc.rejected_draft_ids).size!==doc.rejected_draft_ids.length
      ||doc.rejected_draft_ids.some(id=>!ids.has(id)||approvedDrafts.has(id)))throw Error('위키 검토 형식이 다릅니다.');
    a.check();return copy(doc);
  }
  async function readEvidence(ref){
    const a=action();W.validateEvidence(ref,a.ctx.owner);
    if(ref.kind!=='wiki')throw Error('고정 위키 출처를 선택하세요.');
    const evidence=api.evidence||globalThis.NowWikiEvidence?.create(api);
    if(!evidence)throw Error('고정 출처 검증 연결을 확인하세요.');
    const proof=await evidence.resolve(copy(ref),{fresh:false});a.check();
    if(api.history()!==a.h||!canRead(proof.currentDocument))throw Error('계정·서버·출처 상태가 변경되었습니다.');
    return copy(proof);
  }
  async function readOriginal(value){
    const a=action(),ref=value.kind?copy(value):{...copy(value),kind:'note'};W.validateEvidence(ref,a.ctx.owner);
    const evidence=api.evidence||globalThis.NowWikiEvidence?.create(api);
    if(!evidence)throw Error('고정 출처 검증 연결을 확인하세요.');
    const proof=await evidence.resolve(ref,{fresh:false});a.check();
    if(api.history()!==a.h)throw Error('계정·서버·이력 연결이 변경되었습니다.');
    return copy(proof);
  }
  async function approvedCatalog(){
    const a=action(),active=()=>{a.check();if(api.history()!==a.h)throw Error('위키 이력 연결이 변경되었습니다.');};
    const rows=await list();active();const verified=[];
    for(const row of rows){
      const approval=row.document?.approvals.at(-1),draft=row.document?.drafts.find(d=>d.id===approval?.draft_id);
      if(!draft||row.deleted||row.protected||row.unavailable||row.pending||row.lifecycle?.pending){verified.push({...row,available:false});continue;}
      const status=await sourceStatus(draft,row.document);active();verified.push({...row,...status});
    }
    const operations=copy(await api.readOperations?.()||[]);active();
    const known=new Set(operations.map(row=>row.operation_id));
    for(const row of verified){
      if(!row.available||!row.document)continue;
      const document=row.document,local='wiki:'+document.wiki_id,item=a.h.view(local);
      if(item?.localOnly!==false||!api.server?.readOperation)continue;
      const approval=document.approvals.at(-1),draft=document.drafts.find(d=>d.id===approval?.draft_id);
      const ids=[...new Set((draft?.relations||[]).filter(r=>r.to_ref.kind==='proposal').map(r=>r.to_ref.operation_id))].filter(id=>!known.has(id));
      if(!ids.length)continue;
      try{
        const proof=await api.server.inspect(local,{content:P.canonicalJson(document),revisionId:item.base.head_revision_id,headVersion:item.base.head_version},{policy:1});active();
        for(const id of ids){
          known.add(id);const result=await api.server.readOperation(id,proof.instance);active();
          if(result.state==='committed')operations.push({operation_id:id,action:result.manifest.kind,state:result.state,scope:scope(a.ctx),manifest:result.manifest});
        }
      }catch{active();}
    }
    const evidence=api.evidence||globalThis.NowWikiEvidence?.create(api),proofs=new Map();
    const relationProof=async(source,relation)=>{
      const row=verified.find(row=>row.document?.wiki_id===source);if(!row?.available||!evidence?.operationProof)throw Error('wiki_relation_operation');
      const ref=relation.to_ref,key=P.canonicalJson([source,ref.operation_id,ref.wiki_id]);
      if(!proofs.has(key))proofs.set(key,evidence.operationProof(ref.operation_id,source,ref.wiki_id,{origin:row.localOnly?'local':'server'}));
      const proof=await proofs.get(key);active();return proof;
    };
    const catalog=await NowWikiGraph.buildApprovedWikiCatalog(verified,a.ctx,{operations,relationProof});active();
    catalog.nodes=catalog.nodes.map(node=>{
      const row=verified.find(row=>row.document?.wiki_id===node.wiki_id);
      return {...node,origin:row.localOnly?'local':'server',protected:false};
    });
    return catalog;
  }
  async function lintSnapshot(){
    const a=action(),active=()=>{a.check();if(api.history()!==a.h)throw Error('위키 이력 연결이 변경되었습니다.');};
    const before=P.canonicalJson(a.h.export()),entries=a.h.entries(),rows=new Map();let index=null;
    if(a.ctx.online!==false)try{index=await api.listRemote();active();}catch{active();}
    if(index&&!index.every(row=>row.owner_id===a.ctx.owner))throw Error('위키 색인 계정이 다릅니다.');
    const known=new Map((index||[]).map(row=>[row.id,row]));
    for(const [local,item]of Object.entries(entries)){
      if(!idOf(local)||item.draft?.owner_id!==a.ctx.owner)continue;
      const id=local.slice(5),lifecycle=L.state(local);
      rows.set(id,{id,origin:item.localOnly?'local':'server',index_status:item.localOnly?'local':index?known.has(id)?'present':'missing':'unavailable',
        protected:a.h.blocked(local)||Boolean(item.protectionScope)||item.base.crypto_epoch>0,deleted:Boolean(item.draft.deleted_at||lifecycle?.deleted_at),
        pending:Boolean(lifecycle?.pending||!item.localOnly&&(item.dirty||item.outbox.length)),content:item.draft.content});
    }
    for(const row of index||[])if(!rows.has(row.id))rows.set(row.id,{id:row.id,origin:'server',index_status:'present',deleted:Boolean(row.deleted_at)});
    const result=[],evidence=api.evidence||globalThis.NowWikiEvidence?.create(api),cache=new Map();
    for(const row of rows.values()){
      const {content,...value}=row;
      if(value.protected||value.deleted||value.pending){result.push(value);continue;}
      let raw=content;
      if(row.origin==='server'){
        if(a.ctx.online===false||!index){result.push({...value,unavailable:true});continue;}
        try{
          const remote=await api.readRemote(row.id);active();
          if(remote.resource?.owner_id!==a.ctx.owner||remote.resource.id!==row.id)throw Error('위키 조회 계정이 다릅니다.');
          if(Boolean(known.get(row.id)?.deleted_at)!==Boolean(remote.resource.deleted_at))value.state_issue='trash_state_changed';
          if(remote.resource.deleted_at||remote.artifact?.protected||!remote.artifact?.document){result.push({...value,protected:remote.artifact?.protected===true,deleted:Boolean(remote.resource.deleted_at),unavailable:true});continue;}
          const current=await api.readCurrent('wiki:'+row.id);active();
          if(current.crypto_epoch>0){result.push({...value,protected:true,unavailable:true,state_issue:'protection_state_changed'});continue;}
          if(current.head_revision_id!==remote.artifact.head_revision_id)value.state_issue='revision_changed';
          if(current.snapshot?.note?.deleted_at)value.state_issue='trash_state_changed';
          if(current.identity_state!=='coherent'||current.snapshot?.note?.deleted_at||current.snapshot?.note?.owner_id!==a.ctx.owner
            ||current.snapshot.note.local_id!=='wiki:'+row.id||current.head_revision_id!==remote.artifact.head_revision_id
            ||current.snapshot.note.content!==P.canonicalJson(remote.artifact.document))throw Error('위키 판본이 다릅니다.');
          raw=current.snapshot.note.content;
        }catch{active();result.push({...value,unavailable:true});continue;}
      }
      let document;
      try{document=P.parseJson(raw);}catch{result.push({...value,document:{schema_version:1,scope:scope(a.ctx)}});continue;}
      if(document?.scope&&P.canonicalJson(document.scope)!==P.canonicalJson(scope(a.ctx))){result.push({...value,unavailable:true});continue;}
      try{await W.validateDocument(document,scope(a.ctx));active();}catch{active();result.push({...value,document});continue;}
      if(document.wiki_id!==row.id){result.push({...value,document});continue;}
      const source_checks=[],relation_checks=[];
      for(const draft of document.drafts){
        for(const original of W.evidenceOf(draft)){
          const ref=original.kind?original:{...copy(original),kind:'note'},key=P.canonicalJson(ref);let status='unavailable';
          try{
            if(!evidence)throw Error('wiki_source_unavailable');
            if(!cache.has(key))cache.set(key,evidence.resolve(ref,{fresh:false}));
            const proof=await cache.get(key);active();status=proof.stale?'changed':'ok';
            for(const citation of draft.citations.filter(c=>(c.evidence_id||c.source_id)===ref.id)){
              const text=proof.kind==='note'?proof.content:proof.draft.sections.find(s=>s.id===citation.section_id)?.markdown;
              if(typeof text!=='string'||!text.includes(citation.quote))status='quote_mismatch';
            }
          }catch(error){active();status=error.status===404?'missing':/owner/.test(error.message)?'foreign':/protection|locked/.test(error.message)?'locked':/hash|binding|quote/.test(error.message)?'invalid':'unavailable';}
          source_checks.push({draft_id:draft.id,evidence_id:ref.id,status});
        }
        for(const relation of draft.relations||[]){
          let status='unavailable';
          if(relation.to_ref.kind==='proposal'&&document.approvals.at(-1)?.draft_id===draft.id)try{
            const proof=await evidence.operationProof(relation.to_ref.operation_id,document.wiki_id,relation.to_ref.wiki_id,{origin:row.origin});active();
            await NowNoteWikiIngest.verifyCarriedRelation(document,relation,proof,a.ctx);active();status='ok';
          }catch{active();}
          relation_checks.push({draft_id:draft.id,relation_id:relation.id,status});
        }
      }
      result.push({...value,document,source_checks,relation_checks});
    }
    for(const row of result.filter(r=>r.relation_checks))for(const draft of row.document.drafts)for(const relation of draft.relations||[]){
      if(relation.to_ref.kind!=='approved')continue;
      const outcome=row.relation_checks.find(c=>c.draft_id===draft.id&&c.relation_id===relation.id),target=result.find(r=>r.id===relation.to_ref.wiki_id);
      if(!target?.source_checks)continue;
      const ref=relation.to_ref,chosen=target.document.drafts.find(d=>d.id===ref.draft_id);
      if(!chosen||chosen.draft_hash!==ref.draft_hash||!target.document.approvals.some(a=>a.id===ref.approval_id&&a.draft_id===ref.draft_id)){
        outcome.status='binding_invalid';continue;
      }
      try{
        const proof=await evidence.resolve({id:'lint-relation',kind:'wiki',origin:target.origin,owner_id:a.ctx.owner,wiki_id:ref.wiki_id,
          draft_id:ref.draft_id,approval_id:ref.approval_id,document_version:target.document.document_version,content_hash:ref.draft_hash},{fresh:false});active();
        outcome.status=proof.stale?'stale':'ok';
      }catch{active();}
    }
    active();if(P.canonicalJson(a.h.export())!==before)throw Error('검사 중 위키 저장 상태가 변경되었습니다. 다시 확인하세요.');
    return {scope:scope(a.ctx),rows:result};
  }
  return {list,capture,sourceStatus,canRead,save,approve,reject,inspectProtected,readEvidence,readOriginal,approvedCatalog,lintSnapshot,
    trash:id=>L.move('wiki:'+id,'trash'),restoreWiki:id=>L.move('wiki:'+id,'restore'),
    retryLifecycle:id=>L.retry('wiki:'+id),reconcileLifecycle:id=>L.reconcile('wiki:'+id)};
};
