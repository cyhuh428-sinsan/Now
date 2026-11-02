import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

for(const file of ['web/app.js','desktop/app/app.js']){
  const source=await fs.readFile(new URL('../../'+file,import.meta.url),'utf8');
  assert.ok(source.includes('NowWikiWorkspace.create('),file+' must share workspace assembly with the independent Wiki host');
  const start=source.indexOf('function initializeWikiNotebook(){');
  const end=source.indexOf('\nasync function initializeApp()',start);
  assert.ok(start>=0&&end>start);
  let serverApi,bookApi,ingestApi,queryApi,uiApi,selectedApi,runtimeLoads=0,browsePreparations=0,fullPreparations=0;
  const server={},reads=[];
  const box=vm.createContext({
    NowWikiServerAccess:{create:api=>{serverApi=api;return server;}},
    NowWikiSelectedPage:{create:api=>{selectedApi=api;return {};}},openWikiReadSet:()=>{},prepareWikiBrowse:async()=>{browsePreparations++;},
    NowNoteWikiSources:{create:()=>({})},NowWikiLifecycle:{create:()=>({})},
    createWikiNotebook:api=>{bookApi=api;return {};},
    createWikiIngestNotebook:api=>{ingestApi=api;return {};},
    createWikiQueryNotebook:api=>{queryApi=api;return {};},
    mountNowWiki:api=>{uiApi=api;return {open:()=>{}};},noteHistoryContext:()=>({}),wikiViewKey:()=>'',
    ensureNowWikiRuntime:async()=>{runtimeLoads++;},
    wikiServerRequest:()=>{},noteHistory:{ensure:async()=>{fullPreparations++;}},wikiSourceNote:()=>{},wikiConnection:()=>{},openWikiProtection:()=>{},
    wikiRead:value=>{reads.push(value);return value;},
    document:{createElement:()=>({addEventListener:()=>{}}),querySelectorAll:()=>[]},$:()=>null,
  });
  const lazy=await fs.readFile(new URL('../vendor/wiki-runtime-loader.js',import.meta.url),'utf8');
  vm.runInContext(lazy.slice(lazy.indexOf('globalThis.createLazyWikiView=')),box);
  vm.runInContext(await fs.readFile(new URL('../vendor/wiki-workspace.js',import.meta.url),'utf8'),box);
  vm.runInContext(source.slice(start,end)+'\ninitializeWikiNotebook();',box);
  assert.equal(uiApi,undefined,file+' startup must not mount Wiki UI');assert.equal(runtimeLoads,0);
  await box.wikiUI.open();assert.equal(runtimeLoads,1,file+' explicit entry loads Wiki UI once');
  assert.equal(fullPreparations,1);await box.wikiUI.open('browse');assert.equal(browsePreparations,1);assert.equal(fullPreparations,1,file+' browse must not materialize the journal');
  assert.equal(typeof serverApi.readWiki,'function',file+' must bind the existing Wiki read endpoint');
  await serverApi.readWiki('exact id');assert.deepEqual(reads,['/exact%20id']);
  assert.equal(bookApi.server,server,file+' reader must inspect pinned server evidence');
  assert.equal(selectedApi.server,server,file+' selected reader must use the same server evidence verifier');
  assert.equal(typeof selectedApi.readCurrent,'function',file+' selected reader must bind current document lookup');
  assert.equal(typeof selectedApi.inspectLifecycle,'function',file+' selected reader must inspect lifecycle without persistence');
  await selectedApi.readRemote('selected id');assert.equal(reads.at(-1),'/selected%20id');
  assert.equal(typeof bookApi.readOperations,'function',file+' graph must consume validated original operation bindings');
  assert.equal(ingestApi.source,box.wikiSourceNote,file+' ingest must resolve account-bound local evidence');
  assert.equal(typeof ingestApi.lintSnapshot,'function',file+' report save must re-read the same account-bound Lint inputs');
  assert.equal(queryApi.book,box.wikiNotebook,file+' Query must consume the same verified notebook');
  assert.equal(queryApi.contextKey,box.wikiViewKey,file+' Query must use the live account/protection view guard');
  assert.ok(uiApi.query&&source.includes('globalThis.NowWikiQuery='),file+' must bundle and expose compiled Query');
  assert.ok(source.includes('globalThis.NowWikiEvidence='),file+' must include the evidence module');
  assert.ok(source.includes('globalThis.NowWikiGraph='),file+' must include the approved graph module');
}
console.log('Web/Desktop pinned evidence runtime wiring PASS');
