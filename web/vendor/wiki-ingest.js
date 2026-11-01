/* Pure planning only. Durable IDs, account-journal CAS and HTTP belong to the adapter. */
(() => {
  'use strict';
  const W=globalThis.NowNoteWiki,P=globalThis.NowNoteProtectionProtocol,copy=structuredClone;
  const check=(condition,code='wiki_invalid_ingest')=>{if(!condition)throw Error(code);};
  const bytes=value=>new TextEncoder().encode(value).length;
  const same=(a,b)=>P.canonicalJson(a)===P.canonicalJson(b);
  const uuid=value=>check(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value),'wiki_invalid_id');
  const exact=(v,names)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(n=>Object.hasOwn(v,n)),'wiki_invalid_field');
  const list=(v,max,min=0)=>check(Array.isArray(v)&&v.length>=min&&v.length<=max,'wiki_ingest_limit');
  const unique=values=>check(new Set(values).size===values.length,'wiki_duplicate_ingest');
  const size=value=>bytes(P.canonicalJson(value));
  const compare=(a,b)=>a<b?-1:a>b?1:0;
  function context(value){
    for(const name of ['owner','device','serverInstance'])check(typeof value?.[name]==='string'&&value[name].length>0,'wiki_context_required');
    check(typeof value.url==='string'&&value.url.length<=2048&&value.owner.length<=80,'wiki_context_required');
    check(Number.isSafeInteger(value.viewGeneration)&&value.viewGeneration>=0,'wiki_context_required');
    return {url:value.url.replace(/\/+$/,''),owner:value.owner,device:value.device,viewGeneration:value.viewGeneration,serverInstance:value.serverInstance};
  }
  const scope=ctx=>({url:ctx.url,owner:ctx.owner});
  function plain(safety){
    exact(safety,['status','epoch','lineage','fence']);
    check(safety.status==='ok'&&safety.epoch===0&&safety.lineage===false&&safety.fence===false,'wiki_protection_unavailable');
  }
  function sourceIdentity(ref){return ref.kind==='note'?[ref.kind,ref.note_ref.owner_id,ref.note_ref.local_id,ref.source_revision_id||'']:
    [ref.kind,ref.owner_id,ref.wiki_id,ref.draft_id,ref.approval_id];}
  const order=(a,b)=>{const x=sourceIdentity(a),y=sourceIdentity(b);for(let i=0;i<x.length;i++){const n=compare(x[i],y[i]);if(n)return n;}return 0;};
  async function captureWikiSources(selection,current){
    const ctx=context(current);list(selection,30,1);const sources=[];
    for(const row of selection){
      plain(row.safety);check(typeof row.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(row.id),'wiki_invalid_source');
      let title,content,manifest,extraction;
      if(row.kind==='note'){
        exact(row,['kind','id','safety','note']);
        const n=row.note;
        check(n?.origin!=='server'||Boolean(ctx.url),'wiki_server_context_required');
        const snapshot=await W.capture([n?.localId],scope(ctx),()=>n),source=snapshot.sources[0];
        check(!n.localId.startsWith('wiki:'),'wiki_input_kind');
        ({title,content}=source);manifest={...source.manifest,id:row.id,kind:'note'};
      }else if(row.kind==='file'){
        exact(row,['kind','id','name','localId','bytes','safety']);
        check(typeof row.name==='string'&&/\.(md|txt)$/i.test(row.name),'wiki_unsupported_adapter');
        check(row.bytes instanceof Uint8Array&&!row.partial,'wiki_incomplete_snapshot');
        check(row.bytes.byteLength<=524288,'wiki_source_budget');
        try{content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(row.bytes);}catch{throw Error('wiki_invalid_utf8');}
        check(content.length>0,'wiki_incomplete_snapshot');title=row.name;
        const textHash=await P.sha256(content);
        extraction={adapter:'utf8-text-v1',file_hash:await P.sha256(row.bytes),text_hash:textHash,
          range:{unit:'byte',start:0,end:row.bytes.byteLength,total:row.bytes.byteLength}};
        manifest={id:row.id,kind:'note',origin:'local',note_ref:{owner_id:ctx.owner,local_id:row.localId},source_revision_id:null,head_version:0,content_hash:textHash};
      }else throw Error('wiki_unsupported_adapter');
      W.validateEvidence(manifest,ctx.owner);
      sources.push({id:row.id,source_kind:row.kind,title,content,manifest,safety:copy(row.safety),...(extraction?{extraction}: {})});
    }
    const result={scope:scope(ctx),sources};await verifySnapshot(result,ctx);return result;
  }
  async function verifySnapshot(snapshot,current){
    const ctx=context(current);exact(snapshot,['scope','sources']);check(same(snapshot.scope,scope(ctx)),'wiki_snapshot_scope');list(snapshot.sources,30,1);
    unique(snapshot.sources.map(s=>s.id));unique(snapshot.sources.map(s=>P.canonicalJson(sourceIdentity(s.manifest))));let total=0;
    for(const s of snapshot.sources){
      check(['file','note'].includes(s.source_kind),'wiki_incomplete_snapshot');
      exact(s,['id','source_kind','title','content','manifest','safety',...(s.source_kind==='file'?['extraction']:[])]);
      plain(s.safety);W.validateEvidence(s.manifest,ctx.owner);check(s.manifest.kind==='note'&&s.id===s.manifest.id,'wiki_invalid_source');
      check(!s.manifest.note_ref.local_id.startsWith('wiki:'),'wiki_input_kind');
      check(typeof s.title==='string'&&[...s.title].length<=240&&typeof s.content==='string','wiki_incomplete_snapshot');
      check(!s.content.startsWith('NOW_ENCRYPTED_V1:'),'wiki_protection_unavailable');
      check(await P.sha256(s.content)===s.manifest.content_hash,'wiki_snapshot_hash');total+=bytes(s.content);
      if(s.extraction){
        const e=s.extraction;exact(e,['adapter','file_hash','text_hash','range']);exact(e.range,['unit','start','end','total']);
        check(e.adapter==='utf8-text-v1'&&e.range.unit==='byte'&&e.range.start===0&&e.range.end===bytes(s.content)
          &&e.range.total===e.range.end&&s.manifest.origin==='local','wiki_incomplete_snapshot');
        check(e.text_hash===s.manifest.content_hash&&e.file_hash===await P.sha256(new TextEncoder().encode(s.content)),'wiki_snapshot_hash');
      }
    }
    check(total<=524288,'wiki_source_budget');return copy(snapshot);
  }
  async function readCatalog(catalog,ctx){
    list(catalog,100);const result=[];
    for(const row of catalog){
      exact(row,['document','origin','headRevisionId','headVersion','indexVersion','safety',...(Object.hasOwn(row,'index')?['index']:[])]);
      plain(row.safety);check(['local','server'].includes(row.origin));
      const doc=await W.validateDocument(row.document,scope(ctx));
      check(Number.isSafeInteger(row.headVersion)&&row.headVersion>=0&&Number.isSafeInteger(row.indexVersion)&&row.indexVersion>=0,'wiki_invalid_version');
      if(row.origin==='server'){check(Boolean(ctx.url),'wiki_server_context_required');uuid(row.headRevisionId);check(row.headVersion>0&&row.indexVersion>0,'wiki_invalid_version');}
      else check(row.headRevisionId===null,'wiki_local_revision');
      if(row.index){await W.validateLink(row.index,ctx);check(row.index.artifact_local_id==='wiki:'+doc.wiki_id,'wiki_index_identity');}
      result.push({...copy(row),document:doc});
    }
    unique(result.map(r=>r.document.wiki_id));return result;
  }
  function reservationIds(value){
    exact(value,['operation_id','mutation_id','commit_mutation_id','abort_mutation_id','pages']);
    for(const key of ['operation_id','mutation_id','commit_mutation_id','abort_mutation_id'])uuid(value[key]);list(value.pages,10,1);
    for(const p of value.pages){exact(p,['wiki_id','draft_id','generation_id','note_mutation_id']);Object.values(p).forEach(uuid);}
    unique(value.pages.map(p=>p.wiki_id));unique(value.pages.map(p=>p.draft_id));unique(value.pages.map(p=>p.generation_id));
    unique([value.mutation_id,value.commit_mutation_id,value.abort_mutation_id,...value.pages.map(p=>p.note_mutation_id)]);
  }
  const approvedDraft=doc=>doc.drafts.find(d=>d.id===doc.approvals.at(-1)?.draft_id);
  function matchSource(source,row){
    const d=approvedDraft(row.document);if(!d)return false;
    const key=source.title.normalize('NFC').toLowerCase().trim();
    return [d.title,d.topic,...(d.aliases||[])].some(s=>s.normalize('NFC').toLowerCase().trim()===key);
  }
  async function fingerprintsFor(snapshot,rows,relatedWikiIds){
    const result=[];
    for(const s of snapshot.sources)result.push({source_key:P.canonicalJson(sourceIdentity(s.manifest)),hash:await P.hashJson({
      scope:snapshot.scope,title:s.title,manifest:s.manifest,extraction:s.extraction||null,
      comparison:rows.filter(r=>matchSource(s,r)||relatedWikiIds.includes(r.document.wiki_id))})});
    return result;
  }
  async function sourceFingerprints(snapshot,catalog,current,relatedWikiIds=[]){
    const ctx=context(current);await verifySnapshot(snapshot,ctx);return fingerprintsFor(snapshot,await readCatalog(catalog,ctx),relatedWikiIds);
  }
  async function planIngest(snapshot,catalog,{context:current,reservation,processed=[],relatedWikiIds=[]}){
    const ctx=context(current);await verifySnapshot(snapshot,ctx);reservationIds(reservation);
    const rows=await readCatalog(catalog,ctx);list(processed,10000);list(relatedWikiIds,5);unique(relatedWikiIds);relatedWikiIds.forEach(uuid);
    const fingerprints=await fingerprintsFor(snapshot,rows,relatedWikiIds);
    const candidates=snapshot.sources.map((s,i)=>{
      if(processed.some(p=>same(p,fingerprints[i])))return {source_id:s.id,action:'unchanged',wiki_id:null};
      const matched=rows.filter(r=>matchSource(s,r));check(matched.length<=1,'wiki_ambiguous_target');
      return {source_id:s.id,action:matched.length?'augment':'new',wiki_id:matched[0]?.document.wiki_id||null};
    });
    check(relatedWikiIds.every(id=>rows.some(r=>r.document.wiki_id===id&&approvedDraft(r.document))),'wiki_unknown_related');
    const selected=rows.filter(r=>snapshot.sources.some(s=>matchSource(s,r)));
    check(new Set([...selected.map(r=>r.document.wiki_id),...relatedWikiIds]).size<=5,'wiki_related_limit');
    const targets=selected.filter(r=>candidates.some(c=>c.action==='augment'&&c.wiki_id===r.document.wiki_id));
    const changed=snapshot.sources.filter(s=>candidates.some(c=>c.source_id===s.id&&c.action!=='unchanged'));
    if(changed.some(s=>s.manifest.origin==='local'))check(targets.every(t=>t.origin==='local'),'wiki_local_branch_required');
    const pages=[],used=new Set();
    for(const c of candidates.filter(c=>c.action!=='unchanged')){
      if(c.wiki_id&&used.has(c.wiki_id))continue;
      const reserved=c.wiki_id?reservation.pages.find(p=>p.wiki_id===c.wiki_id):reservation.pages.find(p=>!used.has(p.wiki_id)&&!rows.some(r=>r.document.wiki_id===p.wiki_id));
      check(Boolean(reserved),'wiki_missing_page_reservation');used.add(reserved.wiki_id);
      const target=targets.find(t=>t.document.wiki_id===reserved.wiki_id)||null;
      check(!target||!target.document.drafts.some(d=>d.id===reserved.draft_id||d.generation_id===reserved.generation_id),'wiki_existing_draft_reservation');
      pages.push({...copy(reserved),action:target?'append_draft':'create_draft'});
    }
    check(rows.length+pages.filter(p=>p.action==='create_draft').length<=100,'wiki_active_limit');
    check(relatedWikiIds.every(id=>!targets.some(t=>t.document.wiki_id===id)),'wiki_self_evidence');
    const inputs=changed.map(s=>copy(s.manifest)),related=changed.length?rows.filter(r=>relatedWikiIds.includes(r.document.wiki_id)):[];
    for(const row of related){
      const d=approvedDraft(row.document),a=row.document.approvals.at(-1);
      inputs.push({id:'wiki-'+row.document.wiki_id,kind:'wiki',origin:row.origin,owner_id:ctx.owner,wiki_id:row.document.wiki_id,
        draft_id:d.id,approval_id:a.id,document_version:row.document.document_version,content_hash:d.draft_hash});
    }
    if(inputs.some(i=>i.origin==='local'))check(targets.every(t=>t.origin==='local'),'wiki_local_branch_required');
    list(inputs,30);unique(inputs.map(i=>i.id));inputs.sort(order);
    const transmission={sources:changed.map(s=>({id:s.id,title:s.title,content:s.content})),
      related_wikis:related.map(row=>({evidence:copy(inputs.find(i=>i.kind==='wiki'&&i.wiki_id===row.document.wiki_id)),draft:copy(approvedDraft(row.document))})),
      comparison_targets:targets.map(row=>({wiki_id:row.document.wiki_id,draft:copy(approvedDraft(row.document))})),
      pages:pages.map(({wiki_id,draft_id,action})=>({wiki_id,draft_id,action}))};
    const transmitted=size(transmission);check(transmitted<=524288,'wiki_source_budget');
    const plan={schema_version:1,context:ctx,snapshot:copy(snapshot),catalog:copy(catalog),reservation:copy(reservation),
      fingerprints,candidates,targets,pages,inputs,transmission,related_wiki_ids:copy(relatedWikiIds),transmitted_bytes:transmitted,calls:changed.length?1:0,
      serverEligible:Boolean(ctx.url)&&inputs.every(i=>i.origin==='server')&&targets.every(t=>t.origin==='server')};
    return {...plan,plan_hash:await P.hashJson(plan)};
  }
  async function fresh(plan,review){
    const unsigned=copy(plan);delete unsigned.plan_hash;
    check(await P.hashJson(unsigned)===plan.plan_hash,'wiki_plan_hash');
    check(same(context(review.context),plan.context),'wiki_context_changed');
    await verifySnapshot(review.snapshot,review.context);await readCatalog(review.catalog,context(review.context));
    check(same(review.snapshot,plan.snapshot)&&same(review.catalog,plan.catalog),'wiki_input_changed');
  }
  async function validateIngestProposal(input,plan,review){
    await fresh(plan,review);check(plan.calls===1,'wiki_unchanged');
    const value=typeof input==='string'?P.parseJson(input):copy(input);exact(value,['pages']);list(value.pages,10,1);
    unique(value.pages.map(p=>p.wiki_id));const documents=[];
    check(typeof review.connection?.provider==='string'&&typeof review.connection?.model==='string','wiki_invalid_model');
    for(const page of value.pages){
      exact(page,['wiki_id','draft_id','title','topic','page_type','summary','aliases','sections','claims','relations','citations']);
      const declared=plan.pages.find(p=>p.wiki_id===page.wiki_id&&p.draft_id===page.draft_id);check(Boolean(declared),'wiki_undeclared_page');
      const target=plan.targets.find(t=>t.document.wiki_id===page.wiki_id),previous=target?.document;
      const draft={schema_version:2,id:declared.draft_id,generation_id:declared.generation_id,base_approved_revision_id:previous?.approvals.at(-1)?.id||null,
        scope:scope(plan.context),title:page.title,topic:page.topic,page_type:page.page_type,summary:page.summary,aliases:copy(page.aliases),
        sections:copy(page.sections),claims:copy(page.claims),relations:copy(page.relations),citations:copy(page.citations),
        evidence_manifest:copy(plan.inputs),
        provider:review.connection.provider,model:review.connection.model,generated_at:review.generatedAt,validation_status:'citations_checked'};
      // A target's previous approval is comparison context, never self evidence.
      const doc=previous?{...copy(previous),schema_version:2,document_version:previous.document_version+1,drafts:[...copy(previous.drafts),{...draft,draft_hash:await P.hashJson(draft)}]}:
        {schema_version:2,wiki_id:page.wiki_id,scope:scope(plan.context),document_version:1,drafts:[{...draft,draft_hash:await P.hashJson(draft)}],approvals:[],rejected_draft_ids:[]};
      await W.validateDocument(doc,scope(plan.context));documents.push({wiki_id:page.wiki_id,document:doc});
    }
    documents.sort((a,b)=>compare(a.wiki_id,b.wiki_id));
    const bindings=documents.map(r=>({wiki_id:r.wiki_id,draft_id:r.document.drafts.at(-1).id,draft_hash:r.document.drafts.at(-1).draft_hash}));
    for(const row of documents){
      const draft=row.document.drafts.at(-1);
      for(const c of draft.citations){
        const ref=draft.evidence_manifest.find(i=>i.id===c.evidence_id);check(Boolean(ref),'wiki_unknown_evidence');let text;
        if(ref.kind==='note'){
          const source=plan.snapshot.sources.find(s=>same(s.manifest,ref));check(Boolean(source),'wiki_unknown_evidence');
          check(c.section_id===null||c.section_id==='full-text','wiki_unknown_section');text=source.content;
        }else{
          const source=plan.catalog.find(r=>r.document.wiki_id===ref.wiki_id),chosen=approvedDraft(source?.document||{drafts:[],approvals:[]});
          check(chosen?.id===ref.draft_id&&chosen.draft_hash===ref.content_hash,'wiki_evidence_binding');
          text=chosen.sections.find(s=>s.id===c.section_id)?.markdown;
        }
        check(typeof text==='string'&&text.includes(c.quote),'wiki_quote_mismatch');
      }
      for(const r of draft.relations){
        const t=r.to_ref;check(t.wiki_id!==row.wiki_id,'wiki_self_relation');let chosen;
        if(t.kind==='proposal'){
          check(t.operation_id===plan.reservation.operation_id,'wiki_relation_operation');
          const other=documents.find(d=>d.wiki_id===t.wiki_id);chosen=other?.document.drafts.find(d=>d.id===t.draft_id);
          check(Boolean(chosen)&&bindings.some(b=>b.wiki_id===t.wiki_id&&b.draft_id===t.draft_id&&b.draft_hash===chosen.draft_hash),'wiki_relation_binding');
        }else{
          const other=plan.catalog.find(d=>d.document.wiki_id===t.wiki_id)?.document;chosen=other?.drafts.find(d=>d.id===t.draft_id);
          check(chosen?.draft_hash===t.draft_hash&&other.approvals.some(a=>a.id===t.approval_id&&a.draft_id===t.draft_id),'wiki_relation_binding');
        }
        check(t.section_id===null||chosen.sections.some(s=>s.id===t.section_id),'wiki_relation_section');
      }
    }
    const proposal={plan:copy(plan),documents,draft_bindings:bindings},result={...proposal,proposal_hash:await P.hashJson(proposal)};
    await fresh(plan,review);return result;
  }
  async function verifyProposal(proposal,review){
    const unsigned=copy(proposal);delete unsigned.proposal_hash;check(await P.hashJson(unsigned)===proposal.proposal_hash,'wiki_proposal_hash');
    await fresh(proposal.plan,review);const plan=proposal.plan;reservationIds(plan.reservation);
    const pages=proposal.documents.map(row=>{
      const d=row.document.drafts.at(-1);
      return {wiki_id:row.wiki_id,draft_id:d.id,...Object.fromEntries(['title','topic','page_type','summary','aliases','sections','claims','relations','citations'].map(k=>[k,d[k]]))};
    });
    const checked=await validateIngestProposal({pages},plan,review);
    check(same(checked,proposal),'wiki_proposal_binding');
    return copy(proposal);
  }
  async function reserveIngest(snapshot,catalog,current){
    const ctx=context(current);await verifySnapshot(snapshot,ctx);const rows=await readCatalog(catalog,ctx),pages=[];
    for(const source of snapshot.sources){
      const matches=rows.filter(row=>matchSource(source,row));check(matches.length<=1,'wiki_ambiguous_target');
      const wiki_id=matches[0]?.document.wiki_id||crypto.randomUUID();if(pages.some(p=>p.wiki_id===wiki_id))continue;
      pages.push({wiki_id,draft_id:crypto.randomUUID(),generation_id:crypto.randomUUID(),note_mutation_id:crypto.randomUUID()});
    }
    list(pages,10,1);
    return {operation_id:crypto.randomUUID(),mutation_id:crypto.randomUUID(),commit_mutation_id:crypto.randomUUID(),abort_mutation_id:crypto.randomUUID(),pages};
  }
  async function buildOperationRequests(proposal,review){
    await verifyProposal(proposal,review);const plan=proposal.plan;check(plan.serverEligible,'wiki_server_input_required');
    const changes=[];
    for(const row of proposal.documents){
      await W.validateDocument(row.document,scope(plan.context));
      const declared=plan.pages.find(p=>p.wiki_id===row.wiki_id),target=plan.targets.find(t=>t.document.wiki_id===row.wiki_id);
      check(Boolean(declared),'wiki_undeclared_page');const d=row.document.drafts.at(-1);
      check(d.id===declared.draft_id&&proposal.draft_bindings.some(b=>b.wiki_id===row.wiki_id&&b.draft_id===d.id&&b.draft_hash===d.draft_hash),'wiki_missing_draft_binding');
      changes.push({wiki_id:row.wiki_id,action:declared.action,note_mutation_id:declared.note_mutation_id,
        base_head_revision_id:target?.headRevisionId||null,base_head_version:target?.headVersion||0,
        base_index_version:target?.indexVersion||0,base_document_version:target?.document.document_version||0,result_document_hash:await P.hashJson(row.document)});
    }
    const r=plan.reservation,base={schema_version:1,owner_id:plan.context.owner,device_id:review.device};
    check(typeof base.device_id==='string'&&base.device_id.length>0&&base.device_id.length<=120&&base.device_id===plan.context.device,'wiki_invalid_device');
    const prepare={...base,operation_id:r.operation_id,mutation_id:r.mutation_id,commit_mutation_id:r.commit_mutation_id,abort_mutation_id:r.abort_mutation_id,
      kind:'ingest',inputs:copy(plan.inputs),draft_bindings:copy(proposal.draft_bindings),changes};
    prepare.manifest_hash=await P.hashJson(prepare);
    const commit={...base,mutation_id:r.commit_mutation_id,manifest_hash:prepare.manifest_hash,documents:copy(proposal.documents)};
    const abort={...base,mutation_id:r.abort_mutation_id,manifest_hash:prepare.manifest_hash};
    check(size(prepare)<=131072&&size(commit)<=20971520,'wiki_operation_capacity');
    return {prepare,commit,abort,requiresDurableReservation:true};
  }
  async function dependencyUnion(documents,current,{resolveWiki,retainedLinks=[]}={}){
    const ctx=context(current),notes=new Map(),wikis=new Map(),visited=new Set(),done=new Set();
    const limits=()=>check(notes.size<=1000&&wikis.size<=1000&&visited.size<=2000,'wiki_dependency_limit');
    async function walk(refs,stack=[]){
      check(stack.length<=32,'wiki_dependency_limit');
      for(const original of refs){
        const ref=Object.hasOwn(original,'kind')?original:{...copy(original),kind:'note'};
        W.validateEvidence(ref,ctx.owner);
        if(ref.kind==='note')notes.set(P.canonicalJson(ref.note_ref),copy(ref.note_ref));
        else{
          const {id,kind,origin,...fixed}=ref,key=P.canonicalJson(fixed);
          check(!stack.includes(key),'wiki_dependency_cycle');visited.add(key);limits();
          wikis.set(key,copy(fixed));
          if(done.has(key))continue;
          const row=await resolveWiki?.(copy(ref));check(Boolean(row),'wiki_dependency_unavailable');plain(row.safety);
          const doc=await W.validateDocument(row.document,scope(ctx)),d=doc.drafts.find(d=>d.id===ref.draft_id);
          check(doc.wiki_id===ref.wiki_id&&doc.document_version===ref.document_version&&d?.draft_hash===ref.content_hash
            &&doc.approvals.some(a=>a.id===ref.approval_id&&a.draft_id===ref.draft_id),'wiki_dependency_binding');
          await walk(W.evidenceOf(d),[...stack,key]);done.add(key);
        }
        limits();
      }
    }
    for(const input of documents){const doc=await W.validateDocument(input,scope(ctx));for(const draft of doc.drafts)await walk(W.evidenceOf(draft));}
    for(const value of retainedLinks){
      const link=await W.validateLink(value,scope(ctx));
      for(const ref of link.dependencies)notes.set(P.canonicalJson(ref),copy(ref));
      await walk((link.wiki_dependencies||[]).map((ref,i)=>({...ref,id:'retained-'+i,kind:'wiki',origin:'server'})));limits();
    }
    return {dependencies:[...notes.values()].sort((a,b)=>compare(a.local_id,b.local_id)),
      wiki_dependencies:[...wikis.entries()].sort((a,b)=>compare(a[0],b[0])).map(([,value])=>value),requiresLiveProtectionCheck:true};
  }
  globalThis.NowNoteWikiIngest=Object.freeze({captureWikiSources,verifySnapshot,planIngest,validateIngestProposal,verifyProposal,reserveIngest,sourceFingerprints,buildOperationRequests,dependencyUnion});
})();
