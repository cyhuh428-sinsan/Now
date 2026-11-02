const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {writeStoreFile,updateStoreFile}=require('../store-file.cjs');
const base='D:/tmp/nownote-241-store-baseline';
fs.mkdirSync(base,{recursive:true});
const own=fs.mkdtempSync(path.join(base,'run-')),results=[];
try{
  for(const mib of [1,8,16]){
    const file=path.join(own,'store-'+mib+'.json');
    writeStoreFile(file,{version:1,values:{'nownote.web.settings.v1':{fontSize:'medium'},
      'nownote.history.v1':{schema_version:1,syntheticFixture:true,content:'x'.repeat(mib*1024*1024)}}});
    const size=fs.statSync(file).size,counters={readBytes:0,writeBytes:0,reads:0,writes:0};
    const read=fs.readFileSync,write=fs.writeFileSync;
    fs.readFileSync=function(...args){const result=read.apply(this,args);counters.readBytes+=Buffer.byteLength(result);counters.reads++;return result;};
    fs.writeFileSync=function(target,bytes,...args){counters.writeBytes+=Buffer.byteLength(bytes);counters.writes++;return write.call(this,target,bytes,...args);};
    const started=performance.now();
    try{updateStoreFile(file,store=>{store.values['nownote.web.settings.v1']={fontSize:'large'};return store;});}
    finally{fs.readFileSync=read;fs.writeFileSync=write;}
    const durationMs=Math.round((performance.now()-started)*100)/100;
    assert.equal(JSON.parse(read(file,'utf8')).values['nownote.web.settings.v1'].fontSize,'large');
    assert.ok(counters.readBytes>=size,'Current baseline must demonstrate the complete store read');
    assert.ok(counters.writeBytes>size-1024,'Current baseline must demonstrate the complete store rewrite');
    results.push({fixtureMiB:mib,fileBytes:size,changedValueBytes:Buffer.byteLength(JSON.stringify({fontSize:'large'})),...counters,durationMs,rssMiB:Math.round(process.memoryUsage().rss/1024/1024)});
  }
  console.log(JSON.stringify({kind:'synthetic legacy storage baseline; not an editor latency or leak benchmark',results},null,2));
}finally{
  const resolved=fs.realpathSync(own);
  if(!resolved.startsWith(path.resolve(base)+path.sep)||fs.lstatSync(own).isSymbolicLink())throw Error('Cleanup boundary mismatch');
  fs.rmSync(own,{recursive:true,force:true});
  console.log('Own synthetic fixture directory removed; real user data untouched');
}
