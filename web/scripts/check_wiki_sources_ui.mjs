import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base='D:/tmp/now-240-wiki-sources';
await fs.mkdir(base,{recursive:true});const own=await fs.mkdtemp(path.join(base,'client-'));
const run=randomUUID(),report={run,kind:'local UI/cold only',phases:[]};let child;
try{
  await fs.writeFile(path.join(own,'source.md'),'한글 합성 원본\r\n<script>globalThis.WIKI_SOURCE_EXECUTED=true</script>\nhttps://never-execute.invalid/');
  await fs.writeFile(path.join(own,'other.txt'),'Second exact synthetic source.');await fs.writeFile(path.join(own,'unsupported.pdf'),'synthetic unsupported file');
  for(const mode of ['web','desktop'])for(const phase of [1,2]){
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    child=spawn(path.join(root,'desktop/node_modules/electron/dist/electron.exe'),[path.join(root,'web/scripts/wiki_sources_ui_host.cjs'),own,mode,String(phase)],{cwd:root,env,stdio:'ignore',windowsHide:true});
    const exit=await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve('timeout');},90000);child.on('error',()=>{clearTimeout(timer);resolve('spawn_failed');});child.on('exit',code=>{clearTimeout(timer);resolve(code);});});child=null;
    const result=JSON.parse(await fs.readFile(path.join(own,mode+'-'+phase+'.json'),'utf8'));report.phases.push({mode,phase,...result});
    if(exit!==0||result.ok!==true)throw Error('wiki_sources_ui_'+mode+'_'+phase+':'+(result.error||exit));
    console.log(mode+' phase '+phase+' actual file selection / Note journal / local storage PASS');
  }
}finally{
  child?.kill();const resolved=await fs.realpath(own),stat=await fs.lstat(own);
  if(!resolved.startsWith(path.resolve(base)+path.sep)||stat.isSymbolicLink())throw Error('profile_cleanup_boundary');
  await fs.rm(own,{recursive:true,force:true});report.ownProfileRemoved=true;
  const target='D:/Project/Now/docs/2.4.0/qa';await fs.mkdir(target,{recursive:true});
  await fs.writeFile(path.join(target,'wiki-sources-'+run+'.json'),JSON.stringify(report,null,2));
  console.log('own profiles removed; HTTP/DB/Provider not exercised');
}
