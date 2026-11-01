import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixture,ctx,scope,id,safety,clone} from './wiki_ingest_fixture.mjs';
const {P,W,I,selection,catalog,reservation,output,doc}=await fixture();
assert.equal(typeof W.validateDocument,'function','strict v1/v2 document reader must exist');
assert.ok(I,'pure ingest core must exist');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const fail=(fn,pattern=/wiki_|json_|unicode|integer/)=>assert.rejects(fn,pattern);
const rehash=async draft=>{const d=clone(draft);delete d.draft_hash;draft.draft_hash=await P.hashJson(d);return draft;};
const read=value=>W.validateDocument(value,scope);
await test('server canonical golden UTF-8',async()=>{
  const golden=JSON.parse(await fs.readFile(new URL('../../server/tests/fixtures/wiki_v2_canonical.json',import.meta.url)));
  for(const c of golden.cases){assert.equal(P.canonicalJson(c.value),c.canonical);assert.equal(await P.hashJson(c.value),c.sha256);}
});
await test('v1 exact bytes/hash and migration preserve old objects',async()=>{
  const bytes=JSON.stringify(doc,null,2),before=await P.sha256(bytes);
  assert.equal(JSON.stringify(await read(bytes)),JSON.stringify(doc));assert.equal(await P.sha256(bytes),before);
  const migrated={...clone(doc),schema_version:2};assert.equal(JSON.stringify((await read(migrated)).drafts[0]),JSON.stringify(doc.drafts[0]));
  assert.equal(JSON.stringify((await read(migrated)).approvals[0]),JSON.stringify(doc.approvals[0]));
});
const snap=await I.captureWikiSources(selection,ctx);
const plan=await I.planIngest(snap,catalog,{context:ctx,reservation,relatedWikiIds:[id(9)]});
const review={context:ctx,snapshot:snap,catalog,device:'fixture-device',connection:{provider:'fixture',model:'Combo/auto'},generatedAt:'2026-11-01T00:00:00Z'};
const proposal=await I.validateIngestProposal(output,plan,review);
await test('two inputs augment and new; draft only; all transmitted evidence retained',async()=>{
  assert.deepEqual(Array.from(plan.candidates,c=>c.action),['augment','new']);assert.equal(plan.calls,1);
  assert.equal(proposal.documents.length,2);
  for(const row of proposal.documents){const result=await read(row.document),draft=result.drafts.at(-1);
    assert.equal(draft.evidence_manifest.length,3,'uncited related wiki and uncited input must remain');
    assert.equal(result.approvals.length,row.wiki_id===doc.wiki_id?1:0);assert.equal(draft.model,'Combo/auto');}
  assert.equal(JSON.stringify(proposal.documents[0].document.drafts[0]),JSON.stringify(doc.drafts[0]));
});
await test('unchanged exact input yields zero model calls',async()=>{
  const unchanged=await I.planIngest(snap,catalog,{context:ctx,reservation,relatedWikiIds:[id(9)],processed:plan.fingerprints});
  assert.equal(unchanged.calls,0);assert.equal(unchanged.pages.length,0);
  const changed=clone(snap);changed.sources[0].manifest.head_version++;
  assert.equal((await I.planIngest(changed,catalog,{context:ctx,reservation,processed:plan.fingerprints})).calls,1);
});
await test('strict v2 owner/schema/unknown/approval/hash binding',async()=>{
  const valid=clone(proposal.documents[1].document);await read(valid);
  for(const mutate of [d=>{d.extra=1;},d=>{d.document_version=true;},d=>{d.document_version=1.5;},d=>{d.schema_version=true;},
    d=>{d.drafts[0].extra=1;},d=>{d.drafts[0].scope.owner='other';},d=>{d.drafts[0].summary+='x';},
    d=>{d.drafts[0].evidence_manifest[0].head_version=false;},d=>{d.drafts[0].schema_version=1;}]){
    const bad=clone(valid);mutate(bad);await fail(()=>read(bad));}
  const approved=clone(valid),draft=approved.drafts[0];approved.document_version++;
  approved.approvals.push({schema_version:2,id:id(30),parent_approved_revision_id:null,draft_id:draft.id,draft_hash:draft.draft_hash,
    evidence_manifest_hash:await P.hashJson(draft.evidence_manifest),approved_by:ctx.owner,approved_at:review.generatedAt});
  await read(approved);approved.approvals[0].evidence_manifest_hash='a'.repeat(64);await fail(()=>read(approved));
  await fail(()=>W.validateDocument(valid,{...scope,owner:'other'}));
});
await test('untrusted model unknown IDs/citations/sections/relations fail closed',async()=>{
  for(const mutate of [v=>{v.tool_calls=[];},v=>{v.pages[0].wiki_id=id(99);},v=>{v.pages[0].draft_id=id(99);},
    v=>{v.pages[0].sections[0].citation_ids=['missing'];},v=>{v.pages[0].citations[0].evidence_id='missing';},
    v=>{v.pages[0].citations[0].quote='Invented';},v=>{v.pages[0].claims[0].citation_ids=[];},
    v=>{v.pages[0].relations=[{id:'r1',from_section_id:'missing',to_ref:{kind:'proposal',operation_id:reservation.operation_id,
      wiki_id:id(20),draft_id:id(21),section_id:'s1'},type:'related_to',confidence:'inferred',citation_ids:[]}];}]){
    const bad=clone(output);mutate(bad);await fail(()=>I.validateIngestProposal(bad,plan,review));}
  const related=clone(output);related.pages[0].relations=[{id:'r1',from_section_id:'s1',to_ref:{kind:'proposal',operation_id:reservation.operation_id,
    wiki_id:id(20),draft_id:id(21),section_id:'s1'},type:'related_to',confidence:'inferred',citation_ids:[]}];
  related.pages[1].relations=[{...clone(related.pages[0].relations[0]),to_ref:{kind:'proposal',operation_id:reservation.operation_id,wiki_id:id(7),draft_id:id(14),section_id:'s1'}}];
  await I.validateIngestProposal(related,plan,review);
  related.pages[0].relations[0].to_ref.section_id='missing';await fail(()=>I.validateIngestProposal(related,plan,review));
  const wikiQuote=clone(output);wikiQuote.pages[0].citations=[{id:'c1',evidence_id:'wiki-'+id(9),section_id:'s1',quote:'Exact evidence 1.'}];
  await I.validateIngestProposal(wikiQuote,plan,review);
  wikiQuote.pages[0].citations[0].section_id='missing';await fail(()=>I.validateIngestProposal(wikiQuote,plan,review));
});
await test('fresh account/server/session and source/target revision guard',async()=>{
  for(const key of ['owner','url','device','viewGeneration','serverInstance'])await fail(()=>I.validateIngestProposal(output,plan,{...review,context:{...ctx,[key]:key==='viewGeneration'?2:'different'}}));
  const changed=clone(snap);changed.sources[0].manifest.head_version++;
  await fail(()=>I.validateIngestProposal(output,plan,{...review,snapshot:changed}));
  const targets=clone(catalog);targets[0].headVersion++;
  await fail(()=>I.validateIngestProposal(output,plan,{...review,catalog:targets}));
  const altered=clone(plan);altered.inputs.pop();await fail(()=>I.validateIngestProposal(output,altered,review));
  const lateContext=clone(ctx),lateReview={...review,context:lateContext,get generatedAt(){lateContext.viewGeneration++;return review.generatedAt;}};
  await fail(()=>I.validateIngestProposal(output,plan,lateReview),/wiki_context_changed/);
});
await test('fixed operation envelopes, canonical hashes, no sending or implicit ID generation',async()=>{
  const request=await I.buildOperationRequests(proposal,review);
  const unsigned=clone(request.prepare);delete unsigned.manifest_hash;
  assert.equal(request.prepare.manifest_hash,await P.hashJson(unsigned));
  assert.equal(request.commit.mutation_id,reservation.commit_mutation_id);assert.equal(request.abort.mutation_id,reservation.abort_mutation_id);
  assert.equal(request.prepare.inputs.length,3);assert.equal(request.prepare.draft_bindings.length,2);
  assert.equal(request.requiresDurableReservation,true);
  const bad=clone(proposal);bad.documents[0].document.drafts.pop();await fail(()=>I.buildOperationRequests(bad,review));
  const noBinding=clone(proposal);noBinding.draft_bindings.pop();await fail(()=>I.buildOperationRequests(noBinding,review));
  const bindingBody=clone(noBinding);delete bindingBody.proposal_hash;noBinding.proposal_hash=await P.hashJson(bindingBody);
  await fail(()=>I.buildOperationRequests(noBinding,review),/wiki_proposal_binding|wiki_missing_draft_binding/);
  const rewritten=clone(proposal);rewritten.documents[0].document.drafts[0].title='rewritten legacy';
  await rehash(rewritten.documents[0].document.drafts[0]);
  rewritten.documents[0].document.approvals[0].draft_hash=rewritten.documents[0].document.drafts[0].draft_hash;
  const unsignedProposal=clone(rewritten);delete unsignedProposal.proposal_hash;rewritten.proposal_hash=await P.hashJson(unsignedProposal);
  await fail(()=>I.buildOperationRequests(rewritten,review),/wiki_proposal_binding/);
});
await test('processed input cannot conceal changed comparison or related wiki',async()=>{
  const changed=clone(catalog);changed[0].headVersion++;
  const next=await I.planIngest(snap,changed,{context:ctx,reservation,relatedWikiIds:[id(9)],processed:plan.fingerprints});
  assert.equal(next.calls,1);
});
await test('retained, rejected, branch and unsent dependencies union never shrinks',async()=>{
  const previous=clone(proposal.documents[1].document),draft=previous.drafts[0];
  const rejected=clone(draft);rejected.id=id(51);rejected.generation_id=id(52);rejected.evidence_manifest=[{...clone(snap.sources[0].manifest),id:'old-source',note_ref:{owner_id:ctx.owner,local_id:'old-note'}}];
  rejected.citations=[{id:'c1',evidence_id:'old-source',section_id:null,quote:'Exact evidence 1.'}];await rehash(rejected);
  previous.drafts.push(rejected);previous.rejected_draft_ids.push(rejected.id);await read(previous);
  const pending=clone(proposal.documents[1].document);pending.wiki_id=id(53);pending.drafts[0].id=id(54);pending.drafts[0].generation_id=id(55);
  pending.drafts[0].evidence_manifest=[{...clone(snap.sources[1].manifest),id:'pending',note_ref:{owner_id:ctx.owner,local_id:'unsent-note'}}];
  pending.drafts[0].citations=[{id:'c1',evidence_id:'pending',section_id:null,quote:'Exact evidence 2.'}];await rehash(pending.drafts[0]);
  const link={artifact_local_id:'wiki:'+id(20),dependencies:[{owner_id:ctx.owner,local_id:'retained-note'}],wiki_dependencies:[],document_schema_floor:2};
  link.lineage_manifest_hash=await P.hashJson(link);await W.validateLink(link,scope);
  const result=await I.dependencyUnion([previous,pending],ctx,{retainedLinks:[link],resolveWiki:ref=>catalog.find(r=>r.document.wiki_id===ref.wiki_id)});
  assert.deepEqual(Array.from(result.dependencies,r=>r.local_id),['note-1','note-2','old-note','retained-note','unsent-note']);
  assert.equal(result.wiki_dependencies.length,1);
  await fail(()=>I.dependencyUnion([previous],ctx,{resolveWiki:()=>null}),/wiki_dependency_unavailable/);
  await fail(()=>I.dependencyUnion([previous],ctx,{resolveWiki:ref=>({...catalog.find(r=>r.document.wiki_id===ref.wiki_id),safety:{...safety,lineage:true}})}));
  const unknown=clone(previous);unknown.drafts[0].evidence_manifest[2].document_version++;
  await rehash(unknown.drafts[0]);await fail(()=>I.dependencyUnion([unknown],ctx,{resolveWiki:ref=>catalog.find(r=>r.document.wiki_id===ref.wiki_id)}));
});
await test('dependency union exact 1000 leaves and depth 32 reject overflow without truncation',async()=>{
  const roots=[];
  for(let n=0;n<34;n++){
    const root=clone(proposal.documents[1].document);root.wiki_id=id(1000+n);
    const d=root.drafts[0];d.evidence_manifest=Array.from({length:n===33?10:30},(_,j)=>({...clone(snap.sources[1].manifest),id:'e'+j,note_ref:{owner_id:ctx.owner,local_id:'union-'+String(n*30+j).padStart(4,'0')}}));
    d.citations[0].evidence_id='e0';await rehash(d);roots.push(root);
  }
  assert.equal((await I.dependencyUnion(roots,ctx)).dependencies.length,1000);
  roots[33].drafts[0].evidence_manifest.push({...clone(snap.sources[1].manifest),id:'extra',note_ref:{owner_id:ctx.owner,local_id:'overflow'}});
  await rehash(roots[33].drafts[0]);await fail(()=>I.dependencyUnion(roots,ctx),/wiki_dependency_limit/);
  const chain=[];
  for(let n=0;n<34;n++){
    const doc=clone(proposal.documents[1].document);doc.wiki_id=id(2000+n);const d=doc.drafts[0];
    d.id=id(3000+n);d.generation_id=id(4000+n);
    if(n===0){d.evidence_manifest=[clone(snap.sources[1].manifest)];d.citations[0].evidence_id='source-2';}
    else{const prior=chain[n-1],child=prior.drafts[0];d.evidence_manifest=[{id:'parent',kind:'wiki',origin:'server',owner_id:ctx.owner,wiki_id:prior.wiki_id,
      draft_id:child.id,approval_id:prior.approvals[0].id,document_version:1,content_hash:child.draft_hash}];d.citations[0].evidence_id='parent';d.citations[0].section_id='s1';}
    await rehash(d);doc.approvals=[{schema_version:2,id:id(5000+n),parent_approved_revision_id:null,draft_id:d.id,draft_hash:d.draft_hash,
      evidence_manifest_hash:await P.hashJson(d.evidence_manifest),approved_by:ctx.owner,approved_at:review.generatedAt}];chain.push(doc);
  }
  const resolver={resolveWiki:ref=>({document:chain.find(d=>d.wiki_id===ref.wiki_id),safety})};
  assert.equal((await I.dependencyUnion([chain[32]],ctx,resolver)).wiki_dependencies.length,32);
  await fail(()=>I.dependencyUnion([chain[33]],ctx,resolver),/wiki_dependency_limit/);
});
await test('UTF-8 MD/TXT exact snapshot/hash/range; unsupported/partial/hash-only reject',async()=>{
  const bytes=new TextEncoder().encode('한글\r\n<script>neverRun()</script>\nhttps://invalid.example/');
  const file={kind:'file',id:'file1',name:'sample.md',localId:'file-note',bytes,safety:clone(safety)};
  const captured=await I.captureWikiSources([file],ctx),source=captured.sources[0];
  assert.equal(source.content,new TextDecoder().decode(bytes));assert.equal(source.manifest.origin,'local');
  assert.equal(source.extraction.file_hash,await P.sha256(bytes));assert.equal(source.extraction.text_hash,await P.sha256(source.content));
  assert.equal(source.extraction.range.end,bytes.length);assert.equal(source.extraction.adapter,'utf8-text-v1');
  await I.verifySnapshot(captured,ctx);
  for(const value of [{...file,bytes:undefined,path:'x.md',hash:'a'.repeat(64)},{...file,name:'x.pdf'},
    {...file,partial:true},{...file,bytes:new Uint8Array([255])}])await fail(()=>I.captureWikiSources([value],ctx));
  const missing=clone(captured);delete missing.sources[0].content;await fail(()=>I.verifySnapshot(missing,ctx));
  const tampered=clone(captured);tampered.sources[0].extraction.text_hash='a'.repeat(64);await fail(()=>I.verifySnapshot(tampered,ctx));
  const stripped=clone(captured);delete stripped.sources[0].extraction;await fail(()=>I.verifySnapshot(stripped,ctx));
  const localPlan=await I.planIngest(captured,[],{context:ctx,reservation:{...reservation,pages:[reservation.pages[1]]}});
  assert.equal(localPlan.serverEligible,false);
  const localOutput={pages:[clone(output.pages[1])]};localOutput.pages[0].citations[0]={id:'c1',evidence_id:'file1',section_id:null,quote:'한글'};
  const localReview={...review,snapshot:captured,catalog:[]};
  const localProposal=await I.validateIngestProposal(localOutput,localPlan,localReview);
  await fail(()=>I.buildOperationRequests(localProposal,localReview),/wiki_server_input_required/);
  const mixed=clone(captured);mixed.sources[0].title='Alpha';
  await fail(()=>I.planIngest(mixed,catalog,{context:ctx,reservation}),/wiki_local_branch_required/);
  const localTarget=clone(catalog);localTarget[0].origin='local';localTarget[0].headRevisionId=null;localTarget[0].headVersion=0;localTarget[0].indexVersion=0;
  assert.equal((await I.planIngest(snap,localTarget,{context:ctx,reservation})).serverEligible,false);
});
await test('all batch protection lineage, fence and unknown states rejected',async()=>{
  for(const key of ['lineage','fence','epoch','status']){
    const changed=clone(selection);changed[0].safety[key]=key==='epoch'?1:key==='status'?'unknown':true;
    await fail(()=>I.captureWikiSources(changed,ctx));
    const targets=clone(catalog);targets[0].safety[key]=changed[0].safety[key];await fail(()=>I.planIngest(snap,targets,{context:ctx,reservation}));}
  const missing=clone(selection);delete missing[0].safety;await fail(()=>I.captureWikiSources(missing,ctx));
});
await test('30 inputs / 512 KiB / 5 related wiki / 10 output / 2MiB document limits',async()=>{
  const many=Array.from({length:30},(_,n)=>({kind:'note',id:'n'+n,safety:clone(safety),note:{...selection[0].note,localId:'n'+n,revisionId:id(100+n),content:'x'}}));
  assert.equal((await I.captureWikiSources(many,ctx)).sources.length,30);await fail(()=>I.captureWikiSources([...many,many[0]],ctx));
  const large=clone(selection.slice(0,1));large[0].note.content='x'.repeat(524288);await I.captureWikiSources(large,ctx);
  large[0].note.content+='x';await fail(()=>I.captureWikiSources(large,ctx));
  const hugeTarget=clone(catalog);hugeTarget[0].document.drafts[0].sections=Array.from({length:5},(_,n)=>({id:'s'+n,title:'x',markdown:'x'.repeat(131072),citation_ids:['c1']}));
  await rehash(hugeTarget[0].document.drafts[0]);hugeTarget[0].document.approvals[0].draft_hash=hugeTarget[0].document.drafts[0].draft_hash;
  await fail(()=>I.planIngest(snap,hugeTarget,{context:ctx,reservation}),/wiki_source_budget/);
  const overflow=clone(output);overflow.pages=Array.from({length:11},()=>output.pages[0]);await fail(()=>I.validateIngestProposal(overflow,plan,review));
  const huge=clone(proposal.documents[1].document);huge.drafts[0].sections=Array.from({length:20},(_,n)=>({id:'s'+n,title:'x',markdown:'x'.repeat(131072),citation_ids:['c1']}));
  await rehash(huge.drafts[0]);await fail(()=>read(huge));
  const catalogs=[];for(let n=0;n<6;n++){const c=clone(catalog[0]);c.document.wiki_id=id(200+n);catalogs.push(c);}
  await fail(()=>I.planIngest(snap,catalogs,{context:ctx,reservation,relatedWikiIds:catalogs.map(r=>r.document.wiki_id)}),/wiki_ingest_limit|wiki_related_limit/);
  const approvedRows=[];for(let n=0;n<4;n++){const c=clone(catalog[1]);c.document.wiki_id=id(300+n);approvedRows.push(c);}
  const five=await I.planIngest(snap,[catalog[0],...approvedRows],{context:ctx,reservation,relatedWikiIds:approvedRows.map(r=>r.document.wiki_id)});
  assert.equal(five.inputs.length,6,'two notes plus four related wiki; target is comparison only');
  const thirty=await I.captureWikiSources(many,ctx);
  assert.equal((await I.planIngest(thirty,catalog,{context:ctx,reservation})).inputs.length,30);
  await fail(()=>I.planIngest(thirty,catalog,{context:ctx,reservation,relatedWikiIds:[id(9)]}));
  const boundary=clone(proposal.documents[1].document),d=boundary.drafts[0];
  d.sections=Array.from({length:16},(_,n)=>({id:'s'+n,title:'x',markdown:n===15?'x':'x'.repeat(131072),citation_ids:['c1']}));
  const currentSize=new TextEncoder().encode(P.canonicalJson(boundary)).length;
  d.sections[15].markdown+='x'.repeat(2097152-currentSize);await rehash(d);
  assert.equal(new TextEncoder().encode(P.canonicalJson(boundary)).length,2097152);await read(boundary);
  d.sections[15].markdown+='x';await rehash(d);await fail(()=>read(boundary),/wiki_artifact_capacity/);
});
console.log('Wiki ingest: '+passed+' groups PASS (synthetic only; UI/durable CAS/HTTP/cold NOT RUN)');
