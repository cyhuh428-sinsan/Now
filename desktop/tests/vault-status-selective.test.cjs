const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),file=require('../document-file.cjs'),{createVaultService}=require('../vault-service.cjs');
test('Vault status reads only connection metadata; preview still validates the complete store',async()=>{
 const parent=path.resolve('D:/tmp/nownote-241-idle-qa');fs.mkdirSync(parent,{recursive:true});
 const own=fs.mkdtempSync(path.join(parent,'vault-')),store=path.join(own,'store.json');
 try{
  file.initialize(store);file.writeKey(store,'nownote.vault.v1',{path:own,lastSuccessAt:'synthetic',lastResult:{applied:1},baselines:{untouched:'large metadata'}},null);
  file.writeKey(store,'nownote.history.v1',{schema_version:1,contexts:{}},null);
  const db=new DatabaseSync(store+'.sqlite');try{db.prepare('UPDATE documents SET payload=? WHERE scope=? AND id=?').run('invalid-json','value:nownote.history.v1','$root');}finally{db.close();}
  const service=createVaultService({storePath:store,backupDir:path.join(own,'backup')}),status=service.vaultStatus();
  assert.equal(status.path,own);assert.equal(status.lastSuccessAt,'synthetic');assert.equal(status.recoveryRequired,false);
  await assert.rejects(service.previewVault({direction:'both'}),/JSON|Unexpected|token/i);
 }finally{file.closeAll();assert.equal(path.dirname(fs.realpathSync(own)),parent);fs.rmSync(own,{recursive:true,force:true});}
});
