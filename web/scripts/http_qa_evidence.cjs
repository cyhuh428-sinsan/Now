const fs=require('node:fs'),path=require('node:path');

function createEvidenceRecorder({manifestFile,mode,phase},io=fs){
  if(!['web','desktop'].includes(mode)||!Number.isInteger(phase)||phase<0)throw Error('qa_evidence_scope');
  const eventFile=path.join(path.dirname(manifestFile),path.basename(manifestFile,'.json')+'-'+mode+'-'+phase+'.events.jsonl');
  io.closeSync(io.openSync(eventFile,'wx'));
  const lines=[];let flushed=0;
  function flush(){
    if(flushed===lines.length)return;
    const manifest=JSON.parse(io.readFileSync(manifestFile,'utf8'));
    if(manifest.clientEvidence===undefined)manifest.clientEvidence=[];
    if(!Array.isArray(manifest.clientEvidence))throw Error('qa_evidence_manifest');
    for(let n=flushed;n<lines.length;n++)manifest.clientEvidence.push(JSON.parse(lines[n]));
    io.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));flushed=lines.length;
  }
  function record(evidence){
    const line=JSON.stringify(evidence);io.appendFileSync(eventFile,line+'\n');lines.push(line);
    if(['failure','result','error','event','localFailure','screenshot','graphFrame','syntheticProvider','syntheticProviderStarted'].some(key=>Object.hasOwn(evidence,key)))flush();
  }
  return {record,flush,eventFile};
}
module.exports={createEvidenceRecorder};
