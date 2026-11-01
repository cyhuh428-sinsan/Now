/* Read-only retained evidence proofs. No plaintext cache or new storage is created. */
globalThis.NowWikiEvidence=Object.freeze({create(api){
  'use strict';
  const P=NowNoteProtectionProtocol,W=NowNoteWiki,copy=structuredClone,eq=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const check=(v,code='wiki_dependency_unverified')=>{if(!v)throw Error(code);};
  const tuple=doc=>{const a=doc.approvals.at(-1),d=doc.drafts.find(d=>d.id===a?.draft_id);return [a?.id||null,d?.id||null,d?.draft_hash||null];};
  async function action(){
    const ctx={...api.context()},key=api.contextKey(),h=api.history();check(ctx.enabled&&ctx.owner&&h&&h.export()?.schema_version===1&&!h.status().unsupported&&!h.suspended());
    const active=()=>check(key===api.contextKey()&&api.context().enabled&&api.history()===h,'wiki_context_changed');
    const roots=[h.export(),...(await api.retainedRoots?.()||[])];active();const all=[],queue=[...roots],seen=new WeakSet();
    while(queue.length){const value=queue.shift();if(value==null)continue;check(typeof value==='object'&&value.contexts&&typeof value.contexts==='object');if(seen.has(value))continue;seen.add(value);all.push(value);queue.push(...(value.recovery_archives||[]));}
    return {ctx,h,active,roots:all,account:NowNoteHistory.key(ctx),docs:new Map(),notes:new Map(),wikis:new Map(),versions:new Set(),producerInstances:new Set()};
  }
  function localItems(a,id){return a.roots.flatMap(r=>{const item=r.contexts?.[a.account]?.notes?.[id];return item?[item]:[];});}
  function bind(a,instance){if(!instance)return;check(!a.instance||a.instance===instance,'wiki_context_changed');a.instance=instance;a.onInstance?.(instance);}
  function plainLocal(a,id){
    for(const root of a.roots){
      const item=root.contexts?.[a.account]?.notes?.[id];
      check(!item||!item.protection_record&&!item.protectionScope&&item.base?.crypto_epoch===0,'wiki_protection_unavailable');
      for(const marker of Object.values(root.protection_operations||{}))check(!(marker?.scope?.owner===a.ctx.owner&&marker.scope.local_id===id
        &&String(marker.scope.url).replace(/\/+$/,'')===String(a.ctx.url).replace(/\/+$/,'')),'wiki_protection_unavailable');
    }
  }
  function snapshots(a,local){
    const found=[],seen=new WeakSet();
    function scan(value){
      if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
      if(value.owner_id===a.ctx.owner&&value.local_id===local&&Object.hasOwn(value,'content')){
        check(typeof value.content==='string'&&!value.content.startsWith('NOW_ENCRYPTED_V1:'),'wiki_protection_unavailable');found.push(copy(value));
      }
      for(const child of Object.values(value))scan(child);
    }
    for(const item of localItems(a,local))scan(item);return found;
  }
  async function documents(a,wiki,remote=[]){
    if(a.docs.has(wiki))return a.docs.get(wiki);plainLocal(a,'wiki:'+wiki);
    const bodies=snapshots(a,'wiki:'+wiki);
    for(const root of a.roots)for(const [local,item]of Object.entries(root.contexts?.[a.account]?.notes||{})){
      if(!local.startsWith('wiki-proposal:')||!local.endsWith(':'+wiki))continue;plainLocal(a,local);bodies.push(...snapshots(a,local));
    }
    const result=new Map();
    for(const input of [...bodies.map(n=>n.content),...remote.map(r=>r.document)]){
      const document=await W.validateDocument(input,a.ctx);a.active();check(document.wiki_id===wiki,'wiki_evidence_binding');
      const hash=await P.hashJson(document);result.set(hash,document);a.versions.add(wiki+':'+hash);check(a.versions.size<=2000,'wiki_dependency_limit');
    }
    a.docs.set(wiki,result);return result;
  }
  async function note(a,ref,{fresh=false}={}){
    const cached=a.notes.get(P.canonicalJson(ref));if(cached){check(!fresh||!cached.stale,'wiki_source_changed');return cached;}
    W.validateEvidence(ref,a.ctx.owner);plainLocal(a,ref.note_ref.local_id);const local=ref.note_ref.local_id;
    let content,current,instance,stale=false;
    if(ref.origin==='server'){
      check(api.server,'wiki_source_unavailable');const proof=await api.server.inspect(local,undefined,{policy:fresh?2:1});a.active();
      const fixed=proof.history.find(r=>r.revision_ref.kind==='note_revision'&&r.revision_ref.id===ref.source_revision_id);
      check(fixed,'wiki_source_unavailable');content=fixed.snapshot.note.content;current=proof.current;instance=proof.instance;bind(a,instance);
      stale=current.head_revision_id!==ref.source_revision_id||current.head_version!==ref.head_version;
    }else{
      const item=a.h.view(local),source=api.source?.(local)||(item?{owner:item.draft.owner_id,status:'ok',protected:Boolean(item.protectionScope),content:item.draft.content}:null);
      check(source?.owner===a.ctx.owner&&source.status==='ok'&&!source.protected,'wiki_source_unavailable');
      const values=snapshots(a,local);values.push({content:source.content});
      for(const value of values)if(await P.sha256(value.content)===ref.content_hash){content=value.content;break;}
      a.active();stale=await P.sha256(source.content)!==ref.content_hash;
      if(item&&!item.localOnly){check(a.ctx.online&&api.server,'wiki_source_unavailable');const proof=await api.server.inspect(local,undefined,{policy:fresh?2:1});instance=proof.instance;bind(a,instance);a.active();}
    }
    check(typeof content==='string'&&await P.sha256(content)===ref.content_hash,'wiki_snapshot_hash');a.active();check(!fresh||!stale,'wiki_source_changed');
    const result={kind:'note',content,stale,current,instance};a.notes.set(P.canonicalJson(ref),result);return result;
  }
  async function wiki(a,ref,{fresh=false,allowDeleted=false}={}){
    W.validateEvidence(ref,a.ctx.owner);const key=P.canonicalJson(ref),known=a.wikis.get(key);
    if(known){check(allowDeleted||!known.deleted,'wiki_source_unavailable');check(!fresh||!known.stale,'wiki_source_changed');return known;}
    let value;
    if(ref.origin==='server'){
      check(api.server,'wiki_source_unavailable');value=await api.server.pinnedWiki(ref,{fresh,allowDeleted,policy:fresh?2:1});a.active();bind(a,value.instance);
      await documents(a,ref.wiki_id,value.history);
    }else{
      const local='wiki:'+ref.wiki_id,item=a.h.view(local);check(item&&item.localOnly,'wiki_source_unavailable');plainLocal(a,local);
      const deleted=Boolean(api.lifecycle?.state(local)?.deleted_at);check(allowDeleted||!deleted,'wiki_source_unavailable');
      const currentDocument=await W.validateDocument(item.draft.content,a.ctx),retained=await documents(a,ref.wiki_id);a.active();let chosen;
      for(const document of retained.values()){
        if(document.document_version!==ref.document_version)continue;
        const draft=document.drafts.find(d=>d.id===ref.draft_id&&d.draft_hash===ref.content_hash);
        if(draft&&document.approvals.some(v=>v.id===ref.approval_id&&v.draft_id===ref.draft_id))chosen={document,draft};
      }
      check(chosen,'wiki_source_unavailable');value={...copy(chosen),currentDocument,index:null,deleted,history:[...retained.values()].map(document=>({document})),safety:{status:'ok',epoch:0,lineage:false,fence:false}};
    }
    check(value.currentDocument.document_version>=ref.document_version,'wiki_source_changed');
    const stale=!eq(tuple(value.currentDocument),[ref.approval_id,ref.draft_id,ref.content_hash]);check(!fresh||!stale,'wiki_source_changed');
    const result={kind:'wiki',...value,stale};a.wikis.set(key,result);return result;
  }
  async function knownGeneration(a,wikiId,draft,docs){
    const candidates=a.roots.flatMap(root=>Object.values(root.contexts?.[a.account]?.wiki_ingest_operations||{}));
    for(const row of candidates){
      if(row?.action!=='ingest'||!['attempted','committed','aborted'].includes(row.state)||!Array.isArray(row.documents)||!Array.isArray(row.inputs))continue;
      if(row.scope?.owner!==a.ctx.owner||String(row.scope.url).replace(/\/+$/,'')!==String(a.ctx.url).replace(/\/+$/,''))continue;
      const bound=row.documents.find(d=>d.wiki_id===wikiId&&d.draft_id===draft.id&&d.draft_hash===draft.draft_hash),page=row.reservation?.pages?.find(p=>p.wiki_id===wikiId&&p.draft_id===draft.id&&p.generation_id===draft.generation_id);
      if(!bound||!page)continue;const document=docs.get(bound.document_hash);if(!document)continue;
      row.inputs.forEach(ref=>W.validateEvidence(ref,a.ctx.owner));let expected=row.inputs;
      const parent=document.approvals.find(v=>v.id===draft.base_approved_revision_id),before=document.drafts.find(d=>d.id===parent?.draft_id);
      const own=row.inputs.filter(ref=>ref.kind==='wiki'&&ref.wiki_id===wikiId);
      if(parent&&own.length){
        if(own.length!==1||own[0].approval_id!==parent.id||own[0].draft_id!==before?.id||own[0].content_hash!==before.draft_hash||own[0].document_version!==document.document_version-1)continue;
        expected=row.inputs.filter(ref=>ref.id!==own[0].id);
      }else if(parent&&row.documents.length>1)continue;
      if(!eq(expected,W.evidenceOf(draft)))continue;
      if(row.remote){
        const m=row.remote.manifest;if(!m||m.operation_id!==row.operation_id||m.owner_id!==a.ctx.owner||!eq(m.inputs,row.inputs))continue;
        const unsigned=copy(m);delete unsigned.manifest_hash;if(await P.hashJson(unsigned)!==m.manifest_hash)continue;
      }
      if(row.documents.length>1){
        let complete=true;
        for(const output of row.documents){
          const other=output.wiki_id===wikiId?docs:await documents(a,output.wiki_id),result=other.get(output.document_hash),chosen=result?.drafts.find(d=>d.id===output.draft_id&&d.draft_hash===output.draft_hash);
          if(!chosen){complete=false;break;}
          if(chosen.base_approved_revision_id&&!row.inputs.some(ref=>ref.kind==='wiki'&&ref.wiki_id===output.wiki_id)){complete=false;break;}
        }if(!complete)continue;
      }
      if(row.remote||row.inputs.some(r=>r.origin==='server')){
        if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(row.scope.serverInstance))continue;
        a.producerInstances.add(row.scope.serverInstance);
      }return true;
    }return false;
  }
  async function graph(refs,{instance,onInstance}={}){
    const a=await action(),nodes=new Map(),visiting=new Set(),leaves=new Set();a.instance=instance;a.onInstance=onInstance;
    async function visit(ref,depth,root=false){
      check(depth<=32,'wiki_dependency_limit');const value=await wiki(a,ref,{fresh:root,allowDeleted:!root});
      if(visiting.has(ref.wiki_id)||nodes.has(ref.wiki_id))return;
      check(nodes.size+visiting.size<2000,'wiki_dependency_limit');visiting.add(ref.wiki_id);
      const docs=await documents(a,ref.wiki_id,value.history),dependencies=new Map();let complete=true;
      for(const document of docs.values())for(const draft of document.drafts){
        if(draft.schema_version===2&&!await knownGeneration(a,ref.wiki_id,draft,docs))complete=false;
        const quotes=new Map();
        for(const raw of W.evidenceOf(draft)){
          const input=raw.kind?raw:{...copy(raw),kind:'note'};W.validateEvidence(input,a.ctx.owner);
          if(input.kind==='wiki'){dependencies.set(P.canonicalJson(input),copy(input));quotes.set(input.id,await wiki(a,input,{allowDeleted:true}));}
          else{
            const key=P.canonicalJson(input.note_ref);leaves.add(key);check(leaves.size<=1000,'wiki_dependency_limit');
            quotes.set(input.id,await note(a,input));a.active();
          }
        }
        for(const citation of draft.citations){
          const source=quotes.get(citation.evidence_id||citation.source_id),text=source?.kind==='note'?source.content:source?.draft.sections.find(s=>s.id===citation.section_id)?.markdown;
          check(typeof text==='string'&&text.includes(citation.quote),'wiki_quote_mismatch');
        }
      }
      for(const [i,ref]of (value.index?.wiki_dependencies||[]).entries()){
        const input={...copy(ref),id:'retained-'+i,kind:'wiki',origin:'server'};dependencies.set(P.canonicalJson(ref),input);
      }
      for(const ref of value.index?.dependencies||[]){
        leaves.add(P.canonicalJson(ref));check(leaves.size<=1000,'wiki_dependency_limit');plainLocal(a,ref.local_id);
        check(api.server,'wiki_source_unavailable');const proof=await api.server.inspect(ref.local_id,undefined,{policy:1});a.active();bind(a,proof.instance);
      }
      check(dependencies.size<=1000,'wiki_dependency_limit');nodes.set(ref.wiki_id,{wiki_id:ref.wiki_id,dependencies:[...new Set([...dependencies.values()].map(r=>r.wiki_id))].sort(),complete});
      for(const input of dependencies.values())await visit(input,depth+1);visiting.delete(ref.wiki_id);
    }
    for(const ref of refs)await visit(ref,0,true);a.active();
    check([...a.producerInstances].every(id=>id===a.instance),'wiki_context_changed');
    return {nodes:[...nodes.values()].sort((a,b)=>a.wiki_id<b.wiki_id?-1:a.wiki_id>b.wiki_id?1:0)};
  }
  return {resolve:async(ref,options={})=>{const a=await action();return ref.kind==='wiki'?wiki(a,ref,options):note(a,ref,options);},graph};
}});
