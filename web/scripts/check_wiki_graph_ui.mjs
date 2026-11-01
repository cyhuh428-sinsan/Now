import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {catalog,documents} from './check_wiki_graph.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base='D:/tmp/now-240-wiki-graph';
await fs.mkdir(base,{recursive:true});const own=await fs.mkdtemp(path.join(base,'client-')),run=randomUUID();
const directory=path.join(root,'docs/2.4.0/qa'),report={run,kind:'actual renderer/CSP/graph; synthetic approved read catalog; HTTP blocked',phases:[]};
let child;
try{
  for(const mode of ['web','desktop']){
    const config=path.join(own,mode+'.json'),result=path.join(own,mode+'-result.json');
    await fs.writeFile(config,JSON.stringify({root,own,mode,catalog,documents,result,directory,run}));
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    child=spawn(path.join(root,'desktop/node_modules/electron/dist/electron.exe'),[path.join(root,'web/scripts/wiki_graph_ui_host.cjs'),config],{cwd:root,env,stdio:'ignore',windowsHide:true});
    const exit=await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve('timeout');},60000);child.once('error',()=>{clearTimeout(timer);resolve('spawn_failed');});child.once('exit',code=>{clearTimeout(timer);resolve(code);});});child=null;
    const value=JSON.parse(await fs.readFile(result,'utf8'));report.phases.push({mode,...value});
    if(exit!==0||!value.ok)throw Error('wiki_graph_ui_'+mode+':'+(value.code||exit));
    console.log(mode+' actual canvas, selection/path, both widths and lock/account teardown PASS');
  }
}finally{
  child?.kill();const real=await fs.realpath(own),stat=await fs.lstat(own);
  if(!real.startsWith(path.resolve(base)+path.sep)||stat.isSymbolicLink())throw Error('graph_cleanup_boundary');
  await fs.rm(own,{recursive:true,force:true});report.profilesRemoved=true;
  await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'wiki-graph-'+run+'.json'),JSON.stringify(report,null,2));
}
