import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
for(const file of ['web/app.js','desktop/app/app.js']){
 const source=await fs.readFile(new URL('../../'+file,import.meta.url),'utf8'),start=source.indexOf('async function prepareProtectedTranscript('),end=source.indexOf('function protectedAnalysisRoute(',start);
 assert.ok(start>0&&end>start,'both applications require guarded typed transcript adapters');
 let enabled=true,invalid=false,reads=0,starts=0,resumes=0;
 const scope={url:'http://synthetic.invalid',owner:'alice',instance:'instance',local_id:'note',device:'actor'},d={key:{kind:'recording_transcript',id:'7',slot:'transcript'}};
 const info={scope,pending:null,catalog:{entries:[d],context:{base:{crypto_epoch:2}},catalog_digest:'digest'}},row={kind:'typed',descriptor:d};
 const origin={value:{purpose:'original'},legacy:null};
 const box=vm.createContext({structuredClone,NowNoteProtectionProtocol:{canonicalJson:JSON.stringify},protectionActionGuard:()=>()=>{if(invalid)throw Error('invalidated');},
  NowNoteProtectionClient:{planTranscript:async(s,c,descriptor,value,origins)=>{assert.equal(value,'Replacement\r\n');assert.equal(origins[0].origin.value.purpose,'original');return {purpose:'mixed_transcript_write'};},buildTranscriptWork:async()=>({})},
  noteProtectionReader:{read:async()=>{reads++;return {value:'Original\r\n',origin};}},noteProtectionRemote:{},
  noteProtectionTranscript:{start:async()=>{starts++;return 'operation';},resume:async()=>{resumes++;}},
 });
 vm.runInContext('let noteProtectionInternalEnabled=true;'+source.slice(start,end),box);
 const edit=await box.prepareProtectedTranscript(info,row,async()=> 'old-key');assert.equal(edit.value,'Original\r\n');assert.equal(reads,1);
 await box.saveProtectedTranscript(info,edit,'Replacement\r\n','journal-key',async()=> 'new-key');assert.equal(starts,1);assert.equal(resumes,1);
 await assert.rejects(box.prepareProtectedTranscript(info,{kind:'archive',descriptor:d},async()=> 'key'),/transcript/);assert.equal(reads,1);
 const pending={...info,pending:{id:'existing'}};await assert.rejects(box.saveProtectedTranscript(pending,edit,'Replacement\r\n','journal-key',async()=> 'key'));assert.equal(starts,1);
 const foreign=structuredClone(edit);foreign.scope.owner='bob';await assert.rejects(box.saveProtectedTranscript(info,foreign,'Replacement\r\n','journal-key',async()=> 'key'));assert.equal(starts,1);
 vm.runInContext('noteProtectionInternalEnabled=false',box);await assert.rejects(box.prepareProtectedTranscript(info,row,async()=> 'key'));assert.equal(reads,1);
 vm.runInContext('noteProtectionInternalEnabled=true',box);invalid=true;await assert.rejects(box.saveProtectedTranscript(info,edit,'Replacement\r\n','journal-key',async()=> 'key'));assert.equal(starts,1);
 console.log(file+': typed transcript adapters, exact CRLF, gate/pending/scope/invalidation and no plain note write PASS (synthetic)');
}
