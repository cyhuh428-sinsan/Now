import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

for(const app of ['web/app.js','desktop/app/app.js'])test(app+': Web protection and backup retain the existing fallback store identity and read the preserved original',async()=>{
  const source=await fs.readFile(new URL('../../'+app,import.meta.url),'utf8');
  const start=source.indexOf('function protectionStorageAdapters()'),end=source.indexOf('function initializeNoteProtection()',start);
  let reads=0,writes=0;
  const original={schema_version:1,contexts:{alice:{notes:{old:{content:'exact original'}}}}};
  const box=vm.createContext({structuredClone,isDesktopClient:()=>false,isHostedWebClient:()=>true,
    STORAGE_KEY:'data',SETTINGS_KEY:'settings',LIBRARY_STORAGE_KEY:'library',NOTE_HISTORY_KEY:'history',
    localStorage:{getItem:()=>JSON.stringify({schema_version:241,storage:'marker'})},state:{},noteHistory:{},
    browserHistoryStorage:()=>({readOriginal:async()=>{reads++;return JSON.stringify(original);},casLegacy:async()=>{writes++;}})});
  vm.runInContext(source.slice(start,end),box);
  const stores=box.protectionStorageAdapters(),fallback=stores.find(item=>item.name==='fallback:history');
  assert.equal(stores.length,7);assert.equal(fallback.kind,'history');
  assert.deepEqual(JSON.parse(JSON.stringify(await fallback.read())),original);assert.equal(reads,1);
  await fallback.cas(original,{}, {active:()=>true});assert.equal(writes,1);
  await assert.rejects(fallback.cas(original,{}, {active:()=>false}));assert.equal(writes,1);
});

for(const app of ['web/app.js','desktop/app/app.js'])test(app+': explicit Web backup verifies a retained original before creating any downloadable archive',async()=>{
  const source=await fs.readFile(new URL('../../'+app,import.meta.url),'utf8');
  const start=source.indexOf('async function exportData()'),end=source.indexOf('async function exportMarkdown()',start);
  let verified=0,downloads=0,fail=false,notice='';
  const box=vm.createContext({Blob,structuredClone,state:{data:{},settings:{}},noteHistoryCaptureChain:Promise.resolve(),
    noteHistory:{idle:async()=>{},archive:async()=>new Blob(['{}'])},wikiViewKey:()=> 'bound-account',libraryStore:null,
    isDesktopClient:()=>false,browserHistoryStorage:()=>({verifyRetainedOriginal:async guard=>{assert.equal(guard.active(),true);verified++;if(fail)throw Error('retained-corruption');}}),
    NowHistoryBackup:{create(){}},requireProtectionSettled(){},downloadText(){downloads++;},fileTimestamp:()=> 'qa',showNotice:message=>{notice=message;}});
  vm.runInContext(source.slice(start,end),box);await box.exportData();assert.equal(verified,1);assert.equal(downloads,1);
  fail=true;await box.exportData();assert.equal(verified,2);assert.equal(downloads,1);assert.equal(notice,'retained-corruption');
});
