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
test('migration resumes after marker publication fails and preserves all legacy extension/history records',()=>{
  const root='D:/tmp/nownote-241-migration';fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'resume-')),file=path.join(dir,'store.json');
  const note={raw:{owner_id:'A',local_id:'x',content:'plain'},draft:{content:'pending'},base:{inventory_revision_ids:['r1']},revisions:[{snapshot:{note:{content:'old'}}}],outbox:[{sent:true,body:{mutation_id:'keep'}}],receipts:[{result:'keep'}],comparison:{extra:true},unknown:{future:[null,1]}};
  const original={version:1,values:{'nownote.history.v1':{schema_version:1,contexts:{A:{notes:{x:note},wiki_operations:{op:{state:'committed',receipt:{hash:'keep'}}}},B:{notes:{x:{protection_record:{ciphertext:'NOW_ENCRYPTED_V1:opaque'}}}}},protection_operations:{id:{phase:'complete',cipher_bundle:'NOW_ENCRYPTED_V1:bundle'}},recovery_archives:[{contexts:{A:{notes:{x:note}}}}]},future:{unknown:[1,false]}},updatedAt:null,extension:{keep:true}};
  const raw=JSON.stringify(original,null,3);fs.writeFileSync(file,raw);
  const rename=fs.renameSync;
  try{
    fs.renameSync=(from,to)=>{if(to===file)throw Error('synthetic_marker_interruption');return rename(from,to);};
    assert.throws(()=>doc.initialize(file,{syntheticLegacy:true}),/synthetic_marker_interruption/);
    assert.equal(fs.readFileSync(file,'utf8'),raw);assert.equal(fs.readFileSync(file+'.original-v1.json','utf8'),raw);
    fs.renameSync=rename;doc.initialize(file,{syntheticLegacy:true});
    assert.deepEqual(doc.read(file).store,original);assert.equal(doc.info(file).retainedOriginal,true);
    assert.deepEqual(doc.readOriginal(file,'nownote.history.v1'),original.values['nownote.history.v1']);
  }finally{fs.renameSync=rename;doc.closeAll();fs.rmSync(dir,{recursive:true,force:true});}
});

test('unfinished legacy protection refuses migration before creating a new original copy or database',()=>{
  const root=path.resolve('D:/tmp/nownote-241-migration');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'pending-'));
  try{
    for(const [index,phase]of ['applying','server_committed','analysis_running','wiki_group_applying'].entries()){
      const file=path.join(dir,'store-'+index+'.json'),journal={schema_version:1,contexts:{},protection_operations:{id:{phase,cipher_bundle:'NOW_ENCRYPTED_V1:opaque'}}};
      const value=index%2?JSON.stringify({schema_version:1,contexts:{},recovery_archives:[journal]}):journal;
      const raw=JSON.stringify({version:1,values:{'nownote.history.v1':value}},null,2);fs.writeFileSync(file,raw);
      assert.throws(()=>doc.initialize(file,{syntheticLegacy:true}),/보호|전환|protection/i);
      assert.equal(fs.readFileSync(file,'utf8'),raw);assert.equal(fs.existsSync(file+'.sqlite'),false);assert.equal(fs.existsSync(file+'.original-v1.json'),false);
    }
  }finally{doc.closeAll();assert.equal(path.dirname(fs.realpathSync(dir)),root);fs.rmSync(dir,{recursive:true,force:true});}
});
