import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {makeFixture} from './app-performance-fixture.mjs';
const script=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(script),'..');
const base='D:/tmp/nownote-241-migration',digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const candidateOnly=process.argv.includes('--candidate-only'),requested=process.argv.find(value=>value.startsWith('--sizes='));
const sizes=requested?requested.slice(8).split(',').map(Number):process.argv.includes('--smoke')?[1]:[1,8,16],iterations=process.argv.includes('--smoke')?1:3;
const modes=candidateOnly?['candidate']:['baseline','candidate'],memoryLimitBytes=1.2*1024**3;
if(!sizes.length||new Set(sizes).size!==sizes.length||sizes.some(value=>![1,8,16].includes(value)))throw Error('Unsupported benchmark sizes');

if(process.argv.includes('--plan'))console.log(JSON.stringify({sizes,iterations,modes,comparison:!candidateOnly,memoryLimitBytes}));
else if(process.argv[2]==='--prepare'){
  const profile=await fs.realpath(process.argv[3]),relative=path.relative(await fs.realpath(base),profile);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert.equal(path.basename(path.dirname(profile)).startsWith('perf-'),true);
  const require=createRequire(import.meta.url),file=require('../document-file.cjs');
  file.initialize(path.join(profile,'nownote-desktop-store.json'),{syntheticLegacy:true});file.closeAll();
}else{
  const baseline=process.env.NOWNOTE_BASELINE_EXE_PATH,candidate=process.env.NOWNOTE_DESKTOP_EXE_PATH;
  if(!baseline||!candidate||path.resolve(baseline)===path.resolve(candidate))throw Error('Two explicit separate product executables are required');
  const require=createRequire(path.join(root,'package.json')),asar=require('@electron/asar'),baselineSource={};
  for(const name of ['main.cjs','preload.cjs','app/app.js']){
    const bytes=asar.extractFile(path.join(path.dirname(baseline),'resources/app.asar'),name).toString().replace(/\r\n/g,'\n');
    const canonical=execFileSync('git',['show','main:desktop/'+name],{cwd:root,maxBuffer:12*1024*1024}).toString().replace(/\r\n/g,'\n');
    assert.equal(digest(bytes),digest(canonical),'Baseline must match main');baselineSource[name]=digest(bytes);
  }
  await fs.mkdir(base,{recursive:true});const own=await fs.mkdtemp(path.join(base,'perf-')),rows=[],sockets=new Set();let child;
  console.log('Own synthetic performance directory: '+path.basename(own));
  await fs.writeFile(path.join(own,'qa-owned.json'),JSON.stringify({schema_version:1,owner:'measure-app-performance',parentPid:process.pid,createdAt:new Date().toISOString()}));
  const until=async(action,label)=>{const end=Date.now()+30000;let last;while(Date.now()<end){try{const value=await action();if(value)return value;}catch(error){last=error;}await delay(80);}throw Error(label+': '+(last?.message||'timeout'));};
  async function debugPort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
  async function connect(target){
    const ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');sockets.add(ws);let id=0;const pending=new Map();
    ws.addEventListener('message',event=>{const row=JSON.parse(event.data),entry=pending.get(row.id);if(!entry)return;pending.delete(row.id);row.error?entry.reject(Error(row.error.message)):entry.resolve(row.result);});
    const command=async(method,params={})=>{const next=++id;let timer;const promise=new Promise((resolve,reject)=>{timer=setTimeout(()=>{pending.delete(next);reject(Error('CDP timeout '+method));},20000);pending.set(next,{resolve,reject});});ws.send(JSON.stringify({id:next,method,params}));try{return await promise;}finally{clearTimeout(timer);}};
    const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression:`(async()=>(${expression}))()`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
    return {command,evaluate,close(){ws.close();sockets.delete(ws);}};
  }
  const resources=pid=>{
    const result=spawnSync('pwsh',['-NoProfile','-File',path.join(root,'scripts/read-app-resources.ps1'),'-TargetProcessId',String(pid)],{encoding:'utf8',windowsHide:true,timeout:20000});
    if(result.status!==0)throw Error('Own resource probe failed: '+result.stderr);const value=JSON.parse(result.stdout);
    if(Math.max(value.privateBytes,value.workingSet)>memoryLimitBytes)throw Error('Synthetic app exceeded the 1.2GiB expansion budget');return value;
  };
  const settle=`(async()=>{await noteHistoryCaptureChain;await noteHistoryFlush();await noteHistory.idle();await Promise.all([...storagePendingWrites]);return true;})()`;
  async function stop(client){
    if(client){await client.evaluate('window.close()').catch(()=>{});client.close();}
    const alive=()=>child&&child.exitCode===null&&child.signalCode===null;
    if(alive())await Promise.race([once(child,'exit'),delay(5000)]);
    if(alive()){child.kill();await Promise.race([once(child,'exit'),delay(5000)]);}
    if(alive())throw Error('Owned performance child has not stopped');child=null;
  }
  try{
    for(const mib of sizes)for(let iteration=0;iteration<iterations;iteration++){
      const fixture=JSON.stringify(makeFixture(mib),null,2)+'\n',fixtureHash=digest(fixture);
      for(const [mode,exe]of [['baseline',baseline],['candidate',candidate]].filter(([mode])=>modes.includes(mode))){
        const profile=path.join(own,mode+'-'+mib+'-'+iteration);await fs.mkdir(profile);const filename=path.join(profile,'nownote-desktop-store.json');await fs.writeFile(filename,fixture);
        let conversionMs=null;
        if(mode==='candidate'){
          const started=performance.now(),prepare=spawnSync(exe,[script,'--prepare',profile],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',windowsHide:true,timeout:45000});
          if(prepare.status!==0)throw Error('Synthetic conversion failed: '+prepare.stderr);conversionMs=performance.now()-started;
          assert.equal(digest(await fs.readFile(filename+'.original-v1.json')),fixtureHash);
        }
        const port=await debugPort(),env={...process.env,NOWNOTE_DESKTOP_USER_DATA_DIR:profile,NOWNOTE_SYNTHETIC_MIGRATION:'1'};delete env.ELECTRON_RUN_AS_NODE;
        const start=performance.now();child=spawn(exe,[`--remote-debugging-port=${port}`,'--disable-gpu'],{env,windowsHide:true,stdio:['ignore','ignore','ignore']});
        await fs.writeFile(path.join(own,'qa-process.json'),JSON.stringify({pid:child.pid,profile,port,executable:exe}));
        let spawnError;child.on('error',error=>{spawnError=error;});
        const target=await until(async()=>{if(spawnError)throw spawnError;const response=await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(1000)});return (await response.json()).find(row=>row.type==='page'&&row.url.includes('index.html'));},'own performance target');
        const client=await connect(target);
        try{await until(()=>client.evaluate(`typeof noteHistory!=='undefined'&&noteHistory&&document.querySelector('#treeContent')&&state.data.tree.length===20&&typeof wikiUI!=='undefined'&&wikiUI!==null`),'synthetic app ready');}
        catch(error){console.log(await client.evaluate(`({ready:document.readyState,auth:document.documentElement.dataset.auth,history:typeof noteHistory,wiki:typeof wikiUI,tree:typeof state==='object'?state.data.tree.length:null})`));throw error;}
        await client.evaluate(settle);const startMs=performance.now()-start;
        await client.command('Page.bringToFront');
        const initialHeap=await client.command('Runtime.getHeapUsage'),before=resources(child.pid);
        const modeInfo=await client.evaluate(`({version:APP_VERSION,historyDeferred:Boolean(noteHistory.deferred?.()),graphLoaded:typeof cytoscape!=='undefined',visibility:document.visibilityState})`);
        const switchMs=await client.evaluate(`(()=>{const start=performance.now();selectTreeNode('perf-19');return performance.now()-start;})()`);
        await client.evaluate(settle);await client.evaluate(`selectTreeNode('perf-0')`);await client.evaluate(settle);
        const input=await client.evaluate(`(async()=>{const editor=document.querySelector('#treeContent'),next=editor.value+${JSON.stringify('\nSynthetic measured edit')};const start=performance.now();editor.value=next;editor.dispatchEvent(new Event('input',{bubbles:true}));const handlerMs=performance.now()-start;await noteHistoryCaptureChain;await noteHistoryFlush();await noteHistory.idle();await Promise.all([...storagePendingWrites]);if(findTreeNode(state.data.tree,'perf-0').content!==next)throw Error('Input not applied');return {handlerMs,durableMs:performance.now()-start};})()`);
        const searchMs=await client.evaluate(`(()=>{const element=document.querySelector('#searchInput'),start=performance.now();element.value='Synthetic memo 19';element.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-start;})()`);
        const finalHeap=await client.command('Runtime.getHeapUsage'),after=resources(child.pid);
        const revisionHashes=Object.fromEntries(Object.entries(JSON.parse(fixture).values['nownote.history.v1'].contexts[JSON.stringify(['','local_user'])].notes).map(([id,entry])=>[id,digest(JSON.stringify(entry.revisions))]));
        const verified=await client.evaluate(`(async()=>{const journal=await nownoteDesktop.storage.read('nownote.history.v1'),notes=journal.contexts[JSON.stringify(['','local_user'])].notes,expected=${JSON.stringify(revisionHashes)};
          for(const [id,hash]of Object.entries(expected)){const entry=notes[id];if(!entry||entry.revisions.length!==(id==='perf-0'?7:6))throw Error('History count differs: '+id);
            const bytes=new TextEncoder().encode(JSON.stringify(entry.revisions.slice(0,6))),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw Error('Original history changed: '+id);}
          if(!notes['perf-0'].draft.content.endsWith(${JSON.stringify('\nSynthetic measured edit')}))throw Error('Measured edit not durable');return true;})()`);
        assert.equal(verified,true);
        await client.evaluate(`(()=>{const element=document.querySelector('#searchInput');element.value='';element.dispatchEvent(new Event('input',{bubbles:true}));})()`);await client.evaluate(settle);
        await stop(client);
        if(mode==='candidate')assert.equal(digest(await fs.readFile(filename+'.original-v1.json')),fixtureHash);
        const row={mode,mib,iteration,fixtureHash,fixtureBytes:Buffer.byteLength(fixture),conversionMs,startMs,switchMs,...input,searchMs,modeInfo,durableAndHistoryVerified:verified,
          initialHeap:initialHeap.usedSize,finalHeap:finalHeap.usedSize,before,after,ioTransferDelta:{readBytes:after.readBytes-before.readBytes,writeBytes:after.writeBytes-before.writeBytes}};
        rows.push(row);console.log(JSON.stringify({mode,mib,iteration,startMs,input,workingSetMiB:after.workingSet/1024**2,privateMiB:after.privateBytes/1024**2,historyDeferred:modeInfo.historyDeferred}));
      }
    }
    const report={kind:'actual packaged apps; synthetic serial measurements; handler timings are not OS keyboard-to-paint latency; process I/O includes IPC, not SSD/file-only writes',comparison:!candidateOnly,baselineSource,
      baselineExecutableSha:digest(await fs.readFile(baseline)),candidateExecutableSha:digest(await fs.readFile(candidate)),rows};
    const reportDir=process.env.NOWNOTE_QA_REPORT_DIR;if(!reportDir)throw Error('Explicit private report directory required');await fs.mkdir(reportDir,{recursive:true});
    await fs.writeFile(path.join(reportDir,candidateOnly?'app-performance-candidate-only.json':process.argv.includes('--smoke')?'app-performance-smoke.json':'app-performance.json'),JSON.stringify(report,null,2));
  }catch(error){
    const reportDir=process.env.NOWNOTE_QA_REPORT_DIR;if(reportDir)await fs.writeFile(path.join(reportDir,'app-performance-last-error.json'),JSON.stringify({message:error.message,stack:error.stack,own:path.basename(own),pid:child?.pid,rows},null,2));
    throw error;
  }finally{
    for(const socket of sockets)socket.close();if(child)await stop();
    const resolved=await fs.realpath(own),parent=await fs.realpath(base);assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('perf-'));
    await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});console.log('Own performance profiles removed; installed product and user profiles unchanged');
  }
}
