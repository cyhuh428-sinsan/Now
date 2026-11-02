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
    const next=structuredClone(original.contexts[account].notes.a);next.draft.content='edited';
    const receipt=service.note(sender,{revision:opened.revision,account,id:'a',expected:original.contexts[account].notes.a,next});
    assert.notEqual(receipt.revision,opened.revision);assert.equal(fileStore.readKey(filename,key).contexts[account].notes.a.draft.content,'edited');
    assert.throws(()=>service.note(sender,{revision:opened.revision,account,id:'a',expected:next,next}),/다시|기준/);
    const old=service.open(sender),sibling=fileStore.readKey(filename,key);sibling.contexts[account].notes.b.draft.content='other window';
    fileStore.writeKey(filename,key,sibling,fileStore.readKey(filename,key));
    assert.throws(()=>service.note(sender,{revision:old.revision,account,id:'a',expected:next,next}),/changed|conflict/);
    assert.equal(fileStore.readKey(filename,key).contexts[account].notes.b.draft.content,'other window');
    const stale=service.open(other),current=fileStore.readKey(filename,key);current.protection_operations={};fileStore.writeKey(filename,key,current,fileStore.readKey(filename,key));
    assert.throws(()=>service.note(other,{revision:stale.revision,account,id:'a',expected:next,next}),/conflict|changed/);
    assert.ok(fileStore.readKey(filename,key).protection_operations);
    const reopened=service.open(sender);assert.throws(()=>service.note(sender,{revision:reopened.revision,account,id:'a',expected:next,next}),/전체|보호|기준/);
  }finally{fileStore.closeAll();const resolved=fs.realpathSync(dir);assert.equal(path.dirname(resolved),root);fs.rmSync(resolved,{recursive:true,force:true});}
});
