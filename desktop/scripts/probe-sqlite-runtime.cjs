const {spawnSync}=require('node:child_process');
const path=require('node:path');
const binary=process.argv[2];
if(!binary)throw Error('Electron executable is required');
const script="const sqlite=require('node:sqlite');const db=new sqlite.DatabaseSync(':memory:');console.log(JSON.stringify({node:process.versions.node,electron:process.versions.electron,sqlite:db.prepare('select sqlite_version() as version').get().version}));db.close();";
const result=spawnSync(path.resolve(binary),['-e',script],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},encoding:'utf8',windowsHide:true});
console.log(JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr}));
if(result.status!==0)process.exitCode=1;
