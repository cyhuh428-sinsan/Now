import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const {createEvidenceRecorder}=createRequire(import.meta.url)('./http_qa_evidence.cjs');
const manifestFile='synthetic-only.json',initial=JSON.stringify({run:'synthetic',clientEvidence:[{existing:true}]}),files=new Map([[manifestFile,initial]]);
let writes=0,fail=false;
const io={
  readFileSync:file=>files.get(file),
  writeFileSync:(file,value)=>{if(fail)throw Error('synthetic disk failure');writes++;files.set(file,value);},
  openSync:(file,flag)=>{assert.equal(flag,'wx');if(files.has(file))throw Error('existing evidence');files.set(file,'');return 1;},closeSync:()=>{},
  appendFileSync:(file,line)=>files.set(file,files.get(file)+line)
};
const recorder=createEvidenceRecorder({manifestFile,mode:'web',phase:69},io);
for(let n=0;n<1000;n++){
  const evidence={method:'GET',path:'/api/v1/wikis',status:200,n};recorder.record(evidence);evidence.status=999;
}
assert.equal(writes,0,'ordinary HTTP events must not rewrite the whole accumulated manifest');
assert.equal(files.get(manifestFile),initial);
const parsed=()=>files.get(recorder.eventFile).trim().split('\n').map(line=>JSON.parse(line));
assert.equal(parsed().length,1000);assert.ok(parsed().every((e,n)=>e.n===n&&e.status===200),'all append-only events are immutable, complete and ordered');
files.set(manifestFile,JSON.stringify({...JSON.parse(initial),independent:'preserved'}));
recorder.record({failure:'synthetic_stage_failed'});
assert.equal(writes,1);let manifest=JSON.parse(files.get(manifestFile));
assert.equal(manifest.clientEvidence.length,1002);assert.equal(manifest.independent,'preserved');assert.equal(manifest.clientEvidence[0].existing,true);
recorder.flush();assert.equal(writes,1,'flush must not duplicate already merged events');
recorder.record({result:{ok:true}});assert.equal(writes,2);
assert.throws(()=>createEvidenceRecorder({manifestFile,mode:'web',phase:69},io),/existing evidence/);
fail=true;assert.throws(()=>recorder.record({failure:'synthetic_disk_failure'}),/disk failure/);
assert.equal(parsed().at(-1).failure,'synthetic_disk_failure','failed manifest merge still preserves the append-only evidence');
fail=false;recorder.flush();assert.equal(JSON.parse(files.get(manifestFile)).clientEvidence.length,1004);
console.log('HTTP QA evidence: 1000 exact ordered events, no per-request manifest rewrite, failure/result barriers, immutable sidecar and no duplicate flush PASS');
const host=fs.readFileSync(new URL('./note_protection_http_host.cjs',import.meta.url),'utf8');
assert.ok(host.includes('failureState'),'a failed wait needs secret-safe actual dialog and busy diagnostics');
const capture=host.match(/const failureStateScript=`([\s\S]*?)`;/)[1];
let status='synthetic secret and document body';
const context={document:{querySelector:()=>({open:true,querySelector:selector=>selector==='[role=status]'?{textContent:status}:{disabled:true}})},__WIKI_QA_WAIT_FAILURE__:{code:'wiki_ingest_journey_answer_preview',elapsedMs:18042}};
const diagnose=()=>JSON.parse(JSON.stringify(vm.runInNewContext(capture,context)));
assert.deepEqual(diagnose(),{open:true,busy:true,status:'unclassified',waitCode:'wiki_ingest_journey_answer_preview',elapsedMs:18042});
status='wiki_source_changed';assert.equal(diagnose().status,status);
status='검토 중 저장 상태가 변경되었습니다. 다시 확인하세요.';assert.equal(diagnose().status,'journal_changed');
context.__WIKI_QA_WAIT_FAILURE__={code:'arbitrary private data',elapsedMs:-1};
assert.equal(diagnose().waitCode,null);assert.equal(diagnose().elapsedMs,null);
const fixture=fs.readFileSync(new URL('./wiki_ingest_http_fixture.js',import.meta.url),'utf8');
const until=fixture.match(/  async function until\(test,code\)\{[^\n]+/)[0];
context.performance={now:()=>18042};context.delay=async()=>{};
vm.runInNewContext('globalThis.__HTTP_QA_CAPTURE_FAILURE__=()=>'+capture,context);
status='wiki_source_changed';
await assert.rejects(vm.runInNewContext(until+"\nuntil(()=>false,'journey_answer_preview')",context),/journey_answer_preview/);
context.document.querySelector=()=>null;
assert.equal(context.__WIKI_QA_FAILURE_STATE__.open,true,'capture before fixture finally closes the dialog');
assert.equal(context.__WIKI_QA_FAILURE_STATE__.busy,true);
assert.equal(context.__WIKI_QA_FAILURE_STATE__.status,'wiki_source_changed');
console.log('HTTP QA failure diagnostics: exact actual host expression, busy/wait state and private-text exclusion PASS');
