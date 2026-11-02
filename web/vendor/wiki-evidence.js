/* Read-only retained evidence proofs. No plaintext cache or new storage is created. */
globalThis.NowWikiEvidence=Object.freeze({create(api){
  'use strict';
  const P=NowNoteProtectionProtocol,W=NowNoteWiki,copy=structuredClone,eq=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const check=(v,code='wiki_dependency_unverified')=>{if(!v)throw Error(code);};
  const tuple=doc=>{const a=doc.approvals.at(-1),d=doc.drafts.find(d=>d.id===a?.draft_id);return [a?.id||null,d?.id||null,d?.draft_hash||null];};
  async function action(retained=[]){
    const ctx={...api.context()},key=api.contextKey(),h=api.history();check(ctx.enabled&&ctx.owner&&h&&!h.status().unsupported&&!h.suspended());
    const root=api.readOnly===true?NowWikiReadSet.root(h,NowNoteHistory.key(ctx)):h.export();check(root?.schema_version===1);
    const active=()=>check(key===api.contextKey()&&api.context().enabled&&api.history()===h,'wiki_context_changed');
    const roots=[root,...retained,...(await api.retainedRoots?.()||[])];active();const all=[],queue=[...roots],seen=new WeakSet();
    while(queue.length){const value=queue.shift();if(value==null)continue;check(typeof value==='object'&&value.contexts&&typeof value.contexts==='object');if(seen.has(value))continue;seen.add(value);all.push(value);queue.push(...(value.recovery_archives||[]));}
    return {ctx,h,active,roots:all,account:NowNoteHistory.key(ctx),docs:new Map(),notes:new Map(),wikis:new Map(),versions:new Set(),producerInstances:new Set(),
      provenance:new Map(),producerReads:new Map(),serverHistories:new Map()};
  }
  function localItems(a,id){return a.roots.flatMap(r=>{const item=r.contexts?.[a.account]?.notes?.[id];return item?[item]:[];});}
  function bind(a,instance){if(!instance)return;check(!a.instance||a.instance===instance,'wiki_context_changed');a.instance=instance;a.onInstance?.(instance);}
  function plainLocal(a,id){
    for(const root of a.roots){
      const item=root.contexts?.[a.account]?.notes?.[id];
      const target=a.protectionTarget,attributed=target&&id===target.local_id&&item?.protectionScope&&eq(item.protectionScope,target);
      check(!item||!item.protection_record&&(!item.protectionScope||attributed)&&item.base?.crypto_epoch===0,'wiki_protection_unavailable');
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
      if(!local.startsWith('wiki-proposal:')||!local.endsWith(':'+wiki))continue;
      const copies=localItems(a,local);
      if(copies.length&&copies.every(value=>globalThis.NowNoteProtectionState?.protectedRecord(value))){
        check(copies.every(value=>value.protection_record.scope.owner===a.ctx.owner&&value.protection_record.scope.local_id===local
          &&value.protection_record.scope.url.replace(/\/+$/,'')===String(a.ctx.url).replace(/\/+$/,'')),'wiki_evidence_binding');
        continue;
      }
      plainLocal(a,local);bodies.push(...snapshots(a,local));
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
      check(a.serverHistories.has(ref.wiki_id)||a.serverHistories.size<2000,'wiki_dependency_limit');
      a.serverHistories.set(ref.wiki_id,value.history);
      if(Object.hasOwn(value,'generationProvenance'))a.provenance.set(ref.wiki_id,value.generationProvenance);
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
  async function remoteGeneration(a,wikiId,draft){
    if(!a.provenance.has(wikiId))return false;
    const metadata=a.provenance.get(wikiId),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v),hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
    const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
    check(exact(metadata,['schema_version','entries'])&&metadata.schema_version===1&&Array.isArray(metadata.entries)&&metadata.entries.length<=1000,'wiki_provenance_invalid');
    const keys=new Set();
    for(const entry of metadata.entries){
      check(exact(entry,['draft_id','draft_hash','operation_id','manifest_hash','result_revision_id','result_document_hash'])
        &&[entry.draft_id,entry.operation_id,entry.result_revision_id].every(uuid)&&[entry.draft_hash,entry.manifest_hash,entry.result_document_hash].every(hash),'wiki_provenance_invalid');
      const key=entry.draft_id+':'+entry.draft_hash;check(!keys.has(key),'wiki_provenance_invalid');keys.add(key);
    }
    const entry=metadata.entries.find(e=>e.draft_id===draft.id&&e.draft_hash===draft.draft_hash);
    if(!entry)return false;
    check(api.server?.readOperation&&a.instance,'wiki_source_unavailable');
    if(!a.producerReads.has(entry.operation_id)){const value=await api.server.readOperation(entry.operation_id,a.instance);a.active();a.producerReads.set(entry.operation_id,value);}
    const original=a.producerReads.get(entry.operation_id),manifest=original.manifest;
    check(original.state==='committed'&&manifest.owner_id===a.ctx.owner&&['ingest','integrate'].includes(manifest.kind)
      &&original.manifest_hash===entry.manifest_hash&&manifest.operation_id===entry.operation_id,'wiki_provenance_invalid');
    let matched=false;
    for(const change of manifest.changes){
      const page=original.receipt.pages.find(p=>p.wiki_id===change.wiki_id);check(page,'wiki_provenance_invalid');
      if(!a.serverHistories.has(change.wiki_id)){
        check(a.serverHistories.size<2000,'wiki_dependency_limit');
        plainLocal(a,'wiki:'+change.wiki_id);
        const proof=await api.server.inspect('wiki:'+change.wiki_id,undefined,{policy:1});a.active();bind(a,proof.instance);
        const history=[];for(const row of proof.history){
          check(row.snapshot.note.source==='wiki-artifact','wiki_evidence_binding');const document=await W.validateDocument(row.snapshot.note.content,a.ctx);a.active();
          check(document.wiki_id===change.wiki_id,'wiki_evidence_binding');const hash=await P.hashJson(document);a.active();a.versions.add(change.wiki_id+':'+hash);check(a.versions.size<=2000,'wiki_dependency_limit');
          history.push({revision_ref:copy(row.revision_ref),document});
        }a.serverHistories.set(change.wiki_id,history);
      }
      const document=a.serverHistories.get(change.wiki_id).find(r=>r.revision_ref.kind==='note_revision'&&r.revision_ref.id===page.result_revision_id)?.document;
      check(document&&await P.hashJson(document)===change.result_document_hash,'wiki_provenance_invalid');a.active();
      if(!['create_draft','append_draft'].includes(change.action))continue;
      const chosen=document.drafts.at(-1),binding=manifest.draft_bindings.find(b=>b.wiki_id===change.wiki_id&&b.draft_id===chosen.id&&b.draft_hash===chosen.draft_hash);
      check(binding,'wiki_provenance_invalid');
      const parent=document.approvals.find(v=>v.id===chosen.base_approved_revision_id),before=document.drafts.find(d=>d.id===parent?.draft_id),own=manifest.inputs.filter(r=>r.kind==='wiki'&&r.wiki_id===change.wiki_id);
      let expected=manifest.inputs;
      if(parent&&own.length){
        check(own.length===1&&own[0].approval_id===parent.id&&own[0].draft_id===before?.id&&own[0].content_hash===before.draft_hash
          &&own[0].document_version===document.document_version-1,'wiki_provenance_invalid');expected=manifest.inputs.filter(r=>r.id!==own[0].id);
      }else if(parent&&manifest.changes.length>1)return false;
      check(eq(expected,W.evidenceOf(chosen)),'wiki_provenance_invalid');
      if(change.wiki_id===wikiId){
        check(chosen.id===draft.id&&chosen.draft_hash===draft.draft_hash&&page.result_revision_id===entry.result_revision_id
          &&change.result_document_hash===entry.result_document_hash,'wiki_provenance_invalid');matched=true;
      }
    }
    return matched;
  }
  async function knownGeneration(a,wikiId,draft,docs,{localCommitted=false}={}){
    const candidates=a.roots.flatMap(root=>Object.values(root.contexts?.[a.account]?.wiki_ingest_operations||{}));
    for(const row of candidates){
      if(localCommitted&&(row?.state!=='committed'||row.remote))continue;
      if(!['ingest','integrate'].includes(row?.action)||!['attempted','committed','aborted'].includes(row.state)||!Array.isArray(row.documents)||!Array.isArray(row.inputs))continue;
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
    }return localCommitted?false:remoteGeneration(a,wikiId,draft);
  }
  async function protectionSeed(a,document){
    const doc=await W.validateDocument(document,a.ctx),local='wiki:'+doc.wiki_id;a.active();plainLocal(a,local);
    const item=a.h.view(local);let history=[],index=null;
    if(item?.localOnly!==true){
      check(api.server&&api.readRemote,'wiki_source_unavailable');
      const proof=await api.server.inspect(local,undefined,{policy:1});a.active();bind(a,proof.instance);
      const remote=await api.readRemote(doc.wiki_id);a.active();
      check(remote.resource?.owner_id===a.ctx.owner&&remote.resource.id===doc.wiki_id&&remote.artifact?.protected===false
        &&remote.artifact.head_revision_id===proof.current.head_revision_id,'wiki_evidence_binding');
      const current=await W.validateDocument(proof.current.snapshot.note.content,a.ctx);a.active();
      check(proof.current.snapshot.note.source==='wiki-artifact'&&current.wiki_id===doc.wiki_id
        &&eq(remote.artifact.document,current),'wiki_evidence_binding');
      index=await W.validateLink(remote.resource.payload,a.ctx);a.active();
      check(index.artifact_local_id===local&&(doc.schema_version!==2||index.document_schema_floor===2),'wiki_evidence_binding');
      for(const row of proof.history){
        check(row.snapshot.note.source==='wiki-artifact','wiki_evidence_binding');
        const value=await W.validateDocument(row.snapshot.note.content,a.ctx);a.active();check(value.wiki_id===doc.wiki_id,'wiki_evidence_binding');
        history.push({revision_ref:copy(row.revision_ref),document:value});
      }
      a.serverHistories.set(doc.wiki_id,history);
      if(Object.hasOwn(remote.artifact,'generation_provenance'))a.provenance.set(doc.wiki_id,remote.artifact.generation_provenance);
    }
    const retained=await documents(a,doc.wiki_id,history);a.active();
    check(retained.has(await P.hashJson(doc)),'wiki_evidence_binding');a.active();
    return {history,index,localOnly:item?.localOnly===true};
  }
  async function graph(refs,{instance,onInstance,protectionDocuments=[],retainedRoots=[],requireComplete=false,protectionTarget}={}){
    const a=await action(retainedRoots),nodes=new Map(),visiting=new Set(),leaves=new Set();a.instance=instance;a.onInstance=onInstance;
    if(requireComplete&&protectionTarget){
      check(protectionTarget.owner===a.ctx.owner&&String(protectionTarget.url).replace(/\/+$/,'')===String(a.ctx.url).replace(/\/+$/,''),'wiki_context_changed');
      check(Object.keys(protectionTarget).length===5&&typeof protectionTarget.device==='string'&&Boolean(protectionTarget.device)
        &&typeof protectionTarget.local_id==='string'&&Boolean(protectionTarget.local_id)
        &&typeof protectionTarget.instance==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(protectionTarget.instance),'wiki_context_changed');
      a.protectionTarget=copy(protectionTarget);
    }
    async function visit(ref,depth,root=false){
      check(depth<=32,'wiki_dependency_limit');
      if(visiting.has(ref.wiki_id)){check(!requireComplete,'wiki_protection_cycle');return;}
      if(ref.document&&nodes.has(ref.wiki_id)){
        const document=await W.validateDocument(ref.document,a.ctx);a.active();
        check(a.docs.get(ref.wiki_id)?.has(await P.hashJson(document)),'wiki_evidence_binding');a.active();return;
      }
      const value=ref.document?await protectionSeed(a,ref.document):await wiki(a,ref,{fresh:root,allowDeleted:!root});
      if(nodes.has(ref.wiki_id))return;
      check(nodes.size+visiting.size<2000,'wiki_dependency_limit');visiting.add(ref.wiki_id);
      const docs=await documents(a,ref.wiki_id,value.history),dependencies=new Map();let complete=true;
      for(const document of docs.values())for(const draft of document.drafts){
        if(draft.schema_version===2){
          const verified=requireComplete&&value.localOnly!==true&&a.h.view('wiki:'+ref.wiki_id)?.localOnly!==true
            ?await remoteGeneration(a,ref.wiki_id,draft):await knownGeneration(a,ref.wiki_id,draft,docs,{localCommitted:requireComplete});
          if(!verified)complete=false;
        }
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
    for(const document of protectionDocuments)await visit({wiki_id:document.wiki_id,document},0);a.active();
    for(const ref of refs)await visit(ref,0,true);a.active();
    check([...a.producerInstances].every(id=>id===a.instance),'wiki_context_changed');
    if(requireComplete)check([...nodes.values()].every(n=>n.complete),'wiki_dependency_unverified');
    return {nodes:[...nodes.values()].sort((a,b)=>a.wiki_id<b.wiki_id?-1:a.wiki_id>b.wiki_id?1:0)};
  }
  async function operationProof(id,sourceId,targetId,{origin}={}){
    const a=await action(),ids=[sourceId,targetId],uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
    check([id,...ids].every(uuid)&&sourceId!==targetId&&['local','server'].includes(origin),'wiki_relation_operation');
    for(const wiki of ids){plainLocal(a,'wiki:'+wiki);check(!api.lifecycle?.state('wiki:'+wiki)?.deleted_at&&!api.lifecycle?.blocked?.('wiki:'+wiki),'wiki_source_unavailable');}
    let operation,currentTarget;const originals=[];
    if(origin==='server'){
      check(api.server?.readOperation&&api.readRemote,'wiki_source_unavailable');const inspected=[];
      for(const wiki of ids){
        check(a.h.view('wiki:'+wiki)?.localOnly!==true,'wiki_evidence_binding');
        const value=await api.server.inspect('wiki:'+wiki,undefined,{policy:1});a.active();bind(a,value.instance);
        const remote=await api.readRemote(wiki);a.active();
        check(remote.resource?.owner_id===a.ctx.owner&&remote.resource.id===wiki&&!remote.resource.deleted_at&&remote.artifact?.protected===false
          &&remote.artifact.head_revision_id===value.current.head_revision_id,'wiki_source_unavailable');
        const document=await W.validateDocument(value.current.snapshot.note.content,a.ctx);a.active();
        check(document.wiki_id===wiki&&eq(remote.artifact.document,document),'wiki_evidence_binding');
        inspected.push(value);if(wiki===targetId)currentTarget=document;
      }
      operation=await api.server.readOperation(id,a.instance);a.active();check(operation.state==='committed','wiki_relation_operation');
      for(let n=0;n<ids.length;n++){
        const page=operation.receipt.pages.find(p=>p.wiki_id===ids[n]);
        const raw=inspected[n].history.find(r=>r.revision_ref.kind==='note_revision'&&r.revision_ref.id===page?.result_revision_id);
        check(raw,'wiki_relation_binding');const document=await W.validateDocument(raw.snapshot.note.content,a.ctx);a.active();
        check(document.wiki_id===ids[n],'wiki_relation_binding');originals.push(document);
      }
    }else{
      const rows=await api.readOperations?.();a.active();operation=rows?.find(row=>row.operation_id===id);
      check(operation?.state==='committed'&&!operation.remote,'wiki_relation_operation');
      for(const wiki of ids){
        const local='wiki:'+wiki,item=a.h.view(local);check(item?.localOnly&&!a.h.blocked(local),'wiki_source_unavailable');
        const documentsByHash=await documents(a,wiki),binding=operation.documents.find(d=>d.wiki_id===wiki);a.active();
        const document=binding&&documentsByHash.get(binding.document_hash);check(document,'wiki_relation_binding');originals.push(document);
        if(wiki===targetId){currentTarget=await W.validateDocument(item.draft.content,a.ctx);a.active();check(currentTarget.wiki_id===wiki,'wiki_evidence_binding');}
      }
    }
    a.active();return {operation:copy(operation),documents:copy(originals),currentTarget:copy(currentTarget)};
  }
  return {resolve:async(ref,options={})=>{const a=await action();return ref.kind==='wiki'?wiki(a,ref,options):note(a,ref,options);},graph,operationProof,
    protection:(documents,{roots=[],instance,target}={})=>graph([],{instance,protectionDocuments:documents,retainedRoots:roots,requireComplete:true,protectionTarget:target})};
}});
