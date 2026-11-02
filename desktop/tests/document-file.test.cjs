const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const doc=require('../document-file.cjs');
test('synthetic migration preserves original bytes, blocks old reader, reconnects after restart',()=>{
  const root='D:/tmp/nownote-241-migration';fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'run-')),file=path.join(dir,'store.json');
  const original={version:1,updatedAt:null,unknown:{keep:true},values:{history:{contexts:{A:{notes:{x:{content:'one',revisions:[{body:'history'}]}}}}},settings:{font:12}}};
  const raw=JSON.stringify(original,null,3);fs.writeFileSync(file,raw);
  try{
    assert.throws(()=>doc.initialize(file),/not enabled/);assert.equal(fs.readFileSync(file,'utf8'),raw);
    doc.initialize(file,{syntheticLegacy:true});
    assert.equal(fs.readFileSync(file+'.original-v1.json','utf8'),raw);
    assert.equal(JSON.parse(fs.readFileSync(file)).values,undefined);
    assert.deepEqual(doc.read(file).store,original);
    doc.writeKey(file,'settings',{font:14},{font:12});doc.closeAll();
    doc.initialize(file);assert.deepEqual(doc.readKey(file,'settings'),{font:14});
    assert.deepEqual(doc.readKey(file,'history'),original.values.history);
    assert.throws(()=>doc.writeKey(file,'settings',{font:15},{font:12}),/changed/);
  }finally{doc.closeAll();fs.rmSync(dir,{recursive:true,force:true});}
});
