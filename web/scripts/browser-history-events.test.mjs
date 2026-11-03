import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../vendor/browser-history-storage.js',import.meta.url),'utf8');
test('browser storage events contain only a fixed key and are emitted from completed document transactions',()=>{
 const sent=[],channels=[];let onCommit;
 class Channel{constructor(name){assert.equal(name,'nownote.storage.v1');channels.push(this);}postMessage(value){sent.push(value);for(const target of channels)if(target!==this)target.onmessage?.({data:structuredClone(value)});}close(){}}
 const make=()=>{const box=vm.createContext({BroadcastChannel:Channel,structuredClone,NowDocumentTransactions:{create:options=>{onCommit=options.onCommit;return {};}}});vm.runInContext(source,box);return box;};
 const reader=make(),writer=make(),received=[];
 assert.equal(typeof reader.NowBrowserHistoryStorage.onChange,'function');
 const stop=reader.NowBrowserHistoryStorage.onChange(key=>received.push(key));
 writer.NowBrowserHistoryStorage.create({indexedDB:{},localStorage:{},lock:fn=>fn(),key:'nownote.history.v1'});
 assert.equal(typeof onCommit,'function');assert.equal(received.length,0);onCommit();
 assert.deepEqual(received,['nownote.history.v1']);assert.deepEqual(JSON.parse(JSON.stringify(sent)),[{schema_version:1,key:'nownote.history.v1'}]);
 channels[0].onmessage({data:{schema_version:1,key:'unknown'}});assert.equal(received.length,1);
 stop();onCommit();assert.equal(received.length,1);
});
