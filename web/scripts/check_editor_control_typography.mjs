import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'desktop/package.json'));
const own=await fs.mkdtemp('D:/tmp/nownote-control-type-');
try{
  const result=await new Promise(resolve=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const child=spawn(require('electron'),[path.join(root,'web/scripts/editor_control_typography_host.cjs'),root,own],{env,stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
    child.on('exit',code=>resolve({code,output}));
  });
  assert.equal(result.code,0,result.output);console.log(result.output.trim());
}finally{
  const real=await fs.realpath(own);
  assert.equal(path.dirname(real).toLowerCase(),'d:\\tmp');
  assert.ok(path.basename(real).startsWith('nownote-control-type-'));
  await fs.rm(real,{recursive:true,force:true});
}
