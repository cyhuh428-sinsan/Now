const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const old=require('./fixtures/store-file-240.cjs');
const document=require('../document-file.cjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('compatibility fixture remains the exact integrated 2.4.0 storage source',()=>{
  // afbc730bb7cb6858d96991b80bede1756a28795b:desktop/store-file.cjs, normalized checkout line endings.
  const source=fs.readFileSync(path.join(__dirname,'fixtures/store-file-240.cjs'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(sha(source),'4b35f0913e2f51503546172609b8818deb44ba94816484ad54fe6ebc23df25f0');
});

test('frozen 2.4.0 reader and cached-writer paths refuse the converted profile without touching either original or SQLite',()=>{
  const parent=path.resolve('D:/tmp/nownote-241-migration');fs.mkdirSync(parent,{recursive:true});
  const own=fs.mkdtempSync(path.join(parent,'legacy-')),file=path.join(own,'store.json');
  try{
    old.writeStoreFile(file,{version:1,values:{'nownote.web.v1':{tree:[{id:'synthetic',content:'preserve'}]}}});
    const cached=old.readStoreFile(file),bytes=fs.readFileSync(file);document.initialize(file,{syntheticLegacy:true});
    const value=document.readKey(file,'nownote.web.v1');document.writeKey(file,'nownote.web.v1',{...value,newVersion:'only SQLite'},value);document.closeAll();
    const files=[file,file+'.original-v1.json',file+'.sqlite'],before=files.map(name=>sha(fs.readFileSync(name)));
    let called=false;
    assert.throws(()=>old.readStoreFile(file),/Invalid/);
    assert.throws(()=>old.updateStoreFile(file,store=>{called=true;store.values={lost:true};return store;},cached.hash),/Invalid/);
    assert.throws(()=>old.compareAndSetStoreValue(file,'nownote.web.v1',{lost:true},cached.store.values['nownote.web.v1']),/Invalid/);
    assert.equal(called,false);assert.deepEqual(files.map(name=>sha(fs.readFileSync(name))),before);
    assert.deepEqual(fs.readFileSync(file+'.original-v1.json'),bytes);
    document.initialize(file);assert.equal(document.readKey(file,'nownote.web.v1').newVersion,'only SQLite');
  }finally{document.closeAll();assert.equal(path.dirname(fs.realpathSync(own)),parent);fs.rmSync(own,{recursive:true,force:true});}
});
