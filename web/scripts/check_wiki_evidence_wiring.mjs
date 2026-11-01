import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

for(const file of ['web/app.js','desktop/app/app.js']){
  const source=await fs.readFile(new URL('../../'+file,import.meta.url),'utf8');
  const start=source.indexOf('function initializeWikiNotebook(){');
  const end=source.indexOf('\nasync function initializeApp()',start);
  assert.ok(start>=0&&end>start);
  let serverApi,bookApi,ingestApi;
  const server={},reads=[];
  const box=vm.createContext({
    NowWikiServerAccess:{create:api=>{serverApi=api;return server;}},
    NowNoteWikiSources:{create:()=>({})},NowWikiLifecycle:{create:()=>({})},
    createWikiNotebook:api=>{bookApi=api;return {};},
    createWikiIngestNotebook:api=>{ingestApi=api;return {};},
    mountNowWiki:()=>({}),noteHistoryContext:()=>({}),wikiViewKey:()=>'',
    wikiServerRequest:()=>{},noteHistory:{},wikiSourceNote:()=>{},wikiConnection:()=>{},openWikiProtection:()=>{},
    wikiRead:value=>{reads.push(value);return value;},
    document:{createElement:()=>({addEventListener:()=>{}})},$:()=>null,
  });
  vm.runInContext(source.slice(start,end)+'\ninitializeWikiNotebook();',box);
  assert.equal(typeof serverApi.readWiki,'function',file+' must bind the existing Wiki read endpoint');
  await serverApi.readWiki('exact id');assert.deepEqual(reads,['/exact%20id']);
  assert.equal(bookApi.server,server,file+' reader must inspect pinned server evidence');
  assert.equal(typeof bookApi.readOperations,'function',file+' graph must consume validated original operation bindings');
  assert.equal(ingestApi.source,box.wikiSourceNote,file+' ingest must resolve account-bound local evidence');
  assert.ok(source.includes('globalThis.NowWikiEvidence='),file+' must include the evidence module');
  assert.ok(source.includes('globalThis.NowWikiGraph='),file+' must include the approved graph module');
}
console.log('Web/Desktop pinned evidence runtime wiring PASS');
