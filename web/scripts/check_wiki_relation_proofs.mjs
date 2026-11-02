import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,id,clone,safety} from './wiki_ingest_fixture.mjs';
import {documents,originals,operation,requests} from './check_wiki_graph.mjs';
const {box,I,P,W,selection}=await fixture();
vm.runInContext(await fs.readFile(new URL('../vendor/wiki-server-access.js',import.meta.url),'utf8'),box);
assert.equal(typeof I.verifyCarriedRelation,'function','approved relation inheritance must verify the original operation');
const relation=documents[0].drafts[0].relations[0],proof={operation:clone(operation),documents:clone(originals),currentTarget:clone(documents[1])};
const result=await I.verifyCarriedRelation(documents[0],relation,proof,ctx);
assert.equal(result.draft.id,relation.to_ref.draft_id);
const before=P.canonicalJson(proof);
for(const mutate of [p=>p.operation.state='prepared',p=>p.operation.documents[0].draft_hash='a'.repeat(64),p=>p.operation.scope.owner='other',p=>p.documents[0].drafts[0].summary='Changed old result']){
  const wrong=clone(proof);mutate(wrong);await assert.rejects(()=>I.verifyCarriedRelation(documents[0],relation,wrong,ctx));
}
await assert.rejects(()=>I.verifyCarriedRelation(documents[0],{...clone(relation),confidence:'uncertain'},proof,ctx));
await assert.rejects(()=>I.verifyCarriedRelation(originals[0],relation,proof,ctx),'an unapproved source is not a parent');
const carried=clone(documents[0]),draft=clone(carried.drafts[0]);draft.id=id(91);draft.generation_id=id(92);draft.base_approved_revision_id=carried.approvals[0].id;
delete draft.draft_hash;draft.draft_hash=await P.hashJson(draft);carried.drafts.push(draft);carried.document_version++;
carried.approvals.push({schema_version:2,id:id(93),parent_approved_revision_id:carried.approvals[0].id,draft_id:draft.id,draft_hash:draft.draft_hash,
  evidence_manifest_hash:await P.hashJson(draft.evidence_manifest),approved_by:ctx.owner,approved_at:'2026-11-02T00:00:00Z'});carried.document_version++;
await W.validateDocument(carried,ctx);
assert.equal((await I.verifyCarriedRelation(carried,relation,proof,ctx)).draft.id,relation.to_ref.draft_id,'multiple generations keep exact original target');
assert.equal(P.canonicalJson(proof),before,'proof validation never rewrites original records');
const manifest=clone(requests.prepare),receipt={status:'ok',wiki_operation:true,operation_id:manifest.operation_id,manifest_hash:manifest.manifest_hash,state:'committed',pages:manifest.changes.map((c,n)=>({
  status:'ok',wiki_operation:true,operation_id:manifest.operation_id,manifest_hash:manifest.manifest_hash,wiki_id:c.wiki_id,mutation_id:c.note_mutation_id,
  result_revision_id:id(500+n),result_head_version:c.base_head_version+1,result_inventory_revision_ids:[id(500+n)],crypto_epoch:0,history_generation:1,
  document_version:c.base_document_version+1,index_version:c.base_index_version+1,document_schema_floor:2,result_document_hash:c.result_document_hash}))};
const remote={...clone(proof),operation:{status:'ok',operation_id:manifest.operation_id,state:'committed',manifest_hash:manifest.manifest_hash,manifest,receipt}};
assert.equal((await I.verifyCarriedRelation(documents[0],relation,remote,ctx)).draft.id,relation.to_ref.draft_id);
remote.operation.receipt.pages=[];
await assert.rejects(()=>I.verifyCarriedRelation(documents[0],relation,remote,ctx),'remote committed state alone is not an original receipt');
for(const name of ['note-history-state','wiki-evidence'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
const localContext={...ctx,enabled:true,online:false};let writes=0;
const history=box.NowNoteHistory.create({context:()=>localContext,write:async()=>{writes++;},request:async()=>{throw Error('unexpected network');}});
const now='2026-11-02T00:00:00.000000Z';
for(let n=0;n<2;n++){
  const original=originals[n],note={id:null,owner_id:ctx.owner,device_id:ctx.device,local_id:'wiki:'+original.wiki_id,note_type:'tree',title:'Wiki',content:P.canonicalJson(original),source:'wiki-artifact',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
  await history.track(note,null,{localOnly:true});await history.seal(note.local_id);
  await history.edit({...note,content:P.canonicalJson(documents[n])});await history.seal(note.local_id);
}
let blocked=false;
const evidence=box.NowWikiEvidence.create({context:()=>localContext,contextKey:()=>JSON.stringify(localContext),history:()=>history,readOperations:async()=>[operation],lifecycle:{state:()=>null,blocked:()=>blocked}});
assert.equal(typeof evidence.operationProof,'function','read-only retained operation resolver required');
const count=writes,retained=await evidence.operationProof(operation.operation_id,documents[0].wiki_id,documents[1].wiki_id,{origin:'local'});
assert.equal((await I.verifyCarriedRelation(documents[0],relation,retained,ctx)).draft.id,relation.to_ref.draft_id);assert.equal(writes,count,'proof lookup never writes a cache');
blocked=true;await assert.rejects(()=>evidence.operationProof(operation.operation_id,documents[0].wiki_id,documents[1].wiki_id,{origin:'local'}),'pending lifecycle cannot supply an inherited relation');blocked=false;
const snapshot=await I.captureWikiSources([selection[0]],ctx),catalog=documents.map((document,n)=>({document,origin:'server',headRevisionId:id(700+n),headVersion:2,indexVersion:2,safety:clone(safety)}));
const reservation={operation_id:id(900),mutation_id:id(901),commit_mutation_id:id(902),abort_mutation_id:id(903),pages:[{wiki_id:documents[0].wiki_id,draft_id:id(904),generation_id:id(905),note_mutation_id:id(906)}]};
const protection={nodes:documents.map(d=>({wiki_id:d.wiki_id,dependencies:[],complete:true}))};
const plan=await I.planIngest(snapshot,catalog,{context:ctx,reservation,policy:2,protection}),parent=documents[0].drafts[0];
const page={wiki_id:documents[0].wiki_id,draft_id:id(904),...Object.fromEntries(['title','topic','page_type','summary','aliases','sections','claims','relations','citations'].map(key=>[key,clone(parent[key])]))};
const review={context:ctx,snapshot,catalog,protection,connection:{provider:'fixture',model:'no-call'},generatedAt:'2026-11-02T00:00:00Z'};
let lookups=0;
const proposal=await I.validateIngestProposal({pages:[page]},plan,{...review,relationProof:async()=>{lookups++;return proof;}});
assert.equal(proposal.documents[0].document.drafts.at(-1).relations[0].to_ref.operation_id,operation.operation_id);
assert.equal(lookups,1,'the proposal actually consumes the verified original operation');
await assert.rejects(()=>I.validateIngestProposal({pages:[page]},plan,review),'missing original proof does not silently inherit');
console.log('Carried relation proof: original committed binding, approved ancestor, immutable relation and exact target PASS (synthetic only)');
