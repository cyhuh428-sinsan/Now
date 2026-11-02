import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol','note-history-state','wiki-state','wiki-ingest','wiki-sources','wiki-lifecycle','wiki-notebook','wiki-server-access','wiki-evidence','wiki-ingest-notebook','wiki-graph'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
const P=box.NowNoteProtectionProtocol,instance=webcrypto.randomUUID(),sourceId='server-source',revision=webcrypto.randomUUID();
const ctx={url:'https://synthetic.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true};
const now='2026-11-01T00:00:00.000000Z',source={id:1,owner_id:ctx.owner,local_id:sourceId,device_id:ctx.device,note_type:'tree',title:'Server evidence',content:'Exact remote evidence.',source:'manual',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
const makeCurrent=(note,id,version=1)=>({status:'ok',snapshot:{schema_version:1,note:structuredClone(note)},head_revision_id:id,head_version:version,crypto_epoch:0,history_generation:version,protection_state:'legacy',identity_state:'coherent',replica_count:1,inventory_revision_ids:[id],has_replica_variants:false});
const notes=new Map([[sourceId,makeCurrent(source,revision)]]),operations=new Map();let saved=null,history,writes=0,fail=false,posts=0,lost=false,prepareLost=false,withProvenance=false;
const representations=new Map([[revision,structuredClone(notes.get(sourceId))]]);
const createHistory=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,write:async value=>{if(fail)throw Error('quota');saved=structuredClone(value);writes++;},request:async()=>{throw Error('unexpected legacy write');}});
history=createHistory();await history.track(source,notes.get(sourceId));
const request=async(path,method,body)=>{
  if(method==='GET'){
    if(path==='/api/v1/server')return {status:'ok',capabilities:{wiki_document_schema:2,wiki_operations_v1:true,wiki_operation_manifest_schema:2}};
    const current=notes.get(body.local_id);
    if(path.endsWith('/crypto-transitions/status'))return {server_instance_id:instance,preparation_only:true,...Object.fromEntries(['head_revision_id','head_version','crypto_epoch','history_generation','protection_state','identity_state','inventory_revision_ids'].map(k=>[k,current[k]])),current_exists:true};
    if(path==='/api/v2/notes/current')return structuredClone(current);
    if(path==='/api/v2/notes/revisions')return {status:'ok',items:[...representations].filter(([,r])=>r.snapshot.note.local_id===body.local_id).map(([id])=>({revision_ref:{kind:'note_revision',id},representation_epoch:0})),next_cursor:null,crypto_epoch:0,history_generation:current.history_generation};
    if(path==='/api/v2/notes/revision')return {status:'ok',revision_ref:{kind:body.revision_kind,id:body.revision_id},snapshot:structuredClone(representations.get(body.revision_id).snapshot),crypto_epoch:0};
    const op=operations.get(path.split('/').at(-1));if(!op)throw Object.assign(Error('not_found'),{status:404});
    return {status:'ok',operation_id:op.manifest.operation_id,state:op.receipt.state,manifest_hash:op.manifest.manifest_hash,manifest:structuredClone(op.manifest),receipt:structuredClone(op.receipt)};
  }
  posts++;
  if(path.endsWith('/prepare')){
    if(prepareLost){prepareLost=false;throw Error('synthetic prepare response lost before receive');}
    const receipt={status:'ok',wiki_operation:true,operation_id:body.operation_id,manifest_hash:body.manifest_hash,state:'prepared',pages:[]};operations.set(body.operation_id,{manifest:structuredClone(body),receipt});return structuredClone(receipt);
  }
  const id=path.split('/').at(-2),op=operations.get(id),m=op.manifest;
  if(path.endsWith('/abort')){op.receipt={status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,state:'aborted',pages:[]};return structuredClone(op.receipt);}
  const pages=[];
  op.commit=structuredClone(body);
  for(const [index,entry]of body.documents.entries()){
    const c=m.changes[index],resultId=webcrypto.randomUUID(),local='wiki:'+entry.wiki_id,note={...source,id:index+2,local_id:local,title:'AI Wiki '+entry.wiki_id,content:P.canonicalJson(entry.document),source:'wiki-artifact'};
    notes.set(local,makeCurrent(note,resultId,c.base_head_version+1));
    representations.set(resultId,structuredClone(notes.get(local)));
    pages.push({status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,wiki_id:entry.wiki_id,mutation_id:c.note_mutation_id,result_revision_id:resultId,result_head_version:c.base_head_version+1,result_inventory_revision_ids:[resultId],crypto_epoch:0,history_generation:c.base_head_version+1,document_version:c.base_document_version+1,index_version:c.base_index_version+1,document_schema_floor:2,result_document_hash:c.result_document_hash});
  }
  op.receipt={status:'ok',wiki_operation:true,operation_id:id,manifest_hash:m.manifest_hash,state:'committed',pages};
  if(lost){lost=false;throw Error('synthetic response lost');}return structuredClone(op.receipt);
};
const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>history,viewGeneration:()=>0,request,
  source:id=>{const current=notes.get(id),note=current?.snapshot.note;return note&&!id.startsWith('wiki:')?{owner:ctx.owner,localId:id,status:'ok',origin:'server',title:note.title,content:note.content,revisionId:current.head_revision_id,headVersion:current.head_version}:null;},
  readCurrent:async id=>structuredClone(notes.get(id)),listRemote:async()=>[],readRemote:async id=>{
    const current=notes.get('wiki:'+id),document=P.parseJson(current.snapshot.note.content);
    const union=await box.NowNoteWikiIngest.dependencyUnion([document],{...ctx,serverInstance:instance,viewGeneration:0},{resolveWiki:ref=>{
      const row=[...representations.values()].find(value=>value.snapshot.note.local_id==='wiki:'+ref.wiki_id&&P.parseJson(value.snapshot.note.content).document_version===ref.document_version);
      return row?{document:P.parseJson(row.snapshot.note.content),safety:{status:'ok',epoch:0,lineage:false,fence:false}}:null;
    }});
    const payload={artifact_local_id:'wiki:'+id,dependencies:union.dependencies,wiki_dependencies:union.wiki_dependencies,document_schema_floor:2};payload.lineage_manifest_hash=await P.hashJson(payload);
    const entries=[];
    if(withProvenance)for(const op of operations.values()){
      const change=op.manifest.changes.find(c=>c.wiki_id===id&&['create_draft','append_draft'].includes(c.action));
      if(!change||op.receipt.state!=='committed')continue;
      const binding=op.manifest.draft_bindings.find(b=>b.wiki_id===id),page=op.receipt.pages.find(p=>p.wiki_id===id);
      entries.push({draft_id:binding.draft_id,draft_hash:binding.draft_hash,operation_id:op.manifest.operation_id,manifest_hash:op.manifest.manifest_hash,result_revision_id:page.result_revision_id,result_document_hash:change.result_document_hash});
    }
    return {resource:{id,owner_id:ctx.owner,schema_version:2,version:current.head_version,deleted_at:null,payload},artifact:{protected:false,head_revision_id:current.head_revision_id,document,...(withProvenance?{generation_provenance:{schema_version:1,entries}}:{})},source_status:{available:true,stale:false}};
  }};
api.lifecycle=box.NowWikiLifecycle.create(api);api.sources=box.NowNoteWikiSources.create(api);api.server=box.NowWikiServerAccess.create({...api,readWiki:api.readRemote});
const notebook=box.createWikiNotebook(api);api.captureNotes=ids=>notebook.capture(ids);
let book=box.createWikiIngestNotebook(api);assert.equal(typeof book.stageServer,'function','durable remote proposal staging required');
const plan=await book.plan({fileIds:[],noteIds:[sourceId]});assert.equal(plan.plan.context.serverInstance,instance);assert.equal(plan.plan.serverEligible,true);
const proposal=await book.generate(plan,{provider:'fixture',model:'Combo/auto',invoke:async()=>JSON.stringify({pages:plan.plan.pages.map(p=>({wiki_id:p.wiki_id,draft_id:p.draft_id,title:source.title,topic:source.title,page_type:'concept',summary:'Synthetic',aliases:[],claims:[],relations:[],sections:[{id:'s1',title:'Evidence',markdown:'Synthetic finding',citation_ids:['c1']}],citations:[{id:'c1',evidence_id:plan.plan.snapshot.sources[0].id,section_id:null,quote:source.content}]}))})});
const staged=await book.stageServer(proposal);assert.equal(posts,0);assert.equal(staged.remote.phase,'staged');
assert.equal(history.blocked('wiki:'+plan.plan.pages[0].wiki_id),true,'pending publication blocks ordinary writers');
await book.prepareServer(plan.operation_id);assert.equal(posts,1);lost=true;
await assert.rejects(()=>book.commitServer(plan.operation_id),/response lost/);assert.equal(posts,2);
const pendingLocal='wiki:'+plan.plan.pages[0].wiki_id;
await assert.rejects(()=>history.track(notes.get(pendingLocal).snapshot.note,notes.get(pendingLocal)),/위키.*원작업/);
assert.equal(history.manages(pendingLocal),false,'ordinary tracking cannot bypass explicit local settle');
assert.equal(box.createWikiIngestNotebook.blocks(history.export(),ctx),true,'general exports remain blocked while the remote operation is unresolved');
history=createHistory();book=box.createWikiIngestNotebook(api);
assert.equal((await book.statusServer(plan.operation_id)).remote.phase,'server_committed');assert.equal(posts,2,'status recovery never repeats a write');
const before=JSON.stringify(saved);fail=true;await assert.rejects(()=>book.applyServer(plan.operation_id),/quota/);assert.equal(JSON.stringify(saved),before);fail=false;
const beforeWrites=writes;await book.applyServer(plan.operation_id);assert.equal(writes,beforeWrites+1,'all local projection and receipt in one CAS');
assert.equal(history.blocked('wiki:'+plan.plan.pages[0].wiki_id),false);assert.equal((await book.operations())[0].state,'committed');
assert.equal(history.view('wiki:'+plan.plan.pages[0].wiki_id).localOnly,false);assert.equal(posts,2);
assert.equal(box.createWikiIngestNotebook.blocks(history.export(),ctx),false);
assert.equal(box.NowNoteWiki.sourceProtectionDependencies([history.export()],ctx,sourceId).length,2,'retained proposal and final document both remain protection dependencies');
const local='wiki:'+plan.plan.pages[0].wiki_id,doc=P.parseJson(history.view(local).draft.content),draft=doc.drafts[0];
let decision=await book.approveLocal(doc,draft.id);assert.equal(decision.pending,true,'remote approval is its own explicit durable operation');
assert.equal(P.parseJson(notes.get(local).snapshot.note.content).approvals.length,0,'staging a decision never silently publishes approval');
prepareLost=true;await assert.rejects(()=>book.prepareServer(decision.operation_id),/prepare response lost/);
const beforeAbsent=posts;assert.equal((await book.statusServer(decision.operation_id)).remote.phase,'prepare_absent');assert.equal(posts,beforeAbsent);
const fixedPrepare=(await book.operations()).find(o=>o.operation_id===decision.operation_id).remote.manifest;
await book.prepareServer(decision.operation_id);assert.equal(operations.get(decision.operation_id).manifest.mutation_id,fixedPrepare.mutation_id);
await book.abortServer(decision.operation_id);assert.equal((await book.statusServer(decision.operation_id)).state,'aborted');assert.equal(P.parseJson(notes.get(local).snapshot.note.content).approvals.length,0);
decision=await book.approveLocal(doc,draft.id);await book.prepareServer(decision.operation_id);await book.commitServer(decision.operation_id);
const archived=structuredClone(saved);delete archived.recovery_archives;saved.recovery_archives=[archived];history=createHistory();book=box.createWikiIngestNotebook(api);
await book.applyServer(decision.operation_id);
assert.equal(P.parseJson(history.view(local).draft.content).approvals[0].schema_version,2);
assert.equal((await book.plan({fileIds:[],noteIds:[sourceId]})).plan.calls,0,'own remote approval must not force unchanged inputs back through the model');
for(const [id,title,content]of [['selected-comparison',source.title,'Changed exact selection.'],['beta-evidence','Beta evidence','Beta exact selection.']]){
  const note={...source,id:notes.size+1,local_id:id,title,content},current=makeCurrent(note,webcrypto.randomUUID());
  notes.set(id,current);representations.set(current.head_revision_id,structuredClone(current));await history.track(note,current);
}
const combined=await book.plan({fileIds:[],noteIds:['selected-comparison','beta-evidence']});
assert.equal(combined.plan.inputs.filter(r=>r.kind==='wiki').length,1);
const combinedProposal=await book.generate(combined,{provider:'fixture',model:'comparison',invoke:async()=>JSON.stringify({pages:combined.plan.pages.map((p,i)=>({
  wiki_id:p.wiki_id,draft_id:p.draft_id,title:combined.plan.snapshot.sources[i].title,topic:combined.plan.snapshot.sources[i].title,page_type:'concept',summary:'Synthetic',aliases:[],claims:[],
  relations:[{id:'r1',from_section_id:'s1',to_ref:{kind:'proposal',operation_id:combined.operation_id,wiki_id:combined.plan.pages[1-i].wiki_id,draft_id:combined.plan.pages[1-i].draft_id,section_id:'s1'},type:'related_to',confidence:'inferred',citation_ids:['c1']}],
  sections:[{id:'s1',title:'Evidence',markdown:'Compared exact evidence.',citation_ids:['c1']}],citations:[{id:'c1',evidence_id:combined.plan.snapshot.sources[i].id,section_id:null,quote:combined.plan.snapshot.sources[i].content}]}))})});
await book.stageServer(combinedProposal);
await book.prepareServer(combined.operation_id);
lost=true;await assert.rejects(()=>book.commitServer(combined.operation_id),/response lost/);
history=createHistory();book=box.createWikiIngestNotebook(api);
await book.statusServer(combined.operation_id);await book.applyServer(combined.operation_id);
const beta=combinedProposal.proposal.documents.find(row=>row.wiki_id!==combined.plan.targets[0].document.wiki_id);
const betaDecision=await book.approveLocal(beta.document,beta.document.drafts[0].id);
await book.prepareServer(betaDecision.operation_id);await book.commitServer(betaDecision.operation_id);await book.applyServer(betaDecision.operation_id);
assert.equal((await book.plan({fileIds:[],noteIds:['selected-comparison','beta-evidence']})).plan.calls,0,'comparison approval also preserves unchanged fingerprints');
const alphaProposal=combinedProposal.proposal.documents.find(row=>row.wiki_id!==beta.wiki_id);
const alphaDecision=await book.approveLocal(alphaProposal.document,alphaProposal.document.drafts.at(-1).id);
await book.prepareServer(alphaDecision.operation_id);await book.commitServer(alphaDecision.operation_id);await book.applyServer(alphaDecision.operation_id);
ctx.device='peer';saved=null;history=createHistory();book=box.createWikiIngestNotebook(api);
for(const current of notes.values())await history.track(current.snapshot.note,current);
api.readOperations=async()=>[];
const graphWrites=writes,recoveredGraph=await notebook.approvedCatalog();
assert.equal(recoveredGraph.nodes.length,2);assert.equal(recoveredGraph.edges.length,2,'new device resolves original server operation, without a local operation journal');
assert.equal(writes,graphWrites,'operation discovery never stores a second graph index');
const remoteProof=await box.NowWikiEvidence.create(api).operationProof(combined.operation_id,alphaProposal.wiki_id,beta.wiki_id,{origin:'server'});
const sourceBefore=P.parseJson(notes.get('wiki:'+alphaProposal.wiki_id).snapshot.note.content);
assert.equal((await box.NowNoteWikiIngest.verifyCarriedRelation(sourceBefore,sourceBefore.drafts.at(-1).relations[0],remoteProof,ctx)).draft.id,beta.document.drafts[0].id,'remote resolver binds original result revisions and full receipt, not current bodies alone');
const betaCurrent=P.parseJson(notes.get('wiki:'+beta.wiki_id).snapshot.note.content),betaApproval=betaCurrent.approvals.at(-1);
const manualRelation={id:'manual-server',from_section_id:'s1',to_ref:{kind:'approved',wiki_id:beta.wiki_id,draft_id:betaApproval.draft_id,approval_id:betaApproval.id,draft_hash:betaApproval.draft_hash,section_id:'s1'},type:'supports',confidence:'inferred',citation_ids:['c1']};
await assert.rejects(()=>book.integrate(alphaProposal.wiki_id,manualRelation),/wiki_dependency_unverified/,'missing producer history cannot be treated as complete on a fresh peer');
withProvenance=true;
const peerApproval=sourceBefore.approvals.at(-1),peerDraft=sourceBefore.drafts.at(-1),peerRef={id:'peer-root',kind:'wiki',origin:'server',owner_id:ctx.owner,wiki_id:sourceBefore.wiki_id,draft_id:peerDraft.id,approval_id:peerApproval.id,document_version:sourceBefore.document_version,content_hash:peerDraft.draft_hash};
const peerWrites=writes,peerGraph=await box.NowWikiEvidence.create(api).graph([peerRef]);
assert.equal(peerGraph.nodes.find(n=>n.wiki_id===sourceBefore.wiki_id).complete,true,'new device must verify metadata against original operation and result history');
assert.equal(writes,peerWrites,'producer discovery does not register a fake local operation or cache');
const goodReader=api.readRemote,goodServer=api.server,postsBeforeProof=posts;
for(const mutate of [m=>m.entries.pop(),m=>m.entries[0].manifest_hash='f'.repeat(64),m=>m.entries[0].result_revision_id=webcrypto.randomUUID(),m=>m.entries.push(structuredClone(m.entries[0])),m=>m.extra='forbidden']){
  api.server=box.NowWikiServerAccess.create({...api,readWiki:async id=>{const value=await goodReader(id);if(id===sourceBefore.wiki_id)mutate(value.artifact.generation_provenance);return value;}});
  let denied=false;try{const graph=await box.NowWikiEvidence.create(api).graph([peerRef]);denied=graph.nodes.some(n=>!n.complete);}catch(error){assert.match(error.message,/wiki_provenance_invalid/);denied=true;}
  assert.equal(denied,true,'missing, changed or ambiguous metadata never proves completeness');
}
api.server=goodServer;
const firstOperation=operations.get(plan.operation_id),firstRevision=firstOperation.receipt.pages[0].result_revision_id,oldRepresentation=representations.get(firstRevision),changedRepresentation=structuredClone(oldRepresentation);
const changedResult=P.parseJson(changedRepresentation.snapshot.note.content),changedDraft=changedResult.drafts[0];changedDraft.summary='Tampered old result';delete changedDraft.draft_hash;changedDraft.draft_hash=await P.hashJson(changedDraft);
changedRepresentation.snapshot.note.content=P.canonicalJson(changedResult);representations.set(firstRevision,changedRepresentation);
await assert.rejects(()=>box.NowWikiEvidence.create(api).graph([peerRef]),/wiki_provenance_invalid/,'a valid typed replacement is not the original receipt-bound result');
representations.set(firstRevision,oldRepresentation);assert.equal(posts,postsBeforeProof,'all metadata failure checks are read only');
const manual=await book.integrate(alphaProposal.wiki_id,manualRelation);
assert.equal(manual.proposal.plan.calls,0);await book.stageServer(manual);
assert.equal((await book.operations()).find(o=>o.operation_id===manual.operation_id).remote.manifest.kind,'integrate');
await book.prepareServer(manual.operation_id);await book.commitServer(manual.operation_id);
saved=structuredClone(saved);history=createHistory();book=box.createWikiIngestNotebook(api);await book.applyServer(manual.operation_id);
const manualCurrent=P.parseJson(history.view('wiki:'+alphaProposal.wiki_id).draft.content);
assert.equal(manualCurrent.drafts.at(-1).relations.length,2);assert.equal(manualCurrent.approvals.length,sourceBefore.approvals.length,'remote commit is not approval');
assert.equal((await notebook.approvedCatalog()).edges.length,2,'remote manual draft is invisible to approved graph');
const manualDecision=await book.approveLocal(manualCurrent,manualCurrent.drafts.at(-1).id);
await book.prepareServer(manualDecision.operation_id);await book.commitServer(manualDecision.operation_id);await book.applyServer(manualDecision.operation_id);
assert.equal((await notebook.approvedCatalog()).edges.length,3,'remote explicit approval projects the added relation');
if(process.argv[2]){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),code=`
import json, sys
from app.schemas.wiki_operations import parse_prepare, CommitOperation
from app.schemas.wiki import digest
for row in json.load(sys.stdin):
    manifest=parse_prepare(row['manifest'])
    assert manifest.model_dump()==row['manifest']
    if 'commit' in row:
        commit=CommitOperation.model_validate(row['commit'])
        assert commit.model_dump()==row['commit']
        for item in commit.documents:
            change=next(c for c in manifest.changes if c.wiki_id==item.wiki_id)
            assert digest(item.document.model_dump())==change.result_document_hash
print('Remote ingest/approval exact server schemas PASS (no DB/HTTP/model)')
`;
  const result=spawnSync(process.argv[2],['-B','-c',code],{cwd:root,input:JSON.stringify([...operations.values()]),encoding:'utf8',env:{...process.env,PYTHONPATH:path.join(root,'server'),PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.stderr);process.stdout.write(result.stdout);
}
console.log('Wiki remote ingest: durable draft and original requests, explicit prepare/commit, lost-response cold GET, one local settle CAS PASS (synthetic HTTP/provider only)');
