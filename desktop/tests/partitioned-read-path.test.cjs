const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createPartitionedStore}=require('../partitioned-store.cjs');

test('cold SQLite path read does not parse unrelated corrupt payloads and cannot replace the full journal',()=>{
  const root=path.resolve('D:/tmp/nownote-241-select');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'read-')),file=path.join(dir,'store.sqlite');let store=createPartitionedStore(file),db;
  const original={contexts:{A:{notes:{one:{draft:{content:'current'},revisions:[{body:'old'}]},two:{draft:{content:'other'}}}}},unknown:{keep:true}};
  try{
    store.write('history',original,null);store.close();
    db=new DatabaseSync(file);db.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('NOT JSON','history','["contexts","A","notes","two","draft"]');db.close();db=null;
    store=createPartitionedStore(file);
    const result=store.readPath('history',['contexts','A','notes','one','draft']);
    assert.equal(result.projection,'path_v1');assert.deepEqual(result.value,{content:'current'});assert.equal(result.found,true);
    const {stamp,...absent}=store.readPath('absent',[]);assert.match(stamp,/^[0-9a-f]{64}$/);
    assert.deepEqual(absent,{projection:'path_v1',found:false});
    const directory=store.readPath('history',['contexts','A','notes'],true);
    assert.equal(directory.stamp,result.stamp);assert.deepEqual(directory.part.entries.map(([id])=>id),['one','two']);
    assert.equal(Object.hasOwn(directory,'value'),false);
    assert.throws(()=>store.write('history',{only:'partial'},result),/JSON|changed/);
    assert.throws(()=>store.read('history'),/JSON/,'full reads still report corruption, never a silently partial archive');
  }finally{db?.close();store.close();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),root);fs.rmSync(resolved,{recursive:true,force:true});}
});
