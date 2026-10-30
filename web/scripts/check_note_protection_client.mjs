import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const views = process.argv.includes('--e4b3a');
const qa = path.resolve(views ? 'D:/tmp/now-240-e4b3a' : 'D:/tmp/now-240-e4b2');
await fs.mkdir(qa,{recursive:true});
const own = await fs.mkdtemp(path.join(qa,'client-'));
assert.ok(own.startsWith(qa + path.sep));
const server = createServer(async(req,res)=>{
  try {
    const pathname = new URL(req.url,'http://127.0.0.1').pathname;
    if(pathname.startsWith('/api/')) { res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"detail":{"code":"synthetic_not_implemented"}}');return; }
    const file = path.resolve(root,'web','.'+decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if(!file.startsWith(path.join(root,'web')+path.sep))throw Error('file boundary');
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream','Cache-Control':'no-store'});
    res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
});
let child = null;
try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8750,'127.0.0.1',resolve);});
  const require = createRequire(new URL('../../desktop/package.json',import.meta.url));
  const electron = require('electron');
  for(const mode of ['desktop','web'].filter(mode=>!process.argv.some(a=>a.startsWith('--mode=')) || process.argv.includes('--mode='+mode))) {
    const profile = path.join(own,mode); await fs.mkdir(profile);
    let serverState = null;
    for(const phase of [1,2]) {
      const result = path.join(own,mode+'-'+phase+'.json'), config = path.join(own,mode+'-'+phase+'-config.json');
      await fs.writeFile(config,JSON.stringify({root,profile,mode,phase,result,suite:views?'e4b3a':'e4b2',serverState,
        screenshot:views&&phase===2?process.env.NOWNOTE_PROTECTION_SCREENSHOT_DIR:null}));
      const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
      child = spawn(electron,[path.join(root,'web/scripts/note_protection_client_host.cjs'),config],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output = '';
      child.stdout.on('data',data=>{output=(output+data).slice(-8000);});child.stderr.on('data',data=>{output=(output+data).slice(-8000);});
      const status = await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      child = null; assert.equal(status,0,output);
      const evidence = JSON.parse(await fs.readFile(result,'utf8'));
      assert.equal(evidence.ok,true);serverState=evidence.serverState;delete evidence.serverState;console.log(JSON.stringify(evidence));
    }
  }
} finally {
  if(child && child.exitCode === null) { child.kill(); await new Promise(r=>child.once('exit',r)); }
  await new Promise(r=>server.close(r));
  if(!path.resolve(own).startsWith(qa + path.sep))throw Error('cleanup boundary');
  await fs.rm(own,{recursive:true,force:true,maxRetries:6,retryDelay:500});
  assert.equal(await fs.stat(own).then(()=>true,()=>false),false);
}
