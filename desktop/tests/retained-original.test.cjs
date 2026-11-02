const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const doc=require('../document-file.cjs');
const {createPartitionedStore}=require('../partitioned-store.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const DATA='nownote.web.v1',HISTORY='nownote.history.v1';
function fixture(run,transform=value=>value){
  const root='D:/tmp/nownote-241-migration';fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'original-')),file=path.join(dir,'store.json');
  const old=transform({version:1,updatedAt:null,unknown:{keep:true},values:{[DATA]:{tree:[{id:'a',content:'ORIGINAL_NOTE'}]},[HISTORY]:{contexts:{A:{notes:{a:{draft:{content:'ORIGINAL_HISTORY'},extra:[1,null]}}}}}}});
  const raw=JSON.stringify(old,null,2);fs.writeFileSync(file,raw);doc.initialize(file,{syntheticLegacy:true});
  try{run({file,old,raw,original:file+'.original-v1.json'});}finally{doc.closeAll();fs.rmSync(dir,{recursive:true,force:true});}
}
test('retained original is inventoried independently and CAS preserves every unrelated value',()=>fixture(({file,old,raw,original})=>{
  assert.equal(doc.info(file).retainedOriginal,true);
  assert.deepEqual(doc.readOriginal(file,DATA),old.values[DATA]);
  const next={tree:[{id:'a',protection_record:{ciphertext:'NOW_ENCRYPTED_V1:opaque'}}]};
  doc.casOriginal(file,DATA,next,old.values[DATA]);
  assert.deepEqual(doc.readOriginal(file,DATA),next);
  assert.deepEqual(doc.readOriginal(file,HISTORY),old.values[HISTORY]);
  assert.deepEqual(JSON.parse(fs.readFileSync(original)).unknown,old.unknown);
  assert.deepEqual(doc.readKey(file,DATA),old.values[DATA]);
  assert.throws(()=>doc.casOriginal(file,DATA,old.values[DATA],old.values[DATA]),/changed/);
  assert.notEqual(fs.readFileSync(original,'utf8'),raw);
}));
test('missing or externally changed original never disappears from the required inventory',()=>fixture(({file,original})=>{
  fs.writeFileSync(original,'{"values":{}}');
  assert.throws(()=>doc.readOriginal(file,DATA),/original/i);
  fs.unlinkSync(original);assert.equal(doc.info(file).retainedOriginal,true);
  assert.throws(()=>doc.readOriginal(file,DATA),/original/i);
}));
test('restart reconciles only an exact before/after original hash, without overwriting an unknown copy',()=>fixture(({file,old,original})=>{
  const before=fs.readFileSync(original),after=JSON.stringify({...old,values:{...old.values,[DATA]:{tree:[]}}});
  const store=createPartitionedStore(file+'.sqlite'),metadata=store.read('$file');
  store.write('$file',{...metadata,original:{required:true,hash:hash(before),pending:{before:hash(before),after:hash(after)}}},metadata);store.close();
  fs.writeFileSync(original,after);doc.closeAll();doc.initialize(file);
  assert.deepEqual(doc.readOriginal(file,DATA),{tree:[]});
  const check=createPartitionedStore(file+'.sqlite');
  assert.equal(check.read('$file').original.hash,hash(after));assert.equal(check.read('$file').original.pending,null);check.close();
}));
test('before-write interruption clears only the matching pending receipt; an unknown copy stays blocked',()=>fixture(({file,original})=>{
  const before=fs.readFileSync(original),store=createPartitionedStore(file+'.sqlite');
  let metadata=store.read('$file');
  store.write('$file',{...metadata,original:{required:true,hash:hash(before),pending:{before:hash(before),after:hash('not-written')}}},metadata);
  assert(doc.readOriginal(file,DATA).tree.length);assert.equal(store.read('$file').original.pending,null);
  metadata=store.read('$file');store.write('$file',{...metadata,original:{required:true,hash:hash(before),pending:{before:hash(before),after:hash('not-written')}}},metadata);
  fs.writeFileSync(original,'unknown external edit');
  assert.throws(()=>doc.readOriginal(file,DATA),/changed/);assert.equal(fs.readFileSync(original,'utf8'),'unknown external edit');
  store.close();
}));
test('process exit after temporary fsync cannot leave a plaintext original copy outside completion checks',()=>fixture(({file,old,original})=>{
  const script=`const fs=require('node:fs'),doc=require(${JSON.stringify(path.resolve(__dirname,'../document-file.cjs'))});
    const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(to===${JSON.stringify(original)})process.exit(77);return rename(from,to);};
    doc.casOriginal(${JSON.stringify(file)},${JSON.stringify(DATA)},${JSON.stringify({...old.values[DATA],attribution:'synthetic'})},${JSON.stringify(old.values[DATA])});`;
  const child=spawnSync(process.execPath,['-e',script],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(child.status,77,child.stderr);
  assert.equal(fs.readdirSync(path.dirname(original)).filter(name=>name.startsWith(path.basename(original)+'.')&&name.endsWith('.tmp')).length,1);
  assert.deepEqual(doc.readOriginal(file,DATA),old.values[DATA]);
  doc.casOriginal(file,DATA,{tree:[{protection_record:{ciphertext:'NOW_ENCRYPTED_V1:sealed'}}]},old.values[DATA]);
  assert.equal(fs.readdirSync(path.dirname(original)).filter(name=>name.startsWith(path.basename(original)+'.')&&name.endsWith('.tmp')).length,0,'A recovered CAS must not leave its plaintext temporary copy');
}));
test('unregistered original temporary copies are preserved and block protection',()=>fixture(({file,original})=>{
  const unknown=original+'.11111111-1111-4111-8111-111111111111.tmp';
  fs.writeFileSync(unknown,'UNREGISTERED_ORIGINAL_COPY');
  assert.throws(()=>doc.readOriginal(file,DATA),/untracked|temporary/i);
  assert.equal(fs.readFileSync(unknown,'utf8'),'UNREGISTERED_ORIGINAL_COPY');
}));
test('a temporary filename collision never deletes the file that prevented exclusive creation',()=>fixture(({file,old,original})=>{
  const open=fs.openSync;let foreign;
  try{
    fs.openSync=(filename,flags,...args)=>{
      if(typeof filename==='string'&&filename.startsWith(original+'.')&&filename.endsWith('.tmp')&&flags==='wx'){
        foreign=filename;const fd=open(filename,'w');fs.writeSync(fd,'FOREIGN_TEMPORARY_COPY');fs.closeSync(fd);
        const error=Error('synthetic_EEXIST');error.code='EEXIST';throw error;
      }
      return open(filename,flags,...args);
    };
    assert.throws(()=>doc.casOriginal(file,DATA,{tree:[]},old.values[DATA]),/synthetic_EEXIST/);
  }finally{fs.openSync=open;}
  assert.equal(fs.readFileSync(foreign,'utf8'),'FOREIGN_TEMPORARY_COPY');
  assert.throws(()=>doc.readOriginal(file,DATA),/temporary/);
}));
test('serialized legacy JSON is visible to protection and retains its encoding after CAS',()=>fixture(({file,old,original})=>{
  const expected=JSON.parse(old.values[DATA]);assert.deepEqual(doc.readOriginal(file,DATA),expected);
  const next={tree:[{id:'a',protection_record:{ciphertext:'NOW_ENCRYPTED_V1:sealed'}}]};
  doc.casOriginal(file,DATA,next,expected);
  const stored=JSON.parse(fs.readFileSync(original)).values[DATA];
  assert.equal(typeof stored,'string');assert.deepEqual(JSON.parse(stored),next);
},old=>({...old,values:{...old.values,[DATA]:JSON.stringify(old.values[DATA])}})));
test('original CAS cannot silently remove a storage root with an undefined value',()=>fixture(({file,old,raw,original})=>{
  assert.throws(()=>doc.casOriginal(file,DATA,undefined,old.values[DATA]),/original|JSON/i);
  assert.equal(fs.readFileSync(original,'utf8'),raw);
}));
test('case-variant temporary names also block protection on Windows filesystems',()=>fixture(({file,original})=>{
  const unknown=path.join(path.dirname(original),path.basename(original).toUpperCase()+'.11111111-1111-4111-8111-111111111111.TMP');
  fs.writeFileSync(unknown,'CASE_VARIANT_ORIGINAL_COPY');
  assert.throws(()=>doc.readOriginal(file,DATA),/untracked|temporary/i);
  assert.equal(fs.readFileSync(unknown,'utf8'),'CASE_VARIANT_ORIGINAL_COPY');
}));
