import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol','note-history-state','wiki-state','wiki-ingest','wiki-sources','wiki-lifecycle','wiki-notebook','wiki-evidence','wiki-ingest-notebook']){
  try{vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);}
  catch(e){if(e.code==='ENOENT'&&name==='wiki-ingest-notebook')continue;throw e;}
}
assert.equal(typeof box.createWikiIngestNotebook,'function','durable Wiki ingest adapter must exist');
let ctx={url:'',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:false},saved=null,writes=0,calls=0,fail=false,generation=0;
const makeHistory=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,write:async value=>{if(fail)throw Error('quota');saved=structuredClone(value);writes++;},request:async()=>{throw Error('unexpected upload');}});
let history=makeHistory();
const api={context:()=>ctx,contextKey:()=>JSON.stringify([ctx,generation]),history:()=>history,viewGeneration:()=>generation,
  captureNotes:async()=>{throw Error('not selected');},sourceSafety:async()=>({status:'ok',epoch:0,lineage:false,fence:false}),
  source:id=>{const item=history.view(id);return item?{owner:ctx.owner,localId:id,status:'ok',origin:'local',title:item.draft.title,content:item.draft.content,revisionId:null,headVersion:0}:null;},
  listRemote:async()=>[],readRemote:async()=>{throw Error('unexpected');}};
api.lifecycle=box.NowWikiLifecycle.create(api);
api.sources=box.NowNoteWikiSources.create(api);
await api.sources.captureFiles([{name:'source.md',arrayBuffer:async()=>new TextEncoder().encode('Exact ingest evidence.').buffer}]);
let book=box.createWikiIngestNotebook(api);const source=(await api.sources.list())[0];
const operation=await book.plan({fileIds:[source.id],noteIds:[]});
assert.equal(operation.plan.calls,1);assert.equal(operation.plan.serverEligible,false);
assert.equal((await book.operations()).length,1);assert.equal((await book.operations())[0].state,'reserved');
const prompt=JSON.parse(book.prompt(operation));assert.equal(prompt.input.sources[0].content,'Exact ingest evidence.');
const output=JSON.stringify({pages:operation.plan.pages.map(p=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:'source.md',topic:'source.md',page_type:'concept',summary:'Synthetic',aliases:[],
  sections:[{id:'s1',title:'Finding',markdown:'Synthetic finding.',citation_ids:['c1']}],claims:[],relations:[],citations:[{id:'c1',evidence_id:source.id,section_id:null,quote:'Exact ingest evidence.'}]}))});
const connection={provider:'fixture',model:'Combo/auto',invoke:async()=>{calls++;return output;}};
const proposal=await book.generate(operation,connection);assert.equal(calls,1);
assert.equal((await book.operations())[0].state,'attempted');assert.equal(Object.values(history.entries()).filter(r=>r.draft.source==='wiki-artifact').length,0);
const missingPending=structuredClone(saved);delete missingPending.contexts[box.NowNoteHistory.key(ctx)].wiki_ingest_operations;
assert.throws(()=>history.validateImport(missingPending),/위키.*작업/,'backup cannot discard a one-attempt durable reservation');
assert.throws(()=>box.NowNoteWiki.sourceProtectionDependencies([history.export()],ctx,source.manifest.note_ref.local_id),/wiki_ingest_pending/);
await assert.rejects(()=>book.generate(operation,connection),/한 번|시도/);assert.equal(calls,1);
const before=JSON.stringify(saved);fail=true;await assert.rejects(()=>book.commitLocal(proposal),/quota/);assert.equal(JSON.stringify(saved),before);fail=false;
const writesBefore=writes,result=await book.commitLocal(proposal);assert.equal(writes,writesBefore+1,'all documents and operation completion in one CAS');
assert.equal(result.documents.length,1);assert.equal((await book.operations())[0].state,'committed');
assert.equal(result.documents[0].document.approvals.length,0,'generation and draft commit never approve');
const row=history.view('wiki:'+result.documents[0].wiki_id);assert.equal(row.localOnly,true);assert.equal(row.revisions.length,1);
const ordinary=box.createWikiNotebook(api),listed=await ordinary.list();assert.equal(listed[0].document?.schema_version,2,'v2 committed draft must be readable through existing notebook');
assert.equal((await ordinary.sourceStatus(result.documents[0].document.drafts[0],result.documents[0].document)).available,true);
assert.deepEqual(Array.from(box.NowNoteWiki.sourceProtectionDependencies([history.export()],ctx,source.manifest.note_ref.local_id)),['wiki:'+result.documents[0].wiki_id]);
assert.equal(box.NowNoteWiki.sourceProtectionDependencies([history.export()],ctx,'unrelated').length,0);
assert.equal(JSON.stringify(saved.contexts[box.NowNoteHistory.key(ctx)].wiki_ingest_operations).includes('Synthetic finding.'),false);
history=makeHistory();book=box.createWikiIngestNotebook(api);assert.equal((await book.operations())[0].operation_id,operation.operation_id);
assert.equal(history.view('wiki:'+result.documents[0].wiki_id).draft.content,row.draft.content);
ctx={...ctx,owner:'bob'};assert.equal((await book.operations()).length,0);ctx={...ctx,owner:'alice'};
const noOp=await book.plan({fileIds:[source.id],noteIds:[]});assert.equal(noOp.plan.calls,0);assert.equal(calls,1);
const remoteWiki=webcrypto.randomUUID(),link={artifact_local_id:'wiki:'+remoteWiki,dependencies:[source.manifest.note_ref],wiki_dependencies:[],document_schema_floor:2};
link.lineage_manifest_hash=await box.NowNoteProtectionProtocol.hashJson(link);
await api.lifecycle.observe([{id:remoteWiki,owner_id:ctx.owner,schema_version:2,version:1,deleted_at:null,payload:link}]);
assert.equal(api.lifecycle.state('wiki:'+remoteWiki).version,1,'existing lifecycle must consume strict v2 index');
const doc=result.documents[0].document,draft=doc.drafts[0],beforeApproval=JSON.stringify(saved);fail=true;
await assert.rejects(()=>book.approveLocal(doc,draft.id),/quota/);assert.equal(JSON.stringify(saved),beforeApproval);fail=false;
const approvalWrites=writes,approved=await book.approveLocal(doc,draft.id);assert.equal(writes,approvalWrites+1);
assert.equal(approved.document.approvals.length,1);assert.equal(approved.document.approvals[0].schema_version,2);
assert.equal(history.view('wiki:'+doc.wiki_id).revisions.length,2);assert.equal(calls,1);
await assert.rejects(()=>book.approveLocal(doc,draft.id),/판본|충돌/);
assert.equal((await book.plan({fileIds:[source.id],noteIds:[]})).plan.calls,0,'own explicit approval does not force unchanged sources through the model again');
await api.sources.captureFiles([{name:'second.txt',arrayBuffer:async()=>new TextEncoder().encode('Second exact evidence.').buffer}]);
const second=(await api.sources.list()).find(s=>s.title==='second.txt');
const reserved=await book.plan({fileIds:[second.id],noteIds:[]});generation++;
await assert.rejects(()=>book.generate(reserved,connection),/context|상태|계정|판본|작업/,'old plan cannot invoke after view context changes');
assert.equal(calls,1);assert.equal((await book.operations()).find(r=>r.operation_id===reserved.operation_id).state,'reserved');
const archivedReservation=structuredClone(saved);saved.recovery_archives=[archivedReservation];
history=makeHistory();book=box.createWikiIngestNotebook(api);
const resumed=await book.resumeLocal(reserved.operation_id);assert.equal(resumed.operation_id,reserved.operation_id);
assert.equal((await book.operations()).find(r=>r.operation_id===reserved.operation_id).state,'reserved','archived pre-dispatch reservation must not conflict with explicit cold resume');
assert.deepEqual(JSON.parse(JSON.stringify(resumed.plan.reservation)),JSON.parse(JSON.stringify(reserved.plan.reservation)));
let brokenCalls=0;
await assert.rejects(()=>book.generate(resumed,{provider:'fixture',model:'bad-json',invoke:async()=>{brokenCalls++;return '{broken';}}));
history=makeHistory();book=box.createWikiIngestNotebook(api);
const attempted=await book.resumeLocal(reserved.operation_id);assert.equal(attempted.state,'attempted');assert.equal(attempted.plan,null);
await assert.rejects(()=>book.generate(resumed,connection));assert.equal(calls,1);assert.equal(brokenCalls,1);
await book.abortLocal(reserved.operation_id);assert.equal((await book.resumeLocal(reserved.operation_id)).state,'aborted');
const noteId='synthetic-note',noteBefore=history.export(),noteNext=structuredClone(noteBefore),now='2026-11-01T00:00:00.000000Z';
const note={id:null,owner_id:ctx.owner,local_id:noteId,device_id:ctx.device,note_type:'tree',title:'NowNote evidence',content:'Exact NowNote evidence.',source:'manual',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
const staged=await box.NowNoteHistory.prepareExternalEdit(noteNext,ctx,note,{newNote:true,localOnly:true});
noteNext.contexts[box.NowNoteHistory.key(ctx)].notes[noteId]=staged.next;
await history.replaceProtectionStore(noteBefore,noteNext,{active:()=>true});api.captureNotes=ids=>ordinary.capture(ids);
const multi=await book.plan({fileIds:[second.id],noteIds:[noteId]});assert.equal(multi.plan.pages.length,2);
const multiOutput=JSON.stringify({pages:multi.plan.pages.map((p,i)=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:'Multi '+i,topic:'Multi '+i,page_type:'concept',summary:'Synthetic',aliases:[],
  sections:[{id:'s1',title:'Evidence',markdown:'Synthetic finding',citation_ids:['c1']}],claims:[],relations:[],
  citations:[{id:'c1',evidence_id:multi.plan.snapshot.sources[i].id,section_id:null,quote:multi.plan.snapshot.sources[i].content}]}))});
const multiProposal=await book.generate(multi,{provider:'fixture',model:'two-pages',invoke:async()=>multiOutput});
const beforeMulti=JSON.stringify(saved);fail=true;await assert.rejects(()=>book.commitLocal(multiProposal),/quota/);assert.equal(JSON.stringify(saved),beforeMulti);fail=false;
const multiWrites=writes,multiResult=await book.commitLocal(multiProposal);assert.equal(writes,multiWrites+1);assert.equal(multiResult.documents.length,2);
for(const entry of multiResult.documents)assert.equal(entry.document.drafts[0].evidence_manifest.length,2,'uncited transmitted input is still retained');
const rejected=await book.rejectLocal(multiResult.documents[0].document,multiResult.documents[0].document.drafts[0].id);
assert.equal(rejected.document.rejected_draft_ids.length,1);assert.equal(rejected.document.approvals.length,0);
const intact=structuredClone(saved),protectedArchive=structuredClone(saved);delete protectedArchive.recovery_archives;
protectedArchive.contexts[box.NowNoteHistory.key(ctx)].notes[second.manifest.note_ref.local_id].base.crypto_epoch=1;
saved.recovery_archives.push(protectedArchive);history=makeHistory();book=box.createWikiIngestNotebook(api);
await assert.rejects(()=>book.plan({fileIds:[second.id],noteIds:[]}),/보호|lineage|전환/,'archived protection lineage cannot be hidden by a plain current source');
saved=intact;history=makeHistory();
book=box.createWikiIngestNotebook(api);
await api.sources.captureFiles([{name:'source.md',arrayBuffer:async()=>new TextEncoder().encode('Changed comparison evidence.').buffer},
  {name:'unrelated-new.txt',arrayBuffer:async()=>new TextEncoder().encode('New unrelated evidence.').buffer}]);
const comparisonFiles=await api.sources.list(),comparison=comparisonFiles.find(s=>s.content==='Changed comparison evidence.'),unrelated=comparisonFiles.find(s=>s.title==='unrelated-new.txt');
const combined=await book.plan({fileIds:[comparison.id,unrelated.id],noteIds:[]});assert.equal(combined.plan.policy,2);assert.equal(combined.plan.pages.length,2);
assert.equal(combined.plan.inputs.filter(r=>r.kind==='wiki').length,1,'validated comparison is now part of durable operation inputs');
assert.equal(combined.plan.protection.nodes[0].complete,true,'temporary blanket gate is replaced only by complete source and cycle proof');
const combinedOutput={pages:combined.plan.pages.map((p,i)=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:combined.plan.snapshot.sources[i].title,
  topic:combined.plan.snapshot.sources[i].title,page_type:'concept',summary:'Synthetic comparison',aliases:[],claims:[],relations:[],
  sections:[{id:'s1',title:'Evidence',markdown:'Compared synthetic evidence.',citation_ids:['c1']}],
  citations:[{id:'c1',evidence_id:combined.plan.snapshot.sources[i].id,section_id:null,quote:combined.plan.snapshot.sources[i].content}]}))};
const compared=await book.generate(combined,{provider:'fixture',model:'comparison',invoke:async()=>JSON.stringify(combinedOutput)});
const comparedResult=await book.commitLocal(compared),beta=comparedResult.documents.find(r=>r.wiki_id!==combined.plan.targets[0].document.wiki_id);
assert.equal((await ordinary.sourceStatus(beta.document.drafts[0],beta.document)).available,true,'retained Wiki comparison must remain readable after its container advances');
const betaApproved=await book.approveLocal(beta.document,beta.document.drafts[0].id);
assert.equal(betaApproved.document.approvals.length,1,'a Wiki comparison is a valid approval source, not a Note-only source');
history=makeHistory();book=box.createWikiIngestNotebook(api);
assert.equal(box.NowNoteProtectionProtocol.parseJson(history.view('wiki:'+beta.wiki_id).draft.content).approvals.length,1,'comparison approval survives a cold journal');
assert.equal((await book.plan({fileIds:[comparison.id,unrelated.id],noteIds:[]})).plan.calls,0,'own comparison approval does not regenerate unchanged inputs');
const alpha=comparedResult.documents.find(r=>r.wiki_id===combined.plan.targets[0].document.wiki_id);
await book.approveLocal(alpha.document,alpha.document.drafts.at(-1).id);
const staleBeta=await ordinary.sourceStatus(beta.document.drafts[0],betaApproved.document);
assert.equal(staleBeta.available,true);assert.equal(staleBeta.stale,true,'a changed approval is stale without rewriting the original Wiki reference');
const retainedPlain=structuredClone(saved),oldProtected=structuredClone(saved);delete oldProtected.recovery_archives;
oldProtected.contexts[box.NowNoteHistory.key(ctx)].notes['wiki:'+alpha.wiki_id].base.crypto_epoch=1;
saved.recovery_archives.push(oldProtected);history=makeHistory();
assert.equal((await ordinary.sourceStatus(beta.document.drafts[0],betaApproved.document)).available,false,'protected retained comparison cannot be hidden by a plain current representation');
saved=retainedPlain;history=makeHistory();
vm.runInContext(await fs.readFile(new URL('../vendor/wiki-graph.js',import.meta.url),'utf8'),box);
api.readOperations=()=>book.operations();
assert.equal(typeof ordinary.approvedCatalog,'function','verified notebook must expose an ephemeral approved catalog');
const catalogWrites=writes,approvedCatalog=await ordinary.approvedCatalog();
assert.equal(approvedCatalog.nodes.length,2);assert.equal(writes,catalogWrites,'catalog reads do not persist an index');
assert.ok(approvedCatalog.nodes.find(n=>n.wiki_id===beta.wiki_id).stale,'catalog preserves changed comparison status');
console.log('Wiki ingest notebook: durable IDs before invoke, one attempt, explicit draft save, single local CAS, quota rollback, cold/scope/no-op PASS (synthetic provider only)');
