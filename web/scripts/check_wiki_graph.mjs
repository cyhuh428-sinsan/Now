import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,scope,id,clone} from './wiki_ingest_fixture.mjs';
const {box,I,P,W,selection,reservation,output}=await fixture();
vm.runInContext(await fs.readFile(new URL('../vendor/cytoscape.min.js',import.meta.url),'utf8'),box);
try{vm.runInContext(await fs.readFile(new URL('../vendor/wiki-graph.js',import.meta.url),'utf8'),box);}catch(error){if(error.code!=='ENOENT')throw error;}
const G=box.NowWikiGraph;assert.equal(typeof G?.buildApprovedWikiCatalog,'function','approved Wiki catalog required');
const snapshot=await I.captureWikiSources(selection,ctx),plan=await I.planIngest(snapshot,[],{context:ctx,reservation});
for(let n=0;n<2;n++)output.pages[n].relations=[{id:'r1',from_section_id:'s1',to_ref:{kind:'proposal',operation_id:reservation.operation_id,
  wiki_id:reservation.pages[1-n].wiki_id,draft_id:reservation.pages[1-n].draft_id,section_id:'s1'},type:'related_to',confidence:n?'inferred':'explicit',citation_ids:['c1']}];
const proposal=await I.validateIngestProposal(output,plan,{context:ctx,snapshot,catalog:[],connection:{provider:'fixture',model:'synthetic'},generatedAt:'2026-11-01T00:00:00Z'});
const originals=proposal.documents.map(row=>clone(row.document));
const operation={operation_id:reservation.operation_id,action:'ingest',state:'committed',scope:{url:ctx.url,owner:ctx.owner},reservation,
  documents:await Promise.all(originals.map(async document=>({wiki_id:document.wiki_id,draft_id:document.drafts[0].id,draft_hash:document.drafts[0].draft_hash,document_hash:await P.hashJson(document)})))};
async function approve(document,n){const doc=clone(document),draft=doc.drafts.at(-1);doc.document_version++;doc.approvals.push({schema_version:2,id:id(n),parent_approved_revision_id:doc.approvals.at(-1)?.id||null,
  draft_id:draft.id,draft_hash:draft.draft_hash,evidence_manifest_hash:await P.hashJson(draft.evidence_manifest),approved_by:ctx.owner,approved_at:'2026-11-01T00:00:00Z'});return W.validateDocument(doc,scope);}
const documents=[await approve(originals[0],80),await approve(originals[1],81)];
const row=document=>({document,available:true,stale:false,protected:false,deleted:false});
const build=(docs=documents,operations=[operation])=>G.buildApprovedWikiCatalog(docs.map(row),ctx,{operations});
assert.equal((await build(originals)).nodes.length,0,'draft-only pages never become active nodes');
assert.equal((await build([documents[0],originals[1]])).edges.length,0,'both endpoint drafts must be approved');
const catalog=await build();assert.equal(catalog.nodes.length,2);assert.equal(catalog.edges.length,2);
const requests=await I.buildOperationRequests(proposal,{context:ctx,snapshot,catalog:[],device:ctx.device,connection:{provider:'fixture',model:'synthetic'},generatedAt:'2026-11-01T00:00:00Z'});
const remoteOperation={operation_id:reservation.operation_id,action:'ingest',state:'committed',scope:{url:ctx.url,owner:ctx.owner},manifest:requests.prepare};
assert.equal((await build(documents,[remoteOperation])).edges.length,2,'verified server manifest recovers proposal bindings on a new device');
const damagedRemote=clone(remoteOperation);damagedRemote.manifest.draft_bindings[0].draft_hash='a'.repeat(64);
assert.equal((await build(documents,[damagedRemote])).edges.length,0,'changed remote manifest does not become a graph binding');
assert.deepEqual(Array.from(catalog.edges,e=>e.confidence).sort(),['explicit','inferred']);
assert.equal(G.planWikiIntegration(documents[0].wiki_id,catalog).incoming.length,1);
const projected=G.projectWikiGraph(catalog);assert.equal(projected.length,4);
assert.equal(G.findWikiPath(catalog,documents[0].wiki_id,documents[1].wiki_id).edges.length,1,'library path terminates on navigation cycle');
assert.equal(G.findWikiPath(catalog,documents[0].wiki_id,documents[0].wiki_id).edges.length,0);
assert.throws(()=>G.findWikiPath(catalog,id(99),documents[0].wiki_id),/wiki_graph_target/);
assert.equal((await build(documents,[])).edges.length,0,'unproved proposal bindings are not promoted');
const changed=clone(operation);changed.documents[1].draft_hash='a'.repeat(64);
assert.equal((await build(documents,[changed])).edges.length,0,'both proposal endpoint hashes are bound');
const hidden=await G.buildApprovedWikiCatalog([row(documents[0]),{...row(documents[1]),protected:true}],ctx,{operations:[operation]});
assert.equal(hidden.nodes.length,1);assert.equal(hidden.edges.length,0);assert.ok(!JSON.stringify(hidden).includes('Beta'));
assert.equal((await G.buildApprovedWikiCatalog(documents.map(row),{...ctx,owner:'other'},{operations:[operation]})).nodes.length,0);
const pending=clone(documents[0]),next=clone(pending.drafts[0]);next.id=id(82);next.generation_id=id(83);next.base_approved_revision_id=pending.approvals[0].id;next.title='UNAPPROVED_LABEL';delete next.draft_hash;next.draft_hash=await P.hashJson(next);pending.drafts.push(next);pending.document_version++;
const still=await build([pending,documents[1]]);assert.equal(still.nodes[0].title,'Alpha');assert.ok(!JSON.stringify(still).includes('UNAPPROVED_LABEL'));
async function withApprovedRelation(section='s1',target=documents[1].wiki_id){
  const source=clone(documents[0]),draft=source.drafts[0],approved=documents[1].approvals[0];
  draft.relations[0].to_ref={kind:'approved',wiki_id:target,draft_id:approved.draft_id,approval_id:approved.id,draft_hash:approved.draft_hash,section_id:section};
  delete draft.draft_hash;draft.draft_hash=await P.hashJson(draft);source.approvals[0].draft_hash=draft.draft_hash;return source;
}
const linked=await withApprovedRelation();assert.equal((await build([linked,documents[1]])).edges.length,1);
const advanced=clone(documents[1]),newDraft=clone(advanced.drafts[0]);
newDraft.id=id(84);newDraft.generation_id=id(85);newDraft.base_approved_revision_id=advanced.approvals[0].id;newDraft.title='Beta updated';newDraft.relations=[];
delete newDraft.draft_hash;newDraft.draft_hash=await P.hashJson(newDraft);advanced.drafts.push(newDraft);advanced.document_version++;
const advancedApproved=await approve(advanced,86),oldEdge=await build([linked,advancedApproved]);
assert.equal(oldEdge.edges.length,1);assert.equal(oldEdge.edges[0].stale,true);
assert.equal(oldEdge.edges[0].target_draft_id,documents[1].drafts[0].id,'approved endpoint never silently follows the newest draft');
const missingSection=await build([await withApprovedRelation('missing'),documents[1]]);assert.equal(missingSection.edges.length,0);
assert.equal(G.findWikiPath(missingSection,documents[0].wiki_id,documents[1].wiki_id).found,false);
assert.equal((await build([await withApprovedRelation('s1',id(666)),documents[1]])).edges.length,0,'unknown endpoint never invents a node');
assert.equal(P.canonicalJson(documents),P.canonicalJson(await Promise.all(documents.map(doc=>W.validateDocument(doc,scope)))),'read-only projection preserves documents');
try{vm.runInContext(await fs.readFile(new URL('../vendor/wiki-graph-ui.js',import.meta.url),'utf8'),box);}catch(error){if(error.code!=='ENOENT')throw error;}
assert.equal(typeof box.mountWikiGraph,'function','graph view must have an explicit teardown lifecycle');
console.log('Approved Wiki graph: bound proposal cycle, reverse/path, both approvals, hidden/foreign/stale labels and immutable projection PASS');
export {catalog,documents,originals,operation,requests};
