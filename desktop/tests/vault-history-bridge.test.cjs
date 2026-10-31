const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const {createVaultService}=require("../vault-service.cjs");
const {renderManagedMarkdown}=require("../vault-markdown.cjs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");

async function fixture(t,{dirty=false,protectedEpoch=false,beforeStoreCommit,afterStoreCommit}={}){
  const qa=path.resolve("D:/tmp/nownote-239-vault-qa");
  await fs.mkdir(qa,{recursive:true});
  const dir=await fs.mkdtemp(path.join(qa,"vault-history-"));
  t.after(async()=>{const absolute=path.resolve(dir);if(!absolute.startsWith(qa+path.sep))throw Error("qa_boundary");await fs.rm(absolute,{recursive:true,force:true});});
  const root=path.join(dir,"vault"),storePath=path.join(dir,"userData","nownote-desktop-store.json"),backupDir=path.join(dir,"backups");
  await fs.mkdir(path.join(root,"Topic"),{recursive:true});await fs.mkdir(path.dirname(storePath));
  const note={owner_id:"vault-fixture",local_id:"t",note_type:"tree",title:"Topic",content:"before",parent_local_id:null,level:1,tags:"[]",source:"web-tree",deleted_at:null};
  const base={head_version:1,head_revision_id:"fixture-revision",inventory_revision_ids:["fixture-revision"],crypto_epoch:0,replica_count:1};
  const scope=JSON.stringify(["https://example.invalid","vault-fixture"]);
  await fs.writeFile(storePath,JSON.stringify({version:1,updatedAt:null,values:{
    "nownote.web.v1":{tree:[{id:"t",title:"Topic",content:"before",level:1,children:[],status:"active",tags:[]}]},
    "nownote.web.settings.v1":{server:{mode:"server",url:"https://example.invalid",ownerId:"vault-fixture",deviceId:"fixture"}},
    "nownote.vault.v1":{path:root,baselines:{}},
    "nownote.history.v1":{schema_version:1,contexts:{[scope]:{notes:{t:{raw:note,draft:note,base,revisions:[],outbox:[],receipts:[],dirty:false}}}}}
  }}));
  await fs.writeFile(path.join(root,"Topic","_index.md"),renderManagedMarkdown({id:"t",kind:"topic",title:"Topic",body:"from Obsidian",tags:[]}));
  if (dirty||protectedEpoch){
    const store=JSON.parse(await fs.readFile(storePath,"utf8"));
    const record=store.values["nownote.history.v1"].contexts[scope].notes.t;
    if (dirty){record.draft={...record.draft,content:"unsent before import"};record.dirty=true;store.values["nownote.web.v1"].tree[0].content=record.draft.content;}
    if (protectedEpoch)record.base.crypto_epoch=1;
    await fs.writeFile(storePath,JSON.stringify(store));
  }
  const service=createVaultService({storePath,backupDir,beforeStoreCommit,afterStoreCommit}),plan=await service.previewVault({direction:"both"});
  const box={crypto:webcrypto,structuredClone};
  vm.runInNewContext(await fs.readFile(path.resolve(__dirname,"../../web/vendor/note-history-state.js"),"utf8"),box);
  const initial=JSON.parse(await fs.readFile(storePath,"utf8")).values["nownote.history.v1"];
  const historyPatch=protectedEpoch?null:await box.NowNoteHistory.prepareExternalEdit(initial,{url:"https://example.invalid",owner:"vault-fixture",device:"fixture",enabled:true},
    {...note,content:"from Obsidian",tags:""});
  return {root,storePath,scope,base,service,plan,historyPatch,initial,box};
}

test("managed Vault import must preserve the edit in the canonical note journal",async t=>{
  const {storePath,scope,base,service,plan,historyPatch}=await fixture(t);
  const result=await service.applyVault({planId:plan.planId,selections:[{itemId:"t",action:"toNowNote",historyPatch}]});
  assert.equal(result.failed.length,0);
  const saved=JSON.parse(await fs.readFile(storePath,"utf8")).values;
  assert.equal(saved["nownote.web.v1"].tree[0].content,"from Obsidian");
  const journal=saved["nownote.history.v1"].contexts[scope].notes.t;
  assert.equal(journal.draft.content,"from Obsidian","Vault success must not leave the canonical draft at the old body");
  assert.equal(journal.raw.content,"before");
  assert.deepEqual(journal.base,base);
  assert.equal(journal.dirty,true);
  assert.equal(journal.revisions.at(-1).reason,"external_import");
  assert.equal(journal.outbox.at(-1).body.note.content,"from Obsidian");
});

test("a new Vault category preserves its identity and canonical queue beside an existing import",async t=>{
  const f=await fixture(t);
  await fs.mkdir(path.join(f.root,"Topic","Category"));
  const file=path.join(f.root,"Topic","Category","_index.md");
  await fs.writeFile(file,"New category body");
  const plan=await f.service.previewVault({direction:"both"});
  const item=plan.items.find(row=>row.paths.vault==="Topic/Category/_index.md");
  assert.ok(item);
  const id=webcrypto.randomUUID();
  const note={owner_id:"vault-fixture",local_id:id,note_type:"tree",title:item.vault.title||"Category",
    content:item.vault.body,parent_local_id:"t",level:2,tags:(item.vault.tags||[]).join(","),source:"web-tree",deleted_at:null};
  const historyPatch=await f.box.NowNoteHistory.prepareExternalEdit(f.initial,
    {url:"https://example.invalid",owner:"vault-fixture",device:"fixture",enabled:true},note,{newNote:true,needsBaseline:true});
  const result=await f.service.applyVault({planId:plan.planId,selections:[
    {itemId:"t",action:"toNowNote",historyPatch:f.historyPatch},
    {itemId:item.itemId,action:"toNowNote",targetParentId:"t",importId:id,historyPatch}
  ]});
  assert.equal(result.failed.length,0);
  assert.equal(result.applied.length,2);
  const saved=JSON.parse(await fs.readFile(f.storePath,"utf8")).values;
  const node=saved["nownote.web.v1"].tree[0].children[0],record=saved["nownote.history.v1"].contexts[f.scope].notes[id];
  assert.equal(node.id,id);assert.equal(record.draft.local_id,id);
  assert.equal(node.content,note.content);assert.equal(record.draft.content,note.content);
  assert.equal(record.outbox.length,1);assert.equal(record.needsBaseline,true);
  assert.equal(saved["nownote.history.v1"].contexts[f.scope].notes.t.draft.content,"from Obsidian");
  assert.match(await fs.readFile(file,"utf8"),new RegExp(id));
});

test("Vault import preserves the prior unsent draft and another account",async t=>{
  const f=await fixture(t,{dirty:true});
  const original=JSON.parse(await fs.readFile(f.storePath,"utf8"));
  const foreign=JSON.stringify(["https://example.invalid","other"]);
  const foreignRecord=structuredClone(original.values["nownote.history.v1"].contexts[f.scope].notes.t);
  foreignRecord.raw.owner_id="other";foreignRecord.draft.owner_id="other";
  foreignRecord.raw.content="other account";foreignRecord.draft.content="other account";
  original.values["nownote.history.v1"].contexts[foreign]={notes:{t:foreignRecord}};
  await fs.writeFile(f.storePath,JSON.stringify(original));
  const plan=await f.service.previewVault({direction:"both"});
  const result=await f.service.applyVault({planId:plan.planId,selections:[{itemId:"t",action:"toNowNote",historyPatch:f.historyPatch}]});
  assert.equal(result.failed.length,0);
  const history=JSON.parse(await fs.readFile(f.storePath,"utf8")).values["nownote.history.v1"];
  assert.deepEqual(history.contexts[foreign],original.values["nownote.history.v1"].contexts[foreign]);
  const note=history.contexts[f.scope].notes.t;
  assert.equal(note.revisions[0].snapshot.note.content,"unsent before import");
  assert.equal(note.revisions[1].snapshot.note.content,"from Obsidian");
  assert.equal(note.raw.content,"before");
  assert.equal(note.outbox.length,2);
});

for(const scenario of ["missing","foreign","stale","store-failure","protected"]){
  test("Vault history rejects "+scenario+" without replacing either original",async t=>{
    const f=await fixture(t,{protectedEpoch:scenario==="protected",...(scenario==="store-failure"?{beforeStoreCommit:()=>{throw Error("synthetic write failure");}}:{})});
    if(scenario==="stale"){
      const store=JSON.parse(await fs.readFile(f.storePath,"utf8"));store.values["nownote.history.v1"].contexts[f.scope].notes.t.draft.content="later";
      await fs.writeFile(f.storePath,JSON.stringify(store));
    }
    if(scenario==="foreign")f.historyPatch.scope.owner="other";
    const before=JSON.parse(await fs.readFile(f.storePath,"utf8")).values;
    const file=path.join(f.root,"Topic","_index.md"),bytes=await fs.readFile(file);
    const result=await f.service.applyVault({planId:f.plan.planId,selections:[{itemId:"t",action:"toNowNote",...(scenario==="missing"||scenario==="protected"?{}:{historyPatch:f.historyPatch})}]});
    assert.equal(result.applied.length,0);assert.equal(result.failed.length,1);
    const after=JSON.parse(await fs.readFile(f.storePath,"utf8")).values;
    assert.deepEqual(after["nownote.history.v1"],before["nownote.history.v1"]);
    assert.deepEqual(after["nownote.web.v1"],before["nownote.web.v1"]);
    assert.deepEqual(after["nownote.vault.v1"].baselines,before["nownote.vault.v1"].baselines);
    assert.deepEqual(await fs.readFile(file),bytes);
  });
}

test("committed Vault import with lost acknowledgement requires verified recovery, not replay",async t=>{
  const f=await fixture(t,{afterStoreCommit:()=>{throw Error("synthetic acknowledgement lost");}});
  const result=await f.service.applyVault({planId:f.plan.planId,selections:[{itemId:"t",action:"toNowNote",historyPatch:f.historyPatch}]});
  assert.equal(result.applied.length,0);assert.equal(result.recoveryRequired,true);
  const status=await createVaultService({storePath:f.storePath,backupDir:path.join(path.dirname(f.root),"backups")}).recoveryStatus();
  assert.equal(status.afterMatches,true);assert.equal(status.beforeMatches,false);
  const saved=JSON.parse(await fs.readFile(f.storePath,"utf8")).values;
  assert.equal(saved["nownote.web.v1"].tree[0].content,"from Obsidian");
  assert.equal(saved["nownote.history.v1"].contexts[f.scope].notes.t.revisions.length,1);
  await assert.rejects(f.service.previewVault({direction:"both"}),/journal|recovery/i);
  await f.service.confirmRecovery({operationId:status.record.operationId});
  assert.equal(f.service.vaultStatus().recoveryRequired,false);
});
