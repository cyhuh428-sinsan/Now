import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture,ctx,clone,id,safety} from './wiki_ingest_fixture.mjs';
import {catalog,documents} from './check_wiki_graph.mjs';
const {box,I,P}=await fixture();
vm.runInContext(await fs.readFile(new URL('../vendor/wiki-query.js',import.meta.url),'utf8'),box);
assert.equal(typeof I.planDerivedWiki,'function','explicit Query save must use the existing Ingest/protection contract');
const rows=documents.map(document=>({document:clone(document),origin:'local',headRevisionId:null,headVersion:0,indexVersion:0,safety:clone(safety)}));
const selected={...clone(catalog),nodes:catalog.nodes.map(n=>({...clone(n),origin:'local',protected:false}))};
const query=await box.NowWikiQuery.selectWikiContext('Alpha',selected,{wiki_ids:[catalog.nodes[0].wiki_id],related_limit:1});
const first=query.pages[0],output={query_hash:query.snapshot_hash,title:'Derived answer',claims:[{id:'a',statement:'A compiled finding',assessment:'supported',citation_ids:['c']}],
  citations:[{id:'c',wiki_id:first.wiki_id,draft_id:first.draft_id,approval_id:first.approval_id,draft_hash:first.draft_hash,document_version:first.document_version,section_id:'s1',quote:first.draft.sections[0].markdown}],uncertainties:[]};
const reservation={operation_id:id(501),mutation_id:id(502),commit_mutation_id:id(503),abort_mutation_id:id(504),pages:[{wiki_id:id(505),draft_id:id(506),generation_id:id(507),note_mutation_id:id(508)}]};
const protection={nodes:documents.map(d=>({wiki_id:d.wiki_id,dependencies:[],complete:true}))};
const plan=await I.planDerivedWiki(query,rows,{context:ctx,reservation,protection});
assert.equal(plan.calls,0);assert.equal(plan.inputs.length,2,'even uncited but consumed context remains a protection dependency');
assert.equal(plan.snapshot.sources.length,0);assert.equal(plan.serverEligible,false);
const review={context:ctx,snapshot:plan.snapshot,catalog:rows,protection,connection:{provider:'fixture',model:'auto'},generatedAt:'2026-11-02T00:00:00Z'};
const proposal=await I.createDerivedProposal(query,output,plan,review);
assert.equal(proposal.documents.length,1);const doc=proposal.documents[0].document;
assert.equal(doc.approvals.length,0);assert.equal(doc.drafts[0].evidence_manifest.length,2);assert.equal(doc.drafts[0].citations[0].quote,first.draft.sections[0].markdown);
await I.verifyProposal(proposal,review);
const altered=clone(output);altered.citations[0].quote='Invented';await assert.rejects(()=>I.createDerivedProposal(query,altered,plan,review));
const protectedQuery=clone(selected);protectedQuery.nodes[0].protected=true;
const memory=await box.NowWikiQuery.selectWikiContext('Alpha',protectedQuery,{wiki_ids:[first.wiki_id],related_limit:0});
await assert.rejects(()=>I.planDerivedWiki(memory,rows,{context:ctx,reservation,protection}),/wiki_query_protected/);
const unproved=clone(protection);unproved.nodes[1].complete=false;
await assert.rejects(()=>I.planDerivedWiki(query,rows,{context:ctx,reservation,protection:unproved}),/wiki_dependency_unverified/);
const serverRows=rows.map((row,n)=>({...clone(row),origin:'server',headRevisionId:id(600+n),headVersion:1,indexVersion:1}));
const serverQuery=await box.NowWikiQuery.selectWikiContext('Alpha',{...clone(selected),nodes:selected.nodes.map(n=>({...clone(n),origin:'server'}))},{wiki_ids:[first.wiki_id],related_limit:1});
const serverPlan=await I.planDerivedWiki(serverQuery,serverRows,{context:ctx,reservation,protection});
const serverOutput={...clone(output),query_hash:serverQuery.snapshot_hash},serverReview={...review,catalog:serverRows,device:ctx.device,snapshot:serverPlan.snapshot};
const serverProposal=await I.createDerivedProposal(serverQuery,serverOutput,serverPlan,serverReview),requests=await I.buildOperationRequests(serverProposal,serverReview);
assert.equal(requests.prepare.kind,'ingest');assert.equal(requests.prepare.schema_version,2);assert.equal(requests.prepare.inputs.length,2);
if(process.argv[2]){
  const code=`import sys,json
from app.schemas.wiki_operations import parse_prepare,CommitOperation
from app.schemas.wiki import WikiArtifactV2,digest
v=json.load(sys.stdin);p=parse_prepare(v['prepare']);c=CommitOperation.model_validate(v['commit'])
assert p.kind=='ingest' and p.schema_version==2 and len(p.inputs)==2
assert all(r.kind=='wiki' for r in p.inputs)
for row in c.documents:
 d=WikiArtifactV2.model_validate(row.document.model_dump() if hasattr(row.document,'model_dump') else row.document)
 assert len(d.drafts[0].evidence_manifest)==2 and not d.approvals
print('Existing Python v2 Query-derived ingest wire PASS')`;
  const result=spawnSync(process.argv[2],['-B','-c',code],{input:JSON.stringify(requests),encoding:'utf8',env:{...process.env,PYTHONPATH:fileURLToPath(new URL('../../server',import.meta.url)),PYTHONIOENCODING:'utf-8'}});
  assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
}
console.log('Explicit Query draft: no model call, all consumed Wiki dependencies, exact citations, unapproved v2 proposal and protection graph PASS');
