const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
if(process.argv[2]==='--child'){
  const mode=process.argv[3],box=vm.createContext({structuredClone});
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../web/vendor/history-snapshot.js'),'utf8'),box);
  const raw=JSON.parse(JSON.stringify({schema_version:1,contexts:{A:{notes:Object.fromEntries(Array.from({length:200},(_,i)=>['note-'+i,
    {draft:{content:('note-'+i+'-').repeat(300)},revisions:Array.from({length:5},(_,j)=>({snapshot:{note:{content:('history-'+i+'-'+j+'-').repeat(180)}}}))}]))}}}));
  const capture=box.NowHistorySnapshots.create();global.gc();
  let latest,elapsed=0;const start=performance.now();latest=mode==='structuredClone'?structuredClone(raw):capture.capture(raw);const first=performance.now()-start;
  for(let i=0;i<10;i++){
    raw.contexts.A.notes['note-0'].draft.content='edit-'+i;const start=performance.now();
    latest=mode==='structuredClone'?structuredClone(raw):capture.capture(raw);elapsed+=performance.now()-start;
  }
  console.log(JSON.stringify({mode,node:process.versions.node,notes:200,revisions:1000,firstMs:+first.toFixed(2),edits10Ms:+elapsed.toFixed(2),
    stats:mode==='sharedSnapshot'?capture.stats():null,content:latest.contexts.A.notes['note-0'].draft.content}));
}else{
  for(const mode of ['structuredClone','sharedSnapshot']){
    const child=spawnSync(process.execPath,['--expose-gc',__filename,'--child',mode],{encoding:'utf8',windowsHide:true,timeout:15000});
    if(child.status!==0)throw Error(child.stderr||child.error?.message||'Snapshot benchmark failed');
    process.stdout.write(child.stdout);
  }
}
