import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
for(const suite of ['QUERY','LINT']){
  const child=spawn(process.execPath,['web/scripts/check_wiki_sources_ui.mjs'],{
    cwd:root,env:{...process.env,NOWNOTE_WIKI_WORKSPACE:'1',NOWNOTE_WIKI_QUERY:'0',NOWNOTE_WIKI_LINT:'0',['NOWNOTE_WIKI_'+suite]:'1'},stdio:'inherit',windowsHide:true,
  });
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0){process.exitCode=1;break;}
}
