import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
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
