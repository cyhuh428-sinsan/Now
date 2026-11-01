import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,clone,id,safety} from './wiki_ingest_fixture.mjs';
const {box,P,W,I,catalog}=await fixture();
for(const name of ['note-history-state','wiki-evidence','wiki-notebook','wiki-graph','wiki-query'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
assert.equal(typeof box.NowWikiEvidence.create({}).protection,'function','a retained unapproved v2 document needs full provenance and dependency proof before protection');
for(const name of ['wiki-sources','wiki-lifecycle','wiki-ingest-notebook'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
let context={url:'',owner:'alice',device:'one',enabled:true,online:false},saved=null,writes=0,generation=0;
const history=box.NowNoteHistory.create({context:()=>context,write:async value=>{saved=clone(value);writes++;},request:async()=>{throw Error('no HTTP');}});
let ingest;
const api={context:()=>context,contextKey:()=>JSON.stringify([context,generation]),history:()=>history,viewGeneration:()=>generation,
  listRemote:async()=>[],readRemote:async()=>{throw Error('no HTTP');},sourceSafety:async()=>clone(safety),
  captureNotes:async()=>{throw Error('no selected Notes');},
  source:local=>{const item=history.view(local);return item?{owner:context.owner,localId:local,status:'ok',origin:'local',title:item.draft.title,content:item.draft.content,revisionId:null,headVersion:0}:null;},
  readOperations:()=>ingest.operations(),approveV2:(doc,draft)=>ingest.approveLocal(doc,draft)};
api.lifecycle=box.NowWikiLifecycle.create(api);api.sources=box.NowNoteWikiSources.create(api);
ingest=box.createWikiIngestNotebook(api);
await api.sources.captureFiles([{name:'source.md',arrayBuffer:async()=>new TextEncoder().encode('Exact protection evidence.').buffer}]);
const source=(await api.sources.list())[0],operation=await ingest.plan({fileIds:[source.id],noteIds:[]});
const output={pages:operation.plan.pages.map(p=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:'Alpha',topic:'Alpha',page_type:'concept',summary:'Synthetic',aliases:[],
  sections:[{id:'s1',title:'Finding',markdown:'Exact protection evidence.',citation_ids:['c']}],claims:[],relations:[],citations:[{id:'c',evidence_id:source.id,section_id:null,quote:'Exact protection evidence.'}]}))};
const proposal=await ingest.generate(operation,{provider:'fixture',model:'auto',invoke:async()=>JSON.stringify(output)});
const created=(await ingest.commitLocal(proposal)).documents[0].document;
const book=box.createWikiNotebook(api);
const before=JSON.stringify(history.export()),beforeWrites=writes;
assert.deepEqual(Array.from(await book.protectionDependencies([history.export()],context,source.manifest.note_ref.local_id)),['wiki:'+created.wiki_id]);
assert.equal(JSON.stringify(history.export()),before);assert.equal(writes,beforeWrites);
const approved=await ingest.approveLocal(created,created.drafts[0].id);
const selected=await box.NowWikiQuery.selectWikiContext('Alpha',await book.approvedCatalog(),{wiki_ids:[created.wiki_id],related_limit:0});
const page=selected.pages[0],answer={query_hash:selected.snapshot_hash,title:'Derived',claims:[{id:'a',statement:'Synthetic',assessment:'inferred',citation_ids:['c']}],
  citations:[{id:'c',wiki_id:page.wiki_id,draft_id:page.draft_id,approval_id:page.approval_id,draft_hash:page.draft_hash,document_version:page.document_version,section_id:'s1',quote:page.draft.sections[0].markdown}],uncertainties:[]};
const derived=(await ingest.commitLocal(await ingest.derive(selected,answer,{provider:'fixture',model:'auto'}))).documents[0].document;
const original=clone(history.export()),originalWrites=writes;
assert.throws(()=>W.sourceProtectionDependencies([original],context,'wiki:'+created.wiki_id),/wiki_protection_dependency_check/,'the raw scan still refuses unresolved Wiki evidence');
assert.deepEqual(Array.from(await book.protectionDependencies([original],context,'wiki:'+created.wiki_id)),['wiki:'+derived.wiki_id]);
assert.deepEqual(Array.from(await book.protectionDependencies([original],context,'wiki:'+derived.wiki_id)),[],'an unapproved but committed derived draft can be protected first');
assert.deepEqual(Array.from(await book.protectionDependencies([{settings:{synthetic:true}},original,{tree:[]}],context,'wiki:'+created.wiki_id)),['wiki:'+derived.wiki_id],'registered non-history stores are scanned without misclassifying their format as a journal');
assert.equal(writes,originalWrites);assert.equal(JSON.stringify(history.export()),JSON.stringify(original));
const account=box.NowNoteHistory.key(context),unknown=clone(original);
delete unknown.contexts[account].wiki_ingest_operations;
history.hydrate(unknown);
await assert.rejects(()=>book.protectionDependencies([unknown],context,'wiki:'+derived.wiki_id),/wiki_dependency_unverified/);
history.hydrate(original);
const corrupt=clone(original);corrupt.contexts[account].notes['wiki:'+derived.wiki_id].revisions[0].snapshot.note.content='{broken';
await assert.rejects(()=>book.protectionDependencies([corrupt],context,'wiki:'+derived.wiki_id));
const pending=clone(original),row=Object.values(pending.contexts[account].wiki_ingest_operations).find(row=>row.inputs.some(r=>r.kind==='wiki'));
row.state='attempted';
await assert.rejects(()=>book.protectionDependencies([pending],context,'wiki:'+derived.wiki_id),/wiki_ingest_dependency_check/);
await assert.rejects(()=>book.protectionDependencies([original],{...context,owner:'other'},'wiki:'+derived.wiki_id),/wiki_context_changed/);
generation++;assert.equal(writes,originalWrites);
const serverRoot=clone(original),remoteDocs=new Map(),remoteOperations=new Map();
for(const item of Object.values(serverRoot.contexts[account].notes))if(item.draft.source==='wiki-artifact'){
  item.localOnly=false;
  const doc=await W.validateDocument(item.draft.content,context),historyRows=[];
  for(const revision of item.revisions)historyRows.push({revision_ref:{kind:'note_revision',id:box.crypto.randomUUID()},snapshot:clone(revision.snapshot)});
  if(!historyRows.some(r=>r.snapshot.note.content===item.draft.content))historyRows.push({revision_ref:{kind:'note_revision',id:box.crypto.randomUUID()},snapshot:{note:clone(item.draft)}});
  const head=historyRows.findLast(r=>r.snapshot.note.content===item.draft.content).revision_ref.id;
  const link={artifact_local_id:item.draft.local_id,dependencies:[clone(source.manifest.note_ref)],document_schema_floor:2,wiki_dependencies:[]};
  link.lineage_manifest_hash=await P.hashJson(link);
  remoteDocs.set(doc.wiki_id,{doc,history:historyRows,head,link,entries:[]});
}
for(const row of Object.values(original.contexts[account].wiki_ingest_operations)){
  if(!['ingest','integrate'].includes(row.action))continue;
  const changes=[],pages=[],bindings=[];
  for(const output of row.documents){
    const entry=remoteDocs.get(output.wiki_id),result=await Promise.all(entry.history.map(async r=>({row:r,doc:await W.validateDocument(r.snapshot.note.content,context)})));
    let fixed;for(const value of result)if(await P.hashJson(value.doc)===output.document_hash)fixed=value;
    assert.ok(fixed);
    changes.push({wiki_id:output.wiki_id,action:'create_draft',result_document_hash:output.document_hash});
    pages.push({wiki_id:output.wiki_id,result_revision_id:fixed.row.revision_ref.id});
    bindings.push({wiki_id:output.wiki_id,draft_id:output.draft_id,draft_hash:output.draft_hash});
  }
  const manifest={owner_id:context.owner,operation_id:row.operation_id,kind:'ingest',inputs:clone(row.inputs),changes,draft_bindings:bindings},hash=await P.hashJson(manifest);
  remoteOperations.set(row.operation_id,{state:'committed',manifest_hash:hash,manifest,receipt:{pages}});
  for(const output of row.documents){const page=pages.find(p=>p.wiki_id===output.wiki_id);remoteDocs.get(output.wiki_id).entries.push({draft_id:output.draft_id,draft_hash:output.draft_hash,operation_id:row.operation_id,manifest_hash:hash,result_revision_id:page.result_revision_id,result_document_hash:output.document_hash});}
}
history.hydrate(serverRoot);let operationReads=0;
const serverApi={...api,server:{
  inspect:async local=>{if(local===source.manifest.note_ref.local_id)return {instance:id(991)};const value=remoteDocs.get(local.slice(5));assert.ok(value);return {instance:id(991),history:clone(value.history),current:{head_revision_id:value.head,snapshot:{note:clone(history.view(local).draft)}}};},
  readOperation:async operation=>{operationReads++;return clone(remoteOperations.get(operation));}
},readRemote:async wiki=>{const value=remoteDocs.get(wiki);return {resource:{owner_id:context.owner,id:wiki,payload:clone(value.link)},artifact:{protected:false,head_revision_id:value.head,document:clone(value.doc),generation_provenance:{schema_version:1,entries:clone(value.entries)}}};}};
const serverEvidence=box.NowWikiEvidence.create(serverApi);
const serverDoc=remoteDocs.get(derived.wiki_id).doc;
// The Wiki source uses a local pinned reference; this transport fixture only tests root generation receipts.
const baseDoc=remoteDocs.get(created.wiki_id).doc;
await serverEvidence.protection([baseDoc],{roots:[serverRoot],instance:id(991)});assert.ok(operationReads>0,'remote proof must not trust a retained local operation in place of the original server receipt');
const entry=remoteDocs.get(created.wiki_id).entries[0],remote=remoteOperations.get(entry.operation_id),receipt=clone(remote.receipt);
remote.receipt.pages=[];await assert.rejects(()=>serverEvidence.protection([baseDoc],{roots:[serverRoot],instance:id(991)}),/wiki_provenance_invalid/);remote.receipt=receipt;
remote.state='prepared';await assert.rejects(()=>serverEvidence.protection([baseDoc],{roots:[serverRoot],instance:id(991)}),/wiki_provenance_invalid/);remote.state='committed';
const entries=remoteDocs.get(created.wiki_id).entries;remoteDocs.get(created.wiki_id).entries=[];
await assert.rejects(()=>serverEvidence.protection([baseDoc],{roots:[serverRoot],instance:id(991)}),/wiki_dependency_unverified/);remoteDocs.get(created.wiki_id).entries=entries;
history.hydrate(original);
const derivedApproved=(await ingest.approveLocal(derived,derived.drafts[0].id)).document,later=clone(derived);
later.wiki_id=created.wiki_id;later.document_version=JSON.parse(history.view('wiki:'+created.wiki_id).draft.content).document_version+1;
const next=later.drafts[0],target=derivedApproved.drafts[0],approval=derivedApproved.approvals.at(-1);
next.id=id(981);next.generation_id=id(982);next.evidence_manifest[0]={...next.evidence_manifest[0],wiki_id:derived.wiki_id,draft_id:target.id,
  approval_id:approval.id,document_version:derivedApproved.document_version,content_hash:target.draft_hash};
next.citations[0].section_id=target.sections[0].id;next.citations[0].quote=target.sections[0].markdown;delete next.draft_hash;next.draft_hash=await P.hashJson(next);
await W.validateDocument(later,context);
const changed=clone(history.view('wiki:'+created.wiki_id).draft);changed.content=P.canonicalJson(later);await history.edit(changed);await history.seal(changed.local_id);
await assert.rejects(()=>box.NowWikiEvidence.create(api).protection([later],{roots:[history.export()]}),/wiki_protection_cycle/,'even an acyclic version history must not introduce a Wiki-level protection cycle');
history.hydrate(original);
for(const file of ['../app.js','../../desktop/app/app.js']){
  const sourceText=await fs.readFile(new URL(file,import.meta.url),'utf8'),start=sourceText.indexOf('preflight: async scope => {'),end=sourceText.indexOf('\n    },\n    change:',start);
  assert.ok(start>=0&&end>start);let value={synthetic:1},mutate=false,proofCalls=0;
  const sandbox=vm.createContext({NowNoteProtectionProtocol:P,elements:{},isEditorComposing:()=>false,noteHistoryCaptureChain:Promise.resolve(),storagePendingWrites:[],
    serverSyncRunning:false,noteHistory:{legacyPending:()=>false,failure:()=>null},noteHistoryTimers:new Map(),window:{clearTimeout:()=>{}},serverSyncTimer:null,
    protectionStorageAdapters:()=>[{read:async()=>clone(value)}],wikiNotebook:{protectionDependencies:async()=>{proofCalls++;if(mutate)value.synthetic++;return [];}}});
  vm.runInContext('globalThis.preflight='+sourceText.slice(start+'preflight: '.length,end)+'};',sandbox);
  await sandbox.preflight({local_id:'synthetic'});assert.equal(proofCalls,1);
  mutate=true;await assert.rejects(()=>sandbox.preflight({local_id:'synthetic'}),/보관 사본/);
}
console.log('Wiki protection preflight: actual local Ingest/Query journals, unapproved derived draft, full dependency order, missing provenance/pending/damaged/foreign fail closed and zero writes PASS');
