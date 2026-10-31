import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol.js','note-history-state.js','wiki-state.js']){
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
}
let source='';try{source=await fs.readFile(new URL('../vendor/wiki-notebook.js',import.meta.url),'utf8');}catch{}
vm.runInContext(source,box);
assert.equal(typeof box.createWikiNotebook,'function','Wiki notebook must reuse the durable Note journal');
let ctx={url:'https://example.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true},saved=null,calls=0;
const original={owner:'alice',localId:'source',status:'ok',origin:'local',title:'Original',content:'Exact evidence.',revisionId:null,headVersion:0};
const sourceNote=id=>id==='source'?structuredClone(original):null;
const H=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,write:async value=>{saved=structuredClone(value);},
  request:async()=>{calls++;throw Error('network must not receive local-only material');}});
let history=H();
const api={context:()=>ctx,contextKey:()=>JSON.stringify([ctx.url,ctx.owner,ctx.auth]),history:()=>history,
  source:sourceNote,notes:()=>[{id:'source',title:'Original'}],
  readCurrent:async()=>{calls++;throw Error('local source must not be uploaded or fetched');},
  listRemote:async()=>[],readRemote:async()=>{throw Error('unexpected');}};
let book=box.createWikiNotebook(api);
const snapshot=await book.capture(['source']);
assert.equal(snapshot.serverEligible,false);
const output={title:'Guide',topic:'Topic',sections:[{id:'one',title:'Finding',markdown:'A finding.',citation_ids:['c']}],
  citations:[{id:'c',source_id:'source-1',quote:'Exact evidence.'}]};
const draft=await box.NowNoteWiki.validateDraft(output,snapshot,{provider:'omniroute',model:'auto'});
const doc={schema_version:1,document_version:1,wiki_id:webcrypto.randomUUID(),scope:snapshot.scope,drafts:[draft],approvals:[],rejected_draft_ids:[]};
const oversized=structuredClone(doc);oversized.wiki_id=webcrypto.randomUUID();oversized.drafts[0].sections[0].markdown='x'.repeat(2097152);
await assert.rejects(()=>book.save(oversized),/capacity|용량/);
const result=await book.save(doc);
assert.equal(result.localOnly,true);assert.equal(calls,0);
const local='wiki:'+doc.wiki_id;
assert.equal(history.view(local).draft.source,'wiki-artifact');
assert.equal(history.view(local).localOnly,true);
assert.equal(history.view(local).revisions.length,1);
history=H();book=box.createWikiNotebook(api);
const cold=await book.list();
assert.equal(cold.length,1);assert.equal(cold[0].document.drafts[0].draft_hash,draft.draft_hash);
const approved=await book.approve(doc,draft.id);
assert.equal(approved.document.approvals.length,1);
assert.equal(approved.document.approvals[0].draft_hash,draft.draft_hash);
assert.equal(history.view(local).revisions.length,2,'Draft and explicit approval remain separate history entries');
assert.equal(calls,0);
original.content='Changed evidence.';
await assert.rejects(()=>book.approve(doc,draft.id),/source|원본|판본|충돌|changed/);
ctx={...ctx,owner:'bob',auth:'other'};
assert.equal((await book.list()).length,0);
assert.equal(Object.keys(saved.contexts).length,1,'Account switch must not erase the original journal');
ctx={...ctx,owner:'alice',auth:'synthetic'};
original.content='Exact evidence.';
await history.localOnly(local,false);
api.listRemote=async()=>[{id:doc.wiki_id}];
let reads=0;
api.readRemote=async()=>{reads++;return {artifact:{protected:true,document:null,current_exists:true},source_status:{available:true,stale:false}};};
const protectedRows=await book.list();
assert.ok(reads>0,'A managed local journal must not skip the server wiki protection state');
assert.equal(protectedRows[0].document,undefined,'Server-protected wikis must not return a cached plaintext document');
api.readRemote=async()=>{throw Error('server_read_failed');};
assert.equal((await book.list())[0].document,undefined,'Read failure must not expose a cached server wiki');
ctx={...ctx,online:false};
original.origin='server';
assert.equal((await book.sourceStatus(draft,approved.document)).available,false,'Offline server sources require a fresh access check');
ctx={...ctx,online:true};
const secondSource={...original,origin:'local',status:'ok',localId:'second-source',content:'Fresh evidence.'};
api.source=id=>id==='second-source'?structuredClone(secondSource):sourceNote(id);
const historyDoc=structuredClone(approved.document),later=structuredClone(draft);
later.id=webcrypto.randomUUID();later.generation_id=webcrypto.randomUUID();later.base_approved_revision_id=historyDoc.approvals.at(-1).id;
later.source_manifest[0].note_ref.local_id='second-source';later.source_manifest[0].content_hash=await box.NowNoteProtectionProtocol.sha256(secondSource.content);
later.citations[0].quote='Fresh evidence.';
const laterUnsigned=structuredClone(later);delete laterUnsigned.draft_hash;
later.draft_hash=await box.NowNoteProtectionProtocol.hashJson(laterUnsigned);
historyDoc.drafts.push(later);historyDoc.document_version+=2;
historyDoc.approvals.push({id:webcrypto.randomUUID(),parent_approved_revision_id:historyDoc.approvals.at(-1).id,
  draft_id:later.id,draft_hash:later.draft_hash,source_manifest_hash:await box.NowNoteProtectionProtocol.hashJson(later.source_manifest),
  approved_by:ctx.owner,approved_at:new Date().toISOString()});
original.status='locked';
assert.equal(book.canRead(historyDoc),false,'Past draft sources remain part of the protected wiki dependency scope');
original.status='ok';original.origin='local';original.content='Changed evidence.';
api.readRemote=async()=>({artifact:{protected:false,document:structuredClone(historyDoc),current_exists:true},
  source_status:{available:true,stale:false}});
assert.equal((await book.sourceStatus(historyDoc.drafts[0],historyDoc)).stale,true,'A past selected draft must not inherit the current approved draft freshness');
assert.equal(typeof book.inspectProtected,'function','A verified decrypted wiki needs a read-only parser rather than a general-write bypass');
const beforePreview=JSON.stringify(saved);
const preview=await book.inspectProtected(box.NowNoteProtectionProtocol.canonicalJson(approved.document),local);
assert.equal(preview.approvals.length,1);assert.equal(JSON.stringify(saved),beforePreview);
const damaged=structuredClone(approved.document);damaged.drafts[0].sections[0].markdown='Tampered evidence.';
await assert.rejects(()=>book.inspectProtected(JSON.stringify(damaged),local),/해시|hash/);
const falseApproval=structuredClone(approved.document);falseApproval.approvals[0].source_manifest_hash='0'.repeat(64);
await assert.rejects(()=>book.inspectProtected(JSON.stringify(falseApproval),local),/해시|검토|hash/,'Read-only approval labels must retain the exact source-manifest binding');
await assert.rejects(()=>book.inspectProtected(JSON.stringify(approved.document),'wiki:'+webcrypto.randomUUID()),/형식|계정|서버/);
assert.equal(JSON.stringify(saved),beforePreview,'Read-only preview must never unlock or rewrite the durable journal');
console.log('Wiki notebook: local-only no upload, durable cold restore, explicit approval, source-change/account isolation and verified read-only parsing PASS');
