import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,ctx,id,clone} from './wiki_ingest_fixture.mjs';
const {box,P,W,catalog}=await fixture();vm.runInContext(await fs.readFile(new URL('../vendor/wiki-server-access.js',import.meta.url),'utf8'),box);
const original=catalog[0].document,latest=clone(original),oldDraft=original.drafts[0],approved=original.approvals[0];
const extra=clone(oldDraft);extra.id=id(91);extra.generation_id=id(92);extra.base_approved_revision_id=approved.id;extra.title+=' pending';
delete extra.draft_hash;extra.draft_hash=await P.hashJson(extra);latest.document_version++;latest.drafts.push(extra);await W.validateDocument(latest,ctx);
const ref={id:'comparison',kind:'wiki',origin:'server',owner_id:ctx.owner,wiki_id:original.wiki_id,draft_id:oldDraft.id,approval_id:approved.id,document_version:original.document_version,content_hash:oldDraft.draft_hash};
const snapshot=doc=>({schema_version:1,note:{id:1,owner_id:ctx.owner,local_id:'wiki:'+doc.wiki_id,device_id:ctx.device,note_type:'tree',title:'Wiki',content:P.canonicalJson(doc),source:'wiki-artifact',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:'2026-11-01T00:00:00.000000Z',updated_at:'2026-11-01T00:00:00.000000Z',client_updated_at:'2026-11-01T00:00:00.000000Z'}});
let mode='',key='alice';const histories=[{ref:{kind:'note_revision',id:id(8)},snapshot:snapshot(original)},{ref:{kind:'note_revision',id:id(90)},snapshot:snapshot(latest)}];
const current=()=>({status:'ok',snapshot:clone(histories[1].snapshot),head_revision_id:id(90),head_version:3,history_generation:2,crypto_epoch:0,protection_state:'legacy',identity_state:'coherent',replica_count:1,inventory_revision_ids:[id(90)],has_replica_variants:false});
const api={context:()=>({...ctx,enabled:true,online:true}),contextKey:()=>key,readWiki:async()=>{
  const value=clone(latest);if(mode==='approval-changed')value.approvals[0].id=id(93);
  return {resource:{id:original.wiki_id,owner_id:ctx.owner,schema_version:1,version:3,deleted_at:mode==='deleted'?'2026-11-01T00:00:00Z':null,payload:{artifact_local_id:'wiki:'+original.wiki_id,dependencies:clone(oldDraft.source_manifest.map(r=>r.note_ref))}},artifact:{protected:false,head_revision_id:id(90),document:value},source_status:{available:true,stale:false}};
},request:async(path,_method,body)=>{
  if(path==='/api/v1/server')return {status:'ok',capabilities:{wiki_document_schema:2,wiki_operations_v1:true,wiki_operation_manifest_schema:mode==='old-capability'?1:2}};
  if(path.endsWith('/current')){const result=current();if(mode==='approval-changed')result.snapshot.note.content=P.canonicalJson((await api.readWiki()).artifact.document);return result;}
  if(path.endsWith('/status'))return {server_instance_id:id(70),preparation_only:true,current_exists:true,...Object.fromEntries(['head_revision_id','head_version','crypto_epoch','history_generation','protection_state','identity_state','inventory_revision_ids'].map(k=>[k,current()[k]]))};
  if(path.endsWith('/revisions'))return {status:'ok',items:histories.map(h=>({revision_ref:h.ref,representation_epoch:0})),next_cursor:null,crypto_epoch:0,history_generation:2};
  if(path.endsWith('/revision')){if(mode==='late')key='other';return {status:'ok',revision_ref:{kind:body.revision_kind,id:body.revision_id},snapshot:clone(histories.find(h=>h.ref.id===body.revision_id).snapshot),crypto_epoch:0};}
  throw Error('unexpected read');
}};
const reader=box.NowWikiServerAccess.create(api);assert.equal(typeof reader.pinnedWiki,'function');
const pinned=await reader.pinnedWiki(ref);assert.equal(pinned.revisionId,id(8));assert.equal(pinned.document.document_version,2);assert.equal(pinned.currentDocument.document_version,3);
assert.equal(pinned.draft.draft_hash,ref.content_hash);assert.equal(pinned.history.length,2);
for(const test of ['approval-changed','deleted','old-capability','late']){mode=test;key='alice';await assert.rejects(()=>reader.pinnedWiki(ref),undefined,test);}
console.log('Pinned Wiki: exact old revision/quote with same approval container advance; changed approval/deleted/capability/late rejected PASS (synthetic HTTP only)');
