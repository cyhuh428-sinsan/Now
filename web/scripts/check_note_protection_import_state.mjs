import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const P=box.NowNoteProtectionState;
assert.equal(typeof P.createImport,'function','MI requires its own purpose-fixed durable controller');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',device:'one',instance:'00000000-0000-4000-8000-000000000001'};
const key='memory-only-key',secret='MI-PRIVATE-ORIGINAL-\r\n';
let ctx={...scope,enabled:true,auth:'first'},markers={},prepares=0,builds=0,stages=0,commits=0,settles=0,applies=0,done=false,lost=true,casFailure=true;
const writes=[],journal={protectionOperations:()=>structuredClone(markers),saveProtection:async m=>{
  P.validateMarker(m);const text=JSON.stringify(m);assert.equal(text.includes(secret),false);assert.equal(text.includes(key),false);
  markers[m.id]=structuredClone(m);writes.push(text);
}};
const intent={schema_version:3,purpose:'mixed_offline_import',prepare:{mutation_id:'00000000-0000-4000-8000-000000000002'},
  local_branches:[{revision_id:'original-uuid',snapshot:{content:secret},origin_device_id:'original-device',parent_ref:null}]};
const receipt={operation_id:'server-original',result:{version:3}};
const remote={
  prepareWrite:async()=>{throw Error('wrong_endpoint');},
  prepareImport:async(s,i)=>{prepares++;assert.equal(i.local_branches[0].origin_device_id,'original-device');return {id:'server-original'};},
  stage:async(s,p,w)=>{stages++;assert.equal(w.transfers[0].raw,'original-fixed-cipher');},
  status:async()=>done?{state:'committed',receipt,receipt_matches_current:true}:{state:'prepared'},
  commit:async(s,p,w)=>{commits++;assert.equal(w.commit.mutation_id,intent.prepare.mutation_id);done=true;if(lost){lost=false;throw Error('response_lost');}return {state:'committed',receipt,receipt_matches_current:true};}
};
const local={cipher:'original-local-cipher'};
const options={context:()=>ctx,journal,remote,capture:async()=>structuredClone(local),
  settle:async()=>{settles++;return {cipher:'receipt-bound-local-cipher'};},
  apply:async(s,before,work,r,guard)=>{assert.equal(guard(),true);assert.deepEqual(before,local);
    assert.equal(work.local.cipher,'receipt-bound-local-cipher');assert.deepEqual(r,receipt);applies++;
    if(casFailure){casFailure=false;throw Error('local_CAS_failure');}}
};
const build=async(p,i)=>{builds++;return {transfers:[{raw:'original-fixed-cipher'}],commit:{mutation_id:i.prepare.mutation_id},branches:i.local_branches};};
let controller=P.createImport(options);
await assert.rejects(P.createWrite(options).start(scope,intent,key),/purpose/);
const id=await controller.start(scope,intent,key);assert.equal(prepares,0);
await assert.rejects(P.createWrite(options).resume(id,key,build),/bundle_binding/);
await assert.rejects(controller.resume(id,'wrong-key',build));assert.equal(prepares,0);
await assert.rejects(controller.resume(id,key,build),/response_lost/);
assert.equal(markers[id].phase,'committing');assert.equal(commits,1);assert.equal(builds,1);
controller.invalidate();ctx={...ctx,owner:'bob',auth:'bob'};
await assert.rejects(controller.resume(id,key,build),/scope/);assert.equal(commits,1);
ctx={...scope,enabled:true,auth:'reauthenticated'};controller=P.createImport(options);
await assert.rejects(controller.resume(id,key,build),/local_CAS_failure/);
assert.equal(markers[id].phase,'applying');assert.equal(commits,1);assert.equal(prepares,1);assert.equal(builds,1);assert.equal(stages,1);assert.equal(settles,1);
controller=P.createImport(options);await controller.resume(id,key,build);
assert.equal(markers[id].phase,'complete');assert.equal(settles,1);assert.equal(applies,2);assert.equal(commits,1);assert.equal(builds,1);
const original=structuredClone(markers[id]);await controller.resume(id,key,build);assert.deepEqual(markers[id],original);
const wrongPurpose={...intent,purpose:'mixed_note_write'};
await assert.rejects(controller.start(scope,wrongPurpose,key),/purpose/);
assert.equal(writes.some(text=>text.includes(secret)||text.includes(key)),false);
console.log('MI durable state: purpose isolation, original cipher after lost response, status-first restart, one settlement and CAS resume PASS (synthetic only)');
