/* Protected-note inspection, attribution and semantic work; plaintext stays in memory. */
(() => {
  'use strict';
  const clone = v => structuredClone(v);
  const P = () => globalThis.NowNoteProtectionState;
  const Q = () => globalThis.NowNoteProtectionProtocol;
  const fail = code => { throw new Error('note_protection_client:' + code); };
  const eq = (a,b) => Q().canonicalJson(a) === Q().canonicalJson(b);
  const at = (root,path) => path.reduce((v,k)=>v?.[k],root);
  const same = (a,b) => P().scopeKey(a) === P().scopeKey(b);
  function create({context,stores}) {
    let confirmation = null;
    function active(ctx,scope) {
      const now = context();
      if (!eq(ctx,now) || !same(now,scope)) fail('confirmation_changed');
      return true;
    }
    async function sealJournal(scope,value,password,operationId) {
      scope=clone(scope);value=clone(value);const ctx=clone(context());active(ctx,scope);
      if(!password || typeof operationId!=='string' || !operationId) fail('journal_key');
      const allowed=['raw','draft','base','revisions','outbox','receipts','conflict','dirty','localOnly','needsBaseline','replicaSelected','edit_generation','error','completed_outbox','archived_outbox','comparison','protectionScope'];
      if(!value || Object.keys(value).some(k=>!allowed.includes(k)) || !Array.isArray(value.base?.inventory_revision_ids)
        || !['revisions','outbox','receipts'].every(k=>Array.isArray(value[k]))) fail('journal_shape');
      if(value.protectionScope){P().validateScope(value.protectionScope);if(!same(value.protectionScope,scope))fail('journal_scope');}
      const check=note=>{
        Q().validateSnapshot({schema_version:1,note});
        if(note.owner_id!==scope.owner || note.local_id!==scope.local_id) fail('journal_scope');
      };
      check(value.raw);check(value.draft);
      for(const revision of value.revisions)check(revision.snapshot?.note);
      for(const op of [...value.outbox,...(value.completed_outbox||[]),...(value.archived_outbox||[])]) {
        if(op.body && (op.body.owner_id!==scope.owner || op.body.local_id!==scope.local_id)) fail('journal_scope');
        if(op.restored_snapshot)check(op.restored_snapshot.note);
      }
      const archive={schema_version:1,scope,operation_id:operationId,value};
      const ciphertext=await Q().encryptContent(JSON.stringify(archive),password);active(ctx,scope);
      const record={protection_record:{schema_version:1,scope,operation_id:operationId,ciphertext}};
      P().protectedRecord(record);return record;
    }
    async function replaceJournal(scope,expected,record,journal) {
      scope=clone(scope);expected=clone(expected);record=clone(record);
      const ctx=clone(context());active(ctx,scope);
      if(!P().protectedRecord(expected) || !same(expected.protection_record.scope,scope)
        || !P().protectedRecord(record) || !same(record.protection_record.scope,scope)) fail('journal_scope');
      const data=journal.export(),key=globalThis.NowNoteHistory.key(scope),current=data.contexts?.[key]?.notes?.[scope.local_id];
      if(current===undefined)fail('copy_changed');
      if(eq(current,record))return clone(record);
      if(!eq(current,expected))fail('copy_changed');
      const next=clone(data);next.contexts[key].notes[scope.local_id]=record;
      active(ctx,scope);await journal.replaceProtectionStore(data,next,{active:()=>active(ctx,scope)});active(ctx,scope);
      if(!eq(journal.export().contexts?.[key]?.notes?.[scope.local_id],record))fail('journal_readback');
      return clone(record);
    }
    return {sealJournal,replaceJournal,
      async initializeJournal(scope,value,password,operationId,journal) {
        scope=clone(scope);const ctx=clone(context());active(ctx,scope);
        const data=journal.export(),key=globalThis.NowNoteHistory.key(scope);
        if(data?.schema_version!==1 || !data.contexts)fail('journal_shape');
        if(data.contexts[key]?.notes?.[scope.local_id]!==undefined)fail('copy_changed');
        const record=await sealJournal(scope,value,password,operationId);active(ctx,scope);
        const next=clone(data);next.contexts[key] ||= {notes:{}};
        next.contexts[key].notes[scope.local_id]=record;
        await journal.replaceProtectionStore(data,next,{active:()=>active(ctx,scope)});active(ctx,scope);
        if(!eq(journal.export().contexts?.[key]?.notes?.[scope.local_id],record))fail('journal_readback');
        return clone(record);
      },
      async copies(scope) {
        confirmation = null;
        const ctx = clone(context()), records = [], snapshots = [];
        active(ctx,scope);
        for (const store of stores()) {
          const raw = await store.read(); active(ctx,scope);
          const unknown = [];
          P().inventory(raw,store.kind,scope,{unverified:unknown});
          snapshots.push({store,raw,unknown});
          for (const p of unknown) records.push({id:crypto.randomUUID(),store:store.name,path:clone(p.path),type:p.type,
            title:String(p.before.title || p.before.raw?.title || ''),updated_at:p.before.updatedAt || p.before.updated_at || p.before.raw?.updated_at || null});
        }
        confirmation = {ctx,scope:clone(scope),snapshots,records:clone(records)};
        return records;
      },
      async confirm(scope,list,selected) {
        const c = confirmation;
        if (!c || !same(c.scope,scope) || !eq(c.records,list)) fail('confirmation_changed');
        active(c.ctx,scope);
        if (!Array.isArray(selected) || new Set(selected).size !== list.length || list.some(r=>!selected.includes(r.id))) fail('confirmation_incomplete');
        // Check every exact copy before the first attribution write.
        for (const s of c.snapshots) {
          if (!eq(await s.store.read(),s.raw)) fail('copy_changed');
          active(c.ctx,scope);
        }
        for (const s of c.snapshots) {
          if (!s.unknown.length) continue;
          const next = clone(s.raw);
          for (const p of s.unknown) at(next,p.path).protectionScope = clone(scope);
          active(c.ctx,scope);
          await s.store.cas(s.raw,next,{active:()=>active(c.ctx,scope)}); active(c.ctx,scope);
          if (!eq(await s.store.read(),next)) fail('attribution_readback');
          active(c.ctx,scope);
        }
        confirmation = null;
      },
      async saveJournal(scope,expected,value,password,operationId,journal) {
        scope=clone(scope);expected=clone(expected);
        const ctx=clone(context());active(ctx,scope);
        if(!P().protectedRecord(expected) || !same(expected.protection_record.scope,scope)) fail('journal_scope');
        const record=await sealJournal(scope,value,password,operationId);active(ctx,scope);
        return replaceJournal(scope,expected,record,journal);
      },
      async openArchive(scope,record,password) {
        const ctx = clone(context());
        const saved = clone(record.protection_record);
        if (!P().protectedRecord(record) || !same(saved.scope,scope)) fail('archive_scope');
        active(ctx,scope);
        const archive = Q().parseJson(await Q().decryptContent(saved.ciphertext,password));
        active(ctx,scope);
        if (archive.schema_version !== 1 || !eq(archive.scope,saved.scope) || archive.operation_id !== saved.operation_id
          || !archive.value || !eq(record.protection_record,saved)) fail('archive_binding');
        if(archive.value.protectionScope){P().validateScope(archive.value.protectionScope);if(!same(archive.value.protectionScope,scope))fail('archive_scope');}
        return clone(archive.value);
      },
      async archives(scope) {
        const ctx=clone(context()), rows=[]; active(ctx,scope);
        function walk(v,path,store) {
          if (!v || typeof v !== 'object') return;
          if (v.protection_record && P().protectedRecord(v) && same(v.protection_record.scope,scope)) rows.push({store,path:clone(path),record:clone(v)});
          for (const [k,child] of Object.entries(v)) if (!['protection_record','protection_operations'].includes(k)) walk(child,[...path,k],store);
        }
        for (const store of stores()) {walk(await store.read(),[],store.name);active(ctx,scope);}
        return rows;
      },
      invalidate() { confirmation = null; },
    };
  }
  async function buildWork(scope,prepared,intent,password,remote,localStores = [],resolveKey) {
    const p = clone(prepared), i = clone(intent), m = p.manifest;
    if (![2,3].includes(p.version) || i.schema_version !== p.version
      || !['conversion','current_plain_transition','mixed_conversion'].includes(i.purpose)) fail('work_purpose');
    const origins = clone(i.source_origins || []);
    const sources = await remote.readSources(scope,p,password,localStores,resolveKey,origins);
    const source = key => {
      const row = sources.find(v=>eq(v.key,key));
      if (!row) fail('source_missing');
      return clone(row.value);
    };
    let destinations = p.version === 2 ? m.entries.map(e=>({destination_key:e.destination_key,source_keys:[e.key],source_etag:e.source_etag,
      output_kind:e.output_kind,output_epoch:p.response.target_epoch,is_null:false,expected_binding:e.expected_binding})) : m.DSET;
    const keys = Q().keyOrder(destinations.map(d=>d.destination_key));
    if (p.version === 2) destinations = keys.map(k=>destinations.find(d=>eq(d.destination_key,k)));
    if (!eq(keys,destinations.map(d=>d.destination_key))) fail('destination_order');
    const transfers = [], records = [];
    for (const d of destinations) {
      if (d.is_null || d.output_epoch === 0) continue;
      if (d.source_keys.length !== 1) fail('source_arity');
      const semantic = source(d.source_keys[0]), key = d.destination_key;
      const original = p.version === 2 ? m.entries.find(e=>eq(e.destination_key,key)) : null;
      const sourceDescriptor = p.version === 3 ? m.S.find(e=>eq(e.descriptor.key,d.source_keys[0]))?.descriptor : null;
      const expected = origins.find(v=>eq(v.key,d.source_keys[0]))?.origin;
      const origin = original ? {value:original.operation_origin,legacy:null} : expected || {value:null,legacy:null};
      const output = {key,output_kind:d.output_kind,output_epoch:d.output_epoch,is_null:false,expected_binding:d.expected_binding,operation_origin:origin.value};
      const outputKey = () => (resolveKey || (async()=>password))({key,representation_epoch:d.output_epoch,output:i.purpose!=='current_plain_transition'});
      const raw = await Q().encryptRepresentation(semantic,output,await outputKey());
      const hash = await Q().sha256(raw), linked = d.output_kind === 'linked_text_envelope_v1', body = key.kind === 'note_body';
      const o = p.version === 3 ? m.O.find(o=>eq(o.destination_key,key)) : null;
      const descriptor = {key,representation_kind:d.output_kind,representation_epoch:d.output_epoch,is_null:false,
        representation_version:1,representation_etag:d.source_etag,storage_operation_id:p.id,
        semantic_origin_id:o?.semantic_origin_id ?? (origin.value?.operation_id || origin.value?.quote_id || origin.value?.import_id || null),
        origin_validator:o?.origin_validator || (body ? 'body_v1' : linked ? 'linked_v1' : 'native_v1'),
        origin_row_required:o?.origin_row_required ?? (!body && !linked),expected_binding:d.expected_binding,
        revision_ref:d.expected_binding?.revision_ref || null,parent_ref:d.expected_binding?.parent_ref || null,
        physical_note_id:['note_body','inventory_snapshot'].includes(key.kind) ? Number(key.id) : null,
        inventory_revision_id:key.kind === 'inventory_snapshot' ? d.expected_binding?.revision_ref?.id || null : null,
        linked_slot_version:linked ? (sourceDescriptor?.linked_slot_version || original?.slot_version || 0) + 1 : null,ciphertext_sha256:hash};
      // These descriptors verify local output bytes, not a claimed future server etag/version.
      Q().validateDescriptor(descriptor,3);
      const verifiedOrigin = {value:origin.value,legacy:null};
      if (!eq(await Q().decryptRepresentation(raw,descriptor,verifiedOrigin,outputKey,3),semantic)) fail('output_verification');
      transfers.push({key,raw,descriptor,origin:verifiedOrigin,semantic});
      records.push({entry_key:p.version === 2 ? original.key : key,destination_key:key,source_etag:d.source_etag,
        output_kind:d.output_kind,target_epoch:d.output_epoch,total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:hash});
    }
    if (p.version === 2) {
      const ordered = Q().keyOrder(records.map(r=>r.entry_key)).map(k=>records.find(r=>eq(r.entry_key,k)));
      records.splice(0,records.length,...ordered);
    }
    const a = i.prepare;
    const commit = {schema_version:p.version,owner_id:scope.owner,local_id:scope.local_id,device_id:scope.device,server_instance_id:scope.instance,
      mutation_id:a.mutation_id,metadata_manifest_digest:p.digest,client_verified_ciphertext_manifest_digest:await Q().hashJson(records)};
    if (p.version === 2) Object.assign(commit,{transition_id:p.id,base_head_version:a.base_head_version,base_revision_id:a.base_revision_id,
      expected_inventory_revision_ids:a.expected_inventory_revision_ids,expected_history_generation:a.expected_history_generation,
      from_epoch:a.crypto_epoch,target_epoch:a.target_epoch,drain_id:p.response.drain_id,drain_version:p.response.drain_version,linked_metadata_version:1});
    else {
      Object.assign(commit,{operation_id:p.id,lease_version:p.response.lease_version,base:a.base,client_decryption_verified:true});
      if (i.purpose === 'mixed_conversion') commit.target_epoch = a.target_epoch;
      else {
        const h = p.response.metadata_header, selected = String(h.selection.physical_note_id);
        const body = m.S.find(e=>e.descriptor.key.kind === 'note_body' && e.descriptor.key.id === selected)?.descriptor;
        const inv = m.S.find(e=>e.descriptor.key.kind === 'inventory_snapshot' && e.descriptor.key.id === selected)?.descriptor;
        if (!body || !inv) fail('selection_missing');
        const snapshot = source(inv.key), content = source(body.key);
        Q().validateSnapshot(snapshot);
        if (snapshot.note.content !== content) fail('selected_meaning');
        commit.plain_current = {...snapshot.note,...h.server_fields};
        Q().validateSnapshot({schema_version:1,note:commit.plain_current});
      }
    }
    return {transfers,source_origins:origins,commit};
  }
  async function buildWriteWork(scope,prepared,intent,password,remote,localStores = [],resolveKey) {
    scope=clone(scope);
    const p=clone(prepared),i=clone(intent),h=p.response?.metadata_header,m=p.manifest,a=i.prepare;
    if(p.version!==3 || i.schema_version!==3 || i.purpose!=='mixed_note_write' || h?.purpose!==i.purpose) fail('work_purpose');
    if(h.owner_id!==scope.owner || h.local_id!==scope.local_id || h.server_instance_id!==scope.instance
      || h.actor_device_id!==scope.device || h.operation_id!==p.id || h.mutation_id!==a.mutation_id) fail('write_scope');
    const control=Object.fromEntries(['operation','selection','target_current_mode','replica_policy','structure','parent_context','restore_source'].map(k=>[k,a[k]]));
    if(!eq(h.control,control) || !eq(h.base,a.base)) fail('write_control');
    if(!eq(h.operation_origin,{purpose:i.purpose,operation_id:p.id,mutation_id:a.mutation_id,operation:a.operation,
      restore_source_ref:a.restore_source?.revision_ref||null,restore_source_descriptor:a.restore_source?.descriptor||null})) fail('write_origin');
    const input=clone(Q().validateSnapshot({schema_version:1,note:i.note})).note;
    if(input.owner_id!==scope.owner || input.local_id!==scope.local_id
      || h.server_fields.owner_id!==scope.owner || h.server_fields.local_id!==scope.local_id) fail('write_scope');
    const projection=Object.fromEntries(['note_type','parent_local_id','level','deleted_at','title','tags','source'].map(k=>[k,input[k]]));
    if(Object.keys(a.structure).some(k=>!eq(a.structure[k],projection[k]))) fail('write_structure');
    const after=Q().validateSnapshot({schema_version:1,note:{...input,...h.server_fields}});
    const origins=clone(i.source_origins||[]),sources=await remote.readSources(scope,p,password,localStores,resolveKey,origins);
    const source=key=>{
      const rows=sources.filter(v=>eq(v.key,key));
      if(rows.length!==1) fail('source_missing');
      const value=Q().validateSnapshot(clone(rows[0].value));
      if(value.note.owner_id!==scope.owner || value.note.local_id!==scope.local_id) fail('write_scope');
      return value;
    };
    const ordered=Q().keyOrder(m.DSET.map(d=>d.destination_key));
    if(!eq(ordered,m.DSET.map(d=>d.destination_key)) || m.DSET.length!==4
      || new Set(m.DSET.map(d=>d.destination_key.kind)).size!==4) fail('destination_order');
    const previous=m.DSET.find(d=>d.destination_key.kind==='revision_before');
    if(!previous || !m.DSET.some(d=>d.destination_key.kind==='note_body') || !m.DSET.some(d=>d.destination_key.kind==='inventory_snapshot')
      || !m.DSET.some(d=>d.destination_key.kind==='revision_snapshot')) fail('write_destinations');
    if(previous.source_keys.length!==(previous.is_null?0:1)) fail('source_arity');
    const before=previous.is_null?null:source(previous.source_keys[0]);
    const semanticFields=['content','title','tags','source','note_type','parent_local_id','level'];
    if(a.operation==='delete' && (!before || input.deleted_at===null || semanticFields.some(k=>!eq(input[k],before.note[k])))) fail('delete_meaning');
    if(a.operation==='restore') {
      const restored=source(a.restore_source.descriptor.key);
      if([...semanticFields,'deleted_at'].some(k=>!eq(input[k],restored.note[k]))) fail('restore_meaning');
    }
    const transfers=[],records=[];
    for(const d of m.DSET) {
      Q().validateDestination(d,'mixed_note_write');
      const key=d.destination_key,isBefore=key.kind==='revision_before',body=key.kind==='note_body';
      if(!isBefore && (d.source_keys.length || d.is_null || d.output_epoch!==(a.target_current_mode==='plain'?0:h.target_epoch))) fail('write_output');
      if(d.is_null || d.output_epoch===0) continue;
      const semantic=isBefore?before:body?after.note.content:after;
      const origin=isBefore?(origins.find(o=>eq(o.key,d.source_keys[0]))?.origin||{value:null,legacy:null}):{value:body?null:h.operation_origin,legacy:null};
      const outputKey=()=> (resolveKey|| (async()=>password))({key,representation_epoch:d.output_epoch,output:!isBefore});
      const output={key,output_kind:d.output_kind,output_epoch:d.output_epoch,is_null:false,expected_binding:d.expected_binding,operation_origin:origin.value};
      const raw=await Q().encryptRepresentation(semantic,output,await outputKey());
      const hash=await Q().sha256(raw),o=m.O.find(o=>eq(o.destination_key,key));
      if(!o || o.storage_operation_id!==p.id || o.is_null) fail('write_origin');
      const descriptor={key,representation_kind:d.output_kind,representation_epoch:d.output_epoch,is_null:false,
        representation_version:1,representation_etag:d.source_etag,storage_operation_id:p.id,semantic_origin_id:o.semantic_origin_id,
        origin_validator:o.origin_validator,origin_row_required:o.origin_row_required,expected_binding:d.expected_binding,
        revision_ref:d.expected_binding?.revision_ref||null,parent_ref:d.expected_binding?.parent_ref||null,
        physical_note_id:['note_body','inventory_snapshot'].includes(key.kind)?Number(key.id):null,
        inventory_revision_id:key.kind==='inventory_snapshot'?h.revision_ref.id:null,linked_slot_version:null,ciphertext_sha256:hash};
      Q().validateDescriptor(descriptor,3);
      if(!eq(await Q().decryptRepresentation(raw,descriptor,origin,outputKey,3),semantic)) fail('output_verification');
      transfers.push({key,raw,descriptor,origin,semantic});
      records.push({entry_key:key,destination_key:key,source_etag:d.source_etag,output_kind:d.output_kind,target_epoch:d.output_epoch,
        total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:hash});
    }
    const afterOutput=m.DSET.find(d=>d.destination_key.kind==='revision_snapshot');
    return {transfers,source_origins:origins,after:clone(after),commit:{...access(scope),operation_id:p.id,mutation_id:a.mutation_id,
      lease_version:p.response.lease_version,base:clone(a.base),metadata_manifest_digest:p.digest,
      client_verified_ciphertext_manifest_digest:await Q().hashJson(records),client_decryption_verified:true,projection,
      plain_after:afterOutput.output_epoch===0?clone(after.note):null,plain_before:!previous.is_null&&previous.output_epoch===0?clone(before.note):null}};
  }
  async function buildImportWork(scope,prepared,intent,password,remote,localStores=[],resolveKey) {
    scope=clone(scope);const p=clone(prepared),i=clone(intent),m=p.manifest,h=p.response.metadata_header;
    if(i.schema_version!==3 || i.purpose!=='mixed_offline_import' || h.purpose!==i.purpose || h.operation_id!==p.id
      || h.owner_id!==scope.owner || h.local_id!==scope.local_id || h.server_instance_id!==scope.instance || h.actor_device_id!==scope.device
      || h.mutation_id!==i.prepare.mutation_id || !eq(h.base,i.prepare.base) || h.source_catalog_digest!==i.prepare.expected_catalog_digest
      || !eq(h.control,{entries:i.prepare.entries})) fail('import_binding');
    Q().validateImportEntries(i.prepare.entries);
    const local=i.local_branches,entries=i.prepare.entries;
    if(!Array.isArray(local) || !eq(local.map(r=>r.revision_id),entries.map(e=>e.revision_id))) fail('import_branch_set');
    const snapshots=new Map(),resolve=resolveKey||(async()=>password);
    for(let n=0;n<entries.length;n++) {
      const e=entries[n],r=local[n],key={kind:'offline_snapshot',id:e.revision_id,slot:'snapshot'};
      if(!eq(Object.keys(r).sort(),['revision_id','parent_ref','origin_device_id','snapshot','representation'].sort())
        || !eq(r.parent_ref,e.parent_ref) || r.origin_device_id!==e.origin_device_id) fail('import_branch');
      let snapshot=Q().validateSnapshot(clone(r.snapshot));
      if(snapshot.note.owner_id!==scope.owner || snapshot.note.local_id!==scope.local_id) fail('import_scope');
      if(e.source_epoch>0) {
        const rep=r.representation;
        if(!rep || !eq(Object.keys(rep).sort(),['descriptor','raw','origin'].sort())) fail('import_cipher_source');
        const d=Q().validateDescriptor(rep.descriptor,3);
        if(!eq(d.key,key) || d.is_null || d.representation_kind!==e.source_kind || d.representation_epoch!==e.source_epoch
          || !eq(d.parent_ref,e.parent_ref) || !eq(d.revision_ref,{kind:'offline_branch',id:e.revision_id})
          || d.expected_binding?.server_instance_id!==scope.instance) fail('import_cipher_source');
        const actual=await Q().decryptRepresentation(rep.raw,d,rep.origin,resolve,3);
        if(!eq(actual,snapshot)) fail('import_cipher_meaning');
      } else if(r.representation!==null) fail('import_plain_source');
      snapshots.set(e.revision_id,snapshot);
    }
    const origins=clone(i.source_origins||[]),existing=await remote.readSources(scope,p,password,localStores,resolveKey,origins);
    const existingCiphertexts=[];
    for(const old of m.existing) {
      const rows=existing.filter(r=>r.key.kind==='offline_snapshot' && r.key.id===old.revision_id);
      if(rows.length!==1 || !eq(rows[0].value,snapshots.get(old.revision_id))) fail('import_existing_meaning');
      if(old.comparison==='cipher_exact') {
        const rep=local.find(r=>r.revision_id===old.revision_id)?.representation;
        const proof=m.verified_existing.find(v=>v.key.id===old.revision_id);
        const hash=rep && await Q().sha256(rep.raw);
        if(!rep || !proof || hash!==proof.ciphertext_sha256 || new TextEncoder().encode(rep.raw).length!==proof.total_bytes)
          fail('import_existing_cipher');
        existingCiphertexts.push({revision_id:old.revision_id,ciphertext_sha256:hash});
      }
    }
    const transfers=[],records=[],plain=[];
    for(const e of entries) {
      const snapshot=snapshots.get(e.revision_id),d=m.DSET.find(d=>d.destination_key.id===e.revision_id);
      if(e.target_epoch===0) plain.push({revision_id:e.revision_id,snapshot:clone(snapshot.note)});
      if(!d) continue;
      Q().validateDestination(d,i.purpose);
      if(d.destination_key.kind!=='offline_snapshot' || d.output_kind!==e.target_kind
        || d.output_epoch!==e.target_epoch || d.is_null || d.source_keys.length) fail('import_destination');
      if(d.output_epoch===0) continue;
      const key=d.destination_key,origin={value:h.operation_origin,legacy:null};
      const outputKey=()=>resolve({key,representation_epoch:d.output_epoch,output:true});
      const raw=await Q().encryptRepresentation(snapshot,{key,output_kind:d.output_kind,output_epoch:d.output_epoch,is_null:false,
        expected_binding:d.expected_binding,operation_origin:origin.value},await outputKey());
      const hash=await Q().sha256(raw),o=m.O.find(o=>eq(o.destination_key,key));
      if(!o || o.storage_operation_id!==p.id || o.semantic_origin_id!==p.id || o.is_null) fail('import_origin');
      const descriptor={key,representation_kind:d.output_kind,representation_epoch:d.output_epoch,is_null:false,representation_version:1,
        representation_etag:d.source_etag,storage_operation_id:p.id,semantic_origin_id:p.id,origin_validator:o.origin_validator,
        origin_row_required:o.origin_row_required,expected_binding:d.expected_binding,revision_ref:d.expected_binding.revision_ref,
        parent_ref:e.parent_ref,physical_note_id:null,inventory_revision_id:null,linked_slot_version:null,ciphertext_sha256:hash};
      Q().validateDescriptor(descriptor,3);
      if(!eq(await Q().decryptRepresentation(raw,descriptor,origin,outputKey,3),snapshot)) fail('import_output');
      transfers.push({key,raw,descriptor,origin,semantic:clone(snapshot)});
      records.push({entry_key:key,destination_key:key,source_etag:d.source_etag,output_kind:d.output_kind,target_epoch:d.output_epoch,
        total_bytes:new TextEncoder().encode(raw).length,ciphertext_sha256:hash});
    }
    return {transfers,source_origins:origins,branches:clone(local),new_branch_ids:m.DSET.map(d=>d.destination_key.id),commit:{...access(scope),operation_id:p.id,mutation_id:i.prepare.mutation_id,
      lease_version:p.response.lease_version,base:clone(i.prepare.base),metadata_manifest_digest:p.digest,client_decryption_verified:true,
      client_verified_ciphertext_manifest_digest:await Q().hashJson(records),client_verified_existing_set_digest:await Q().hashJson(m.verified_existing),
      plain_entries:plain,existing_ciphertexts:existingCiphertexts}};
  }
  function planImport(scope,catalog,branches,sourceOrigins=[]) {
    scope=clone(scope);catalog=clone(catalog);branches=clone(branches);P().validateScope(scope);
    Q().validateContext(catalog.context);
    if(catalog.context.base.crypto_epoch<1 || !Array.isArray(branches) || !branches.length) fail('import_plan');
    const local=branches.sort((a,b)=>a.revision_id<b.revision_id?-1:a.revision_id>b.revision_id?1:0),entries=[];
    for(const r of local) {
      const snapshot=Q().validateSnapshot(r.snapshot),key={kind:'offline_snapshot',id:r.revision_id,slot:'snapshot'};
      if(snapshot.note.owner_id!==scope.owner || snapshot.note.local_id!==scope.local_id) fail('import_scope');
      if(typeof r.origin_device_id!=='string' || !r.origin_device_id || r.origin_device_id.length>120) fail('import_branch');
      const old=catalog.entries.find(d=>eq(d.key,key)),rep=r.representation;
      if(old) Q().validateDescriptor(old,3);
      if(rep) Q().validateDescriptor(rep.descriptor,3);
      if(old?.representation_epoch>0 && !rep) fail('import_original_cipher_missing');
      if(rep && (rep.descriptor.representation_kind!=='history_envelope_v1' || !eq(rep.descriptor.key,key))) fail('import_cipher_source');
      const sourceKind=rep?'history_envelope_v1':'snapshot_v1',sourceEpoch=rep?rep.descriptor.representation_epoch:0;
      entries.push({revision_id:r.revision_id,parent_ref:clone(r.parent_ref),origin_device_id:r.origin_device_id,
        source_kind:sourceKind,source_epoch:sourceEpoch,target_kind:old?.representation_kind||'history_envelope_v1',
        target_epoch:old?.representation_epoch??catalog.context.base.crypto_epoch,expected_existing:old||null,
        provenance:{kind:rep?'cipher_branch':'plain_branch',origin_server_instance_id:scope.instance,origin_owner_id:scope.owner,
          ...(rep?{origin_storage_operation_id:old?rep.descriptor.storage_operation_id:null}:{origin_revision_ref:old?old.revision_ref:null})}});
    }
    Q().validateImportEntries(entries);
    const batch=new Map(entries.map(e=>[e.revision_id,e])),known=new Set(catalog.entries
      .filter(d=>['revision_snapshot','offline_snapshot'].includes(d.key.kind) && d.revision_ref!==null).map(d=>Q().canonicalJson(d.revision_ref)));
    const done=new Set();
    for(const entry of entries) {
      let node=entry;const chain=new Set();
      while(node && !done.has(node.revision_id)) {
        if(chain.has(node.revision_id)) fail('import_parent_cycle');
        chain.add(node.revision_id);const parent=node.parent_ref;
        if(parent===null) break;
        if(parent.kind==='offline_branch' && batch.has(parent.id)) node=batch.get(parent.id);
        else {if(!known.has(Q().canonicalJson(parent))) fail('import_parent_missing');break;}
      }
      for(const id of chain) done.add(id);
    }
    return {schema_version:3,purpose:'mixed_offline_import',source_origins:clone(sourceOrigins),local_branches:local,
      prepare:{mutation_id:crypto.randomUUID(),base:catalog.context,expected_catalog_digest:catalog.catalog_digest,entries}};
  }
  function settleImportJournal(scope,journal,work,receipt) {
    scope=clone(scope);const value=clone(journal),w=clone(work),r=clone(receipt);
    if(r.schema_version!==3 || r.purpose!=='mixed_offline_import' || r.owner_id!==scope.owner || r.local_id!==scope.local_id
      || r.server_instance_id!==scope.instance || r.operation_id!==w.commit.operation_id || r.mutation_id!==w.commit.mutation_id
      || !Array.isArray(w.branches) || !Array.isArray(w.new_branch_ids)) fail('import_receipt');
    const ids=w.branches.map(b=>b.revision_id),expected=clone(w.commit.base);
    if(new Set(ids).size!==ids.length || new Set(w.new_branch_ids).size!==w.new_branch_ids.length
      || w.new_branch_ids.some(id=>!ids.includes(id))) fail('import_branch_set');
    if(w.new_branch_ids.length) {
      expected.base.head_version++;expected.base.history_generation++;
      if(!expected.base.current_exists) expected.base.identity_state='branch_only';
    }
    Q().validateContext(r.result);
    if(!eq(r.result,expected)) fail('import_receipt_result');
    for(const b of w.branches) {
      const rows=value.revisions.filter(v=>v.revision_id===b.revision_id);
      if(rows.length!==1 || !eq(rows[0].snapshot,b.snapshot) || !eq(rows[0].parent_ref,b.parent_ref)
        || rows[0].origin_device_id!==undefined && rows[0].origin_device_id!==b.origin_device_id) fail('import_branch_changed');
      rows[0].imported=true;rows[0].server_ref={kind:'offline_branch',id:b.revision_id};
      rows[0].origin_device_id=b.origin_device_id;
    }
    value.base={...value.base,...r.result.base};
    return value;
  }
  const access = s => ({schema_version:3,owner_id:s.owner,local_id:s.local_id,device_id:s.device,server_instance_id:s.instance});
  function encoded(value) {
    let binary = '';
    for (const b of new TextEncoder().encode(Q().canonicalJson(value))) binary += String.fromCharCode(b);
    return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  }
  function createReader({request}) {
    const path = '/api/v2/notes/mixed-representations';
    const query = (s,c) => ({...access(s),expected_context:encoded(c.context),catalog_digest:c.catalog_digest});
    const checked = (r,c) => {
      if (r.schema_version !== 3 || !eq(r.context,c.context) || r.catalog_digest !== c.catalog_digest) fail('source_changed');
      return r;
    };
    return {
      async catalog(scope) {
        scope=clone(scope);
        const c = await request(scope,path + '/context','GET',access(scope));
        if (c.server_instance_id !== scope.instance || c.schema_version !== 3) fail('catalog_scope');
        Q().validateContext(c.context);
        const pages = []; let cursor = null;
        do {
          const r = await request(scope,path + '/catalog','GET',{...query(scope,c),limit:500,...(cursor ? {cursor} : {})});
          checked(r,c); pages.push(r);
          cursor = r.next_cursor;
          if (cursor !== null && pages.slice(0,-1).some(p=>p.next_cursor===cursor)) fail('catalog_cursor');
        } while (cursor !== null);
        const entries = await Q().verifyCatalog(pages,{...access(scope),context:c.context,catalog_digest:c.catalog_digest});
        if (!eq(c.counts,pages[0].counts) || !eq(c.coverage,pages[0].coverage)) fail('catalog_changed');
        return {...c,entries};
      },
      async read(scope,catalog,descriptor,resolveKey) {
        scope=clone(scope);
        const c = clone(catalog), d = clone(descriptor);
        if (!c.entries.some(e=>eq(e,d))) fail('descriptor_missing');
        Q().validateDescriptor(d,3);
        const args = {...query(scope,c),kind:d.key.kind,representation_id:d.key.id,slot:d.key.slot,representation_etag:d.representation_etag};
        const meta = checked(await request(scope,path + '/metadata','GET',args),c);
        if (!eq(meta.descriptor,d)) fail('source_changed');
        const fields=['schema_version','context','catalog_digest','descriptor','operation_origin'];
        if (Object.keys(meta).length!==fields.length || fields.some(k=>!Object.hasOwn(meta,k))) fail('origin_response');
        if (d.expected_binding && (d.expected_binding.server_instance_id!==scope.instance || d.expected_binding.owner_id!==scope.owner || d.expected_binding.local_id!==scope.local_id)) fail('representation_scope');
        const expected={value:meta.operation_origin,legacy:d.origin_validator==='a2a_pre_origin_v0'&&meta.operation_origin===null?'a2a_pre_origin_v0':null};
        const chunks = []; let index = 0, total, size;
        do {
          const r = checked(await request(scope,path + '/representation','GET',{...args,chunk_index:index}),c);
          if (!eq(r.descriptor,d)) fail('source_changed');
          if (index === 0) {total=r.total_chunks;size=r.total_bytes;}
          if (!Number.isSafeInteger(total) || !Number.isSafeInteger(size) || total < 0 || size < 0
            || total !== r.total_chunks || size !== r.total_bytes) fail('source_framing');
          if (d.is_null) {
            if (total !== 0 || size !== 0 || r.chunk_index !== null || r.data_base64 !== null) fail('source_null');
            return {descriptor:d,value:await Q().decryptRepresentation(null,d,expected,resolveKey,3),origin:expected};
          }
          if (total !== Math.max(1,Math.ceil(size/262144)) || r.chunk_index !== index || typeof r.data_base64 !== 'string') fail('source_framing');
          const bytes = Uint8Array.from(atob(r.data_base64),ch=>ch.charCodeAt(0));
          if (bytes.length !== Math.min(262144,size-index*262144)) fail('source_length');
          chunks.push(bytes); index++;
        } while (index < total);
        const bytes = new Uint8Array(size); let offset=0;
        for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
        const raw = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
        const value=await Q().decryptRepresentation(raw,d,expected,resolveKey,3);
        if (value?.note && (value.note.owner_id!==scope.owner || value.note.local_id!==scope.local_id)) fail('representation_scope');
        return {descriptor:d,value,origin:expected};
      },
    };
  }
  function plan(scope,purpose,status,catalog,branches = [],sourceOrigins = []) {
    const k = status.crypto_epoch;
    if (!Number.isSafeInteger(k) || k < 0 || status.server_instance_id !== scope.instance) fail('plan_scope');
    const drain = {mutation_id:crypto.randomUUID(),crypto_epoch:k,expected_history_generation:status.history_generation};
    if (purpose === 'conversion') {
      if (k !== 0) fail('initial_epoch');
      return {schema_version:2,purpose,drain,prepare:{mutation_id:crypto.randomUUID(),crypto_epoch:0,base_head_version:status.head_version,
        base_revision_id:status.head_revision_id,expected_inventory_revision_ids:clone(status.inventory_revision_ids),
        expected_history_generation:status.history_generation,target_epoch:1,local_branches:branches.map(b=>({revision_id:b.revision_id,parent_ref:clone(b.parent_ref),origin_device_id:b.origin_device_id}))}};
    }
    if (!catalog || k < 1 || !eq(catalog.context.base,Object.fromEntries(Object.keys(catalog.context.base).map(f=>[f,status[f]])))) fail('plan_context');
    const base = clone(catalog.context), prepare = {mutation_id:crypto.randomUUID(),base,expected_catalog_digest:catalog.catalog_digest};
    if (purpose === 'mixed_conversion') Object.assign(prepare,{target_epoch:k+1,target_current_mode:base.base.current_exists?'protected':'absent',reserved_branches:clone(branches)});
    else if (purpose === 'current_plain_transition') {
      if (base.current_mode !== 'protected' || base.base.identity_state !== 'coherent') fail('current_required');
      const id = String(base.selected_physical_note_id), body = catalog.entries.find(d=>d.key.kind==='note_body'&&d.key.id===id), inv=catalog.entries.find(d=>d.key.kind==='inventory_snapshot'&&d.key.id===id);
      if (!body || !inv || !inv.revision_ref) fail('selection_missing');
      Object.assign(prepare,{selection:{physical_note_id:base.selected_physical_note_id,inventory_revision_ref:inv.revision_ref,
        note_representation_etag:body.representation_etag,inventory_representation_etag:inv.representation_etag},replica_policy:'selected_head_only',target_current_mode:'plain'});
    } else fail('work_purpose');
    return {schema_version:3,purpose,drain,prepare,source_origins:clone(sourceOrigins)};
  }
  globalThis.NowNoteProtectionClient = Object.freeze({create,buildWork,buildWriteWork,buildImportWork,planImport,settleImportJournal,createReader,plan});
})();
