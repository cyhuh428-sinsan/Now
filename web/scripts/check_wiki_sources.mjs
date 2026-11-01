import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa});
for(const name of ['note-protection-protocol','note-protection-state','note-protection-client','note-history-state','wiki-state','wiki-ingest','wiki-sources']){
  try{vm.runInContext(await fs.readFile(new URL('../vendor/'+name+'.js',import.meta.url),'utf8'),box);}
  catch(e){if(e.code==='ENOENT'&&name==='wiki-sources')continue;throw e;}
}
assert.equal(typeof box.NowNoteWikiSources?.create,'function','account Note-journal source adapter required');
let ctx={url:'https://sources.invalid',owner:'alice',device:'one',auth:'synthetic',enabled:true,online:false},saved=null,writes=0,requests=0,failWrite=false;
const copy=structuredClone;
const makeHistory=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,
  request:async()=>{requests++;throw Error('unexpected network');},write:async value=>{writes++;if(failWrite)throw Error('quota');saved=copy(value);}});
let h=makeHistory();
const api={context:()=>ctx,contextKey:()=>JSON.stringify(ctx),history:()=>h};
let sources=box.NowNoteWikiSources.create(api);
const content='한글 원본\r\n<script>globalThis.WIKI_SOURCE_EXECUTED=true</script>\nhttps://never-execute.invalid/';
const file=(name='source.md',text=content)=>({name,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
const first=await sources.captureFiles([file(),file('other.txt','Other exact source.')]);
assert.equal(first.created,2);assert.equal(writes,1,'one durable CAS for the entire selection');assert.equal(requests,0);
const before=JSON.stringify(saved),rows=await sources.list();assert.equal(rows.length,2);
assert.equal(rows[0].content,content);assert.equal(rows[0].extraction.file_hash,await box.NowNoteProtectionProtocol.sha256(new TextEncoder().encode(content)));
const item=h.view(rows[0].manifest.note_ref.local_id);assert.equal(item.localOnly,true);assert.equal(item.revisions.length,1);
assert.equal(item.draft.content,content);assert.equal(item.revisions[0].snapshot.note.content,content);
assert.equal(JSON.stringify(item.wiki_source_snapshot).includes(content),false,'snapshot body belongs to Note history, not metadata');
assert.equal((await sources.captureFiles([file()])).created,0);assert.equal(JSON.stringify(saved),before,'unchanged capture adds no revision or writes');
h=makeHistory();sources=box.NowNoteWikiSources.create(api);assert.equal((await sources.list())[0].content,content,'cold hydrate keeps exact text');
ctx={...ctx,owner:'bob'};assert.equal((await sources.list()).length,0);ctx={...ctx,owner:'alice'};
failWrite=true;await assert.rejects(()=>sources.captureFiles([file('failure.txt','must-not-store')]),/quota/);
assert.equal(JSON.stringify(saved),before);assert.equal(h.entries()[rows[0].manifest.note_ref.local_id].draft.content,content);failWrite=false;
for(const broken of [file('unsupported.pdf'),file('partial.md'),{name:'broken.md',arrayBuffer:async()=>new Uint8Array([255]).buffer}]){
  if(broken.name==='partial.md')broken.arrayBuffer=async()=>{throw Error('file read failed');};
  await assert.rejects(()=>sources.captureFiles([file('good.txt','keep atomic'),broken]));assert.equal(JSON.stringify(saved),before);
}
const deferred=file('late.txt');deferred.arrayBuffer=async()=>{ctx={...ctx,owner:'bob'};return new TextEncoder().encode('not-for-bob').buffer;};
await assert.rejects(()=>sources.captureFiles([deferred]),/계정|서버/);assert.equal(JSON.stringify(saved),before);ctx={...ctx,owner:'alice'};
const damaged=copy(saved);damaged.contexts[box.NowNoteHistory.key(ctx)].notes[rows[0].manifest.note_ref.local_id].wiki_source_snapshot.extraction.text_hash='0'.repeat(64);
await assert.rejects(()=>box.NowNoteWikiSources.inspect(damaged.contexts[box.NowNoteHistory.key(ctx)].notes[rows[0].manifest.note_ref.local_id],ctx),/wiki_snapshot_hash/);
await h.sync();assert.equal(requests,0,'local source snapshots must never automatically upload');
const protectedScope={url:ctx.url,owner:ctx.owner,device:ctx.device,local_id:item.raw.local_id,instance:webcrypto.randomUUID()};
const protector=box.NowNoteProtectionClient.create({context:()=>protectedScope,stores:()=>[]});
const sealed=await protector.sealJournal(protectedScope,item,'synthetic-file-key',webcrypto.randomUUID());
assert.equal(JSON.stringify(sealed).includes(content),false);
const reopened=await protector.openArchive(protectedScope,sealed,'synthetic-file-key');
assert.equal(reopened.draft.content,content);assert.deepEqual(reopened.wiki_source_snapshot,item.wiki_source_snapshot);
assert.equal(box.WIKI_SOURCE_EXECUTED,undefined);
console.log('Wiki sources: actual Note journal single-CAS, UTF8 snapshot/cold, duplicate no-op, quota/read/unsupported/late-owner atomic refusal, owner B0, upload0 PASS');
