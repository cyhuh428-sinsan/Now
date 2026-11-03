const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=require('../document-file.cjs');
test('settings CAS checks journal metadata without opening historical payloads',()=>{
 const parent=path.resolve('D:/tmp/nownote-241-settings-test');fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,'run-')),filename=path.join(dir,'store.json'),key='nownote.history.v1';
 const account=JSON.stringify(['https://qa.invalid','alice']),root={schema_version:1,contexts:{[account]:{notes:{}}}};
 try{
  file.initialize(filename);file.writeKey(filename,key,root,null);
  const stamp=file.readKeyCurrent(filename,key,account).stamp;
  const request={stamp,expected:null,next:{fontSize:'large'}};
  file.writeSettings(filename,request);
  assert.deepEqual(file.readKey(filename,'nownote.web.settings.v1'),request.next);
  assert.throws(()=>file.writeSettings(filename,request),/changed|conflict/i);
  file.writeKey(filename,key,{...root,protection_operations:{}},root);
  assert.throws(()=>file.writeSettings(filename,{...request,expected:request.next}),/changed|protection|metadata/i);
  const blocked=file.readKeyPath(filename,key,[],true).stamp;
  assert.throws(()=>file.writeSettings(filename,{...request,stamp:blocked,expected:request.next}),/protection|metadata/i);
  assert.deepEqual(file.readKey(filename,'nownote.web.settings.v1'),request.next);
 }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(dir)),parent);fs.rmSync(dir,{recursive:true,force:true});}
});
