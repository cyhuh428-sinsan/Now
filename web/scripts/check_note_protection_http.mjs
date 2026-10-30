import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const envFile=process.env.NOWNOTE_QA_ENV_FILE;
if(!envFile)throw Error('qa_env_path_required');
const line=(await fs.readFile(envFile,'utf8')).split(/\r?\n/).find(v=>v.startsWith('NOW_QA_API_TOKEN='));
let token=line?.slice('NOW_QA_API_TOKEN='.length).trim();
if(token?.startsWith('"')&&token.endsWith('"'))token=token.slice(1,-1);
if(!token)throw Error('qa_api_token_missing');
const qa=path.resolve('D:/tmp/now-240-e4b3a-http');await fs.mkdir(qa,{recursive:true});
const own=await fs.mkdtemp(path.join(qa,'client-')),run=crypto.randomBytes(6).toString('hex');
const manifestDir=path.resolve(process.env.NOWNOTE_QA_MANIFEST_DIR||path.join(root,'docs/2.4.0/qa'));
await fs.mkdir(manifestDir,{recursive:true});
const manifestFile=path.join(manifestDir,'http-'+run+'.json');
const manifest={run,source,created_at:new Date().toISOString(),server:'http://127.0.0.1:8750',accounts:[],notes:[],phases:[],requests:[],cleanup:'pending',serverResources:'retained'};
const save=()=>fs.writeFile(manifestFile,JSON.stringify(manifest,null,2));
await save();
let stage='probe',child=null;
async function request(method,url,body,userToken) {
  let response;
  try{response=await fetch('http://127.0.0.1:8750'+url,{method,headers:{Authorization:'Bearer '+token,...(userToken?{'X-Now-User-Token':userToken}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}
  catch{manifest.requests.push({stage,method,path:url,state:'transport_uncertain'});await save();throw Error('transport_uncertain');}
  manifest.requests.push({stage,method,path:url,status:response.status});await save();
  if(!response.ok)throw Error('http_'+response.status);
  return response.json();
}
try {
  const ready=await request('GET','/health/ready');
  if(ready.status!=='ready')throw Error('not_ready');
  const served=await fetch('http://127.0.0.1:8750/app.js');
  if(!served.ok||crypto.createHash('sha256').update(Buffer.from(await served.arrayBuffer())).digest('hex')!==crypto.createHash('sha256').update(await fs.readFile(path.join(root,'web/app.js'))).digest('hex'))throw Error('served_source_mismatch');
  manifest.servedSourceMatches=true;await save();
  const require=createRequire(new URL('../../desktop/package.json',import.meta.url)),electron=require('electron');
  const modes=['desktop','web'].filter(m=>!process.argv.some(a=>a.startsWith('--mode='))||process.argv.includes('--mode='+m));
  for(const mode of modes) {
    const credentials={};
    const probe=process.argv.includes('--probe');
    for(const suffix of probe?[]:['a','b']) {
      const owner='qa_http_'+run+'_'+mode+'_'+suffix,device=mode==='web'?'web-client':'qa-http-'+run,password='Qa-'+crypto.randomBytes(18).toString('hex');
      stage=mode+'_register_'+suffix;manifest.accounts.push({owner,device,state:'request_pending',retention:'QA verification retained'});await save();
      const issued=await request('POST','/api/v1/auth/register',{owner_id:owner,password,email:owner+'@example.invalid',display_name:'HTTP QA',device_id:device,device_name:'Isolated HTTP QA'});
      credentials[suffix]={owner,device,password};manifest.accounts.at(-1).state='created';await save();
      if(suffix==='a')for(const local of ['target','other']) {
        const local_id='qa-http-'+run+'-'+local,mutation_id=crypto.randomUUID();
        stage=mode+'_seed_'+local;manifest.notes.push({owner,local_id,mutation_id,state:'request_pending'});await save();
        await request('PUT','/api/v2/notes/current',{schema_version:1,owner_id:owner,local_id,device_id:device,mutation_id,crypto_epoch:0,base_head_version:0,base_revision_id:null,expected_inventory_revision_ids:[],
          note:{note_type:'tree',title:'HTTP QA '+local,content:local==='target'?'HTTP-QA-ORIGINAL-'+run+'\r\n':'HTTP-QA-PRESERVE-'+run,parent_local_id:null,level:1,tags:'[]',source:'web-tree',deleted_at:null}},issued.access_token);
        manifest.notes.at(-1).state='created';await save();
      }
    }
    const secrets=path.join(own,mode+'-credentials.json');await fs.writeFile(secrets,JSON.stringify(credentials),{mode:0o600});
    const profile=path.join(own,mode);await fs.mkdir(profile);
    for(const phase of probe?[0]:process.argv.includes('--fresh-editor')?[1,2,5]:process.argv.includes('--editor-restart')?[1,2,3,4]:[1,2]) {
      stage=mode+'_phase_'+phase;
      const result=path.join(own,mode+'-'+phase+'-result.json'),config=path.join(own,mode+'-'+phase+'-config.json');
      const activeProfile=phase===5?path.join(own,mode+'-fresh'):profile;
      if(phase===5)await fs.mkdir(activeProfile);
      await fs.writeFile(config,JSON.stringify({root,source,profile:activeProfile,mode,phase,result,secrets,envFile,run,manifestFile,probe,mixedWrite:process.argv.includes('--mixed-write'),editorWrite:['--editor-write','--editor-restart','--fresh-editor','--mutation-write'].some(f=>process.argv.includes(f)),editorRestart:process.argv.includes('--editor-restart'),mutationWrite:process.argv.includes('--mutation-write')}));
      const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
      child=spawn(electron,[path.join(root,'web/scripts/note_protection_http_host.cjs'),config],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output='';child.stdout.on('data',b=>output=(output+b).slice(-3000));child.stderr.on('data',b=>output=(output+b).slice(-3000));
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});child=null;
      manifest.clientEvidence=JSON.parse(await fs.readFile(manifestFile,'utf8')).clientEvidence || [];
      if(code!==0)throw Error('client_phase_failed_'+stage);
      const evidence=JSON.parse(await fs.readFile(result,'utf8'));manifest.phases.push(evidence);await save();console.log(JSON.stringify(evidence));
    }
  }
  manifest.result='passed';
}catch(error){manifest.clientEvidence=JSON.parse(await fs.readFile(manifestFile,'utf8')).clientEvidence || [];manifest.result='failed';manifest.failure={stage,code:/^[a-z0-9_]+$/.test(error.message)?error.message:'qa_error'};process.exitCode=1;console.log(JSON.stringify({ok:false,...manifest.failure}));}
finally {
  if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
  if(await fs.realpath(own)!==own||!own.startsWith(qa+path.sep))throw Error('cleanup_boundary');
  await fs.rm(own,{recursive:true,force:true,maxRetries:6,retryDelay:500});
  manifest.cleanup='own profiles/children removed; QA accounts/notes/operations and server retained';await save();
  console.log(JSON.stringify({manifest:path.basename(manifestFile),result:manifest.result,profilesRemoved:true,accountsRetained:manifest.accounts.map(a=>a.owner)}));
}
