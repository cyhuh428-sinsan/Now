const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createPartitionedStore}=require('../partitioned-store.cjs');
function fixture(run){
  const root=path.resolve('D:/tmp/nownote-241-patch');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'run-')),file=path.join(dir,'store.sqlite'),a=createPartitionedStore(file),b=createPartitionedStore(file);
  try{run(a,b,file);}finally{a.close();b.close();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),root);fs.rmSync(resolved,{recursive:true,force:true});}
}
test('independent document writes survive stale sibling views, reject stale same-document writes and invalidate full caches',()=>fixture((a,b)=>{
  const original={notes:{a:{draft:'one',history:['old'],unknown:{keep:1}},b:{draft:'two'}},extra:true};
  a.write('history',original,null);assert.deepEqual(b.read('history'),original);
  const beforeA=a.readPath('history',['notes','a']).value,beforeB=b.readPath('history',['notes','b']).value;
  a.writePath('history',['notes','a'],beforeA,{...beforeA,draft:'edited'});
  b.writePath('history',['notes','b'],beforeB,{draft:'other edit'});
  assert.throws(()=>b.writePath('history',['notes','a'],beforeA,{draft:'stale'}),/conflict/i);
  assert.deepEqual(a.read('history'),{notes:{a:{...beforeA,draft:'edited'},b:{draft:'other edit'}},extra:true});
}));
test('path write never parses unrelated corrupt bodies; orphan target records and stale projections are rejected',()=>fixture((a,_b,file)=>{
  const original={notes:{a:{draft:'one'},b:{body:'other'}}};a.write('history',original,null);
  const raw=new DatabaseSync(file);
  try{
    raw.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('NOT JSON','history','["notes","b"]');
    const current=a.readPath('history',['notes','a']);
    assert.throws(()=>a.writePath('history',['notes','a'],current,{draft:'bad'}),/conflict/i);
    a.writePath('history',['notes','a'],current.value,{draft:'new'});
    assert.equal(a.readPath('history',['notes','a']).value.draft,'new');
    assert.equal(raw.prepare('SELECT payload FROM documents WHERE scope=? AND id=?').get('history','["notes","b"]').payload,'NOT JSON');
    raw.prepare('INSERT INTO documents(scope,id,payload,version) VALUES(?,?,?,1)').run('history','["notes","a","orphan"]','{"value":"PRESERVE"}');
    assert.throws(()=>a.writePath('history',['notes','a'],{draft:'new'},{draft:'blocked'}),/parts|conflict/i);
    assert.equal(a.readPath('history',['notes','a']).value.draft,'new');
  }finally{raw.close();}
}));
test('Unicode extension paths keep the same range order in JavaScript and SQLite',()=>fixture((a)=>{
  const before={notes:{a:{'\ue000':{keep:1},'😀':{nested:{keep:2}},content:'old'}}};a.write('history',before,null);
  a.writePath('history',['notes','a'],before.notes.a,{...before.notes.a,content:'new'});
  a.writePath('history',['notes','a','😀'],before.notes.a['😀'],{nested:{keep:3}});
  assert.equal(a.read('history').notes.a['😀'].nested.keep,3);
}));
test('scoped replacement removes old target plaintext from DB/WAL without changing its sibling',()=>fixture((a,_b,file)=>{
  const marker='QA_SCOPED_OLD_PLAINTEXT_241',before={notes:{a:{draft:marker.repeat(200),history:[{body:marker.repeat(200)}]},b:{content:'keep sibling'}}};
  a.write('history',before,null);a.writePath('history',['notes','a'],before.notes.a,{protection_record:{ciphertext:'NOW_ENCRYPTED_V1:synthetic-only'}});
  for(const suffix of ['','-wal'])if(fs.existsSync(file+suffix))assert.equal(fs.readFileSync(file+suffix).includes(Buffer.from(marker)),false);
  assert.equal(a.read('history').notes.b.content,'keep sibling');
}));
