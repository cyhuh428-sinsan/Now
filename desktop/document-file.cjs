const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {createPartitionedStore}=require('./partitioned-store.cjs');
const {isDeepStrictEqual}=require('node:util');
const FORMAT='nownote-sqlite-parts-v1',META='$file';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const databases=new Map();
const markerPath=storePath=>`${storePath}.sqlite`;
function open(storePath){
  const filename=markerPath(storePath);
  if(!fs.existsSync(filename))throw Error('Document database is missing; original files were not replaced.');
  if(!databases.has(filename))databases.set(filename,createPartitionedStore(filename));
  return databases.get(filename);
}
function atomic(filename,bytes){
  const temp=`${filename}.${randomUUID()}.tmp`;
  try{
    const fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,filename);
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function initialize(storePath,{syntheticLegacy=false}={}){
  fs.mkdirSync(path.dirname(storePath),{recursive:true});
  const exists=fs.existsSync(storePath),bytes=exists?fs.readFileSync(storePath):null;
  const original=exists?JSON.parse(bytes.toString('utf8')):{version:1,updatedAt:null,values:{}};
  if(original.storage_backend===FORMAT){open(storePath);return;}
  if(!original.values||typeof original.values!=='object'||Array.isArray(original.values))throw Error('Invalid legacy desktop store');
  if(exists){
    // Real-profile conversion remains gated until its retained-copy protection inventory is verified.
    const qa=path.resolve('D:/tmp/nownote-241-migration');
    const resolved=fs.realpathSync.native(path.dirname(storePath));
    const relative=path.relative(qa,resolved);
    if(!syntheticLegacy||!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Existing profile migration is not enabled. Use a separate 2.4.1 QA profile.');
  }
  const filename=markerPath(storePath);
  const database=createPartitionedStore(filename);
  try{
    const digest=hash(bytes||Buffer.from('new profile'));
    const previous=database.read(META);
    if(previous){if(previous.importHash!==digest)throw Error('Migration source changed; database preserved.');}
    else{
      const {values,...metadata}=original;
      const updates=Object.entries(values).map(([key,value])=>({key:`value:${key}`,value,expected:null}));
      updates.push({key:META,value:{metadata,keys:Object.keys(values),importHash:digest},expected:null});
      database.commit(updates);
    }
    const reconstructed=snapshot(database).store;
    if(!isDeepStrictEqual(reconstructed,original))throw Error('Migration verification failed; original preserved.');
    if(bytes){
      const backup=`${storePath}.original-v1.json`;
      if(fs.existsSync(backup)){if(hash(fs.readFileSync(backup))!==digest)throw Error('Original backup changed');}
      else{
        const fd=fs.openSync(backup,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      }
      if(hash(fs.readFileSync(storePath))!==digest)throw Error('Legacy writer changed the source; migration not published.');
    }
    atomic(storePath,Buffer.from(JSON.stringify({storage_backend:FORMAT,version:2})));
  }finally{database.close();}
}
function snapshot(database){
  const file=database.read(META);if(!file)throw Error('Missing document file metadata');
  const store={...file.metadata,values:{}};
  for(const key of file.keys)Object.defineProperty(store.values,key,{value:database.read(`value:${key}`),enumerable:true,writable:true,configurable:true});
  return {store,hash:hash(JSON.stringify(store))};
}
function read(storePath){return snapshot(open(storePath));}
function info(storePath){const row=open(storePath).read(META);if(!row)throw Error('Missing document file metadata');return {...row.metadata,keys:row.keys};}
function readKey(storePath,key){return open(storePath).read(`value:${key}`);}
function writeKey(storePath,key,value,expected){
  const database=open(storePath),file=database.read(META);
  const next={...file,metadata:{...file.metadata,updatedAt:new Date().toISOString()},keys:file.keys.includes(key)?file.keys:[...file.keys,key]};
  const result=database.commit([{key:`value:${key}`,value,expected},{key:META,value:next,expected:file}]);
  return {...result,updatedAt:next.metadata.updatedAt};
}
function update(storePath,transform,expectedHash){
  const database=open(storePath),before=snapshot(database);
  if(expectedHash!==undefined&&expectedHash!==before.hash)throw Error('NowNote store changed since preview');
  const after=transform(structuredClone(before.store));after.updatedAt=new Date().toISOString();
  const file=database.read(META),{values,...metadata}=after;
  if(file.keys.some(key=>!Object.hasOwn(values,key)))throw Error('Removing storage keys requires explicit migration');
  database.commit([...Object.entries(values).map(([key,value])=>({key:`value:${key}`,value,expected:before.store.values[key]??null})),
    {key:META,value:{...file,metadata,keys:Object.keys(values)},expected:file}]);
  return snapshot(database);
}
function closeAll(){for(const database of databases.values())database.close();databases.clear();}
module.exports={FORMAT,initialize,read,readKey,writeKey,info,update,closeAll};
