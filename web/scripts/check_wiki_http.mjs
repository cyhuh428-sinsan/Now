import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto,randomUUID,createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {readStoreFile,updateStoreFile}=require('../../desktop/store-file.cjs');
const base='http://127.0.0.1:8750',run=randomUUID().replaceAll('-','').slice(0,12);
const owner='qa_wiki_'+run,device='qa-wiki-'+run,sourceId='qa-wiki-source-'+run;
const directory=process.env.NOWNOTE_QA_MANIFEST_DIR,envFile=process.env.NOWNOTE_QA_ENV_FILE;
assert.ok(directory&&envFile,'Private QA paths required');
const env=await fs.readFile(envFile,'utf8');
let token=env.split(/\r?\n/).find(line=>line.startsWith('NOW_QA_API_TOKEN='))?.slice('NOW_QA_API_TOKEN='.length).trim();
if(token?.startsWith('"')&&token.endsWith('"'))token=token.slice(1,-1);
assert.ok(token,'QA token required');
const own=path.resolve('D:/tmp/now-240-wiki-http-'+randomUUID());
const storePath=path.join(own,'store.json');
const manifest={run,owner,device,sourceId,wikiId:null,stage:'preflight',outcome:'running',requests:[],providerCalls:0,
  serverResources:'retained synthetic QA',sourceHashes:{}};
for(const file of ['note-history-state.js','note-protection-protocol.js','wiki-state.js','wiki-notebook.js'])
  manifest.sourceHashes[file]=createHash('sha256').update(await fs.readFile(new URL('../vendor/'+file,import.meta.url))).digest('hex');
const save=()=>fs.writeFile(path.join(directory,'wiki-http-'+run+'.json'),JSON.stringify(manifest,null,2));
await save();
let userToken='';
async function recordFetch(url,options={}){
  const parsed=new URL(url);
  assert.equal(parsed.origin,base,'QA must not call external services');
  let response;
  try{response=await fetch(url,{...options,redirect:'error'});}
  catch{manifest.requests.push({method:options.method||'GET',route:parsed.pathname,status:'transport_uncertain'});await save();throw Error('transport_uncertain_no_retry');}
  manifest.requests.push({method:options.method||'GET',route:parsed.pathname,status:response.status});await save();
  return response;
}
async function http(method,route,body){
  const response=await recordFetch(base+route,{method,headers:{Authorization:'Bearer '+token,
    ...(userToken?{'X-Now-User-Token':userToken}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(Error('http_'+response.status),{status:response.status,code:value.detail?.code});
  return value;
}
async function refused(action,status,code){
  let observed;
  try{await action();}catch(error){observed=error;}
  assert.ok(observed,'Expected a definite rejection');
  assert.ok((Array.isArray(status)?status:[status]).includes(observed.status),'Unexpected rejection status');
  if(code)assert.equal(observed.code,code);
}
try{
  await fs.mkdir(own,{recursive:true});
  assert.equal((await http('GET','/health/ready')).status,'ready');
  const localApp=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
  const deployed=await recordFetch(base+'/app.js',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  assert.equal(deployed.status,200);
  const hash=value=>createHash('sha256').update(value.replace(/\r\n/g,'\n')).digest('hex');
  manifest.appHash=hash(await deployed.text());await save();
  assert.equal(manifest.appHash,hash(localApp),'Exact source app must be served before synthetic registration');
  const openapi=await http('GET','/openapi.json');
  assert.ok(openapi.paths['/api/v1/wikis/{wiki_id}/current'],'Wiki API must exist before synthetic registration');
  const registered=await http('POST','/api/v1/auth/register',{owner_id:owner,password:'Qa-'+randomUUID(),
    email:owner+'@example.invalid',display_name:'Wiki HTTP QA',device_id:device,device_name:'Isolated Wiki QA'});
  assert.ok(registered.access_token);userToken=registered.access_token;manifest.stage='registered';await save();
  const ctx={url:base,owner,device,enabled:true,online:true,auth:'memory-only',
    headers:{Authorization:'Bearer '+token,'X-Now-User-Token':userToken}};
  const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa,
    URLSearchParams,AbortSignal,fetch:recordFetch});
  for(const file of ['note-protection-protocol.js','note-history-state.js','wiki-state.js','wiki-notebook.js'])
    vm.runInContext(await fs.readFile(new URL('../vendor/'+file,import.meta.url),'utf8'),box);
  const app=localApp;
  const start=app.indexOf('async function noteHistoryRequest('),end=app.indexOf('\nfunction noteHistoryWireNotes()',start);
  assert.ok(start>=0&&end>start);vm.runInContext(app.slice(start,end),box);
  const request=(route,method,body)=>box.noteHistoryRequest(ctx,route,method,body);
  const write=async value=>{updateStoreFile(storePath,store=>{store.values['nownote.history.v1']=value;return store;});};
  const make=initial=>box.NowNoteHistory.create({initial,context:()=>ctx,request:(_ctx,...args)=>request(...args),write});
  let history=make();box.noteHistory=history;
  const now=new Date().toISOString(),original='Exact source evidence '+run+'\r\n합성 원문';
  const sourceNote={id:null,owner_id:owner,device_id:device,local_id:sourceId,note_type:'tree',title:'Wiki HTTP source',
    content:original,parent_local_id:null,level:1,tags:null,source:'web-tree',deleted_at:null,
    created_at:now,updated_at:now,client_updated_at:now};
  await history.track(sourceNote,null,{needsBaseline:true});await history.seal(sourceId);await history.sync();
  assert.equal(history.view(sourceId).outbox.length,0);assert.equal(history.view(sourceId).conflict,null);
  const originalRevision=history.view(sourceId).base.head_revision_id;assert.ok(originalRevision);
  let projection=history.view(sourceId).draft;
  const query=()=>'?owner_id='+encodeURIComponent(owner);
  const book=box.createWikiNotebook({context:()=>ctx,contextKey:()=>JSON.stringify([base,owner,device]),history:()=>history,
    source:id=>id===sourceId?{owner,localId:id,status:'ok',origin:'server',title:projection.title,content:projection.content,revisionId:null,headVersion:0}:null,
    readCurrent:id=>request('current','GET',{local_id:id}),
    listRemote:async()=>(await http('GET','/api/v1/wikis'+query())).items,
    readRemote:id=>http('GET','/api/v1/wikis/'+id+query())});
  const W=box.NowNoteWiki,P=box.NowNoteProtectionProtocol;
  const output={title:'Wiki HTTP guide',topic:'Synthetic QA',sections:[{id:'one',title:'Finding',
    markdown:'A supported synthetic finding.',citation_ids:['c']}],citations:[{id:'c',source_id:'source-1',quote:'Exact source evidence'}]};
  const snapshot=await book.capture([sourceId]);assert.equal(snapshot.serverEligible,true);
  const first=await W.validateDraft(output,snapshot,{provider:'synthetic',model:'no-provider'});
  let doc={schema_version:1,document_version:1,wiki_id:randomUUID(),scope:snapshot.scope,drafts:[first],approvals:[],rejected_draft_ids:[]};
  manifest.wikiId=doc.wiki_id;manifest.localId='wiki:'+doc.wiki_id;manifest.stage='wiki_draft';await save();
  assert.equal((await book.save(doc)).pending,false);
  doc=(await book.approve(doc,first.id)).document;
  assert.equal(doc.approvals.length,1);
  let remote=await http('GET','/api/v1/wikis/'+doc.wiki_id+query());
  assert.deepEqual(Object.keys(remote.resource.payload).sort(),['artifact_local_id','dependencies']);
  assert.equal(remote.artifact.document.approvals.length,1);
  assert.equal(remote.source_status.stale,false);
  assert.equal((await request('current','GET',{local_id:sourceId})).snapshot.note.content,original);
  const cold=readStoreFile(storePath).store.values['nownote.history.v1'];
  history=make(cold);box.noteHistory=history;
  assert.equal((await book.list())[0].document.approvals.length,1);
  assert.equal(history.view(manifest.localId).localOnly,false);
  const nextSource={...history.view(sourceId).draft,content:original+'\nRevised evidence.',client_updated_at:new Date().toISOString()};
  await history.edit(nextSource);await history.seal(sourceId);await history.sync();projection=history.view(sourceId).draft;
  assert.equal(history.view(sourceId).outbox.length,0);
  const stale=await W.validateDraft(output,snapshot,{provider:'synthetic',model:'no-provider'},
    {baseApprovedRevisionId:doc.approvals.at(-1).id});
  doc={...doc,document_version:doc.document_version+1,drafts:[...doc.drafts,stale]};
  assert.equal((await book.save(doc)).pending,false);
  await assert.rejects(()=>book.approve(doc,stale.id),/원본|changed/);
  const wire=async value=>{
    const current=await request('current','GET',{local_id:manifest.localId});
    return {schema_version:1,owner_id:owner,local_id:manifest.localId,device_id:device,mutation_id:randomUUID(),
      crypto_epoch:current.crypto_epoch,base_head_version:current.head_version,base_revision_id:current.head_revision_id,
      expected_inventory_revision_ids:current.inventory_revision_ids,
      note:{...box.NowNoteHistory.meaning(history.view(manifest.localId).draft),content:P.canonicalJson(value)}};
  };
  const invalid=structuredClone(doc);invalid.document_version++;
  invalid.approvals.push({id:randomUUID(),parent_approved_revision_id:doc.approvals.at(-1).id,draft_id:stale.id,
    draft_hash:stale.draft_hash,source_manifest_hash:await P.hashJson(stale.source_manifest),approved_by:owner,approved_at:new Date().toISOString()});
  await refused(async()=>request('current','PUT',await wire(invalid)),409,'wiki_source_changed');
  remote=await http('GET','/api/v1/wikis/'+doc.wiki_id+query());
  assert.equal(remote.artifact.document.approvals.length,1);assert.equal(remote.source_status.stale,true);
  const fresh=await W.validateDraft(output,await book.capture([sourceId]),{provider:'synthetic',model:'no-provider'},
    {baseApprovedRevisionId:doc.approvals.at(-1).id});
  doc={...doc,document_version:doc.document_version+1,drafts:[...doc.drafts,fresh]};
  assert.equal((await book.save(doc)).pending,false);doc=(await book.approve(doc,fresh.id)).document;
  assert.equal(doc.approvals.length,2);
  const rejected=structuredClone(doc);rejected.document_version++;rejected.rejected_draft_ids.push(stale.id);
  const firstWire=await wire(rejected),secondWire={...structuredClone(firstWire),mutation_id:randomUUID()};
  const receipt=await request('current','PUT',firstWire);
  await refused(()=>request('current','PUT',secondWire),409,'version_conflict');
  assert.deepEqual(await request('current','PUT',firstWire),receipt);
  const legacy=await http('GET','/api/v1/notes'+query());
  assert.ok(!legacy.some(n=>n.local_id===manifest.localId));
  const search=await http('GET','/api/v1/notes/search'+query()+'&q=Exact%20source%20evidence');
  assert.ok(!search.some(n=>n.local_id===manifest.localId));
  await refused(()=>http('GET','/api/v1/wikis?owner_id='+encodeURIComponent(owner+'_other')),[401,403]);
  const status=await request('crypto-transitions/status','GET',{local_id:sourceId,device_id:device});
  await refused(()=>request('crypto-transitions','POST',{schema_version:1,owner_id:owner,local_id:sourceId,device_id:device,
    mutation_id:randomUUID(),server_instance_id:status.server_instance_id,crypto_epoch:status.crypto_epoch,target_epoch:status.crypto_epoch+1,
    base_head_version:status.head_version,base_revision_id:status.head_revision_id,expected_history_generation:status.history_generation,
    expected_inventory_revision_ids:status.inventory_revision_ids,local_branches:[]}),409,'wiki_protection_required');
  const previous=await request('revision','GET',{local_id:sourceId,revision_kind:'note_revision',revision_id:originalRevision});
  assert.equal(previous.snapshot.note.content,original);
  remote=await http('GET','/api/v1/wikis/'+doc.wiki_id+query());
  assert.equal(remote.artifact.document.document_version,6);assert.equal(remote.artifact.document.approvals.length,2);
  manifest.headVersion=remote.artifact.head_version;manifest.documentVersion=remote.artifact.document.document_version;
  manifest.sourceCurrentHash=await P.sha256(projection.content);manifest.originalRevision=originalRevision;
  manifest.wikiContentHash=await P.sha256(P.canonicalJson(remote.artifact.document));
  manifest.sourceRevision=(await request('current','GET',{local_id:sourceId})).head_revision_id;
  manifest.outcome='PASS';manifest.stage='complete';await save();
  console.log('Wiki real WSL HTTP: draft/approval, stale rejection/regeneration, CAS/original receipt, cold journal, v1 isolation and protection prerequisite PASS; run='+run);
}catch(error){
  manifest.outcome='FAIL';manifest.errorType=error.name;
  manifest.errorFrame=String(error.stack||'').match(/check_wiki_http\.mjs:\d+:\d+/)?.[0]||null;
  manifest.errorCode=typeof error.code==='string'&&/^[a-z0-9_]{1,100}$/i.test(error.code)?error.code:null;
  await save();throw Error('wiki_http_failed_'+run+': '+error.name+(manifest.errorCode?'/'+manifest.errorCode:''));
}finally{
  const resolved=path.resolve(own);
  if(!resolved.startsWith('D:'+path.sep+'tmp'+path.sep+'now-240-wiki-http-'))throw Error('qa_cleanup_boundary');
  await fs.rm(resolved,{recursive:true,force:true});manifest.cleanup='own store removed';await save();
}
