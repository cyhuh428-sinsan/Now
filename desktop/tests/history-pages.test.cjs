const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=require('../document-file.cjs'),{createHistorySession}=require('../history-session.cjs');
const account=JSON.stringify(['https://qa.invalid','alice']),key='nownote.history.v1';
test('converted journal pages preserve every revision and cursor after a cold session without granting a full-write baseline',()=>{
  const parent=path.resolve('D:/tmp/nownote-241-migration');fs.mkdirSync(parent,{recursive:true});
  const own=fs.mkdtempSync(path.join(parent,'pages-')),filename=path.join(own,'store.json');
  const note={owner_id:'alice',local_id:'a',note_type:'tree',source:'manual',content:'current'};
  const entry={raw:note,draft:note,base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:Array.from({length:125},(_,index)=>({revision_id:'r'+index,snapshot:{note:{...note,content:'history '+index}},unknown:{index}})),outbox:[],receipts:[]};
  const root={schema_version:1,contexts:{[account]:{notes:{a:entry}}}},raw=JSON.stringify({version:1,values:{[key]:root}});
  fs.writeFileSync(filename,raw);
  try{
    file.initialize(filename,{syntheticLegacy:true});const service=createHistorySession(()=>filename),sender={},stamp=service.current(sender,account).stamp;
    const first=service.page(sender,{account,id:'a',stamp,limit:50});assert.equal(first.items[0].revision_id,'r124');assert.equal(first.items.length,50);
    assert.throws(()=>service.full(sender,{revision:first.stamp,next:{}}));file.closeAll();file.initialize(filename);
    const cold=createHistorySession(()=>filename),second=cold.page({}, {account,id:'a',stamp,cursor:first.nextCursor});
    assert.equal(second.items[0].revision_id,'r74');assert.equal(second.items[0].unknown.index,74);
    const last=cold.page({}, {account,id:'a',stamp,cursor:second.nextCursor});assert.equal(last.items.length,25);assert.equal(last.nextCursor,null);
    assert.equal(fs.readFileSync(filename+'.original-v1.json','utf8'),raw);
    const current=file.readKey(filename,key),changed=structuredClone(current);changed.contexts[account].notes.a.draft.content='concurrent edit';file.writeKey(filename,key,changed,current);
    assert.throws(()=>cold.page({}, {account,id:'a',stamp,cursor:first.nextCursor}),/changed|변경/);
  }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(own)),parent);fs.rmSync(own,{recursive:true,force:true});}
});
