import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const file of ['web/app.js','desktop/app/app.js']){
 const source=await fs.readFile(new URL('../../'+file,import.meta.url),'utf8');
 const start=source.indexOf('async function applyProtectedAnalysisResult('),end=source.indexOf('async function prepareProtectedTranscript(',start);
 assert.ok(start>0&&end>start,'both apps must apply typed analysis through existing MW');
 let writes=[],reads=0,created=0,invalid=false,late=false;
 const descriptor={key:{kind:'analysis_result',id:'7',slot:'result_json'},is_null:false};
 const info={scope:{owner:'alice',local_id:'memo'},pending:null,catalog:{entries:[descriptor],context:{base:{current_exists:true}}}};
 const row={kind:'typed',descriptor},old={owner_id:'alice',local_id:'memo',title:'Original',content:'ORIGINAL\r\n',tags:'[]'};
 const box=vm.createContext({structuredClone,NowNoteProtectionProtocol:{canonicalJson:JSON.stringify},protectionActionGuard:()=>()=>{if(invalid)throw Error('scope_changed');},
  noteProtectionReader:{read:async()=>{reads++;if(late)invalid=true;return {value:'{"summary":"RESULT\\r\\n"}'};}},
  editProtectedCurrent:async()=>structuredClone(old),createProtectedCurrent:async()=>{created++;return {...old,content:''};},
  writeProtectedCurrent:async(i,n,p,r)=>{assert.equal(p,'journal-key');writes.push(structuredClone(n));return 'mw';},
  extractServerAnalysisResultText:value=>JSON.parse(value).summary,extractTags:()=>[],t:k=>k,
 });
 vm.runInContext('let noteProtectionInternalEnabled=true,noteProtectionEditSession=null;'+source.slice(start,end),box);
 assert.equal(await box.applyProtectedAnalysisResult(info,row,'append','journal-key',async()=> 'key'),'mw');
 assert.ok(writes[0].content.startsWith(old.content));assert.ok(writes[0].content.endsWith('RESULT\r\n'));assert.equal(old.content,'ORIGINAL\r\n');
 await box.applyProtectedAnalysisResult(info,row,'approve','journal-key',async()=> 'key');assert.equal(writes.length,2);
 const absent=structuredClone(info);absent.catalog.context.base.current_exists=false;
 await assert.rejects(box.applyProtectedAnalysisResult(absent,row,'append','journal-key',async()=> 'key'));assert.equal(writes.length,2);
 await box.applyProtectedAnalysisResult(absent,row,'approve','journal-key',async()=> 'key');assert.equal(created,1);assert.equal(writes.length,3);
 for(const bad of [{kind:'archive',descriptor},{kind:'typed',descriptor:{...descriptor,is_null:true}}])await assert.rejects(box.applyProtectedAnalysisResult(info,bad,'append','journal-key',async()=> 'key'));
 await assert.rejects(box.applyProtectedAnalysisResult({...info,pending:{id:'existing'}},row,'approve','journal-key',async()=> 'key'));
 const before=reads;vm.runInContext('noteProtectionInternalEnabled=false',box);await assert.rejects(box.applyProtectedAnalysisResult(info,row,'append','journal-key',async()=> 'key'));assert.equal(reads,before);
 vm.runInContext('noteProtectionInternalEnabled=true',box);late=true;await assert.rejects(box.applyProtectedAnalysisResult(info,row,'append','journal-key',async()=> 'key'),/scope/);assert.equal(writes.length,3);
 const legacyStart=source.indexOf('function appendAnalysisResultToNote('),legacyEnd=source.indexOf('async function rejectAnalysisResult(',legacyStart);
 let plainWrites=0,backups=0,notices=0,blocked=true;
 const node={id:'memo',content:'PROTECTED-CIPHER',protection_record:{ciphertext:'cipher'}};
 const legacy=vm.createContext({state:{data:{tree:[node]},settings:{server:{}}},findTreeNode:()=>node,noteProtectionBlocked:()=>blocked,showNotice:()=>{notices++;},extractServerAnalysisResultText:()=> 'PLAINTEXT RESULT',createRecoverySnapshot:()=>{backups++;},persist:()=>{plainWrites++;},persistSettings:()=>{plainWrites++;},renderTree:()=>{},renderServerSettings:()=>{},showSaved:()=>{},markTreeNodeChanged:()=>{},setServerMessage:()=>{},extractTags:()=>[],formatServerJobTime:()=> 'time',t:k=>k,elements:{treeSavedLabel:{}}});
 vm.runInContext(source.slice(legacyStart,legacyEnd),legacy);
 const job={id:7,note_local_id:'memo',result_json:'result',status:'done'};
 legacy.appendAnalysisResultToNote(job);legacy.approveAnalysisResult(job);
 assert.equal(node.content,'PROTECTED-CIPHER');assert.equal(plainWrites,0);assert.equal(backups,0);assert.equal(notices,2);
 delete node.protection_record;blocked=false;node.content='PLAIN';legacy.appendAnalysisResultToNote(job);assert.ok(node.content.includes('PLAINTEXT RESULT'));assert.ok(plainWrites>0);
 console.log(file+': typed append/approve MW, preserved original, absent approval, gate/scope/pending and protected plain-path denial PASS (synthetic)');
}
