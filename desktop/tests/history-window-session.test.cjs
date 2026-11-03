const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=require('../document-file.cjs'),{createHistorySession}=require('../history-session.cjs');
test('native Window commit preserves hidden historical bodies and rejects old route, sender and stale revision',()=>{
 const parent=path.resolve('D:/tmp/nownote-241-window-session');fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,'run-')),filename=path.join(dir,'store.json'),key='nownote.history.v1',account=JSON.stringify(['https://qa.invalid','alice']);
 const note={owner_id:'alice',local_id:'large',source:'manual',note_type:'tree',content:'current'};
 const entry={raw:note,draft:structuredClone(note),base:{crypto_epoch:0,inventory_revision_ids:[],head_revision_id:'r4'},dirty:false,localOnly:false,needsBaseline:false,replicaSelected:true,
  revisions:Array.from({length:5},(_,i)=>({revision_id:'r'+i,imported:true,snapshot:{note:{...note,content:'old-'+i+'x'.repeat(8192)}}})),outbox:[],receipts:[{old:'receipt'}],completed_outbox:[{old:'completed'}]};
 const initial={schema_version:1,contexts:{[account]:{notes:{large:entry}}}};
 try{
  file.initialize(filename);file.writeKey(filename,key,initial,null);
  const service=createHistorySession(()=>filename),sender={},stamp=service.current(sender,account).stamp;
  const selected=service.selectWindow(sender,{account,id:'large',stamp});assert.equal(selected.entry.revisions.length,1);
  assert.throws(()=>service.full(sender,{revision:selected.revision,next:{}}));
  const next=structuredClone(selected.entry);next.draft.content='new';next.dirty=true;
  const request={revision:selected.revision,account,id:'large',expected:selected.entry,next};
  assert.throws(()=>service.note(sender,request));assert.throws(()=>service.noteWindow({},request));
  const receipt=service.noteWindow(sender,request);assert.notEqual(receipt.stamp,stamp);
  assert.throws(()=>service.noteWindow(sender,request));
  const saved=file.readKey(filename,key).contexts[account].notes.large;
  assert.deepEqual(saved.revisions,entry.revisions);assert.deepEqual(saved.receipts,entry.receipts);assert.deepEqual(saved.completed_outbox,entry.completed_outbox);assert.equal(saved.draft.content,'new');
  const second=structuredClone(next);second.revisions.push({revision_id:'r5',imported:false,snapshot:{note:second.draft}});
  service.noteWindow(sender,{...request,revision:receipt.revision,expected:next,next:second});
  assert.equal(file.readKey(filename,key).contexts[account].notes.large.revisions.length,6);
  const fresh={...note,local_id:'new-note',content:'created'},created={raw:fresh,draft:fresh,base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[],conflict:null,dirty:true,localOnly:true,needsBaseline:false,replicaSelected:true};
  const creation={account,id:'new-note',stamp:service.current(sender,account).stamp,next:created};
  service.createWindow(sender,creation);assert.throws(()=>service.createWindow(sender,creation));
  assert.equal(file.readKey(filename,key).contexts[account].notes['new-note'].draft.content,'created');
 }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(dir)),parent);fs.rmSync(dir,{recursive:true,force:true});}
});
test('external same-stamp corruption invalidates the metadata-only SQLite certificate',()=>{
 const parent=path.resolve('D:/tmp/nownote-241-window-session');fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,'external-')),filename=path.join(dir,'store.json'),account=JSON.stringify(['https://qa.invalid','alice']);
 const entry=id=>({raw:{owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'current'},draft:{owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'current'},base:{crypto_epoch:0,inventory_revision_ids:[]},revisions:[],outbox:[],receipts:[]});
 try{
  file.initialize(filename);file.writeKey(filename,'nownote.history.v1',{schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}}}},null);
  const service=createHistorySession(()=>filename),sender={},stamp=service.current(sender,account).stamp;
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(filename+'.sqlite');
  try{db.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('invalid-json','value:nownote.history.v1',JSON.stringify(['contexts',account,'notes','b','draft']));}finally{db.close();}
  assert.throws(()=>service.selectWindow(sender,{account,id:'a',stamp}),/JSON|token/i);
 }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(dir)),parent);fs.rmSync(dir,{recursive:true,force:true});}
});
