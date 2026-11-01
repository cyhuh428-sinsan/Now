import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol.js','note-protection-state.js','note-history-state.js','wiki-state.js','wiki-lifecycle.js','wiki-notebook.js'])
  vm.runInContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
const ctx={url:'https://example.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true};
const local='wiki:'+webcrypto.randomUUID(),sourceRevision=webcrypto.randomUUID(),wikiRevision=webcrypto.randomUUID();
const source={owner:ctx.owner,localId:'source',status:'ok',origin:'server',title:'Evidence',content:'Exact evidence.',revisionId:sourceRevision,headVersion:1};
const snapshot=await box.NowNoteWiki.capture(['source'],ctx,()=>source);
const draft=await box.NowNoteWiki.validateDraft({title:'Guide',topic:'Synthetic',sections:[{id:'s',title:'Finding',markdown:'Finding.',citation_ids:['c']}],
  citations:[{id:'c',source_id:'source-1',quote:'Exact evidence.'}]},snapshot,{provider:'synthetic',model:'no-model'});
const doc={schema_version:1,document_version:1,wiki_id:local.slice(5),scope:snapshot.scope,drafts:[draft],approvals:[],rejected_draft_ids:[]};
const now='2026-11-01T00:00:00.000Z';
const note={id:1,owner_id:ctx.owner,local_id:local,device_id:ctx.device,note_type:'tree',title:'AI Wiki '+doc.wiki_id,
  content:JSON.stringify(doc),source:'wiki-artifact',parent_local_id:null,level:1,tags:null,deleted_at:null,created_at:now,updated_at:now,client_updated_at:now};
const current={head_version:1,head_revision_id:wikiRevision,inventory_revision_ids:[wikiRevision],crypto_epoch:0,history_generation:1,replica_count:1,identity_state:'coherent'};
let saved;
const h=box.NowNoteHistory.create({context:()=>ctx,write:async value=>saved=structuredClone(value),request:async()=>{throw Error('unexpected Note publication');}});
await h.track(note,current);
let resource={id:doc.wiki_id,owner_id:ctx.owner,schema_version:1,version:1,deleted_at:null,payload:{artifact_local_id:local,dependencies:[{owner_id:ctx.owner,local_id:'source'}]}};
const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>h};
const lifecycle=box.NowWikiLifecycle.create({...api,request:async(_ctx,_local,_op,body)=>{
  resource={...resource,version:body.base_version+1,deleted_at:now};return {status:'ok',resource,mutation_id:body.mutation_id};
}});
await lifecycle.observe([resource]);
let enter,release;const entered=new Promise(resolve=>enter=resolve),response=new Promise(resolve=>release=resolve);
const book=box.createWikiNotebook({...api,lifecycle,source:()=>structuredClone(source),listRemote:async()=>[resource],
  readRemote:async()=>{enter();return response;},
  readCurrent:async()=>({...current,head_revision_id:sourceRevision,inventory_revision_ids:[sourceRevision],snapshot:{schema_version:1,note:{...note,local_id:'source',content:source.content,source:'web-tree'}}})});
const next=structuredClone(doc);next.document_version++;next.rejected_draft_ids.push(draft.id);
const before=JSON.stringify(h.view(local));
const saving=book.save(next).then(value=>({value}),error=>({error}));
await entered;
await lifecycle.move(local,'trash');
release({resource:{...resource,version:1,deleted_at:null},artifact:{protected:false,document:doc},source_status:{available:true,stale:false}});
const outcome=await saving;
assert(outcome.error,'Pending/trash created during source lookup must reject the late local save');
assert.equal(JSON.stringify(h.view(local)),before,'Late source response must not edit/seal the journal');
assert(lifecycle.blocked(local));assert(saved.contexts[box.NowNoteHistory.key(ctx)].wiki_lifecycle[local].deleted_at);
console.log('Actual Wiki save await race: lifecycle change blocks local edit/seal and preserves the complete original journal PASS');
