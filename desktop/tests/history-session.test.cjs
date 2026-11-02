const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const fileStore=require('../document-file.cjs');
const {createHistorySession}=require('../history-session.cjs');
const account=JSON.stringify(['https://qa.invalid','alice']),key='nownote.history.v1';
test('native product session guards the whole journal revision and never replaces unseen sibling/protection changes',()=>{
  const root=path.resolve('D:/tmp/nownote-241-session');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'run-')),filename=path.join(dir,'store.json');
  const note=id=>({owner_id:'alice',local_id:id,note_type:'tree',source:'manual',content:'old'});
  const entry=id=>({raw:note(id),draft:note(id),base:{crypto_epoch:0},revisions:[],outbox:[],receipts:[]});
  const original={schema_version:1,contexts:{[account]:{notes:{a:entry('a'),b:entry('b')}}}};
  try{
    fileStore.initialize(filename);fileStore.writeKey(filename,key,original,null);
    const service=createHistorySession(()=>filename),sender={},other={},opened=service.open(sender);
    const preview=service.current(sender,account);assert.equal(typeof preview.stamp,'string');assert.equal(preview.stamp,opened.stamp);
    const next=structuredClone(original.contexts[account].notes.a);next.draft.content='edited';
    const receipt=service.note(sender,{revision:opened.revision,account,id:'a',expected:original.contexts[account].notes.a,next});
    assert.notEqual(receipt.revision,opened.revision);assert.equal(fileStore.readKey(filename,key).contexts[account].notes.a.draft.content,'edited');
    assert.throws(()=>service.note(sender,{revision:opened.revision,account,id:'a',expected:next,next}),/다시|기준/);
    const old=service.open(sender),sibling=fileStore.readKey(filename,key);sibling.contexts[account].notes.b.draft.content='other window';
    fileStore.writeKey(filename,key,sibling,fileStore.readKey(filename,key));
    assert.notEqual(service.current(sender,account).stamp,preview.stamp);
    assert.throws(()=>service.note(sender,{revision:old.revision,account,id:'a',expected:next,next}),/changed|conflict/);
    assert.equal(fileStore.readKey(filename,key).contexts[account].notes.b.draft.content,'other window');
    const stale=service.open(other),current=fileStore.readKey(filename,key);current.protection_operations={};fileStore.writeKey(filename,key,current,fileStore.readKey(filename,key));
    assert.throws(()=>service.note(other,{revision:stale.revision,account,id:'a',expected:next,next}),/conflict|changed/);
    assert.ok(fileStore.readKey(filename,key).protection_operations);
    const reopened=service.open(sender);assert.throws(()=>service.note(sender,{revision:reopened.revision,account,id:'a',expected:next,next}),/전체|보호|기준/);
  }finally{fileStore.closeAll();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),root);fs.rmSync(resolved,{recursive:true,force:true});}
});
test('native current preview is read-only and does not parse stored historical payloads',()=>{
  const {DatabaseSync}=require('node:sqlite');
  const root=path.resolve('D:/tmp/nownote-241-session');fs.mkdirSync(root,{recursive:true});
  const dir=fs.mkdtempSync(path.join(root,'preview-')),filename=path.join(dir,'store.json');
  const note={owner_id:'alice',local_id:'a',note_type:'tree',source:'manual',content:'draft'};
  const original={schema_version:1,contexts:{[account]:{notes:{a:{raw:note,draft:note,base:{crypto_epoch:0,head_revision_id:null},revisions:[{old:'old'}],outbox:[],receipts:[]}}}}};
  try{
    fileStore.initialize(filename);fileStore.writeKey(filename,key,original,null);
    const db=new DatabaseSync(filename+'.sqlite');
    try{db.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('not-json','value:'+key,JSON.stringify(['contexts',account,'notes','a','revisions','0']));}finally{db.close();}
    const service=createHistorySession(()=>filename),sender={},result=service.current(sender,account);
    assert.equal(result.projection,'journal_current_v1');assert.equal(result.notes.a.draft.content,'draft');
    assert.equal(Object.hasOwn(result,'revision'),false);assert.equal(Object.hasOwn(result,'value'),false);
    assert.throws(()=>service.full(sender,{revision:undefined,next:{}}),/기준|다시/);
    assert.throws(()=>service.open(sender),/JSON|Unexpected|token/i);
  }finally{fileStore.closeAll();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),root);fs.rmSync(resolved,{recursive:true,force:true});}
});
