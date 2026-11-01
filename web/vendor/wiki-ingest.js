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
        check(!/^wiki(?:-proposal)?:/.test(n.localId),'wiki_input_kind');
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
  async function verifySnapshot(snapshot,current,{allowEmpty=false}={}){
    const ctx=context(current);exact(snapshot,['scope','sources']);check(same(snapshot.scope,scope(ctx)),'wiki_snapshot_scope');list(snapshot.sources,30,allowEmpty?0:1);
    unique(snapshot.sources.map(s=>s.id));unique(snapshot.sources.map(s=>P.canonicalJson(sourceIdentity(s.manifest))));let total=0;
    for(const s of snapshot.sources){
      check(['file','note'].includes(s.source_kind),'wiki_incomplete_snapshot');
      exact(s,['id','source_kind','title','content','manifest','safety',...(s.source_kind==='file'?['extraction']:[])]);
      plain(s.safety);W.validateEvidence(s.manifest,ctx.owner);check(s.manifest.kind==='note'&&s.id===s.manifest.id,'wiki_invalid_source');
      check(!/^wiki(?:-proposal)?:/.test(s.manifest.note_ref.local_id),'wiki_input_kind');
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
  const approvalTuple=row=>{const a=row.document.approvals.at(-1),d=approvedDraft(row.document);return {wiki_id:row.document.wiki_id,origin:row.origin,
    approval_id:a?.id||null,draft_id:d?.id||null,draft_hash:d?.draft_hash||null};};
  async function fingerprintsFor(snapshot,rows,relatedWikiIds,policy=1){
    const result=[];
    for(const s of snapshot.sources)result.push({source_key:P.canonicalJson(sourceIdentity(s.manifest)),hash:await P.hashJson({
      scope:snapshot.scope,title:s.title,manifest:s.manifest,extraction:s.extraction||null,
      comparison:rows.filter(r=>matchSource(s,r)||relatedWikiIds.includes(r.document.wiki_id)).map(r=>policy===2?approvalTuple(r):r)})});
    return result;
  }
  async function sourceFingerprints(snapshot,catalog,current,relatedWikiIds=[],{policy=1,allowEmpty=false}={}){
    const ctx=context(current);await verifySnapshot(snapshot,ctx,{allowEmpty});return fingerprintsFor(snapshot,await readCatalog(catalog,ctx),relatedWikiIds,policy);
  }
  async function comparisonRefs(snapshot,catalog,current,processed=[],relatedWikiIds=[]){
    const ctx=context(current);await verifySnapshot(snapshot,ctx);const rows=await readCatalog(catalog,ctx),fingerprints=await fingerprintsFor(snapshot,rows,relatedWikiIds,2);
    const changed=snapshot.sources.filter((s,i)=>!processed.some(p=>same(p,fingerprints[i])));
    return rows.filter(r=>changed.length&&(relatedWikiIds.includes(r.document.wiki_id)||changed.some(s=>matchSource(s,r)))).map(wikiInput);
  }
  const wikiInput=row=>{const d=approvedDraft(row.document),a=row.document.approvals.at(-1);check(d&&a,'wiki_comparison_missing');
    return {id:'wiki-'+row.document.wiki_id,kind:'wiki',origin:row.origin,owner_id:row.document.scope.owner,wiki_id:row.document.wiki_id,
      draft_id:d.id,approval_id:a.id,document_version:row.document.document_version,content_hash:d.draft_hash};};
  function expectedInputs(plan,wiki){
    if(plan.policy!==2)return copy(plan.inputs);
    const target=plan.targets.find(r=>r.document.wiki_id===wiki);if(!target)return copy(plan.inputs);
    const own=wikiInput(target),matches=plan.inputs.filter(r=>r.kind==='wiki'&&r.wiki_id===wiki);
    check(matches.length===1&&same(matches[0],own),'wiki_comparison_binding');
    return copy(plan.inputs.filter(ref=>ref.id!==own.id));
  }
  function checkPlanInputs(plan){
    if(plan.policy!==2)return;
    const refs=[];
    for(const value of plan.transmission.sources){const source=plan.snapshot.sources.find(s=>s.id===value.id);
      check(source&&same(value,{id:source.id,title:source.title,content:source.content}),'wiki_input_manifest');refs.push(copy(source.manifest));}
    const rows=[...plan.targets,...plan.catalog.filter(r=>plan.related_wiki_ids.includes(r.document.wiki_id))],known=new Set();
    for(const row of rows){
      const original=plan.catalog.find(r=>r.document.wiki_id===row.document.wiki_id);check(original&&same(row,original),'wiki_comparison_binding');
      if(known.has(row.document.wiki_id))continue;known.add(row.document.wiki_id);refs.push(wikiInput(row));
    }
    refs.sort(order);check(same(refs,plan.inputs),'wiki_input_manifest');
    check(same(plan.transmission.comparison_targets,plan.targets.map(r=>({wiki_id:r.document.wiki_id,evidence:wikiInput(r),draft:copy(approvedDraft(r.document))}))),
      'wiki_comparison_binding');
    check(same(plan.transmission.related_wikis,plan.catalog.filter(r=>plan.related_wiki_ids.includes(r.document.wiki_id)).map(r=>({evidence:wikiInput(r),draft:copy(approvedDraft(r.document))}))),
      'wiki_input_manifest');
  }
  function checkProtectionGraph(protection,plan){
    exact(protection,['nodes']);list(protection.nodes,2000);const nodes=new Map(),colors=new Map(),freshIds=new Set(plan.pages.filter(p=>p.action==='create_draft').map(p=>p.wiki_id));
    for(const row of protection.nodes){exact(row,['wiki_id','dependencies','complete']);uuid(row.wiki_id);list(row.dependencies,1000);row.dependencies.forEach(uuid);unique(row.dependencies);
      check(typeof row.complete==='boolean'&&!nodes.has(row.wiki_id),'wiki_dependency_unverified');nodes.set(row.wiki_id,row);}
    const proposed=new Map(plan.pages.map(p=>[p.wiki_id,expectedInputs(plan,p.wiki_id).filter(r=>r.kind==='wiki').map(r=>r.wiki_id)]));
    function visit(id,depth){
      check(depth<=32,'wiki_dependency_limit');check(colors.get(id)!==1,'wiki_protection_cycle');if(colors.get(id)===2)return;
      check(colors.size<2000,'wiki_dependency_limit');const node=nodes.get(id);check(node?.complete===true||!node&&freshIds.has(id),'wiki_dependency_unverified');
      colors.set(id,1);for(const next of new Set([...(node?.dependencies||[]),...(proposed.get(id)||[])]))visit(next,depth+1);colors.set(id,2);
    }
    for(const page of plan.pages)visit(page.wiki_id,0);return true;
  }
  async function planIngest(snapshot,catalog,{context:current,reservation,processed=[],relatedWikiIds=[],policy=1,protection={nodes:[]}}){
    const ctx=context(current);await verifySnapshot(snapshot,ctx);reservationIds(reservation);
    check(policy===1||policy===2,'wiki_invalid_policy');
    const rows=await readCatalog(catalog,ctx);list(processed,10000);list(relatedWikiIds,5);unique(relatedWikiIds);relatedWikiIds.forEach(uuid);
    const fingerprints=await fingerprintsFor(snapshot,rows,relatedWikiIds,policy);
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
    if(policy===1)check(relatedWikiIds.every(id=>!targets.some(t=>t.document.wiki_id===id)),'wiki_self_evidence');
    const inputs=changed.map(s=>copy(s.manifest)),related=changed.length?rows.filter(r=>relatedWikiIds.includes(r.document.wiki_id)):[];
    for(const row of [...related,...(policy===2?targets:[])]){
      if(!inputs.some(ref=>ref.kind==='wiki'&&ref.wiki_id===row.document.wiki_id))inputs.push(wikiInput(row));
    }
    if(inputs.some(i=>i.origin==='local'))check(targets.every(t=>t.origin==='local'),'wiki_local_branch_required');
    list(inputs,30);unique(inputs.map(i=>i.id));inputs.sort(order);
    const transmission={sources:changed.map(s=>({id:s.id,title:s.title,content:s.content})),
      related_wikis:related.map(row=>({evidence:copy(inputs.find(i=>i.kind==='wiki'&&i.wiki_id===row.document.wiki_id)),draft:copy(approvedDraft(row.document))})),
      comparison_targets:targets.map(row=>({wiki_id:row.document.wiki_id,...(policy===2?{evidence:copy(inputs.find(i=>i.kind==='wiki'&&i.wiki_id===row.document.wiki_id))}:{}),draft:copy(approvedDraft(row.document))})),
      pages:pages.map(({wiki_id,draft_id,action})=>({wiki_id,draft_id,action}))};
    const transmitted=size(transmission);check(transmitted<=524288,'wiki_source_budget');
    const plan={schema_version:1,context:ctx,snapshot:copy(snapshot),catalog:copy(catalog),reservation:copy(reservation),
      fingerprints,candidates,targets,pages,inputs,transmission,related_wiki_ids:copy(relatedWikiIds),transmitted_bytes:transmitted,calls:changed.length?1:0,
      serverEligible:Boolean(ctx.url)&&inputs.every(i=>i.origin==='server')&&targets.every(t=>t.origin==='server'),...(policy===2?{policy,protection:copy(protection)}:{})};
    if(policy===2&&plan.calls){checkPlanInputs(plan);checkProtectionGraph(protection,plan);}
    return {...plan,plan_hash:await P.hashJson(plan)};
  }
  async function planIntegration(snapshot,catalog,{context:current,reservation,wikiId,relation,protection={nodes:[]}}){
    const ctx=context(current);await verifySnapshot(snapshot,ctx,{allowEmpty:true});reservationIds(reservation);
    const rows=await readCatalog(catalog,ctx),target=rows.find(r=>r.document.wiki_id===wikiId),parent=target&&approvedDraft(target.document);
    check(parent,'wiki_comparison_missing');check(reservation.pages.length===1&&reservation.pages[0].wiki_id===wikiId,'wiki_missing_page_reservation');
    const endpoint=rows.find(r=>r.document.wiki_id===relation?.to_ref?.wiki_id),ref=relation?.to_ref;
    check(endpoint&&endpoint!==target&&ref.kind==='approved','wiki_relation_binding');
    const chosen=approvedDraft(endpoint.document),approval=endpoint.document.approvals.at(-1);
    check(chosen&&chosen.id===ref.draft_id&&chosen.draft_hash===ref.draft_hash&&approval.id===ref.approval_id,'wiki_relation_binding');
    check(ref.section_id===null||chosen.sections.some(s=>s.id===ref.section_id),'wiki_relation_section');
    check(target.origin!=='server'||endpoint.origin==='server','wiki_local_branch_required');
    check(!(parent.relations||[]).some(r=>r.id===relation.id),'wiki_duplicate_relation');
    const previousRefs=parent.evidence_manifest||parent.source_manifest.map(r=>({...copy(r),kind:'note'}));
    const selected=[],related=[];
    for(const old of previousRefs){
      if(old.kind==='note'){
        const source=snapshot.sources.find(s=>s.manifest.note_ref.owner_id===old.note_ref.owner_id&&s.manifest.note_ref.local_id===old.note_ref.local_id&&s.manifest.content_hash===old.content_hash);
        check(source,'wiki_source_changed');selected.push(copy(source));
      }else{
        const row=rows.find(r=>r.document.wiki_id===old.wiki_id),now=row&&wikiInput(row);
        check(now&&now.owner_id===old.owner_id&&now.draft_id===old.draft_id&&now.approval_id===old.approval_id&&now.content_hash===old.content_hash,'wiki_source_changed');
        related.push(row);
      }
    }
    unique(selected.map(s=>s.id));unique(related.map(r=>r.document.wiki_id));check(related.length+1<=5,'wiki_related_limit');
    const fixed={scope:copy(snapshot.scope),sources:selected},inputs=[...selected.map(s=>copy(s.manifest)),...related.map(wikiInput),wikiInput(target)];
    list(inputs,30,1);unique(inputs.map(r=>r.id));inputs.sort(order);
    if(inputs.some(r=>r.origin==='local'))check(target.origin==='local','wiki_local_branch_required');
    const page={...copy(reservation.pages[0]),action:'append_draft'};
    check(!target.document.drafts.some(d=>d.id===page.draft_id||d.generation_id===page.generation_id),'wiki_existing_draft_reservation');
    const transmission={sources:selected.map(s=>({id:s.id,title:s.title,content:s.content})),
      related_wikis:related.map(r=>({evidence:wikiInput(r),draft:copy(approvedDraft(r.document))})),
      comparison_targets:[{wiki_id:wikiId,evidence:wikiInput(target),draft:copy(parent)}],pages:[{wiki_id:wikiId,draft_id:page.draft_id,action:page.action}]};
    check(size(transmission)<=524288,'wiki_source_budget');
    const plan={schema_version:1,kind:'integrate',context:ctx,snapshot:fixed,catalog:copy(catalog),reservation:copy(reservation),fingerprints:[],candidates:[],
      targets:[copy(target)],pages:[page],inputs,transmission,related_wiki_ids:related.map(r=>r.document.wiki_id),transmitted_bytes:0,calls:0,
      serverEligible:Boolean(ctx.url)&&target.origin==='server'&&inputs.every(r=>r.origin==='server'),policy:2,protection:copy(protection),integration:{wiki_id:wikiId,relation:copy(relation)}};
    checkPlanInputs(plan);checkProtectionGraph(protection,plan);return {...plan,plan_hash:await P.hashJson(plan)};
  }
  async function createIntegrationProposal(plan,review){
    check(plan.kind==='integrate'&&plan.calls===0,'wiki_invalid_integration');
    const parent=approvedDraft(plan.targets[0].document),refs=parent.evidence_manifest||parent.source_manifest.map(r=>({...copy(r),kind:'note'}));
    const citations=parent.citations.map(c=>{
      const old=refs.find(r=>r.id===(c.evidence_id||c.source_id)),next=plan.inputs.find(r=>r.kind===old?.kind&&(r.kind==='note'
        ?r.note_ref.owner_id===old.note_ref.owner_id&&r.note_ref.local_id===old.note_ref.local_id:r.wiki_id===old.wiki_id));
      check(next,'wiki_unknown_evidence');return {id:c.id,evidence_id:next.id,section_id:c.section_id??null,quote:c.quote};
    });
    const page={wiki_id:plan.integration.wiki_id,draft_id:plan.pages[0].draft_id,title:parent.title,topic:parent.topic,page_type:parent.page_type||'concept',summary:parent.summary||'',
      aliases:copy(parent.aliases||[]),sections:copy(parent.sections),claims:copy(parent.claims||[]),relations:[...copy(parent.relations||[]),copy(plan.integration.relation)],citations};
    return validateIngestProposal({pages:[page]},plan,review);
  }
  async function planDerivedWiki(query,catalog,{context:current,reservation,protection={nodes:[]}}){
    const Q=NowWikiQuery,ctx=context(current);await Q.verifySnapshot(query);Q.assertSaveable(query);reservationIds(reservation);
    check(same(query.scope,scope(ctx))&&reservation.pages.length===1,'wiki_query_binding');
    const all=await readCatalog(catalog,ctx),rows=query.pages.map(page=>{
      const row=all.find(r=>r.document.wiki_id===page.wiki_id),draft=row&&approvedDraft(row.document),approval=row?.document.approvals.at(-1);
      check(row&&row.origin===page.origin&&row.document.document_version===page.document_version&&approval?.id===page.approval_id
        &&draft?.id===page.draft_id&&draft.draft_hash===page.draft_hash,'wiki_query_source_changed');return row;
    });
    check(!all.some(r=>r.document.wiki_id===reservation.pages[0].wiki_id),'wiki_existing_draft_reservation');
    const inputs=rows.map(wikiInput).sort(order),page={...copy(reservation.pages[0]),action:'create_draft'};
    const transmission={sources:[],comparison_targets:[],related_wikis:rows.map(r=>({evidence:wikiInput(r),draft:copy(approvedDraft(r.document))})),
      pages:[{wiki_id:page.wiki_id,draft_id:page.draft_id,action:page.action}]};
    check(size(transmission)<=524288,'wiki_source_budget');
    const plan={schema_version:1,kind:'ingest',derived:true,context:ctx,snapshot:{scope:scope(ctx),sources:[]},catalog:copy(rows),reservation:copy(reservation),
      fingerprints:[],candidates:[],targets:[],pages:[page],inputs,transmission,related_wiki_ids:rows.map(r=>r.document.wiki_id),transmitted_bytes:0,calls:0,
      serverEligible:Boolean(ctx.url)&&inputs.every(r=>r.origin==='server'),policy:2,protection:copy(protection)};
    checkPlanInputs(plan);checkProtectionGraph(protection,plan);return {...plan,plan_hash:await P.hashJson(plan)};
  }
  async function createDerivedProposal(query,response,plan,review){
    check(plan.derived===true&&plan.calls===0,'wiki_invalid_derived');
    await NowWikiQuery.verifySnapshot(query);NowWikiQuery.assertSaveable(query);
    const answer=await NowWikiQuery.validateWikiAnswer(response,query);
    check(answer.citations.length>0,'wiki_query_uncited_claim');
    check(plan.inputs.length===query.pages.length&&query.pages.every(page=>plan.inputs.some(ref=>ref.kind==='wiki'&&ref.wiki_id===page.wiki_id
      &&ref.draft_id===page.draft_id&&ref.approval_id===page.approval_id&&ref.document_version===page.document_version&&ref.content_hash===page.draft_hash)),'wiki_query_binding');
    const citations=answer.citations.map(c=>({id:c.id,evidence_id:plan.inputs.find(ref=>ref.wiki_id===c.wiki_id).id,section_id:c.section_id,quote:c.quote}));
    const statuses={supported:'인용 근거 있음',inferred:'추론',uncertain:'불확실',unsupported:'근거 없음'};
    const markdown=answer.claims.map(c=>'['+statuses[c.assessment]+'] '+c.statement).concat(answer.uncertainties.map(s=>'[확인 필요] '+s)).join('\n\n');
    check([...markdown].length<=131072,'wiki_query_budget');
    const page={wiki_id:plan.pages[0].wiki_id,draft_id:plan.pages[0].draft_id,title:answer.title,topic:query.pages[0].draft.topic,page_type:'reference',summary:'',aliases:[],
      sections:[{id:'answer',title:answer.title,markdown,citation_ids:citations.map(c=>c.id)}],claims:copy(answer.claims),relations:[],citations};
    return validateIngestProposal({pages:[page]},plan,review);
  }
  async function fresh(plan,review){
    const unsigned=copy(plan);delete unsigned.plan_hash;
    check(await P.hashJson(unsigned)===plan.plan_hash,'wiki_plan_hash');
    check(same(context(review.context),plan.context),'wiki_context_changed');
    await verifySnapshot(review.snapshot,review.context,{allowEmpty:plan.kind==='integrate'||plan.derived===true});await readCatalog(review.catalog,context(review.context));
    check(same(review.snapshot,plan.snapshot),'wiki_input_changed');
    if(plan.policy!==2){check(same(review.catalog,plan.catalog),'wiki_input_changed');return;}
    await readCatalog(plan.catalog,plan.context);checkPlanInputs(plan);
    for(const row of plan.targets){const latest=review.catalog.find(r=>r.document.wiki_id===row.document.wiki_id);check(latest&&same(latest,row),'wiki_target_changed');}
    for(const ref of plan.inputs.filter(r=>r.kind==='wiki')){
      const before=plan.catalog.find(r=>r.document.wiki_id===ref.wiki_id),latest=review.catalog.find(r=>r.document.wiki_id===ref.wiki_id);
      check(before&&latest&&same(wikiInput(before),ref)&&same(approvalTuple(before),approvalTuple(latest))&&latest.document.document_version>=ref.document_version,'wiki_source_changed');
    }
    for(const candidate of plan.candidates.filter(c=>c.action!=='unchanged')){
      const source=plan.snapshot.sources.find(s=>s.id===candidate.source_id),found=review.catalog.filter(r=>matchSource(source,r)).map(r=>r.document.wiki_id);
      check(same(found,candidate.wiki_id?[candidate.wiki_id]:[]),'wiki_target_changed');
    }
    checkProtectionGraph(review.protection||plan.protection,plan);
  }
  async function validateIngestProposal(input,plan,review){
    await fresh(plan,review);check(plan.calls===1||(plan.kind==='integrate'||plan.derived===true)&&plan.calls===0,'wiki_unchanged');
    const value=typeof input==='string'?P.parseJson(input):copy(input);exact(value,['pages']);list(value.pages,10,1);
    unique(value.pages.map(p=>p.wiki_id));const documents=[];
    if(plan.policy===2)check(value.pages.length===plan.pages.length,'wiki_incomplete_pages');
    check(typeof review.connection?.provider==='string'&&typeof review.connection?.model==='string','wiki_invalid_model');
    for(const page of value.pages){
      exact(page,['wiki_id','draft_id','title','topic','page_type','summary','aliases','sections','claims','relations','citations']);
      const declared=plan.pages.find(p=>p.wiki_id===page.wiki_id&&p.draft_id===page.draft_id);check(Boolean(declared),'wiki_undeclared_page');
      const target=plan.targets.find(t=>t.document.wiki_id===page.wiki_id),previous=target?.document;
      const draft={schema_version:2,id:declared.draft_id,generation_id:declared.generation_id,base_approved_revision_id:previous?.approvals.at(-1)?.id||null,
        scope:scope(plan.context),title:page.title,topic:page.topic,page_type:page.page_type,summary:page.summary,aliases:copy(page.aliases),
        sections:copy(page.sections),claims:copy(page.claims),relations:copy(page.relations),citations:copy(page.citations),
        evidence_manifest:expectedInputs(plan,page.wiki_id),
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
          if(t.operation_id===plan.reservation.operation_id){
            const other=documents.find(d=>d.wiki_id===t.wiki_id);chosen=other?.document.drafts.find(d=>d.id===t.draft_id);
            check(Boolean(chosen)&&bindings.some(b=>b.wiki_id===t.wiki_id&&b.draft_id===t.draft_id&&b.draft_hash===chosen.draft_hash),'wiki_relation_binding');
          }else{
            const before=plan.targets.find(target=>target.document.wiki_id===row.wiki_id)?.document;
            check(before&&(approvedDraft(before)?.relations||[]).some(old=>same(old,r)),'wiki_relation_parent');
            const proof=await review.relationProof?.(row.wiki_id,copy(r));check(proof,'wiki_relation_operation');
            chosen=(await verifyCarriedRelation(before,r,proof,plan.context)).draft;
          }
        }else{
          const other=plan.catalog.find(d=>d.document.wiki_id===t.wiki_id)?.document;chosen=other?.drafts.find(d=>d.id===t.draft_id);
          check(chosen?.draft_hash===t.draft_hash&&other.approvals.some(a=>a.id===t.approval_id&&a.draft_id===t.draft_id),'wiki_relation_binding');
          const live=review.catalog.find(d=>d.document.wiki_id===t.wiki_id)?.document,retained=live?.drafts.find(d=>d.id===t.draft_id);
          check(retained?.draft_hash===t.draft_hash&&live.approvals.some(a=>a.id===t.approval_id&&a.draft_id===t.draft_id),'wiki_relation_binding');
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
    const prepare={...base,schema_version:plan.policy===2?2:1,operation_id:r.operation_id,mutation_id:r.mutation_id,commit_mutation_id:r.commit_mutation_id,abort_mutation_id:r.abort_mutation_id,
      kind:plan.kind||'ingest',inputs:copy(plan.inputs),draft_bindings:copy(proposal.draft_bindings),changes};
    prepare.manifest_hash=await P.hashJson(prepare);
    const commit={...base,mutation_id:r.commit_mutation_id,manifest_hash:prepare.manifest_hash,documents:copy(proposal.documents)};
    const abort={...base,mutation_id:r.abort_mutation_id,manifest_hash:prepare.manifest_hash};
    check(size(prepare)<=131072&&size(commit)<=20971520,'wiki_operation_capacity');
    return {prepare,commit,abort,requiresDurableReservation:true};
  }
  async function verifyCarriedRelation(before,relation,proof,current){
    const ctx=scope(current);check(typeof current?.url==='string'&&typeof ctx.owner==='string'&&ctx.owner.length>0,'wiki_context_required');
    const source=await W.validateDocument(before,ctx),ref=relation.to_ref;
    check(ref?.kind==='proposal'&&ref.wiki_id!==source.wiki_id,'wiki_relation_binding');
    const parent=approvedDraft(source);
    check(parent&&(parent.relations||[]).some(r=>same(r,relation)),'wiki_relation_parent');
    exact(proof,['operation','documents','currentTarget']);list(proof.documents,10,2);
    const record=proof.operation,manifest=record?.manifest||record?.remote?.manifest;
    check(record?.operation_id===ref.operation_id&&record.state==='committed','wiki_relation_operation');
    const original=[];
    for(const raw of proof.documents)original.push(await W.validateDocument(raw,scope(ctx)));
    unique(original.map(d=>d.wiki_id));
    const first=original.find(d=>d.wiki_id===source.wiki_id),other=original.find(d=>d.wiki_id===ref.wiki_id);
    check(first&&other,'wiki_relation_binding');
    const origin=first.drafts.at(-1),target=other.drafts.find(d=>d.id===ref.draft_id);
    check(target&&source.approvals.some(a=>a.draft_id===origin.id&&a.draft_hash===origin.draft_hash)
      &&(origin.relations||[]).some(r=>same(r,relation)),'wiki_relation_parent');
    if(manifest){
      const unsigned=copy(manifest);delete unsigned.manifest_hash;
      check([1,2].includes(manifest.schema_version)&&['ingest','integrate'].includes(manifest.kind)&&manifest.owner_id===ctx.owner
        &&manifest.operation_id===ref.operation_id&&await P.hashJson(unsigned)===manifest.manifest_hash,'wiki_relation_operation');
      check(typeof globalThis.NowWikiServerAccess?.create==='function','wiki_relation_operation');
      const receipt=NowWikiServerAccess.create({}).verifyReceipt(record.receipt||record.remote?.receipt,manifest);
      check(receipt.state==='committed'&&(!record.manifest||record.manifest_hash===manifest.manifest_hash),'wiki_relation_operation');
      for(const [document,draft]of [[first,origin],[other,target]]){
        const hash=await P.hashJson(document);
        check(manifest.draft_bindings.some(b=>b.wiki_id===document.wiki_id&&b.draft_id===draft.id&&b.draft_hash===draft.draft_hash)
          &&manifest.changes.some(c=>c.wiki_id===document.wiki_id&&c.result_document_hash===hash),'wiki_relation_binding');
      }
    }else{
      check(['ingest','integrate'].includes(record.action)&&record.scope&&same({url:record.scope.url,owner:record.scope.owner},scope(ctx))
        &&record.reservation?.operation_id===ref.operation_id,'wiki_relation_operation');
      for(const [document,draft]of [[first,origin],[other,target]]){
        const hash=await P.hashJson(document);
        check(record.documents.some(d=>d.wiki_id===document.wiki_id&&d.draft_id===draft.id&&d.draft_hash===draft.draft_hash&&d.document_hash===hash)
          &&record.reservation.pages.some(p=>p.wiki_id===document.wiki_id&&p.draft_id===draft.id&&p.generation_id===draft.generation_id),'wiki_relation_binding');
      }
    }
    const live=await W.validateDocument(proof.currentTarget,scope(ctx));
    const chosen=live.drafts.find(d=>d.id===target.id&&d.draft_hash===target.draft_hash);
    check(live.wiki_id===ref.wiki_id&&chosen&&(ref.section_id===null||chosen.sections.some(s=>s.id===ref.section_id)),'wiki_relation_section');
    return {draft:copy(chosen),source_draft_id:origin.id,source_document_version:first.document_version,target_document_version:other.document_version};
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
  globalThis.NowNoteWikiIngest=Object.freeze({captureWikiSources,verifySnapshot,planIngest,planIntegration,createIntegrationProposal,planDerivedWiki,createDerivedProposal,validateIngestProposal,verifyProposal,verifyPlan:fresh,expectedInputs,checkProtectionGraph,comparisonRefs,reserveIngest,sourceFingerprints,buildOperationRequests,verifyCarriedRelation,dependencyUnion});
})();
