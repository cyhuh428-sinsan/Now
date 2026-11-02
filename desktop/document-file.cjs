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
function atomic(filename,bytes,temp=`${filename}.${randomUUID()}.tmp`){
  let owned=null;
  try{
    const fd=fs.openSync(temp,'wx');try{owned=fs.fstatSync(fd,{bigint:true});fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,filename);
  }finally{
    if(owned){
      try{
        const current=fs.lstatSync(temp,{bigint:true});
        if(!current.isSymbolicLink()&&current.dev===owned.dev&&current.ino===owned.ino)fs.unlinkSync(temp);
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
  }
}
function assertLegacyProtectionSettled(values){
  const fail=()=>Error('기존 보호 전환을 먼저 완료한 뒤 저장 형식을 이전하세요. 원본과 원작업은 변경하지 않았습니다.');
  const pending=Object.entries(values).map(([key,value])=>{
    if(typeof value!=='string')return value;
    try{return JSON.parse(value);}catch{if(key==='nownote.history.v1')throw fail();return null;}
  });
  while(pending.length){
    const value=pending.pop();if(!value||typeof value!=='object')continue;
    if(Object.hasOwn(value,'protection_operations')){
      const operations=value.protection_operations;
      if(!operations||typeof operations!=='object'||Array.isArray(operations)
        ||Object.values(operations).some(marker=>!marker||marker.phase!=='complete'))throw fail();
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);
  }
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
    // Old encrypted bundles bind their exact store inventory; a retained copy cannot be appended to them.
    assertLegacyProtectionSettled(original.values);
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
      updates.push({key:META,value:{metadata,keys:Object.keys(values),importHash:digest,
        original:{required:Boolean(bytes),hash:bytes?digest:null,pending:null}},expected:null});
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
function originalState(file){
  const state=file.original||{required:file.importHash!==hash(Buffer.from('new profile')),hash:file.importHash,pending:null};
  const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
  if(typeof state.required!=='boolean'||state.required&&!digest(state.hash)||!state.required&&state.pending
    ||state.pending&&(!digest(state.pending.before)||!digest(state.pending.after)||state.pending.before!==state.hash))
    throw Error('Invalid retained original state; original preserved.');
  return state;
}
function info(storePath){
  const row=open(storePath).read(META);if(!row)throw Error('Missing document file metadata');
  return {...row.metadata,keys:row.keys,retainedOriginal:originalState(row).required||fs.existsSync(storePath+'.original-v1.json')};
}
function retained(storePath){
  const database=open(storePath),file=database.read(META),state=originalState(file),filename=storePath+'.original-v1.json';
  const prefix=path.basename(filename)+'.',temporary=state.pending?.temporary;
  if(temporary!==undefined&&(typeof temporary!=='string'||!temporary.startsWith(prefix)
    ||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.tmp$/.test(temporary.slice(prefix.length))))
    throw Error('Invalid original temporary receipt; copies preserved.');
  const fold=name=>name.toLowerCase();
  const candidates=fs.readdirSync(path.dirname(filename)).filter(name=>fold(name).startsWith(fold(prefix))&&fold(name).endsWith('.tmp'));
  if(candidates.some(name=>!temporary||fold(name)!==fold(temporary)))throw Error('Untracked original temporary copy; inspection required.');
  if(!state.required){if(fs.existsSync(filename))throw Error('Unexpected retained original; inspection required.');return null;}
  let bytes;
  try{
    if(fs.lstatSync(filename).isSymbolicLink())throw Error('Original cannot be a link');
    bytes=fs.readFileSync(filename);
  }catch{throw Error('Retained original is missing or unreadable; protection cannot complete.');}
  const digest=hash(bytes);
  if(state.pending){
    if(digest!==state.pending.before&&digest!==state.pending.after)throw Error('Retained original changed during protection; original preserved.');
    const actual=temporary&&candidates.find(name=>fold(name)===fold(temporary));
    if(actual){
      const candidate=path.join(path.dirname(filename),actual);
      if(fs.lstatSync(candidate).isSymbolicLink()||hash(fs.readFileSync(candidate))!==state.pending.after
        ||hash(fs.readFileSync(filename))!==digest)throw Error('Original temporary copy changed; all copies preserved.');
      fs.unlinkSync(candidate);
    }
    database.write(META,{...file,original:{required:true,hash:digest,pending:null}},file);
  }else if(digest!==state.hash)throw Error('Retained original changed; original preserved.');
  let value;
  try{value=JSON.parse(bytes.toString('utf8'));}catch{throw Error('Retained original is invalid; original preserved.');}
  if(!value||typeof value!=='object'||!value.values||typeof value.values!=='object'||Array.isArray(value.values))throw Error('Retained original is invalid; original preserved.');
  return {database,filename,bytes,digest,value};
}
function originalValue(value){
  if(value==null)return null;
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{throw Error('Unsupported original JSON encoding; original preserved.');}
  }
  if(!value||Object.prototype.toString.call(value)!=='[object Object]')throw Error('Unsupported original JSON root; original preserved.');
  return value;
}
function readOriginal(storePath,key){
  const copy=retained(storePath);return copy?originalValue(copy.value.values[key]):null;
}
function casOriginal(storePath,key,value,expected){
  if(expected===undefined)throw Error('Original comparison is required');
  if(!value||Object.prototype.toString.call(value)!=='[object Object]'||typeof value.toJSON==='function')throw Error('Original replacement must be a JSON object');
  const copy=retained(storePath);if(!copy)throw Error('No retained original exists');
  if(JSON.stringify(originalValue(copy.value.values[key]))!==JSON.stringify(expected))throw Error('Retained original changed; no data was overwritten.');
  const replacement=typeof copy.value.values[key]==='string'?JSON.stringify(value):value;
  const next={...copy.value,values:{...copy.value.values,[key]:replacement}},bytes=Buffer.from(JSON.stringify(next,null,2)+'\n'),after=hash(bytes);
  if(after===copy.digest)return {ok:true};
  const temporary=path.basename(copy.filename)+'.'+randomUUID()+'.tmp';
  const file=copy.database.read(META),pending={...file,original:{required:true,hash:copy.digest,pending:{before:copy.digest,after,temporary}}};
  copy.database.write(META,pending,file);
  if(hash(fs.readFileSync(copy.filename))!==copy.digest)throw Error('Retained original changed; no data was overwritten.');
  atomic(copy.filename,bytes,path.join(path.dirname(copy.filename),temporary));
  copy.database.write(META,{...pending,original:{required:true,hash:after,pending:null}},pending);
  return {ok:true};
}
function readKey(storePath,key){return open(storePath).read(`value:${key}`);}
function readKeyPath(storePath,key,segments,shallow=false){return open(storePath).readPath(`value:${key}`,segments,shallow);}
function readKeySnapshot(storePath,key){return open(storePath).readSnapshot(`value:${key}`);}
function readKeyCurrent(storePath,key,account){return open(storePath).readCurrent(`value:${key}`,account);}
function readKeyNote(storePath,key,account,id,stamp){return open(storePath).readNote(`value:${key}`,account,id,stamp);}
function writeKeyPath(storePath,key,segments,expected,value,manifest){
  const database=open(storePath),file=database.read(META);
  if(!file.keys.includes(key))throw Error('History storage must be initialized first');
  const next={...file,metadata:{...file.metadata,updatedAt:new Date().toISOString()}};
  return database.writePath(`value:${key}`,segments,expected,value,{manifest,additional:[{key:META,expected:file,value:next}]});
}
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
module.exports={FORMAT,initialize,read,readKey,readKeyPath,readKeySnapshot,readKeyCurrent,readKeyNote,writeKeyPath,writeKey,readOriginal,casOriginal,info,update,closeAll};
