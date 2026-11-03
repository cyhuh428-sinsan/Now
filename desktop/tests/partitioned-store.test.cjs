const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('partitioned SQLite keeps unknown fields and concurrent writes fail without overwriting',()=>{
  const {createPartitionedStore}=require('../partitioned-store.cjs');
  const root='D:/tmp/nownote-241-parts';fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'run-'));
  const a=createPartitionedStore(path.join(dir,'store.sqlite')),b=createPartitionedStore(path.join(dir,'store.sqlite'));
  try{
    const value={contexts:{A:{notes:{a:{draft:{content:'one'},revisions:[{content:'old'}]},b:{draft:{content:'two'}}}}},unknown:{kept:true}};
    a.write('history',value,null);assert.deepEqual(b.read('history'),value);
    const next=structuredClone(value);next.contexts.A.notes.a.draft.content='changed';
    const result=a.write('history',next,value);assert.equal(result.partsWritten,1);
    assert.throws(()=>b.write('history',value,value),/changed/);assert.deepEqual(b.read('history'),next);
    const cipher={ciphertext:'sealed',extra:[null,false]};a.write('history',cipher,next);assert.deepEqual(b.read('history'),cipher);
    assert(!JSON.stringify(a.inspect('history')).includes('old'));
    a.write('settings',{font:16},null);assert.deepEqual(a.read('history'),cipher);
  }finally{a.close();b.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('protection replacement removes previous plaintext bytes from database and WAL before acknowledgement',()=>{
  const {createPartitionedStore}=require('../partitioned-store.cjs');
  const root='D:/tmp/nownote-241-parts';fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'wipe-')),file=path.join(dir,'store.sqlite');
  const store=createPartitionedStore(file),plaintextMarker='QA_PRIVATE_BEFORE_PROTECTION_0946';
  try{
    const original={draft:{content:plaintextMarker.repeat(300)},revisions:[{body:plaintextMarker.repeat(300)}]};
    store.write('history',original,null);store.write('history',{protection_record:{ciphertext:'NOW_ENCRYPTED_V1:sealed'}},original);
    for(const suffix of ['','-wal'])if(fs.existsSync(file+suffix))assert(!fs.readFileSync(file+suffix).includes(Buffer.from(plaintextMarker)),'Plaintext remains in '+suffix);
    store.close();
    assert(!fs.readFileSync(file).includes(Buffer.from(plaintextMarker)),'Plaintext remains after close');
  }finally{try{store.close();}catch{}fs.rmSync(dir,{recursive:true,force:true});}
});
