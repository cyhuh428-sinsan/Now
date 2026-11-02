import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,clone,id,safety} from './wiki_ingest_fixture.mjs';
import {documents} from './check_wiki_graph.mjs';
const {box,I,W,P}=await fixture();
vm.runInContext(await fs.readFile(new URL('../vendor/wiki-lint.js',import.meta.url),'utf8'),box);
assert.equal(typeof I.planLintReport,'function','explicit Lint reports must retain the existing Wiki inputs and protection contract');
const rows=documents.map(document=>({id:document.wiki_id,document:clone(document),origin:'local',index_status:'local',
  source_checks:document.drafts.flatMap(d=>W.evidenceOf(d).map(r=>({draft_id:d.id,evidence_id:r.id,status:'ok'}))),
  relation_checks:document.drafts.flatMap(d=>(d.relations||[]).map(r=>({draft_id:d.id,relation_id:r.id,status:'ok'})))}));
const snapshot={scope:{url:ctx.url,owner:ctx.owner},rows},report=await box.NowWikiLint.lintWikiCatalog(snapshot,{});
const catalog=rows.map(row=>({document:clone(row.document),origin:'local',headRevisionId:null,headVersion:0,indexVersion:0,safety:clone(safety)}));
const reservation={operation_id:id(801),mutation_id:id(802),commit_mutation_id:id(803),abort_mutation_id:id(804),pages:[{wiki_id:id(805),draft_id:id(806),generation_id:id(807),note_mutation_id:id(808)}]};
const protection={nodes:documents.map(d=>({wiki_id:d.wiki_id,dependencies:[],complete:true}))};
const plan=await I.planLintReport(snapshot,{},report,catalog,{context:ctx,reservation,protection});
assert.equal(plan.calls,0);assert.equal(plan.inputs.length,2);assert.equal(plan.serverEligible,false);
const review={context:ctx,snapshot:plan.snapshot,catalog,protection,connection:{provider:'manual',model:'wiki-lint-v1'},generatedAt:'2026-11-02T00:00:00Z'};
const proposal=await I.createLintReportProposal(snapshot,{},report,plan,review),draft=proposal.documents[0].document.drafts[0];
assert.equal(draft.evidence_manifest.length,2);assert.equal(proposal.documents[0].document.approvals.length,0);assert.equal(draft.claims.length,0);
assert.ok(draft.sections[0].markdown.includes('검사 2'));assert.equal(draft.provider,'manual');
await I.verifyProposal(proposal,review);
const forged=clone(report);forged.checked=999;await assert.rejects(()=>I.createLintReportProposal(snapshot,{},forged,plan,review));
const hidden=clone(snapshot);hidden.rows[0].protected=true;
const hiddenReport=await box.NowWikiLint.lintWikiCatalog(hidden,{});
await assert.rejects(()=>I.planLintReport(hidden,{},hiddenReport,catalog,{context:ctx,reservation,protection}));
assert.equal(snapshot.rows.length,2,'report save does not shrink the selected source scope');
console.log('Explicit Lint report: deterministic manual draft, every selected Wiki input, no implicit approval/model or protected scope truncation PASS');
