import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto,randomUUID,createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createVaultService}=require('../../desktop/vault-service.cjs');
const {renderManagedMarkdown}=require('../../desktop/vault-markdown.cjs');
const {readStoreFile,updateStoreFile}=require('../../desktop/store-file.cjs');
const base='http://127.0.0.1:8750',run=randomUUID().replaceAll('-','').slice(0,12);
const owner='qa_vault_'+run,device='qa-vault-'+run,local='qa-vault-'+run;
const manifestDir=process.env.NOWNOTE_QA_MANIFEST_DIR;
assert.ok(manifestDir&&process.env.NOWNOTE_QA_ENV_FILE,'Private QA paths required');
const env=await fs.readFile(process.env.NOWNOTE_QA_ENV_FILE,'utf8');
const tokenPrefix='NOW_QA_API_TOKEN=';
let token=env.split(/\r?\n/).find(line=>line.startsWith(tokenPrefix))?.slice(tokenPrefix.length).trim();
if(token?.startsWith('"')&&token.endsWith('"'))token=token.slice(1,-1);
assert.ok(token,'QA API token required');
const root=path.resolve('D:/tmp/nownote-239-vault-qa');
await fs.mkdir(root,{recursive:true});
const own=await fs.mkdtemp(path.join(root,'http-'));
const storePath=path.join(own,'store.json'),vault=path.join(own,'vault');
const manifest={run,owner,local,device,requests:[],outcome:'running',providerCalls:0,serverResources:'retained synthetic QA'};
manifest.sourceHashes={};
for(const file of ['../vendor/note-history-state.js','../../desktop/vault-history.cjs','../../desktop/vault-service.cjs'])
  manifest.sourceHashes[file]=createHash('sha256').update(await fs.readFile(new URL(file,import.meta.url))).digest('hex');
const save=()=>fs.writeFile(path.join(manifestDir,'vault-http-'+run+'.json'),JSON.stringify(manifest,null,2));
await save();
let userToken='';
async function http(method,route,body){
  let response;
  try{response=await fetch(base+route,{method,headers:{Authorization:'Bearer '+token,...(userToken?{'X-Now-User-Token':userToken}:{}),
    ...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
  catch{manifest.requests.push({method,route,status:'transport_uncertain'});await save();throw Error('transport_uncertain_no_retry');}
  manifest.requests.push({method,route,status:response.status});await save();
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(Error('http_'+response.status),{status:response.status,code:value.detail?.code});
  return value;
}
try{
  assert.equal((await http('GET','/health/ready')).status,'ready');
  const registration=await http('POST','/api/v1/auth/register',{owner_id:owner,password:'Qa-'+randomUUID(),email:owner+'@example.invalid',
    display_name:'Vault HTTP QA',device_id:device,device_name:'Isolated Vault QA'});
  assert.ok(registration.access_token);userToken=registration.access_token;
  const ctx={url:base,owner,device,enabled:true,online:true,auth:'memory-only'};
  const box={crypto:webcrypto,structuredClone};
  vm.runInNewContext(await fs.readFile(new URL('../vendor/note-history-state.js',import.meta.url),'utf8'),box);
  const request=async(_ctx,route,method,body)=>{
    const query=new URLSearchParams({owner_id:owner});
    if(method==='GET')Object.entries(body||{}).forEach(([key,value])=>{if(value!=null)query.set(key,String(value));});
    return http(method,'/api/v2/notes/'+route+(method==='GET'?'?'+query:''),method==='GET'?undefined:body);
  };
  const write=async value=>{updateStoreFile(storePath,store=>{store.values['nownote.history.v1']=value;return store;});};
  const make=initial=>box.NowNoteHistory.create({initial,context:()=>ctx,request,write});
  const now=new Date().toISOString();
  const note={id:null,owner_id:owner,device_id:device,local_id:local,note_type:'tree',title:'Vault HTTP QA',content:'before',
    parent_local_id:null,level:1,tags:'',source:'web-tree',created_at:now,updated_at:now,client_updated_at:now,deleted_at:null};
  let history=make();
  await history.track(note,null,{needsBaseline:true});await history.seal(local);await history.sync();
  assert.equal(history.view(local).outbox.length,0);assert.ok(history.view(local).base.head_revision_id);
  const original=history.view(local).base.head_revision_id;
  await fs.mkdir(path.join(vault,'Topic'),{recursive:true});
  const file=path.join(vault,'Topic','_index.md'),imported='Imported Vault HTTP body '+run;
  const markdown=renderManagedMarkdown({id:local,kind:'topic',title:note.title,body:imported,tags:[]});
  await fs.writeFile(file,markdown);
  updateStoreFile(storePath,store=>{
    store.values['nownote.web.v1']={tree:[{id:local,title:note.title,content:'before',level:1,parentId:null,tags:[],children:[],status:'active'}]};
    store.values['nownote.web.settings.v1']={server:{mode:'server',url:base,ownerId:owner,deviceId:device}};
    store.values['nownote.vault.v1']={path:vault,baselines:{}};return store;
  });
  const service=createVaultService({storePath,backupDir:path.join(own,'backups')});
  const plan=await service.previewVault({direction:'both'});
  const patch=await box.NowNoteHistory.prepareExternalEdit(history.export(),ctx,{...history.view(local).draft,content:imported,tags:''});
  const result=await service.applyVault({planId:plan.planId,selections:[{itemId:local,action:'toNowNote',historyPatch:patch}]});
  assert.equal(result.failed.length,0);assert.equal(result.applied.length,1);
  history=make(readStoreFile(storePath).store.values['nownote.history.v1']);
  await history.sync();
  assert.equal(history.view(local).outbox.length,0);assert.equal(history.view(local).conflict,null);
  const current=await request(ctx,'current','GET',{local_id:local});
  assert.equal(current.snapshot.note.content,imported);
  const previous=await request(ctx,'revision','GET',{local_id:local,revision_kind:'note_revision',revision_id:original});
  assert.equal(previous.snapshot.note.content,'before');
  history=make(readStoreFile(storePath).store.values['nownote.history.v1']);
  assert.equal(history.view(local).draft.content,imported);assert.equal(history.view(local).outbox.length,0);
  assert.equal(await fs.readFile(file,'utf8'),markdown);
  manifest.outcome='PASS';manifest.headVersion=current.head_version;manifest.originalRevision=original;
  console.log('Vault real WSL HTTP: import, canonical upload, old revision, cold journal and unchanged Vault PASS; run='+run);
}catch(error){
  manifest.outcome='FAIL';manifest.errorType=error.name;await save();
  throw Error('vault_http_failed_'+run+': '+error.message);
}finally{
  const resolved=path.resolve(own);
  if(!resolved.startsWith(root+path.sep))throw Error('qa_cleanup_boundary');
  await fs.rm(resolved,{recursive:true,force:true});
  manifest.cleanup='own profile removed';await save();
}
