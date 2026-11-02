const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=require('../document-file.cjs'),{createHistorySession}=require('../history-session.cjs');
const key='nownote.history.v1',account=JSON.stringify(['https://qa.invalid','alice']);
test('selected native session reads only chosen history and never authorizes full-journal replacement',()=>{
  const parent=path.resolve('D:/tmp/nownote-241-session');fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(path.join(parent,'selected-')),filename=path.join(dir,'store.json');
  const note=id=>({local_id:id,owner_id:'alice',source:'manual',note_type:'tree',content:'before'});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[]});
  const metadata={one:{state:'committed',body:'UNREAD_WIKI_OPERATION_BODY'}};
  const initial={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')},wiki_ingest_operations:metadata}}};
  try{
    file.initialize(filename);file.writeKey(filename,key,initial,null);
    const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(filename+'.sqlite');
    try{db.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('invalid-json','value:'+key,JSON.stringify(['contexts',account,'notes','b','revisions']));}finally{db.close();}
    const service=createHistorySession(()=>filename),sender={},stamp=service.current(sender,account).stamp;
    const opened=service.select(sender,{account,id:'a',stamp});assert.equal(opened.entry.draft.content,'before');
    assert.equal(opened.stamp,stamp);assert.equal(Object.hasOwn(opened,'value'),false);
    assert.throws(()=>service.full(sender,{revision:opened.revision,next:{}}),/전체|selected|선택/);
    const next=structuredClone(opened.entry);next.draft.content='selected edit';
    const receipt=service.note(sender,{revision:opened.revision,account,id:'a',expected:opened.entry,next});
    assert.notEqual(receipt.stamp,stamp);assert.equal(file.readKeyPath(filename,key,['contexts',account,'notes','a','draft']).value.content,'selected edit');
    assert.deepEqual(file.readKeyPath(filename,key,['contexts',account,'wiki_ingest_operations']).value,metadata);
    assert.throws(()=>service.select(sender,{account,id:'a',stamp}),/changed|변경|판본/);
    assert.throws(()=>service.open(sender),/JSON|token/);
  }finally{file.closeAll();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),parent);fs.rmSync(resolved,{recursive:true,force:true});}
});
