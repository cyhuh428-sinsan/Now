const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createDocumentStore}=require('../document-store.cjs');
test('document reads and compare-and-set writes preserve independent accounts and notes',()=>{
  const store=createDocumentStore(':memory:');
  try{
    assert.deepEqual(store.commit([{kind:'put',scope:'account-a',id:'one',expectedVersion:0,value:{title:'One',content:'Synthetic'}}]),[1]);
    store.commit([{kind:'put',scope:'account-b',id:'one',expectedVersion:0,value:{content:'Other'}}]);
    assert.equal(store.read('account-a','one').value.content,'Synthetic');
    assert.equal(store.read('account-b','one').value.content,'Other');
    assert.throws(()=>store.commit([{kind:'put',scope:'account-a',id:'one',expectedVersion:0,value:{content:'Stale'}}]),/conflict/);
    assert.equal(store.read('account-a','one').version,1);
    assert.equal(store.read('absent','one'),null);
    store.commit([{kind:'put',scope:'ACCOUNT-A',id:'one',expectedVersion:0,value:{content:'Case-sensitive'}}]);
    assert.equal(store.read('account-a','one').value.content,'Synthetic');
    assert.equal(store.read('ACCOUNT-A','one').value.content,'Case-sensitive');
  }finally{store.close();}
});
test('a marked v1 file with modified collations or extra triggers is rejected without modification',()=>{
  const {DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');
  const base=path.resolve('D:/tmp/nownote-241-document-store');fs.mkdirSync(base,{recursive:true});
  const dir=fs.mkdtempSync(path.join(base,'schema-'));
  try{
    for(const variant of ['collation','trigger','sqliteX-trigger','v0-view']){
      const file=path.join(dir,variant+'.sqlite'),db=new DatabaseSync(file);
      if(variant==='v0-view')db.exec('CREATE VIEW unrelated_view AS SELECT 42 AS value;');
      else db.exec(`CREATE TABLE documents(scope TEXT NOT NULL${variant==='collation'?' COLLATE NOCASE':''},id TEXT NOT NULL,payload TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),PRIMARY KEY(scope,id));
        CREATE TABLE revisions(scope TEXT NOT NULL,id TEXT NOT NULL,revision_id TEXT NOT NULL,seq INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(scope,id,revision_id),UNIQUE(scope,id,seq),FOREIGN KEY(scope,id) REFERENCES documents(scope,id));
        PRAGMA user_version=1;`);
      if(variant==='trigger')db.exec('CREATE TRIGGER unexpected AFTER UPDATE ON documents BEGIN DELETE FROM revisions; END;');
      if(variant==='sqliteX-trigger')db.exec('CREATE TRIGGER sqliteX AFTER UPDATE ON documents BEGIN DELETE FROM revisions; END;');
      db.close();
      const digest=()=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=digest();
      assert.throws(()=>{const store=createDocumentStore(file);store.close();},/schema/);
      assert.equal(digest(),before,'Rejected database must not be rewritten');
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a failed multi-document transaction preserves every earlier document and revision',()=>{
  const store=createDocumentStore(':memory:');
  try{
    store.commit([{kind:'put',scope:'a',id:'one',expectedVersion:0,value:{content:'Original'}}]);
    assert.throws(()=>store.commit([
      {kind:'put',scope:'a',id:'one',expectedVersion:1,value:{content:'Changed'}},
      {kind:'append',scope:'a',id:'one',expectedVersion:2,revisionId:'r1',value:{snapshot:'Synthetic'}},
      {kind:'put',scope:'a',id:'missing',expectedVersion:9,value:{}},
    ]),/conflict/);
    assert.equal(store.read('a','one').value.content,'Original');
    assert.equal(store.history('a','one').items.length,0);
  }finally{store.close();}
});
test('history is paginated without losing opaque encrypted or extension fields',()=>{
  const store=createDocumentStore(':memory:');
  try{
    const value={content:'NOW_ENCRYPTED_V1:synthetic-only',extensions:{future:{keep:[1,2,3]}}};
    store.commit([{kind:'put',scope:'a',id:'one',expectedVersion:0,value}]);
    for(let n=1;n<=4;n++)store.commit([{kind:'append',scope:'a',id:'one',expectedVersion:n,revisionId:'r'+n,value:{...value,revision:n}}]);
    const page=store.history('a','one',{limit:2});
    assert.deepEqual(page.items.map(row=>row.revisionId),['r4','r3']);
    assert.deepEqual(page.items[0].value.extensions,value.extensions);
    const older=store.history('a','one',{limit:2,before:page.nextCursor});
    assert.deepEqual(older.items.map(row=>row.revisionId),['r2','r1']);
    assert.equal(older.nextCursor,null);
    assert.deepEqual(store.read('a','one').value,value);
    assert.throws(()=>store.history('a','one',{limit:0}),/limit/);
  }finally{store.close();}
});
test('separate connections reject stale writes and recover committed data after restart',()=>{
  const base=path.resolve('D:/tmp/nownote-241-document-store');fs.mkdirSync(base,{recursive:true});
  const dir=fs.mkdtempSync(path.join(base,'run-')),file=path.join(dir,'documents.sqlite');
  let first,second;
  try{
    first=createDocumentStore(file);second=createDocumentStore(file);
    first.commit([{kind:'put',scope:'a',id:'one',expectedVersion:0,value:{content:'First'}}]);
    second.commit([{kind:'put',scope:'a',id:'two',expectedVersion:0,value:{content:'Independent'}}]);
    first.commit([{kind:'put',scope:'a',id:'one',expectedVersion:1,value:{content:'Latest'}}]);
    assert.throws(()=>second.commit([{kind:'put',scope:'a',id:'one',expectedVersion:1,value:{content:'Stale'}}]),/conflict/);
    first.close();first=null;second.close();second=createDocumentStore(file);
    assert.equal(second.read('a','one').value.content,'Latest');
    assert.equal(second.read('a','two').value.content,'Independent');
  }finally{
    first?.close();second?.close();
    if(!fs.realpathSync(dir).startsWith(base+path.sep)||fs.lstatSync(dir).isSymbolicLink())throw Error('Cleanup boundary mismatch');
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
