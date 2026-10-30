import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,Uint8Array,atob,btoa});
for(const name of ['protocol','state','client'])vm.runInContext(await fs.readFile(new URL('../vendor/note-protection-'+name+'.js',import.meta.url),'utf8'),box);
const C=box.NowNoteProtectionClient,Q=box.NowNoteProtectionProtocol,uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
assert.equal(typeof C.planImport,'function','MI UI requires a metadata-only plan built from original local revisions');
assert.equal(typeof C.settleImportJournal,'function','history import must not acknowledge current writes or discard local drafts');
const scope={url:'https://synthetic.invalid',owner:'alice',local_id:'memo',instance:uid(1),device:'current-device'};
const base={base:{head_version:2,head_revision_id:null,crypto_epoch:2,history_generation:3,protection_state:'protected',inventory_revision_ids:[],identity_state:'branch_only',current_exists:false},current_mode:'absent',selected_physical_note_id:null,mixed_metadata_version:1};
const catalog={context:base,catalog_digest:'a'.repeat(64),entries:[]};
const note={id:99,owner_id:'alice',local_id:'memo',device_id:'physical-original',note_type:'tree',title:'Original',content:'PRIVATE\r\n',
  parent_local_id:null,level:1,tags:null,source:null,deleted_at:null,client_updated_at:null,created_at:'2026-10-30T00:00:00.000001Z',updated_at:'2026-10-30T00:00:00.000002Z'};
const first={revision_id:uid(10),parent_ref:null,origin_device_id:'capture-original',snapshot:{schema_version:1,note},representation:null};
const second={...first,revision_id:uid(11),parent_ref:{kind:'offline_branch',id:uid(10)},snapshot:{schema_version:1,note:{...note,content:'Child'}}};
const plan=C.planImport(scope,catalog,[second,first],[]);
assert.equal(plan.prepare.entries[0].revision_id,first.revision_id);assert.equal(plan.local_branches[0].snapshot.note.id,99);
assert.equal(plan.prepare.entries[0].origin_device_id,'capture-original');assert.equal(plan.prepare.entries[1].parent_ref.id,uid(10));
assert.equal(plan.prepare.entries[0].source_kind,'snapshot_v1');assert.equal(plan.prepare.entries[0].target_epoch,2);
assert.equal(JSON.stringify(plan.prepare).includes('PRIVATE'),false);assert.equal(plan.prepare.entries.some(e=>Object.hasOwn(e,'snapshot')),false);
assert.equal(plan.prepare.entries[0].provenance.origin_revision_ref,null);
const foreign=structuredClone(first);foreign.snapshot.note.owner_id='bob';
assert.throws(()=>C.planImport(scope,catalog,[foreign],[]),/scope/);
assert.throws(()=>C.planImport(scope,catalog,[first,first],[]),/duplicate/);
assert.throws(()=>C.planImport(scope,catalog,[{...first,origin_device_id:''}],[]),/branch/);
const journal={raw:structuredClone(note),draft:{...note,content:'still unsent'},base:{...base.base,snapshot:{schema_version:1,note}},
  revisions:[{revision_id:uid(10),parent_ref:null,snapshot:{schema_version:1,note},imported:false},{revision_id:uid(11),parent_ref:second.parent_ref,snapshot:second.snapshot,imported:false}],
  outbox:[{id:uid(20),revision_id:uid(10),sent:false,body:{owner_id:'alice',local_id:'memo',device_id:'capture-original'}}],
  receipts:[],dirty:true,conflict:{code:'keep-original'},localOnly:false};
const receipt={schema_version:3,purpose:'mixed_offline_import',operation_id:uid(30),mutation_id:plan.prepare.mutation_id,owner_id:'alice',local_id:'memo',server_instance_id:scope.instance,result:{...base,base:{...base.base,head_version:3,history_generation:4}}};
const work={branches:plan.local_branches,new_branch_ids:[uid(10),uid(11)],commit:{base,operation_id:uid(30),mutation_id:plan.prepare.mutation_id}};
const settled=C.settleImportJournal(scope,journal,work,receipt);
assert.equal(Q.canonicalJson(settled.outbox),Q.canonicalJson(journal.outbox));assert.equal(Q.canonicalJson(settled.conflict),Q.canonicalJson(journal.conflict));
assert.equal(Q.canonicalJson(settled.draft),Q.canonicalJson(journal.draft));assert.equal(settled.dirty,true);
assert.equal(settled.revisions[0].imported,true);assert.equal(settled.revisions[0].server_ref.kind,'offline_branch');
assert.equal(settled.revisions[1].snapshot.note.content,'Child');assert.equal(settled.base.head_version,3);
assert.equal(journal.revisions[0].imported,false,'source journal must remain unchanged until receipt-bound cipher CAS');
const changed=structuredClone(journal);changed.revisions[0].snapshot.note.content='changed after capture';
assert.throws(()=>C.settleImportJournal(scope,changed,work,receipt),/import_branch/);
assert.throws(()=>C.settleImportJournal(scope,journal,work,{...receipt,operation_id:uid(99)}),/receipt/);
console.log('MI plan/settle: 8 PASS (original metadata and FULL15, no current-write acknowledgement; pure synthetic journal)');
