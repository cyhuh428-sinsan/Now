import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol','note-history-state','wiki-state','wiki-ingest','wiki-sources'])vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);
const ctx={url:'https://synthetic.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:true};
let saved=null,fail=false,current=null;const requests=[];
const request=async(_ctx,path,method,body)=>{
  requests.push({path,method,body:structuredClone(body)});
  if(path==='revisions/import')return {imported_refs:body.entries.map(e=>({kind:'offline_branch',id:e.revision_id}))};
  if(method==='GET'){if(!current)throw Object.assign(Error('not_found'),{status:404});return structuredClone(current);}
  const time='2026-11-01T00:00:00.000000Z',revision=webcrypto.randomUUID();
  current={status:'ok',snapshot:{schema_version:1,note:{id:99,owner_id:ctx.owner,local_id:body.local_id,device_id:ctx.device,...body.note,created_at:time,updated_at:time,client_updated_at:time}},
    head_version:1,head_revision_id:revision,inventory_revision_ids:[revision],crypto_epoch:0,history_generation:1,protection_state:'legacy',identity_state:'coherent',replica_count:1,has_replica_variants:false};
  return {status:'ok',mutation_id:body.mutation_id,result_revision_id:revision,result_head_version:1,result_inventory_revision_ids:[revision],crypto_epoch:0,history_generation:1};
};
const history=box.NowNoteHistory.create({context:()=>ctx,write:async value=>{if(fail)throw Error('quota');saved=structuredClone(value);},request});
const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>history,readCurrent:id=>request(ctx,'current','GET',{local_id:id})};
const sources=box.NowNoteWikiSources.create(api);
await sources.captureFiles([{name:'source.md',arrayBuffer:async()=>new TextEncoder().encode('Exact publish text.').buffer}]);
const source=(await sources.list())[0];assert.equal(typeof sources.publishFiles,'function','explicit snapshot publication required');
await assert.rejects(()=>sources.publishFiles([source.id],{confirmed:false}));assert.equal(requests.length,0);
const before=JSON.stringify(saved);fail=true;await assert.rejects(()=>sources.publishFiles([source.id],{confirmed:true}),/quota/);assert.equal(JSON.stringify(saved),before);fail=false;assert.equal(requests.length,0);
const other={...history.view(source.manifest.note_ref.local_id).draft,local_id:'unselected',title:'Unselected',source:'manual'};
await history.track(other,null);await history.seal(other.local_id);
await sources.publishFiles([source.id],{confirmed:true});
assert.equal(requests.some(r=>r.body.local_id==='unselected'),false,'publish only selected source IDs, not every pending Note');
const published=(await sources.list())[0];assert.equal(published.manifest.origin,'server');assert.equal(published.manifest.source_revision_id,current.head_revision_id);
assert.equal(published.content,'Exact publish text.');assert.match(published.extraction.text_hash,/^[0-9a-f]{64}$/);assert.equal(published.extraction.text_hash,source.extraction.text_hash);
assert.equal(history.view(source.manifest.note_ref.local_id).wiki_source_snapshot.manifest.origin,'local','original extraction provenance remains immutable');
const puts=requests.filter(r=>r.method==='PUT').length;await sources.publishFiles([source.id],{confirmed:true});assert.equal(requests.filter(r=>r.method==='PUT').length,puts,'confirmed repeat uses existing revision without a new write');
console.log('Wiki snapshot publication: explicit text-only scope, durable intent before send, selected Note IDs only, actual revision proof and no-op PASS (synthetic Note HTTP only)');
