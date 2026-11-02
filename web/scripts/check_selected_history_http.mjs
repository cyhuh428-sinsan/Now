import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),parent=path.resolve('D:/tmp/now-240-stage-e3');
await fs.mkdir(parent,{recursive:true});const own=await fs.mkdtemp(path.join(parent,'selected-'));
const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;
await new Promise(resolve=>socket.close(resolve));
const env={...process.env,NOWNOTE_HISTORY_QA_DIR:own,NOWNOTE_HISTORY_QA_PORT:String(port),NOWNOTE_SELECTED_HTTP_QA_URL:`http://127.0.0.1:${port}/`,NOWNOTE_LAZY_WIKI_QA:'1'};
let api,qa,exited=false,apiExit=null,qaExit=null,diagnostic='';
try{
  api=spawn(process.env.NOWNOTE_QA_PYTHON||'python',['-B','web/scripts/run_note_history_qa.py'],{cwd:root,env,stdio:['ignore','ignore','pipe'],windowsHide:true});
  api.on('error',()=>{exited=true;});api.on('exit',code=>{exited=true;apiExit=code;});
  // Drain diagnostics without publishing account credentials or fixture bodies.
  api.stderr.on('data',chunk=>{diagnostic=(diagnostic+String(chunk)).slice(-16384);});
  let ready=false;
  for(let i=0;i<180;i++){
    if(exited){const missing=/ModuleNotFoundError: No module named ['"]([\w.]+)['"]/.exec(diagnostic),kind=[...diagnostic.matchAll(/\b([A-Za-z]+Error):/g)].at(-1)?.[1];
      const frames=[...diagnostic.matchAll(/File "([^"]+)", line (\d+)/g)].slice(-4).map(match=>({file:path.basename(match[1]),line:Number(match[2])}));
      throw Error('Selected history QA API failed to start: '+JSON.stringify({exit:apiExit,kind,missing:missing?.[1],frames}));}
    try{const response=await fetch(env.NOWNOTE_SELECTED_HTTP_QA_URL+'health/ready',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
    await delay(250);
  }
  if(!ready)throw Error('Selected history QA API readiness timeout');
  qa=spawn(process.execPath,['web/scripts/check_wiki_workspace.mjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});
  qaExit=await new Promise((resolve,reject)=>{qa.once('error',reject);qa.once('exit',resolve);});
  if(qaExit!==0)throw Error('Selected history actual renderer/HTTP QA failed');
  console.log('Selected history Web/Desktop loopback API/import/receipt: PASS; paid Provider calls 0');
}finally{
  if(qa&&qa.exitCode===null){qa.kill();await Promise.race([once(qa,'exit').catch(()=>{}),delay(10000)]);}
  if(api&&!exited){api.kill();await Promise.race([once(api,'exit').catch(()=>{}),delay(10000)]);}
  if(api&&!exited||qa&&qa.exitCode===null)throw Error('QA children still active; own folder preserved');
  const resolved=await fs.realpath(own),resolvedParent=await fs.realpath(parent);
  if(path.dirname(resolved)!==resolvedParent)throw Error('QA cleanup boundary');
  // Windows may release the terminated interpreter's SQLite handle slightly after exit.
  await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  try{await fs.access(resolved);throw Error('QA profile remains');}catch(error){if(error.code!=='ENOENT')throw error;}
  console.log('Own selected-history API process, synthetic SQLite/accounts and renderer profiles removed');
}
