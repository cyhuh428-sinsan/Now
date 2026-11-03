const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const doc=require('../document-file.cjs'),base='D:/tmp/nownote-241-approval-tests';
function fixture(action){fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'approval-')),file=path.join(dir,'store.json'),raw=JSON.stringify({version:1,values:{'nownote.web.v1':{tree:[],extension:'synthetic'},'nownote.history.v1':{schema_version:1,contexts:{}}}},null,2);fs.writeFileSync(file,raw);try{action({dir,file,raw});}finally{doc.closeAll();assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(base));fs.rmSync(dir,{recursive:true,force:true});}}
test('explicit local migration approval is bound to exact original bytes and preserves its full store',()=>fixture(({dir,file,raw})=>{
 let approvals=0;doc.initialize(file,{approveLegacy:evidence=>{approvals++;assert.equal(Object.isFrozen(evidence),true);assert.equal(evidence.profileDirectory,fs.realpathSync(dir));assert.equal(evidence.sourceSha256,createHash('sha256').update(raw).digest('hex'));assert.equal(evidence.byteLength,Buffer.byteLength(raw));return true;}});
 assert.equal(approvals,1);assert.equal(fs.readFileSync(file+'.original-v1.json','utf8'),raw);assert.deepEqual(doc.read(file).store,JSON.parse(raw));doc.closeAll();doc.initialize(file,{approveLegacy:()=>{throw Error('Do not ask again after conversion');}});
}));
test('no approval, decline and changed source cannot create a converted database',()=>fixture(({file,raw})=>{
 for(const options of [{},{syntheticLegacy:true},{approveLegacy:()=>false}]){assert.throws(()=>doc.initialize(file,options),/not enabled|승인|전환/);assert.equal(fs.readFileSync(file,'utf8'),raw);assert.equal(fs.existsSync(file+'.sqlite'),false);}
 assert.throws(()=>doc.initialize(file,{approveLegacy:()=>{fs.appendFileSync(file,' ');return true;}}),/changed|변경/);assert.equal(fs.existsSync(file+'.sqlite'),false);assert.equal(fs.existsSync(file+'.original-v1.json'),false);
}));
test('approval cannot bypass an unfinished protection operation',()=>fixture(({file})=>{
 const raw=JSON.stringify({version:1,values:{'nownote.history.v1':{schema_version:1,contexts:{},protection_operations:{one:{phase:'applying'}}}}});fs.writeFileSync(file,raw);
 assert.throws(()=>doc.initialize(file,{approveLegacy:()=>true}),/보호|전환/);assert.equal(fs.readFileSync(file,'utf8'),raw);assert.equal(fs.existsSync(file+'.sqlite'),false);assert.equal(fs.existsSync(file+'.original-v1.json'),false);
}));
test('native migration confirmation defaults to cancel and accepts only the explicit continue button',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),start=source.indexOf('function approveLegacyMigration('),end=source.indexOf('if (primaryInstance) app.whenReady()',start);assert.ok(start>0&&end>start);
 let choice=1,seen;const box={dialog:{showMessageBoxSync:options=>{seen=options;return choice;}}};vm.createContext(box);vm.runInContext(source.slice(start,end),box);
 const evidence={profileDirectory:'synthetic-profile',byteLength:1048576,sourceSha256:'a'.repeat(64)};assert.equal(box.approveLegacyMigration(evidence),false);assert.equal(seen.defaultId,1);assert.equal(seen.cancelId,1);assert.equal(seen.buttons.length,2);assert.ok(seen.detail.includes('synthetic-profile'));choice=0;assert.equal(box.approveLegacyMigration(evidence),true);
 assert.match(source,/approveLegacy:approveLegacyMigration/);assert.match(source,/error.code!=='NOWNOTE_MIGRATION_DECLINED'/);
});
