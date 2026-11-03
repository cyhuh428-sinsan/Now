import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
for(const app of ['web/app.js','desktop/app/app.js'])test(app+': a peer write also revokes the memo-integrated Wiki proof without replacing note data',async()=>{
 const source=await fs.readFile(new URL('../../'+app,import.meta.url),'utf8'),start=source.indexOf('function handleWikiStorageChange('),end=source.indexOf('function initializeWikiNotebook()',start);assert.ok(start>0&&end>start);
 let closed=0,cancelled=0;const data={draft:'preserve'},box=vm.createContext({noteProtectionViewGeneration:4,wikiUI:{close(){closed++;}},NowNoteCryptoWorker:{cancelAll(){cancelled++;}},state:{data}});
 vm.runInContext(source.slice(start,end),box);box.handleWikiStorageChange('nownote.history.v1');assert.equal(box.noteProtectionViewGeneration,5);assert.equal(closed,1);assert.equal(cancelled,1);assert.equal(box.state.data,data);
 box.handleWikiStorageChange('unknown');assert.equal(closed,1);
});
