const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const surface of ['web','desktop/app'])test(surface+': browse prepares only readonly lifecycle metadata and never falls back after a read failure',async()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../'+surface+'/app.js'),'utf8'),start=source.indexOf('async function prepareWikiBrowse()');
  assert.ok(start>=0,'explicit browse preparation is wired into the product');const tail=source.slice(start),end=tail.indexOf('\nfunction initializeWikiNotebook(');assert.ok(end>0);
  for(const mode of ['metadata','pending','stale']){
    let full=0,reads=0;const account=JSON.stringify(['https://qa.invalid','alice']);
    const directory=async(_key,p)=>{reads++;if(mode==='stale')throw Error('stale');return {projection:'path_v1',found:true,stamp:'one',part:{type:'object',entries:p.at(-1)==='wiki_ingest_operations'&&mode==='pending'?[['op',{}]]:[]}};};
    const read=async()=>{reads++;return {projection:'path_v1',found:true,stamp:'one',value:{}};};
    const box=vm.createContext({Set,NowWikiLifecycle:{validateMap:x=>x},NOTE_HISTORY_KEY:'history',isDesktopClient:()=>surface!=='web',
      nownoteDesktop:{storage:{readDirectory:directory,readPath:read}},browserHistoryStorage:()=>({readDirectory:p=>directory('history',p),readPath:read}),
      noteHistory:{prepareWikiIndex:fn=>fn({stamp:'one',account,metadata:['wiki_lifecycle','wiki_ingest_operations'],guard:{active:()=>true}}).then(Boolean),ensure:async()=>{full++;}}});
    vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../vendor/wiki-index-reader.js'),'utf8'),box);vm.runInContext(tail.slice(0,end),box);
    if(mode==='stale')await assert.rejects(vm.runInContext('prepareWikiBrowse()',box),/stale/);else await vm.runInContext('prepareWikiBrowse()',box);
    assert.equal(full,mode==='pending'?1:0);assert.ok(reads>0);
  }
  assert.ok(source.includes("args[0]==='browse'?prepareWikiBrowse():noteHistory.ensure()"));
});
