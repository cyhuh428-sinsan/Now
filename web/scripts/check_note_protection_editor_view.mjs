import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const parent='D:/tmp/now-240-protected-view';
await fs.mkdir(parent,{recursive:true});
const own=await fs.mkdtemp(path.join(parent,'client-'));
let child;
try {
  const require=createRequire(new URL('../../desktop/package.json',import.meta.url)),electron=require('electron');
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(electron,[path.join(root,'web/scripts/note_protection_editor_view_host.cjs'),own],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',v=>{output=(output+v).slice(-4000);});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});child=null;
  const result=JSON.parse(await fs.readFile(path.join(own,'result.json'),'utf8'));
  assert.equal(result.ok,true,result.error);assert.equal(code,0,output);console.log(JSON.stringify(result));
}finally{
  if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  assert.ok(path.resolve(own).startsWith(path.resolve(parent)+path.sep));
  await fs.rm(own,{recursive:true,force:true,maxRetries:6,retryDelay:500});
  assert.equal(await fs.stat(own).then(()=>true,()=>false),false);
}
