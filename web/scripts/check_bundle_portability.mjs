import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const temp=await fs.mkdtemp('D:/tmp/now-240-stage-b/bundle-');
const files=['web/app.js','desktop/app/app.js','web/scripts/bundle_markdown.mjs',
  'web/vendor/marked.umd.js','web/vendor/purify.min.js','web/vendor/document-renderer.js',
  'web/vendor/marked.LICENSE','web/vendor/dompurify.LICENSE','web/vendor/library-state.js','web/vendor/library-ui.js',
  'web/vendor/diff.js','web/vendor/diff.LICENSE','web/vendor/note-history-state.js','web/vendor/note-history-ui.js','web/vendor/note-protection-protocol.js','web/vendor/note-protection-state.js','web/vendor/note-protection-client.js','web/vendor/note-protection-ui.js'];
function run(command,args,cwd){const result=spawnSync(command,args,{cwd,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||result.stdout);return result.stdout;}
try{
  for(const autocrlf of ['false','true']){
    const dest=path.join(temp,autocrlf);
    await fs.mkdir(dest,{recursive:true});
    run('git',['-c',`core.autocrlf=${autocrlf}`,'checkout-index',`--prefix=${dest.replaceAll('\\','/')}/`,'--',...files],root);
    run(process.execPath,['web/scripts/bundle_markdown.mjs','--check'],dest);
    const before=await fs.readFile(path.join(dest,'web/app.js'),'utf8');
    if(before.includes('\r\n') !== (autocrlf==='true'))throw Error('Git checkout 줄끝 조건 미충족');
    run(process.execPath,['web/scripts/bundle_markdown.mjs'],dest);
    run(process.execPath,['web/scripts/bundle_markdown.mjs','--check'],dest);
    const after=await fs.readFile(path.join(dest,'web/app.js'),'utf8');
    if(before.replace(/\r\n/g,'\n')!==after)throw Error('줄끝 외 소스 변경');
    console.log(`clean index checkout core.autocrlf=${autocrlf}: PASS`);
  }
}finally{await fs.rm(temp,{recursive:true,force:true});}
