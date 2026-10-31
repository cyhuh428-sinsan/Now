import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const box={crypto:webcrypto,structuredClone,TextEncoder,TextDecoder,Uint8Array,atob,btoa};
for(const name of ['note-protection-protocol.js','note-protection-state.js','note-history-state.js','wiki-state.js'])
  vm.runInNewContext(await fs.readFile(new URL('../vendor/'+name,import.meta.url),'utf8'),box);
const copy=structuredClone,P=box.NowNoteProtectionState;
const local='wiki:'+webcrypto.randomUUID(),scope={url:'https://synthetic.invalid',owner:'alice',device:'one',instance:webcrypto.randomUUID(),local_id:local};
let ctx={...scope,enabled:true,online:false,auth:'synthetic'},saved=null,failStore=true,network=0;
const password='synthetic-wiki-only',text='WIKI-PRIVATE-CRLF\r\n',key=box.NowNoteHistory.key(scope);
const H=()=>box.NowNoteHistory.create({initial:saved,context:()=>ctx,write:async value=>{saved=copy(value);},request:async()=>{network++;throw Error('no network');}});
let journal=H();
const note={owner_id:scope.owner,local_id:local,device_id:scope.device,source:'wiki-artifact',title:'AI Wiki',content:text};
await journal.track(note,null,{localOnly:true});await journal.seal(local,'wiki_edit');
let data=journal.export();data.contexts[key].notes[local].protectionScope=copy(scope);
await journal.replaceProtectionStore(journal.export(),data);
let duplicate=copy(data),other={content:'preserve-other'};
const stores=()=>[
  {name:'history',kind:'history',read:async()=>journal.export(),cas:(before,after,guard)=>journal.replaceProtectionStore(before,after,guard)},
  {name:'fallback',kind:'history',read:async()=>copy(duplicate),cas:async(before,after)=>{if(failStore)throw Error('synthetic CAS');assert.deepEqual(before,duplicate);duplicate=copy(after);}},
  {name:'unrelated',kind:'data',read:async()=>copy(other),cas:async()=>{throw Error('unrelated write');}},
];
const create=()=>P.create({context:()=>ctx,journal,stores,remote:new Proxy({},{get(){return ()=>{network++;throw Error('local protection must not call server');};}}),preflight:async()=>{}});
let controller=create();
assert.equal(typeof controller.startLocalWiki,'function','Local-only wiki protection must reuse durable per-store settlement without server requests');
const id=await controller.startLocalWiki(scope,password);
assert.equal(controller.status(id).phase,'applying');
assert.equal(controller.pending(),1);assert.equal(controller.blocked(local),true);
assert.ok(!JSON.stringify(journal.protectionOperations()).includes('WIKI-PRIVATE'));
assert.ok(!JSON.stringify(journal.protectionOperations()).includes(password));
await assert.rejects(()=>controller.resume(id,password),/synthetic CAS/);
assert.ok(!JSON.stringify(journal.export()).includes('WIKI-PRIVATE'));
assert.ok(JSON.stringify(duplicate).includes('WIKI-PRIVATE'),'Incomplete second store is preserved, not declared protected');
assert.equal(controller.status(id).phase,'applying');
journal=H();controller=create();
await assert.rejects(()=>controller.resume(id,'wrong'));
ctx={...ctx,owner:'bob',auth:'other'};
await assert.rejects(()=>controller.resume(id,password),/scope/);
ctx={...scope,enabled:true,online:false,auth:'restored'};failStore=false;
const receipt=await controller.resume(id,password);
assert.equal(receipt.purpose,'local_wiki_protection');
assert.equal(controller.status(id).phase,'complete');assert.equal(controller.pending(),0);
assert.equal(journal.blocked(local),true);
for(const store of [journal.export(),duplicate])assert.ok(!JSON.stringify(store).includes('WIKI-PRIVATE'));
const record=journal.export().contexts[key].notes[local].protection_record;
const archive=JSON.parse(await box.NowNoteProtectionProtocol.decryptContent(record.ciphertext,password));
assert.equal(archive.value.draft.content,text);assert.equal(archive.value.revisions.length,1);
assert.deepEqual(other,{content:'preserve-other'});assert.equal(network,0);
await controller.resume(id,password);assert.equal(network,0);
const W=box.NowNoteWiki;
assert.equal(typeof W.sourceProtectionDependencies,'function','Original protection must inspect all local wiki draft/history dependencies before freezing sources');
const wikiDoc={schema_version:1,wiki_id:local.slice(5),scope:{url:scope.url,owner:scope.owner},
  drafts:[{source_manifest:[{note_ref:{owner_id:scope.owner,local_id:'original'}}]},
    {source_manifest:[{note_ref:{owner_id:scope.owner,local_id:'other-original'}}]}]};
const plain={...note,content:JSON.stringify(wikiDoc)},archiveRoot={schema_version:1,contexts:{[key]:{notes:{[local]:{raw:plain,draft:plain}}}}};
const dependencies=roots=>Array.from(W.sourceProtectionDependencies(roots,scope,'original'));
assert.deepEqual(dependencies([archiveRoot]),[local],'An old draft remains a dependency even after later regeneration selects other sources');
assert.deepEqual(dependencies([{recovery_archives:[copy(archiveRoot)]}]),[local],'Recovery copies must also be protected');
assert.deepEqual(dependencies([journal.export(),duplicate]),[],'Cipher-only archives have no remaining plaintext dependency');
assert.deepEqual(dependencies([{contexts:{[JSON.stringify([scope.url,'bob'])]:archiveRoot.contexts[key]}}]),[],'Other account stores are preserved');
const malformed=copy(archiveRoot);malformed.contexts[key].notes[local].raw.content='{bad';
assert.throws(()=>dependencies([malformed]),/wiki.*scope|wiki.*format|wiki.*protection/,'Malformed owned wiki copies cannot silently permit original protection');
// A server-backed note must never be silently downgraded to local protection.
const second='wiki:'+webcrypto.randomUUID(),serverScope={...scope,local_id:second};
await journal.track({...note,local_id:second},null,{localOnly:false});
await assert.rejects(()=>controller.startLocalWiki(serverScope,password),/local_wiki/);
assert.equal(network,0);
console.log('Local wiki protection: zero network, cipher journal, interrupted per-store CAS, wrong key/owner, cold resume, exact history, source dependency union and server-note refusal PASS');
