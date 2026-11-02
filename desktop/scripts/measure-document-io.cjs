const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{once}=require('node:events'),{createInterface}=require('node:readline');
const {randomUUID,webcrypto,createHash}=require('node:crypto');
const base=path.resolve('D:/tmp/nownote-241-migration'),root=path.resolve(__dirname,'..');
const account=JSON.stringify(['https://qa.invalid','bench']);
const hash=value=>createHash('sha256').update(value).digest('hex');
async function child(){
  const own=fs.realpathSync(process.argv[3]),mode=process.argv[4],mib=Number(process.argv[5]);
  assert.equal(path.dirname(own),fs.realpathSync(base));assert.ok(path.basename(own).startsWith('io-'));
  assert.ok(['legacy','sqlite'].includes(mode)&&[1,8,16].includes(mib));
  const folder=path.join(own,mode+'-'+mib);fs.mkdirSync(folder);const filename=path.join(folder,'store.json');
  globalThis.crypto=webcrypto;require('../../web/vendor/note-history-state.js');
  const file=require('../document-file.cjs'),old=require('../tests/fixtures/store-file-240.cjs');
  const context=()=>({url:'https://qa.invalid',owner:'bench',auth:'synthetic',device:'qa',enabled:true,online:false});
  const note=id=>({owner_id:'bench',local_id:id,note_type:'tree',source:'manual',title:id,content:'current'});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,head_version:0,head_revision_id:null,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[],localOnly:true});
  let initial={schema_version:1,contexts:{[account]:{notes:{target:entry('target'),ballast:entry('ballast')}}}};
  const padding='UNRELATED_HISTORY:'+ 'x'.repeat(mib*1024*1024),paddingHash=hash(padding);
  initial.contexts[account].notes.ballast.revisions.push({revision_id:randomUUID(),snapshot:{note:{...note('ballast'),content:padding}}});
  old.writeStoreFile(filename,{version:1,updatedAt:null,values:{'nownote.history.v1':initial}});
  const sourceBytes=fs.statSync(filename).size;let engine,service,sender={},expected,revision;
  if(mode==='legacy'){
    expected=initial;
    engine=NowNoteHistory.create({initial,context,request:async()=>{throw Error('Network forbidden');},write:async value=>{old.compareAndSetStoreValue(filename,'nownote.history.v1',value,expected);expected=value;}});
  }else{
    file.initialize(filename,{syntheticLegacy:true});file.closeAll();
    service=require('../history-session.cjs').createHistorySession(()=>filename);
    revision=service.current(sender,account).stamp;
  }
  initial=null;global.gc?.();
  const lines=createInterface({input:process.stdin}),commands=lines[Symbol.asyncIterator]();
  const next=async command=>assert.equal((await commands.next()).value,command);
  const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
  send({phase:'ready',sourceBytes,mode,mib,runtime:{node:process.versions.node,electron:process.versions.electron,sqlite:process.versions.sqlite},heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss});
  await next('write');
  let clones=0,wholeClones=0,parseBytes=0;
  const clone=globalThis.structuredClone,parse=JSON.parse;
  globalThis.structuredClone=(value,...args)=>{clones++;if(value?.contexts?.[account]?.notes?.ballast)wholeClones++;return clone(value,...args);};
  JSON.parse=(text,...args)=>{if(typeof text==='string')parseBytes+=Buffer.byteLength(text);return parse(text,...args);};
  const start=performance.now();
  try{
    if(mode==='sqlite'){
      const opened=service.select(sender,{account,id:'target',stamp:revision});expected=opened.entry;revision=opened.revision;
      engine=NowNoteHistory.create({initial:{schema_version:1,contexts:{[account]:{notes:{target:expected}}}},context,request:async()=>{throw Error('Network forbidden');},
        write:async value=>{const next=value.contexts[account].notes.target,receipt=service.note(sender,{account,id:'target',expected,next,revision});expected=next;revision=receipt.revision;}});
    }
    await engine.edit({...note('target'),content:'ONE_SMALL_EDIT'});await engine.seal('target');await engine.idle();
  }finally{globalThis.structuredClone=clone;JSON.parse=parse;}
  send({phase:'done',elapsedMs:+(performance.now()-start).toFixed(2),clones,wholeClones,parseBytes,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss});
  await next('verify');file.closeAll();
  const stored=mode==='legacy'?old.readStoreFile(filename).store.values['nownote.history.v1']:(file.initialize(filename),file.readKey(filename,'nownote.history.v1'));
  assert.equal(stored.contexts[account].notes.target.draft.content,'ONE_SMALL_EDIT');assert.equal(stored.contexts[account].notes.target.revisions.length,1);
  assert.equal(hash(stored.contexts[account].notes.ballast.revisions[0].snapshot.note.content),paddingHash);
  file.closeAll();send({phase:'verified',preserved:true});lines.close();process.stdin.pause();
}
async function main(){
  if(process.platform!=='win32')throw Error('Windows OS I/O counters are required; benchmark not run');
  const repository=path.resolve(root,'..'),sources=['desktop/document-store.cjs','desktop/partitioned-store.cjs','desktop/document-file.cjs','desktop/history-session.cjs','desktop/app/document-parts.js','desktop/app/journal-writes.js','desktop/tests/fixtures/store-file-240.cjs','web/vendor/note-history-state.js','desktop/scripts/measure-document-io.cjs','desktop/scripts/read-process-io.ps1'];
  const sourceHashes=()=>Object.fromEntries(sources.map(name=>[name,hash(fs.readFileSync(path.join(repository,name),'utf8').replace(/\r\n/g,'\n'))]));
  const sourceHashesLF=sourceHashes();
  fs.mkdirSync(base,{recursive:true});const own=fs.mkdtempSync(path.join(base,'io-')),rows=[];let active;
  const runtime=process.env.NOWNOTE_ELECTRON_PATH||process.execPath;
  const probe=pid=>{
    const result=spawnSync('pwsh',['-NoProfile','-File',path.join(__dirname,'read-process-io.ps1'),'-TargetProcessId',String(pid)],{encoding:'utf8',windowsHide:true,timeout:15000});
    if(result.status!==0)throw Error('Own process I/O probe failed: '+(result.stderr||result.error?.message||result.status));return JSON.parse(result.stdout);
  };
  try{
    for(const mib of [1,8,16])for(const mode of ['legacy','sqlite']){
      active=spawn(runtime,['--expose-gc',__filename,'--child',own,mode,String(mib)],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',NODE_NO_WARNINGS:'1'},stdio:['pipe','pipe','pipe'],windowsHide:true});
      let stderr='';active.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
      const input=createInterface({input:active.stdout}),iterator=input[Symbol.asyncIterator]();
      const read=async phase=>{let timer;try{
        const line=await Promise.race([iterator.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Child measurement timeout')),45000);})]);
        if(line.done)throw Error('Own measurement child exited: '+stderr);const result=JSON.parse(line.value);assert.equal(result.phase,phase);return {value:result,bytes:Buffer.byteLength(line.value+'\n')};
      }finally{clearTimeout(timer);}};
      const ready=(await read('ready')).value,before=probe(active.pid);active.stdin.write('write\n');
      const done=await read('done'),after=probe(active.pid),writeBytes=after.writeBytes-before.writeBytes-done.bytes;
      assert.ok(writeBytes>=0);if(mode==='sqlite')assert.equal(done.value.wholeClones,0);else assert.ok(writeBytes>=ready.sourceBytes);
      active.stdin.write('verify\n');assert.equal((await read('verified')).value.preserved,true);
      const exit=active.exitCode===null?(await once(active,'exit'))[0]:active.exitCode;assert.equal(exit,0);input.close();active=null;
      rows.push({...ready,...done.value,phase:undefined,osWriteBytes:after.writeBytes-before.writeBytes,stdoutBytes:done.bytes,fileWriteTransferBytes:writeBytes,osReadBytes:after.readBytes-before.readBytes});
      console.log(mode+' '+mib+'MiB: file write transfer '+writeBytes+' bytes; whole clones '+done.value.wholeClones);
    }
    assert.deepEqual(sourceHashes(),sourceHashesLF,'Source changed during measurement');
    const report={kind:'synthetic source History edit+seal; OS process I/O minus measured stdout; not SSD physical writes or editor latency',
      memoryScope:'instrumented child observations include fixture setup; not steady-state editor memory',sourceHashesLF,rows};
    if(process.env.NOWNOTE_QA_REPORT_DIR){fs.mkdirSync(process.env.NOWNOTE_QA_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NOWNOTE_QA_REPORT_DIR,'document-io-'+randomUUID()+'.json'),JSON.stringify(report,null,2));}
    console.log(JSON.stringify(report));
  }finally{
    if(active&&active.exitCode===null){active.kill();await once(active,'exit').catch(()=>{});}
    const resolved=fs.realpathSync(own);assert.equal(path.dirname(resolved),fs.realpathSync(base));assert.equal(fs.lstatSync(own).isSymbolicLink(),false);
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});console.log('Own measurement children and fixture directory removed');
  }
}
(process.argv[2]==='--child'?child():main()).catch(error=>{console.error(error.message);process.exitCode=1;});
