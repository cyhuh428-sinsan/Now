import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['protocol','state','history-state']) {
  const file=name==='history-state'?'note-history-state.js':'note-protection-'+name+'.js';
  vm.runInNewContext(await readFile(new URL('../vendor/'+file,import.meta.url),'utf8'),box);
}
const P=box.NowNoteProtectionState,copy=structuredClone;
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'linked',device:'one',instance:'00000000-0000-4000-8000-000000000001'};
const base={crypto_epoch:0,head_version:0,head_revision_id:null,history_generation:2,inventory_revision_ids:[],identity_state:'related_only',current_exists:false,protection_state:'legacy'};
const intent={schema_version:2,purpose:'conversion',drain:{crypto_epoch:0,expected_history_generation:2},prepare:{crypto_epoch:0,base_head_version:0,base_revision_id:null,expected_history_generation:2,expected_inventory_revision_ids:[],target_epoch:1,local_branches:[]}};
let status={server_instance_id:scope.instance,...copy(base)},reads=0;
const wire=P.createRemote({request:async(s,path,method,body)=>{
  assert.equal(path,'/api/v2/notes/crypto-transitions/status');assert.equal(method,'GET');
  assert.deepEqual(copy(body),{owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device});reads++;return copy(status);
}});
assert.equal(await wire.verifyEmptyLocal(scope,intent),true);
for(const changed of [{current_exists:true},{identity_state:'coherent'},{identity_state:'branch_only'},{crypto_epoch:1},{protection_state:'protected'},{head_revision_id:scope.instance},{inventory_revision_ids:[scope.instance]},{history_generation:3},{server_instance_id:'00000000-0000-4000-8000-000000000002'}]) {
  status={server_instance_id:scope.instance,...copy(base),...changed};
  await assert.rejects(()=>wire.verifyEmptyLocal(scope,intent),/server_only|context|instance/);
}
status={server_instance_id:scope.instance,...copy(base)};
for(const changed of [{schema_version:3},{purpose:'mixed_conversion'},{prepare:{...intent.prepare,target_epoch:2}},{prepare:{...intent.prepare,local_branches:[{}]}},{drain:{crypto_epoch:0,expected_history_generation:1}}]) {
  await assert.rejects(()=>wire.verifyEmptyLocal(scope,{...copy(intent),...changed}),/server_only|context/);
}
let context={...scope,enabled:true,auth:'synthetic'},saved={schema_version:1,contexts:{}},scan=[],failRead=false;
const journal=box.NowNoteHistory.create({initial:saved,context:()=>({...context,online:false}),request:async()=>{},write:async v=>{saved=copy(v);}});
let values={data:{tree:[]},fallback:{tree:[]}};
const stores=()=>['data','fallback','history'].map(name=>({name,kind:name==='history'?'history':'data',read:async()=>{scan.push(name);if(failRead&&name==='fallback')throw Error('store_read_failed');return copy(name==='history'?journal.export():values[name]);},cas:async()=>{throw Error('unexpected_local_write');}}));
let drains=0,committed=false,proofCalls=0;
const remote={verifyEmptyLocal:async(s,i)=>{assert.deepEqual(scan.slice(-3),['data','fallback','history']);proofCalls++;return wire.verifyEmptyLocal(s,i);},drainPrepare:async()=>{drains++;return {drain_id:'synthetic',drain_version:1,accepted_runs:[],accepted_claims:[],state:'ready',pending_count:0};},drainStatus:async()=>({drain_id:'synthetic',drain_version:1,accepted_runs:[],accepted_claims:[],state:'ready',pending_count:0}),fresh:async()=>({verified:true}),prepare:async()=>({promoted:true}),stage:async()=>{},status:async()=>({state:committed?'committed':'prepared',receipt_matches_current:true,receipt:committed?{operation_id:'synthetic'}:null}),commit:async()=>{committed=true;return remote.status();}};
const create=r=>P.create({context:()=>context,journal,stores,remote:r,preflight:async()=>{}});
await assert.rejects(()=>create({...remote,verifyEmptyLocal:undefined}).start(scope,intent,'synthetic'),/local_copies_missing/);
assert.equal(drains,0);
failRead=true;
await assert.rejects(()=>create(remote).start(scope,intent,'synthetic'),/store_read_failed/);
assert.equal(proofCalls,0);failRead=false;
values.data.tree=[{id:'linked',content:'unattributed',children:[]}];
await assert.rejects(()=>create(remote).start(scope,intent,'synthetic'),/scope_unverified/);
assert.equal(proofCalls,0);values.data.tree=[];
await assert.rejects(()=>create({...remote,verifyEmptyLocal:async()=>false}).start(scope,intent,'synthetic'),/local_copies_missing/);
await assert.rejects(()=>create({...remote,verifyEmptyLocal:async()=>{context={...context,auth:'changed'};return true;}}).start(scope,intent,'synthetic'),/scope_changed/);
assert.equal(Object.keys(journal.protectionOperations()).length,0);
const c=create(remote),id=await c.start(scope,intent,'synthetic');
assert.equal(drains,1);assert.equal(c.status(id).phase,'draining');
const bundle=JSON.parse(await box.NowNoteProtectionProtocol.decryptContent(c.status(id).cipher_bundle,'synthetic'));
assert.ok(bundle.stores.every(s=>s.patches.length===0));
await c.resume(id,'synthetic',async()=>({verified:true}));
assert.equal(c.status(id).phase,'complete');assert.deepEqual(values,{data:{tree:[]},fallback:{tree:[]}});
console.log('server-only conversion: verified status/base, exhaustive stores, default denial, read/attribution/auth failure, durable empty apply PASS');
