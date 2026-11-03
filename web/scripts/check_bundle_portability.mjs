import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const temp=await fs.mkdtemp('D:/tmp/now-240-stage-b/bundle-');
const files=['web/app.js','desktop/app/app.js','web/scripts/bundle_markdown.mjs',
  'web/vendor/marked.umd.js','web/vendor/purify.min.js','web/vendor/note-blocks.js','web/vendor/document-renderer.js',
  'web/vendor/marked.LICENSE','web/vendor/dompurify.LICENSE','web/vendor/library-state.js','web/vendor/library-ui.js',
  'web/vendor/diff.js','web/vendor/diff.LICENSE','web/vendor/note-history-state.js','web/vendor/note-history-ui.js','web/vendor/note-protection-protocol.js','web/vendor/note-protection-state.js','web/vendor/note-protection-client.js','web/vendor/note-protection-analysis.js','web/vendor/note-protection-ui.js',
  'web/vendor/wiki-state.js','web/vendor/wiki-ingest.js','web/vendor/wiki-sources.js','web/vendor/wiki-lifecycle.js','web/vendor/wiki-notebook.js','web/vendor/wiki-server-access.js','web/vendor/wiki-evidence.js','web/vendor/wiki-ingest-notebook.js','web/vendor/wiki-graph.js','web/vendor/wiki-graph-ui.js','web/vendor/wiki-query.js','web/vendor/wiki-query-notebook.js','web/vendor/wiki-lint.js','web/vendor/cytoscape.min.js','web/vendor/cytoscape.LICENSE','web/vendor/wiki-ui.js','web/vendor/browser-history-storage.js'];
files.push('web/vendor/wiki-protection-group.js');
files.push('web/vendor/wiki-runtime-loader.js','web/wiki-runtime.js','desktop/app/wiki-runtime.js');
files.push('web/vendor/document-parts.js','web/vendor/document-idb.js','desktop/app/document-parts.js');
files.push('web/vendor/history-snapshot.js');
files.push('web/vendor/journal-writes.js','desktop/app/journal-writes.js');
files.push('web/vendor/deferred-history.js');
files.push('web/vendor/history-backup.js');
files.push('web/vendor/wiki-index-reader.js');
files.push('web/vendor/wiki-read-set.js','web/vendor/wiki-selected-page.js');
files.push('web/vendor/history-client.js','web/vendor/wiki-workspace.js','web/wiki-core.js','desktop/app/wiki-core.js');
files.push('web/vendor/web-session-storage.js');
files.push('web/vendor/history-persistence.js');
files.push('web/vendor/wiki-connection.js','web/wiki.html','web/wiki-shell.js','web/wiki.css');
files.push('web/vendor/workspace-navigation.js','desktop/app/workspace-navigation.js');
files.push('desktop/app/wiki.html','desktop/app/wiki-shell.js','desktop/app/wiki.css');
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
