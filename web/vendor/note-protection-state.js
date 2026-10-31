/* Per-store protection settlement. Existing history journal owns all durable markers. */
(() => {
  'use strict';
  const copy = value => structuredClone(value);
  const json = value => JSON.stringify(value);
  const eq = (a, b) => json(a) === json(b);
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = code => { throw new Error('note_protection:' + code); };
  const protocol = () => globalThis.NowNoteProtectionProtocol;
  const phases = ['drain_pending','draining','preparing','promoted','bundled','prepared','committing','server_committed','applying','complete','analysis_claiming','analysis_claimed','analysis_dispatching','analysis_running','analysis_terminal','analysis_settling','analysis_settled','analysis_write_preparing','analysis_write_prepared','analysis_write_staged','analysis_write_committing','analysis_write_committed','analysis_replan_preparing','analysis_replan_allocated','analysis_replan_stored','analysis_replan_prepared','analysis_replan_staged','analysis_replan_committing','analysis_replan_committed'];
  const fields = (v, names) => { if (!record(v) || Object.keys(v).length !== names.length || names.some(k => !Object.hasOwn(v,k))) fail('marker_fields'); };
  function scopeKey(s) { return json([s.url.replace(/\/+$/, ''), s.owner, s.instance, s.local_id]); }
  function validateScope(s) {
    fields(s, ['url','owner','instance','local_id','device']);
    for (const f of ['url','owner','instance','local_id','device']) if (typeof s[f] !== 'string') fail('scope');
    if (!s.owner || !s.device || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s.instance)) fail('scope');
  }
  function validateMarker(m) {
    fields(m, ['schema_version','id','scope','phase','cipher_bundle']); validateScope(m.scope);
    if (m.schema_version !== 1 || typeof m.id !== 'string' || !phases.includes(m.phase)
      || typeof m.cipher_bundle !== 'string' || !m.cipher_bundle.startsWith('NOW_ENCRYPTED_V1:')) fail('marker');
    return m;
  }
  function protectedRecord(value) {
    if (!record(value) || !Object.hasOwn(value,'protection_record')) return false;
    const allowed = ['protection_record','id','owner_id','local_id','note_local_id','device_id','date','parentId','level','parent_local_id','note_type',
      'status','syncState','updatedAt','createdAt','deletedAt','archivedAt','restoredAt','created_at','updated_at','protectionScope','title','content','children',
      'tags','properties','favorite','shared','serverShared','groupSharedReadOnly','remoteOwnerId','remoteLocalId','unsharedAt'];
    if (Object.keys(value).some(k=>!allowed.includes(k))) fail('protected_record_fields');
    const r = value.protection_record;
    fields(r, ['schema_version','scope','operation_id','ciphertext']); validateScope(r.scope);
    if (value.protectionScope) {
      validateScope(value.protectionScope);
      if (!sameOwner(value.protectionScope,r.scope) || value.protectionScope.local_id !== r.scope.local_id) fail('protected_record_scope');
    }
    if (r.schema_version !== 1 || typeof r.operation_id !== 'string' || typeof r.ciphertext !== 'string'
      || !r.ciphertext.startsWith('NOW_ENCRYPTED_V1:')) fail('protected_record');
    if (Object.hasOwn(value,'content') && value.content !== r.ciphertext || Object.hasOwn(value,'title') && value.title !== '보호된 메모') fail('protected_record_copy');
    if (Object.hasOwn(value,'tags') && (!Array.isArray(value.tags) || value.tags.length)) fail('protected_record_copy');
    if (Object.hasOwn(value,'properties') && (!record(value.properties) || Object.entries(value.properties).some(([k,v])=>!['status','priority','type','source','author','dueDate','project'].includes(k) || v !== ''))) fail('protected_record_copy');
    return true;
  }
  function sameOwner(s, scope) {
    return record(s) && s.url?.replace(/\/+$/, '') === scope.url.replace(/\/+$/, '') && s.owner === scope.owner && s.instance === scope.instance;
  }
  function inventory(value, kind, scope, options = {}) {
    validateScope(scope);
    const found = [], occupied = new Set();
    const add = (path, object, proof, type) => {
      if (object.owner_id && object.owner_id !== scope.owner) return;
      if (object.ownerId && object.ownerId !== scope.owner) return;
      if (object.remoteOwnerId && object.remoteOwnerId !== scope.owner) return;
      if (protectedRecord(object)) {
        if (!sameOwner(object.protection_record.scope, scope)) fail('scope_unverified');
        return;
      }
      if (!proof) {
        if (options.unverified) { options.unverified.push({ path, type, before: copy(object) }); return; }
        fail('local_scope_unverified');
      }
      validateScope(proof);
      if (!sameOwner(proof,scope)) return;
      if (proof.local_id !== scope.local_id) fail('local_scope_unverified');
      const p = json(path); if (occupied.has(p)) return; occupied.add(p);
      found.push({ path, type, before: copy(object) });
    };
    function walk(v, path, role, proof) {
      if (!record(v) && !Array.isArray(v)) return;
      if (Array.isArray(v)) { v.forEach((item,i) => walk(item,[...path,i],role,proof)); return; }
      if (protectedRecord(v)) {
        if (options.includeArchives && sameOwner(v.protection_record.scope,scope) && v.protection_record.scope.local_id === scope.local_id) {
          found.push({path:copy(path),type:'archive',before:copy(v)});
        }
        // A parent's archive never owns its independent child records.
        if (Array.isArray(v.children)) walk(v.children,[...path,'children'],'tree',null);
        for (const k of ['data','history','settings','snapshots','recovery_archives']) {
          if (Object.hasOwn(v,k)) walk(v[k],[...path,k],k === 'history' ? 'history' : k === 'data' ? 'data' : role,null);
        }
        return;
      }
      if (role === 'history' && v.schema_version === 1 && record(v.contexts)) {
        const account = json([scope.url.replace(/\/+$/,''),scope.owner]);
        for (const [k,c] of Object.entries(v.contexts)) {
          if (k !== account) continue;
          if (!record(c.notes)) fail('journal_unknown');
          const item = c.notes[scope.local_id];
          if (item) {
            if (protectedRecord(item)) {
              if (options.includeArchives) walk(item,[...path,'contexts',k,'notes',scope.local_id],'history',null);
              continue;
            }
            if (item.raw?.owner_id !== scope.owner || item.raw?.local_id !== scope.local_id
              || item.draft?.owner_id !== scope.owner || item.draft?.local_id !== scope.local_id) fail('journal_scope');
            const positive = item.protectionScope || (item.base?.server_instance_id === scope.instance ? scope : null);
            add([...path,'contexts',k,'notes',scope.local_id],item,positive,'journal');
          }
          // An unsettled immutable legacy body must be settled, never rewritten in place.
          if (c.legacy_pending?.body?.notes?.some(n => n.owner_id === scope.owner && n.local_id === scope.local_id)) fail('legacy_unsettled');
        }
        for (const [i,a] of (v.recovery_archives || []).entries()) walk({ schema_version: 1, contexts: a.contexts }, [...path,'recovery_archives',i], 'history',proof);
        return;
      }
      const tagged = v.protectionScope || proof;
      if (v.localId === scope.local_id && (Object.hasOwn(v,'localContent') || Object.hasOwn(v,'serverContent'))) {
        add(path,v,tagged,'conflict'); return;
      }
      if (v.local_id === scope.local_id && v.owner_id === scope.owner) { add(path,v,tagged,'raw'); return; }
      if (v.note_local_id === scope.local_id && v.owner_id === scope.owner) { add(path,v,tagged,'linked'); return; }
      if (role === 'tree' && v.id === scope.local_id) { add(path,v,tagged,'ui'); return; }
      if (v.server && record(v.server)) {
        const server = v.server;
        const serverProof = server.url?.replace(/\/+$/,'') === scope.url.replace(/\/+$/,'') && server.ownerId === scope.owner
          && server.serverInstanceId === scope.instance ? scope : null;
        for (const [k,child] of Object.entries(v)) walk(child,[...path,k],k === 'server' ? 'server' : role,k === 'server' ? serverProof : proof);
        return;
      }
      if (role === 'data') {
        for (const key of ['tree','deletedTree']) if (Array.isArray(v[key])) walk(v[key],[...path,key],'tree',proof);
        for (const [group,prefix] of [['daily','daily:'],['worklogs','worklog:']]) {
          for (const [date,note] of Object.entries(v[group] || {})) if (prefix + date === scope.local_id) add([...path,group,date],note,note.protectionScope || proof,'ui');
        }
        for (const [i,note] of (v.archivedDaily || []).entries()) {
          if ('daily-archive:' + note.id === scope.local_id) add([...path,'archivedDaily',i],note,note.protectionScope || proof,'ui');
        }
      }
      for (const [k,child] of Object.entries(v)) {
        if (role === 'data' && ['tree','deletedTree','daily','worklogs','archivedDaily'].includes(k)) continue;
        if (k === 'protection_operations' || k === 'protectionScope') continue;
        walk(child,[...path,k],k === 'history' ? 'history' : k === 'data' ? 'data' : k === 'children' ? 'tree' : role,k === 'children' ? null : tagged);
      }
    }
    walk(value,[],kind,null);
    return found;
  }
  const at = (value,path) => path.reduce((v,k) => v?.[k],value);
  function put(value,path,next) {
    if (!path.length) return copy(next);
    const parent = at(value,path.slice(0,-1)); if (!parent || !Object.hasOwn(parent,path.at(-1))) fail('copy_missing');
    parent[path.at(-1)] = copy(next); return value;
  }
  function currentMatches(current, old) {
    if (protectedRecord(current) && protectedRecord(old)) {
      return eq(current.protection_record,old.protection_record)
        && Object.entries(old).every(([k,v]) => k === 'children' || eq(current[k],v));
    }
    // Children are independent records, not part of the parent's semantic archive.
    const omit = v => Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'children'));
    return record(current) && eq(omit(current),omit(old));
  }
  async function sealCopies(entries, scope, id, password, memo,resolveKey,intent) {
    const results = [];
    for (const e of entries) {
      let original = copy(e.before);
      const children = original.children; delete original.children;
      if (e.type === 'archive') {
        if (typeof resolveKey !== 'function') fail('archive_key_required');
        const r=original.protection_record;
        const opened=protocol().parseJson(await protocol().decryptContent(r.ciphertext,await resolveKey({representation_epoch:'local:'+r.operation_id,operation_id:r.operation_id,output:false})));
        if (opened.schema_version !== 1 || !eq(opened.scope,r.scope) || opened.operation_id !== r.operation_id || !record(opened.value)) fail('archive_binding');
        if (intent?.purpose === 'current_plain_transition') {results.push({...e,after:copy(e.before)});continue;}
        original=copy(opened.value);
      }
      const archive = { schema_version: 1, scope, operation_id: id, value: original };
      const archiveBytes = json(archive);
      let cipher = memo.get(archiveBytes);
      if (!cipher) { cipher = await protocol().encryptContent(archiveBytes,password); memo.set(archiveBytes,cipher); }
      const keep = ['id','owner_id','local_id','note_local_id','device_id','date','parentId','level','parent_local_id','note_type',
        'status','syncState','updatedAt','createdAt','deletedAt','archivedAt','restoredAt','created_at','updated_at','protectionScope'];
      let after = Object.fromEntries(keep.filter(k => Object.hasOwn(original,k)).map(k => [k,copy(original[k])]));
      if (e.type === 'journal') after = {};
      else { after.title = '보호된 메모'; after.content = cipher; }
      if (e.type === 'ui' || e.type === 'archive' && Array.isArray(e.before.tags)) after.tags = [];
      if (e.type === 'archive' && e.before.properties) after.properties = copy(e.before.properties);
      if (children !== undefined) after.children = children;
      after.protection_record = { schema_version: 1, scope: copy(scope), operation_id: id, ciphertext: cipher };
      results.push({ ...e, after });
    }
    return results;
  }
  function create({ context, journal, stores, remote, preflight, change = () => {} }) {
    let epoch = 0, running = false, freezing = null;
    const active = (ctx, generation) => {
      const now = context();
      if (generation !== epoch || !now.enabled || now.auth !== ctx.auth || now.owner !== ctx.owner
        || now.url.replace(/\/+$/,'') !== ctx.url.replace(/\/+$/,'') || now.instance !== ctx.instance) fail('scope_changed');
    };
    const own = scope => {
      validateScope(scope); const ctx = context();
      if (!ctx.enabled || !sameOwner(ctx,scope) || ctx.device !== scope.device) fail('scope_changed');
      return { ...ctx };
    };
    const operations = () => journal.protectionOperations();
    const inAccount = m => context().enabled && m?.scope?.owner === context().owner
      && m?.scope?.url?.replace(/\/+$/,'') === context().url.replace(/\/+$/,'');
    function status(id) { const m = operations()[id]; if (!m) fail('operation_missing'); if (!inAccount(m)) fail('scope_changed'); return copy(validateMarker(m)); }
    async function save(m,bundle,password,ctx,generation) {
      active(ctx,generation);
      m.cipher_bundle = await protocol().encryptContent(json(bundle),password); active(ctx,generation);
      validateMarker(m); await journal.saveProtection(m,{active:()=>{active(ctx,generation);return true;}}); active(ctx,generation);
      if (!eq(status(m.id),m)) fail('marker_readback'); change();
    }
    async function open(m,password) {
      if (!password) fail('key_required');
      const bundle = JSON.parse(await protocol().decryptContent(m.cipher_bundle,password));
      if (bundle.schema_version !== 1 || bundle.operation_id !== m.id || !eq(bundle.scope,m.scope) || !Array.isArray(bundle.stores)) fail('bundle_binding');
      return bundle;
    }
    async function start(scope,intent,password,resolveKey) {
      if (!password) fail('key_required'); const ctx = own(scope), generation = epoch;
      if (Object.values(operations()).filter(inAccount).some(m => scopeKey(validateMarker(m).scope) === scopeKey(scope) && m.phase !== 'complete')) fail('operation_exists');
      if (running) fail('busy'); running = true;
      freezing = copy(scope); change();
      try {
        await preflight(scope); active(ctx,generation);
        const id = crypto.randomUUID(), sources = [], memo = new Map();
        for (const store of stores()) {
          const raw = await store.read(); active(ctx,generation);
          sources.push({ name: store.name, ephemeral: Boolean(store.ephemeral), patches: await sealCopies(inventory(raw,store.kind,scope,{includeArchives:true}),scope,id,password,memo,resolveKey,intent) });
          active(ctx,generation);
        }
        if (!sources.some(s => s.patches.length)) {
          if (intent.schema_version !== 2 || intent.purpose !== 'conversion' || typeof remote.verifyEmptyLocal !== 'function'
            || await remote.verifyEmptyLocal(copy(scope),copy(intent)) !== true) fail('local_copies_missing');
          active(ctx,generation);
        }
        const bundle = { schema_version: 1, scope: copy(scope), operation_id: id, intent: copy(intent), stores: sources, drain: null, prepared: null, work: null, receipt: null };
        const marker = { schema_version: 1, id, scope: copy(scope), phase: 'drain_pending', cipher_bundle: '' };
        await save(marker,bundle,password,ctx,generation);
        bundle.drain = await remote.drainPrepare(scope,copy(bundle.intent)); active(ctx,generation);
        marker.phase = 'draining'; await save(marker,bundle,password,ctx,generation);
        return id;
      } finally { running = false; freezing = null; change(); }
    }
    async function resume(id,password,build,resolveKey) {
      const marker = status(id), ctx = own(marker.scope), generation = epoch;
      if (running) fail('busy'); running = true;
      try {
        const b = await open(marker,password); active(ctx,generation);
        const persist = () => save(marker,b,password,ctx,generation);
        if (marker.phase === 'complete') return copy(b.receipt);
        if (marker.phase === 'drain_pending') {
          // Same immutable mutation after response loss; never invent a new cohort.
          b.drain = await remote.drainPrepare(marker.scope,copy(b.intent)); active(ctx,generation);
          marker.phase = 'draining'; await persist();
        }
        if (marker.phase === 'draining') {
          const d = await remote.drainStatus(marker.scope,copy(b.drain)); active(ctx,generation);
          if (d.drain_id !== b.drain.drain_id || d.drain_version !== b.drain.drain_version
            || !eq(d.accepted_runs,b.drain.accepted_runs) || !eq(d.accepted_claims,b.drain.accepted_claims)) fail('drain_changed');
          if (d.state !== 'ready' || d.pending_count !== 0) fail('related_jobs_unsettled');
          b.drain = d; const fresh = await remote.fresh(marker.scope,copy(b.intent),copy(d)); active(ctx,generation);
          b.fresh = fresh; marker.phase = 'preparing'; await persist();
        }
        if (marker.phase === 'preparing') {
          b.prepared = await remote.prepare(marker.scope,copy(b.intent),copy(b.drain),copy(b.fresh)); active(ctx,generation);
          if (!b.prepared.promoted) fail('drain_not_promoted');
          marker.phase = 'promoted'; await persist();
        }
        if (marker.phase === 'promoted') {
          if (typeof build !== 'function') fail('cipher_plan_required');
          b.work = await build(copy(b.prepared),copy(b.intent),copy(b.stores)); active(ctx,generation);
          marker.phase = 'bundled'; await persist();
        }
        if (marker.phase === 'bundled') {
          await remote.stage(marker.scope,copy(b.prepared),copy(b.work),password,copy(b.stores),resolveKey); active(ctx,generation);
          marker.phase = 'prepared'; await persist();
        }
        if (marker.phase === 'prepared') { marker.phase = 'committing'; await persist(); }
        if (marker.phase === 'committing') {
          let result = await remote.status(marker.scope,copy(b.prepared),copy(b.work)); active(ctx,generation);
          if (result.state !== 'committed') {
            if (!['prepared','uploading','ready'].includes(result.state)) fail('remote_not_committable');
            result = await remote.commit(marker.scope,copy(b.prepared),copy(b.work)); active(ctx,generation);
          }
          if (result.state !== 'committed' || !result.receipt) fail('commit_unconfirmed');
          if (result.receipt_matches_current !== true) fail('committed_not_current');
          b.receipt = result.receipt; marker.phase = 'server_committed'; await persist();
        }
        if (marker.phase === 'server_committed') { marker.phase = 'applying'; await persist(); }
        if (marker.phase === 'applying') {
          const currentStatus = await remote.status(marker.scope,copy(b.prepared),copy(b.work)); active(ctx,generation);
          if (currentStatus.state !== 'committed' || currentStatus.receipt_matches_current !== true || !eq(currentStatus.receipt,b.receipt)) fail('committed_not_current');
          const adapters = stores();
          if (!eq(adapters.map(s => s.name),b.stores.map(s => s.name))) fail('store_inventory_changed');
          const knownCiphers = b.stores.flatMap(s => s.patches).flatMap(p => [p.after.protection_record,
            ...(protectedRecord(p.before) ? [p.before.protection_record] : [])]);
          const knownArchives = value => {
            if (!record(value) && !Array.isArray(value)) return;
            if (protectedRecord(value)) {
              const r = value.protection_record;
              if (scopeKey(r.scope) === scopeKey(marker.scope) && !knownCiphers.some(known => eq(known,r))) fail('local_cipher_changed');
            }
            for (const [k,v] of Object.entries(value)) if (k !== 'protection_record' && k !== 'protection_operations') knownArchives(v);
          };
          for (const saved of b.stores) {
            const store = adapters.find(s => s.name === saved.name), current = await store.read(); active(ctx,generation);
            knownArchives(current);
            if (Boolean(store.ephemeral) !== saved.ephemeral) fail('store_inventory_changed');
            let next = copy(current);
            const cacheCleared = saved.ephemeral && inventory(current,store.kind,marker.scope).length === 0;
            for (const patch of cacheCleared ? [] : saved.patches) {
              const value = at(next,patch.path);
              if (value === undefined && saved.ephemeral) continue;
              if (currentMatches(value,patch.after)) continue;
              if (!currentMatches(value,patch.before)) fail('local_copy_changed:' + saved.name + ':' + patch.path.map(k => String(k)).join('/'));
              const replacement = copy(patch.after);
              if (Object.hasOwn(value,'children')) replacement.children = copy(value.children);
              next = put(next,patch.path,replacement);
            }
            if (!eq(next,current)) { active(ctx,generation); await store.cas(current,next,{ active:() => { active(ctx,generation); return true; } }); active(ctx,generation); }
            const readback = await store.read(); active(ctx,generation);
            knownArchives(readback);
            for (const patch of cacheCleared ? [] : saved.patches) {
              const value = at(readback,patch.path);
              if (value === undefined && saved.ephemeral) continue;
              if (!currentMatches(value,patch.after)) fail('store_readback');
            }
            // Inventory is re-run: newly appearing owned copies cannot be missed.
            if (inventory(readback,store.kind,marker.scope).length) fail('local_copy_added');
          }
          marker.phase = 'complete'; await persist();
        }
        return copy(b.receipt);
      } finally { running = false; }
    }
    return { start,resume,status,
      invalidate() { epoch++; },
      blocked(id) {
        if (freezing && inAccount({scope:freezing}) && freezing.local_id === id) return true;
        try { return Object.values(operations()).filter(inAccount).some(m => { validateMarker(m); return m.scope.local_id === id && m.phase !== 'complete'; }); }
        catch { return true; }
      },
      pending() {
        const pending = Object.values(operations()).filter(inAccount).filter(m => { validateMarker(m); return m.phase !== 'complete'; });
        return pending.length + (freezing && inAccount({scope:freezing}) && !pending.some(m=>scopeKey(m.scope)===scopeKey(freezing)) ? 1 : 0);
      },
    };
  }
  function createWrite(options) {return createMutation(options,'mixed_note_write');}
  function createImport(options) {return createMutation(options,'mixed_offline_import');}
  function createMutation({context,journal,remote,capture,settle,apply,change=()=>{}},purpose) {
    let generation=0,running=false;
    const same=(a,b)=>protocol().canonicalJson(a)===protocol().canonicalJson(b);
    const own=scope=>{
      validateScope(scope);const ctx=copy(context());
      if(!ctx.enabled || ctx.owner!==scope.owner || ctx.instance!==scope.instance || ctx.device!==scope.device
        || String(ctx.url).replace(/\/+$/,'')!==scope.url.replace(/\/+$/,'')) fail('scope_changed');
      return {...ctx,local_id:scope.local_id};
    };
    const active=(ctx,epoch)=>{
      const current=own(Object.fromEntries(['url','owner','instance','local_id','device'].map(k=>[k,ctx[k]])));
      if(epoch!==generation || current.auth!==ctx.auth) fail('scope_changed');
      return true;
    };
    const status=id=>{
      const marker=journal.protectionOperations()[id];
      if(!marker) fail('operation_missing');
      validateMarker(marker);own(marker.scope);return copy(marker);
    };
    const pending=scope=>Object.values(journal.protectionOperations()).some(marker=>{
      if(marker?.scope?.owner!==scope.owner || String(marker?.scope?.url||'').replace(/\/+$/,'')!==scope.url.replace(/\/+$/,'')) return false;
      validateMarker(marker);
      return marker.phase!=='complete' && marker.scope.owner===scope.owner && marker.scope.local_id===scope.local_id
        && marker.scope.url.replace(/\/+$/,'')===scope.url.replace(/\/+$/,'');
    });
    async function save(marker,bundle,password,ctx,epoch) {
      active(ctx,epoch);
      marker.cipher_bundle=await protocol().encryptContent(json(bundle),password);active(ctx,epoch);
      validateMarker(marker);await journal.saveProtection(copy(marker),{active:()=>active(ctx,epoch)});active(ctx,epoch);
      if(!same(status(marker.id),marker)) fail('marker_readback');change();
    }
    async function open(marker,password) {
      if(!password) fail('key_required');
      const b=protocol().parseJson(await protocol().decryptContent(marker.cipher_bundle,password));
      fields(b,['schema_version','operation_id','scope','intent','local','prepared','work','receipt']);
      if(b.schema_version!==1 || b.operation_id!==marker.id || !same(b.scope,marker.scope)
        || b.intent?.schema_version!==3 || b.intent.purpose!==purpose) fail('bundle_binding');
      return b;
    }
    return {
      async start(scope,intent,password) {
        if(!password) fail('key_required');scope=copy(scope);intent=copy(intent);
        const ctx=own(scope),epoch=generation;
        if(intent.schema_version!==3 || intent.purpose!==purpose) fail('work_purpose');
        if(running) fail('busy');if(pending(scope)) fail('operation_exists');running=true;
        try {
          const local=await capture(copy(scope),()=>active(ctx,epoch),copy(intent));active(ctx,epoch);
          if(pending(scope)) fail('operation_exists');
          const id=crypto.randomUUID(),marker={schema_version:1,id,scope,phase:'preparing',cipher_bundle:''};
          const bundle={schema_version:1,operation_id:id,scope:copy(scope),intent,local,prepared:null,work:null,receipt:null};
          await save(marker,bundle,password,ctx,epoch);return id;
        } finally {running=false;}
      },
      async resume(id,password,build,resolveKey) {
        const marker=status(id),ctx=own(marker.scope),epoch=generation;
        if(running) fail('busy');running=true;
        try {
          const b=await open(marker,password);active(ctx,epoch);
          const persist=()=>save(marker,b,password,ctx,epoch);
          if(marker.phase==='complete') return copy(b.receipt);
          if(marker.phase==='preparing') {
            b.prepared=await remote[purpose==='mixed_offline_import'?'prepareImport':'prepareWrite'](copy(marker.scope),copy(b.intent));active(ctx,epoch);
            marker.phase='promoted';await persist();
          }
          if(marker.phase==='promoted') {
            if(typeof build!=='function') fail('cipher_plan_required');
            b.work=await build(copy(b.prepared),copy(b.intent),copy(b.local));active(ctx,epoch);
            marker.phase='bundled';await persist();
          }
          if(marker.phase==='bundled') {
            await remote.stage(copy(marker.scope),copy(b.prepared),copy(b.work),password,[],resolveKey);active(ctx,epoch);
            marker.phase='prepared';await persist();
          }
          if(marker.phase==='prepared'){marker.phase='committing';await persist();}
          if(marker.phase==='committing') {
            let r=await remote.status(copy(marker.scope),copy(b.prepared),copy(b.work));active(ctx,epoch);
            if(r.state!=='committed') {
              if(!['prepared','uploading','ready'].includes(r.state)) fail('remote_not_committable');
              r=await remote.commit(copy(marker.scope),copy(b.prepared),copy(b.work));active(ctx,epoch);
            }
            if(r.state!=='committed' || !r.receipt || r.receipt.operation_id!==b.prepared.id || r.receipt_matches_current!==true) fail('commit_unconfirmed');
            b.receipt=copy(r.receipt);marker.phase='server_committed';await persist();
          }
          if(marker.phase==='server_committed'){
            if(settle){b.work.local=copy(await settle(copy(marker.scope),copy(b.local),copy(b.work),copy(b.receipt),password,resolveKey));active(ctx,epoch);}
            marker.phase='applying';await persist();
          }
          if(marker.phase==='applying') {
            const r=await remote.status(copy(marker.scope),copy(b.prepared),copy(b.work));active(ctx,epoch);
            if(r.state!=='committed' || r.receipt_matches_current!==true || !same(r.receipt,b.receipt)) fail('committed_not_current');
            await apply(copy(marker.scope),copy(b.local),copy(b.work),copy(b.receipt),()=>active(ctx,epoch));active(ctx,epoch);
            marker.phase='complete';await persist();
          }
          if(marker.phase!=='complete') fail('write_phase');
          return copy(b.receipt);
        } finally {running=false;}
      },
      status,invalidate(){generation++;},
    };
  }
  function createRemote({ request, keyResolver }) {
    const eq = (a,b) => protocol().canonicalJson(a) === protocol().canonicalJson(b);
    const access = (s,version) => ({ schema_version: version, owner_id: s.owner, local_id: s.local_id, device_id: s.device, server_instance_id: s.instance });
    const pathFor = purpose => ({ conversion: '/api/v2/notes/crypto-transitions', current_plain_transition: '/api/v2/notes/current-plain', mixed_conversion: '/api/v2/notes/mixed-conversions' })[purpose] || fail('purpose');
    const query = (s,p) => p.version === 2 ? { owner_id: s.owner, local_id: s.local_id, device_id: s.device, transition_id: p.id }
      : { ...access(s,3), operation_id: p.id };
    const ensureScope = (s,b) => {
      if (b.owner_id !== s.owner || b.local_id !== s.local_id || b.device_id !== s.device || b.server_instance_id !== s.instance) fail('wire_scope');
    };
    async function pages(s,p) {
      const sections = p.version === 2 ? [null] : ['mixed_note_write','mixed_offline_import','mixed_analysis_write'].includes(p.response.purpose) ? ['S','DSET','P','O','existing','verified_existing'] : ['S','DSET','P','O'];
      const result = {}; let header = null, setDigests = p.response.set_digests || null;
      for (const section of sections) {
        let cursor = null; const seen = new Set(), entries = [];
        do {
          const q = { ...query(s,p), metadata_manifest_digest: p.digest, limit: 500, ...(cursor ? { cursor } : {}),
            ...(p.version === 2 ? { manifest_schema: 2 } : { section }) };
          const page = await request(s,p.path + '/manifest','GET',q);
          if (page.metadata_manifest_digest !== p.digest) fail('manifest_changed');
          if (p.version === 2) {
            if (page.schema_version !== 2 || !eq(page.metadata_context,p.response.metadata_context) || !eq(page.set_counts,p.response.set_counts)) fail('manifest_context');
            entries.push(...page.items);
          } else {
            if (setDigests === null && ['mixed_note_write','mixed_offline_import','mixed_analysis_write'].includes(p.response.purpose)) setDigests = copy(page.set_digests);
            if (page.schema_version !== 3 || page.section !== section || !eq(page.metadata_header,p.response.metadata_header)
              || !eq(page.set_digests,setDigests) || !eq(page.counts,p.response.counts)) fail('manifest_context');
            header = page.metadata_header; entries.push(...page.entries);
          }
          cursor = page.next_cursor;
          if (cursor !== null && (typeof cursor !== 'string' || seen.has(cursor))) fail('manifest_cursor');
          seen.add(cursor);
        } while (cursor !== null);
        if (p.version === 2) {
          for (const name of ['entries','null_slots','origin_expectations','linked_expectations']) result[name] = entries.filter(e => e.set === name).map(e => e.entry);
          if (entries.length !== Object.values(result).reduce((n,a) => n + a.length,0)) fail('manifest_section');
        } else result[section] = entries;
      }
      for (const [name,list] of Object.entries(result)) {
        const pick = e => ['S','existing','verified_existing'].includes(name) ? e.descriptor.key : ['DSET','O','origin_expectations'].includes(name) ? e.destination_key : e.key;
        const keys = list.map(pick); if (!eq(protocol().keyOrder(keys),keys)) fail('manifest_order');
        if (p.version === 2) { if (list.length !== p.response.set_counts[name]) fail('manifest_count'); }
        else if (await protocol().hashJson(list) !== setDigests[name] || list.length !== p.response.counts[name].total) fail('manifest_digest');
      }
      const digest = await protocol().hashJson({ ...(p.version === 2 ? p.response.metadata_context : header), ...result });
      if (digest !== p.digest) fail('manifest_digest');
      return result;
    }
    async function normalized(s,p,response,work) {
      const analyzing=p.response.purpose==='mixed_analysis_write';
      if(analyzing){
        s=copy(s);p=copy(p);response=copy(response);work=copy(work);
        if(Object.hasOwn(response,'status')){
          fields(response,['schema_version','status','operation','original_execution']);
          if(response.schema_version!==3||response.status!=='operation'||!eq(response.original_execution,p.original_execution))fail('analysis_original_execution');
          response=response.operation;
        }
        fields(response,['schema_version','purpose','operation_id','mutation_id','state','lease_version','expires_at','metadata_manifest_digest','metadata_header','counts','receipt','latest_context']);
        if(response.metadata_manifest_digest!==p.digest||!eq(response.metadata_header,p.response.metadata_header)||!eq(response.counts,p.response.counts))fail('analysis_operation_changed');
      }
      const writing=p.response.purpose==='mixed_note_write';
      const importing=p.response.purpose==='mixed_offline_import',mutation=writing||importing||analyzing;
      if ((response.operation_id || response.transition_id) !== p.id) fail('operation_identity');
      if(mutation && (response.schema_version!==3 || response.purpose!==p.response.purpose || response.mutation_id!==p.response.mutation_id)) fail('receipt_identity');
      if (response.state === 'committed') {
        const r = response.receipt;
        if (!r || r.owner_id !== s.owner || r.local_id !== s.local_id || r.server_instance_id !== s.instance || r.metadata_manifest_digest !== p.digest) fail('receipt_binding');
        if (p.version === 3 && r.operation_id !== p.id) fail('receipt_identity');
        if(mutation) {
          protocol().validateContext(response.latest_context);
          if(r.schema_version!==3 || r.purpose!==p.response.purpose || r.mutation_id!==p.response.mutation_id
            || !eq(r.result,response.latest_context) || r.ciphertext_manifest_digest!==work?.commit.client_verified_ciphertext_manifest_digest) fail('receipt_binding');
          for(const name of ['S','DSET','P','O','existing','verified_existing']) {
            if(r.set_digests?.[name]!==await protocol().hashJson(p.manifest[name])) fail('receipt_manifest');
          }
          if(analyzing){
            fields(r,['schema_version','purpose','operation_id','mutation_id','server_instance_id','owner_id','local_id','result','metadata_manifest_digest','set_digests','ciphertext_manifest_digest','origin_expectations_digest','committed_at']);
            fields(r.set_digests,['S','DSET','P','O','existing','verified_existing']);
            const expected=copy(p.response.metadata_header.base);expected.base.history_generation++;
            if(!eq(r.result,expected)||r.origin_expectations_digest!==await protocol().hashJson(p.manifest.O)
              ||typeof r.committed_at!=='string'||!Number.isFinite(Date.parse(r.committed_at)))fail('analysis_receipt');
          }
          if(importing) {
            const expected=copy(p.response.metadata_header.base);
            if(p.manifest.DSET.length) {
              expected.base.head_version++;expected.base.history_generation++;
              if(!expected.base.current_exists) expected.base.identity_state='branch_only';
            }
            if(!eq(r.result,expected) || r.origin_expectations_digest!==await protocol().hashJson(p.manifest.O)
              || work?.commit.client_verified_existing_set_digest!==await protocol().hashJson(p.manifest.verified_existing)) fail('import_receipt');
          }
        } else {
        if (response.receipt_matches_current !== true) fail('committed_not_current');
        const now = response.current_context;
        if (!now || now.server_instance_id !== s.instance) fail('current_context');
        if (p.version === 3) {
          const actual = Object.fromEntries(['base','current_mode','selected_physical_note_id','mixed_metadata_version'].map(k => [k,now[k]]));
          if (!eq(actual,r.result) || now.active_operation_id !== null) fail('current_context');
        } else {
          for (const f of ['crypto_epoch','head_version','head_revision_id','history_generation','identity_state','current_exists','protection_state','inventory_revision_ids']) {
            if (!eq(now[f],r[f])) fail('current_context');
          }
          if (now.active_transition_id !== null) fail('current_context');
        }
        }
        const received = []; let cursor = null, context = null, digest = null;
        do {
          let q, path;
          if (p.version === 3) {
            if (!context) {
              const current = await request(s,'/api/v2/notes/mixed-representations/context','GET',access(s,3));
              context = current.context; digest = current.catalog_digest;
              if (current.server_instance_id !== s.instance || !eq(context,r.result)) fail('current_context');
            }
            const encoded = new TextEncoder().encode(protocol().canonicalJson(context)); let binary = '';
            for (const b of encoded) binary += String.fromCharCode(b);
            q = { ...access(s,3), expected_context:btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'), catalog_digest:digest, limit:500, ...(cursor ? {cursor} : {}) };
            path = '/api/v2/notes/mixed-representations/catalog';
          } else {
            q = { owner_id:s.owner,local_id:s.local_id,device_id:s.device,representation_schema:2,limit:500,
              ...(context || {}), ...(cursor ? {cursor} : {}) };
            path = '/api/v2/notes/representations';
          }
          const page = await request(s,path,'GET',q); received.push(page);
          if (!context) {
            for (const f of ['server_instance_id','crypto_epoch','head_version','head_revision_id','history_generation','identity_state','current_exists']) {
              if (!eq(page.context[f],r[f])) fail('current_context');
            }
            context = page.context; digest = page.catalog_digest;
          }
          cursor = page.next_cursor;
          if (cursor !== null && received.slice(0,-1).some(p => p.next_cursor === cursor)) fail('catalog_cursor');
        } while (cursor !== null);
        const actual = await protocol().verifyCatalog(received,{ schema_version:p.version === 3 ? 3 : 2,
          server_instance_id:s.instance, owner_id:s.owner,local_id:s.local_id,device_id:s.device,context,catalog_digest:digest });
        if(importing||analyzing) {
          if(actual.length!==p.manifest.P.length+p.manifest.DSET.length
            || p.manifest.P.some(old=>!actual.some(d=>eq(d,old)))) fail('import_published_preserved');
          for(const output of p.manifest.DSET) {
            const d=actual.find(d=>eq(d.key,output.destination_key)),o=p.manifest.O.find(o=>eq(o.destination_key,output.destination_key));
            if(!d || !o || !eq(Object.fromEntries(['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'].map(k=>[k,d[k]])),
              Object.fromEntries(['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'].map(k=>[k,o[k]])))) fail('import_published_origin');
          }
        }
        const destinations = p.version === 3 ? p.manifest.DSET : p.manifest.entries.map(e => ({ destination_key:e.destination_key,
          output_kind:e.output_kind,output_epoch:p.response.target_epoch,is_null:false,expected_binding:e.expected_binding }));
        for (const output of destinations) {
          const d = actual.find(d => eq(d.key,output.destination_key));
          if (!d || d.representation_kind !== output.output_kind || d.representation_epoch !== output.output_epoch || d.is_null !== output.is_null
            || !eq(d.expected_binding,output.expected_binding)) fail('published_representation_changed');
          if (p.version === 3 && d.storage_operation_id !== p.id) fail('published_origin_changed');
          const t = work?.transfers.find(t => eq(t.key,d.key));
          if (!output.is_null && output.output_epoch > 0 && (!t || d.ciphertext_sha256 !== t.descriptor.ciphertext_sha256)) fail('published_cipher_changed');
        }
      }
      // Mutation wires have latest_context, not the conversion receipt_matches_current field.
      // This internal flag is emitted only after the original receipt and fresh publication checks.
      return mutation && response.state==='committed' ? {...response,receipt_matches_current:true} : response;
    }
    const transport = {
      async prepareAnalysis(s,intent,execution,catalog,probeOnly=false) {
        s=copy(s);validateScope(s);const i=copy(intent),e=copy(execution),c=copy(catalog),Q=protocol(),A=globalThis.NowNoteProtectionAnalysis;
        const body=i.prepare;ensureScope(s,body);
        if(i.purpose!=='mixed_analysis_write'||body.schema_version!==3)fail('analysis_prepare_schema');
        fields(i,['purpose','prepare','transfers']);fields(body,['schema_version','owner_id','local_id','device_id','server_instance_id','mutation_id','base','expected_catalog_digest','execution_ref','bundle_metadata']);
        Q.validateContext(body.base);
        if(e.state!=='client_settled'||!['done','failed'].includes(e.terminal_receipt?.outcome)||!eq(body.bundle_metadata,e.bundle_metadata)
          ||!eq(body.base,c.context)||body.expected_catalog_digest!==c.catalog_digest
          ||!eq(e.source_context,{server_instance_id:s.instance,base:body.base,catalog_digest:body.expected_catalog_digest}))fail('analysis_original_execution');
        await A.validateBundle(e,body.bundle_metadata);
        const reference={schema_version:3,execution_id:e.execution_id,terminal_run_version:e.terminal_receipt.terminal_run_version,
          terminal_receipt_digest:await Q.hashJson(e.terminal_receipt),original_bundle_digest:e.bundle_metadata.bundle_digest};
        if(!eq(body.execution_ref,reference))fail('analysis_original_execution');
        const original={reference:copy(body.execution_ref),source_schema_version:3,source_context:copy(e.source_context),terminal_receipt:copy(e.terminal_receipt),bundle_metadata:copy(e.bundle_metadata)};
        const path='/api/v2/notes/mixed-analysis-writes';let r;
        try{
          const known=await request(s,path+'/status','GET',{...access(s,3),operation_id:e.execution_id});
          fields(known,['schema_version','status','operation','original_execution']);
          if(known.schema_version!==3||known.status!=='operation'||!eq(known.original_execution,original))fail('analysis_original_execution');
          r=known.operation;
        }catch(error){if(error.status!==404||error.code!=='operation_not_found')throw error;}
        if(!r&&probeOnly===true)return null;
        if(!r)r=await request(s,path+'/prepare','POST',copy(body));
        fields(r,['schema_version','purpose','operation_id','mutation_id','state','lease_version','expires_at','metadata_manifest_digest','metadata_header','counts','receipt','latest_context']);
        if(r.schema_version!==3||r.purpose!==i.purpose||r.operation_id!==e.execution_id||r.mutation_id!==body.mutation_id
          ||!Number.isSafeInteger(r.lease_version)||r.lease_version<1||typeof r.expires_at!=='string'||!Number.isFinite(Date.parse(r.expires_at))
          ||!['prepared','uploading','committed','stale','aborted','expired'].includes(r.state))fail('analysis_operation_identity');
        Q.validateContext(r.latest_context);
        const p={version:3,path,id:r.operation_id,operation_id:r.operation_id,digest:r.metadata_manifest_digest,response:r,original_execution:original};
        const m=p.manifest=await pages(s,p),verified=await A.validateInitialWriteManifest(s,i,e,c,{...r.metadata_header,...m});
        if(verified.metadata_manifest_digest!==p.digest||!eq(verified.counts,r.counts))fail('analysis_manifest_metadata');
        return p;
      },
      async replanAnalysis(s,intent,catalog,known=null) {
        s=copy(s);validateScope(s);const i=copy(intent),c=copy(catalog),saved=copy(known),Q=protocol(),A=globalThis.NowNoteProtectionAnalysis;
        await A.validateReplanWritePlan(s,i,c);
        const body=i.prepare,e=i.original.execution,path='/api/v2/notes/mixed-analysis-writes';
        const original={reference:copy(body.execution_ref),source_schema_version:3,source_context:copy(e.source_context),terminal_receipt:copy(e.terminal_receipt),bundle_metadata:copy(e.bundle_metadata)};
        if(saved){
          if(saved.version!==3||saved.path!==path||saved.id!==saved.response?.operation_id||saved.response.mutation_id!==body.mutation_id||!eq(saved.original_execution,original))fail('analysis_operation_identity');
          const v=await A.validateReplanWriteManifest(s,i,c,{...saved.response.metadata_header,...saved.manifest});
          if(v.metadata_manifest_digest!==saved.digest||!eq(v.counts,saved.response.counts))fail('analysis_manifest_metadata');
        }
        // The allocation ID is unknown until the response: replay only the original immutable request.
        const wrapped=saved?await request(s,path+'/status','GET',{...access(s,3),operation_id:saved.id})
          :await request(s,path+'/replan','POST',copy(body));
        if(!saved&&wrapped?.status==='already_stored')return A.validateStoredAnalysisResult(s,i,c,wrapped);
        fields(wrapped,['schema_version','status','operation','original_execution']);
        if(wrapped.schema_version!==3||wrapped.status!==(saved?'operation':'prepared')||!eq(wrapped.original_execution,original))fail('analysis_original_execution');
        const r=wrapped.operation;
        fields(r,['schema_version','purpose','operation_id','mutation_id','state','lease_version','expires_at','metadata_manifest_digest','metadata_header','counts','receipt','latest_context']);
        if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(r.operation_id)||r.operation_id===e.execution_id
          ||r.schema_version!==3||r.purpose!==i.purpose||r.mutation_id!==body.mutation_id||saved&&(r.operation_id!==saved.id||r.metadata_manifest_digest!==saved.digest)
          ||!Number.isSafeInteger(r.lease_version)||r.lease_version<1||typeof r.expires_at!=='string'||!Number.isFinite(Date.parse(r.expires_at))
          ||!['prepared','uploading','committed','stale','aborted','expired'].includes(r.state))fail('analysis_operation_identity');
        Q.validateContext(r.latest_context);
        const p={version:3,path,id:r.operation_id,operation_id:r.operation_id,digest:r.metadata_manifest_digest,response:r,original_execution:original};
        p.manifest=await pages(s,p);
        const v=await A.validateReplanWriteManifest(s,i,c,{...r.metadata_header,...p.manifest});
        if(v.metadata_manifest_digest!==p.digest||!eq(v.counts,r.counts))fail('analysis_manifest_metadata');
        return p;
      },
      async prepareImport(s,intent) {
        s=copy(s);validateScope(s);
        const i=copy(intent), Q=protocol();
        if(i.schema_version!==3 || i.purpose!=='mixed_offline_import') fail('import_prepare_schema');
        fields(i.prepare,['mutation_id','base','expected_catalog_digest','entries']);
        Q.validateContext(i.prepare.base);Q.validateImportEntries(i.prepare.entries);
        if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(i.prepare.mutation_id)
          || !/^[0-9a-f]{64}$/.test(i.prepare.expected_catalog_digest)) fail('import_prepare');
        const entries=i.prepare.entries, epoch=i.prepare.base.base.crypto_epoch;
        if(!eq(entries.map(e=>e.revision_id),entries.map(e=>e.revision_id).sort())) fail('import_order');
        for(const e of entries) {
          const ip=e.provenance;
          if(ip.origin_owner_id!==s.owner || ip.origin_server_instance_id!==s.instance) fail('import_provenance_scope');
          if(!e.origin_device_id || e.origin_device_id.length>120
            || (ip.kind==='cipher_branch')!==(e.source_kind==='history_envelope_v1')
            || e.target_epoch!==(e.target_kind==='snapshot_v1'?0:epoch)) fail('import_provenance');
          if(!e.expected_existing && (ip.kind==='cipher_branch' && ip.origin_storage_operation_id!==null
            || ip.kind==='plain_branch' && ip.origin_revision_ref!==null
            || e.target_epoch===0 && (ip.kind!=='post_plain_draft' || i.prepare.base.current_mode!=='plain'))) fail('import_provenance');
        }
        const body={...access(s,3),...i.prepare}, path='/api/v2/notes/mixed-imports';
        const r=await request(s,path+'/prepare','POST',body), h=r.metadata_header;
        if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(r.operation_id)) fail('import_identity');
        fields(h,['schema_version','purpose','operation_id','server_instance_id','owner_id','local_id','actor_device_id','mutation_id','base',
          'source_catalog_digest','target_epoch','revision_ref','parent_ref','server_fields','control','operation_origin']);
        if(r.schema_version!==3 || r.purpose!==i.purpose || !h
          || h.schema_version!==3 || h.purpose!==i.purpose || h.operation_id!==r.operation_id
          || h.mutation_id!==body.mutation_id || r.mutation_id!==body.mutation_id
          || h.server_instance_id!==s.instance || h.owner_id!==s.owner || h.local_id!==s.local_id
          || h.actor_device_id!==s.device || !eq(h.base,body.base) || h.source_catalog_digest!==body.expected_catalog_digest
          || h.target_epoch!==epoch || h.revision_ref!==null || h.parent_ref!==null || h.server_fields!==null
          || !eq(h.control,{entries}) || !eq(h.operation_origin,{purpose:i.purpose,operation_id:r.operation_id,mutation_id:body.mutation_id,entries}))
          fail('import_identity_control');
        const p={version:3,path,id:r.operation_id,operation_id:r.operation_id,digest:r.metadata_manifest_digest,response:r};
        const m=p.manifest=await pages(s,p), source=m.S.map(e=>e.descriptor);
        const kinds=['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot',
          'recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
        const count=rows=>({total:rows.length,nonnull:rows.filter(e=>!e.is_null).length,nulls:rows.filter(e=>e.is_null).length,
          by_kind:kinds.map(kind=>{const part=rows.filter(e=>e.key.kind===kind);return {kind,total:part.length,nonnull:part.filter(e=>!e.is_null).length,nulls:part.filter(e=>e.is_null).length};})});
        const counts=Object.fromEntries(Object.entries(m).map(([name,list])=>[name,count(list.map(e=>['S','existing','verified_existing'].includes(name)
          ?e.descriptor:['DSET','O'].includes(name)?{...e,key:e.destination_key}:e))]));
        if(!eq(r.counts,counts)) fail('import_manifest_counts');
        if(!eq(m.P,source) || await Q.hashJson({server_instance_id:s.instance,owner_id:s.owner,local_id:s.local_id,context:body.base,entries:source})!==body.expected_catalog_digest)
          fail('import_catalog');
        const byKey=new Map(), refs=new Set(), batch=new Map(entries.map(e=>[e.revision_id,e]));
        const expectation=d=>({destination_key:d.key,...Object.fromEntries(['is_null','origin_validator','origin_row_required','storage_operation_id','semantic_origin_id'].map(k=>[k,d[k]]))});
        const expectedO=[], expectedExisting=[], expectedProof=[], expectedOutputs=[];
        for(const d of source) {
          Q.validateDescriptor(d,3);byKey.set(Q.canonicalJson(d.key),d);expectedO.push(expectation(d));
          if(['revision_snapshot','offline_snapshot'].includes(d.key.kind)) refs.add(Q.canonicalJson(d.revision_ref));
        }
        const done=new Set();
        for(const e of entries) {
          let node=e;const chain=new Set();
          while(node && !done.has(node.revision_id)) {
            if(chain.has(node.revision_id)) fail('import_parent_cycle');
            chain.add(node.revision_id);const parent=node.parent_ref;
            if(parent===null) break;
            if(parent.kind==='offline_branch' && batch.has(parent.id)) node=batch.get(parent.id);
            else {if(!refs.has(Q.canonicalJson(parent))) fail('import_parent');break;}
          }
          for(const id of chain) done.add(id);
          const key={kind:'offline_snapshot',id:e.revision_id,slot:'snapshot'}, old=byKey.get(Q.canonicalJson(key));
          if(old) {
            const ip=e.provenance;
            if(!eq(old,e.expected_existing) || old.is_null || !eq(old.parent_ref,e.parent_ref)
              || old.representation_kind!==e.source_kind || old.representation_epoch!==e.source_epoch
              || old.representation_kind!==e.target_kind || old.representation_epoch!==e.target_epoch
              || ip.kind==='cipher_branch' && ip.origin_storage_operation_id!==null && ip.origin_storage_operation_id!==old.storage_operation_id
              || ip.kind==='plain_branch' && ip.origin_revision_ref!==null && !eq(ip.origin_revision_ref,old.revision_ref)) fail('import_existing');
            expectedExisting.push({revision_id:e.revision_id,descriptor:old,comparison:old.representation_epoch===0?'plain_exact':'cipher_exact'});
            const v=m.verified_existing.find(v=>eq(v.key,key));
            if(!v || (old.representation_epoch>0
              ? !Number.isSafeInteger(v.total_bytes) || v.total_bytes<1 || v.total_chunks!==Math.ceil(v.total_bytes/262144)
              : v.total_bytes!==null || v.total_chunks!==null)) fail('import_existing_proof');
            expectedProof.push({key,revision_ref:{kind:'offline_branch',id:e.revision_id},parent_ref:e.parent_ref,
              origin_device_id:e.origin_device_id,descriptor:old,origin_expectation:expectation(old),total_bytes:v.total_bytes,
              total_chunks:v.total_chunks,expected_binding:old.expected_binding,ciphertext_sha256:old.ciphertext_sha256});
          } else {
            if(e.expected_existing!==null) fail('import_existing');
            const d=m.DSET.find(d=>eq(d.destination_key,key));
            if(!d) fail('import_destination');
            Q.validateDestination(d,i.purpose);
            const binding=e.target_epoch===0?null:{server_instance_id:s.instance,owner_id:s.owner,local_id:s.local_id,
              transition_id:p.id,crypto_epoch:e.target_epoch,destination_key:key,revision_ref:{kind:'offline_branch',id:e.revision_id},parent_ref:e.parent_ref};
            expectedOutputs.push({destination_key:key,source_keys:[],source_etag:d.source_etag,output_kind:e.target_kind,
              output_epoch:e.target_epoch,is_null:false,expected_binding:binding});
            expectedO.push({destination_key:key,is_null:false,origin_validator:'native_mixed_v1',origin_row_required:true,storage_operation_id:p.id,semantic_origin_id:p.id});
          }
        }
        const orderedO=Q.keyOrder(expectedO.map(e=>e.destination_key)).map(key=>expectedO.find(e=>eq(e.destination_key,key)));
        if(!eq(m.DSET,expectedOutputs) || !eq(m.O,orderedO) || !eq(m.existing,expectedExisting) || !eq(m.verified_existing,expectedProof)) fail('import_manifest_sets');
        return p;
      },
      async prepareWrite(s,intent) {
        s=copy(s);
        const i=copy(intent);
        if(i.schema_version!==3 || i.purpose!=='mixed_note_write') fail('prepare_schema');
        const body={...access(s,3),...i.prepare};ensureScope(s,body);
        const path='/api/v2/notes/mixed-writes',r=await request(s,path+'/quote','POST',body);
        const h=r.metadata_header;
        if(r.schema_version!==3 || r.purpose!==i.purpose || !r.operation_id || r.mutation_id!==body.mutation_id
          || h?.operation_id!==r.operation_id || h.mutation_id!==body.mutation_id || h.owner_id!==s.owner
          || h.local_id!==s.local_id || h.actor_device_id!==s.device || h.server_instance_id!==s.instance
          || !eq(h.base,body.base)) fail('operation_identity');
        const control=Object.fromEntries(['operation','selection','target_current_mode','replica_policy','structure','parent_context','restore_source'].map(k=>[k,body[k]]));
        if(!eq(h.control,control)) fail('write_control');
        const p={version:3,path,id:r.operation_id,operation_id:r.operation_id,digest:r.metadata_manifest_digest,response:r};
        p.manifest=await pages(s,p);
        if(p.manifest.existing.length || p.manifest.verified_existing.length) fail('write_existing');
        return p;
      },
      async identity(scope) {
        const r = await request(scope,'/api/v2/notes/crypto-transitions/status','GET',{ owner_id: scope.owner, local_id: scope.local_id, device_id: scope.device });
        if (r.server_instance_id !== scope.instance) fail('server_instance_changed'); return r;
      },
      async verifyEmptyLocal(s,intent) {
        const p = intent.prepare, d = intent.drain;
        if (intent.schema_version !== 2 || intent.purpose !== 'conversion' || !p || !d
          || p.crypto_epoch !== 0 || p.target_epoch !== 1 || !Array.isArray(p.local_branches) || p.local_branches.length
          || d.crypto_epoch !== 0 || d.expected_history_generation !== p.expected_history_generation) fail('server_only_conversion');
        const r = await transport.identity(s);
        if (r.crypto_epoch !== 0 || r.protection_state !== 'legacy' || r.identity_state !== 'related_only'
          || r.current_exists !== false || r.head_revision_id !== null || !Array.isArray(r.inventory_revision_ids) || r.inventory_revision_ids.length
          || !Number.isSafeInteger(r.head_version) || r.head_version < 0
          || !Number.isSafeInteger(r.history_generation) || r.history_generation < 0) fail('server_only_conversion');
        const mapping = {base_head_version:'head_version',base_revision_id:'head_revision_id',expected_history_generation:'history_generation',expected_inventory_revision_ids:'inventory_revision_ids'};
        if (Object.entries(mapping).some(([a,b]) => !eq(p[a],r[b]))) fail('context_changed');
        return true;
      },
      async drainPrepare(s,intent) {
        const body = { ...access(s,2), ...intent.drain }; ensureScope(s,body);
        if (body.schema_version !== 2) fail('drain_schema');
        return request(s,'/api/v2/notes/related-drains','POST',body);
      },
      drainStatus: (s,d) => request(s,'/api/v2/notes/related-drains/status','GET',{ owner_id: s.owner, local_id: s.local_id, device_id: s.device, server_instance_id: s.instance, drain_id: d.drain_id }),
      async fresh(s,intent,d) {
        if (intent.schema_version === 3) {
          const r = await request(s,'/api/v2/notes/mixed-representations/context','GET',access(s,3));
          if (r.server_instance_id !== s.instance || !eq(r.context,intent.prepare.base) || r.catalog_digest !== intent.prepare.expected_catalog_digest || !eq(r.context.base,d.ready_base)) fail('context_changed');
          return r;
        }
        if (intent.schema_version !== 2 || intent.purpose !== 'conversion') fail('prepare_schema');
        const r = await transport.identity(s), names = Object.keys(d.ready_base || {});
        if (!names.length || names.some(k => !eq(r[k],d.ready_base[k]))) fail('context_changed');
        const mapping = { crypto_epoch: 'crypto_epoch', base_head_version: 'head_version', base_revision_id: 'head_revision_id', expected_history_generation: 'history_generation', expected_inventory_revision_ids: 'inventory_revision_ids' };
        if (Object.entries(mapping).some(([a,b]) => !eq(intent.prepare[a],r[b]))) fail('context_changed');
        return r;
      },
      async prepare(s,intent,d,fresh) {
        const version = intent.schema_version, path = pathFor(intent.purpose);
        const body = { ...access(s,version), ...intent.prepare, ...(version === 2 ? { drain_id: d.drain_id, drain_version: d.drain_version, linked_metadata_version: 1 }
          : { drain_ref: { drain_id: d.drain_id, drain_version: d.drain_version } }) };
        ensureScope(s,body); if (body.schema_version !== version) fail('prepare_schema');
        if (version === 3 && (!eq(body.base,fresh.context) || body.expected_catalog_digest !== fresh.catalog_digest)) fail('context_changed');
        const r = await request(s,path + (version === 2 ? '' : intent.purpose === 'current_plain_transition' ? '/quote' : '/prepare'),'POST',body);
        const id = r.operation_id || r.transition_id;
        if (!id || r.server_instance_id && r.server_instance_id !== s.instance) fail('operation_identity');
        const promoted = await transport.drainStatus(s,d);
        if (promoted.state !== 'promoted' || promoted.transition_id !== id || promoted.drain_id !== d.drain_id || promoted.drain_version !== d.drain_version
          || !eq(promoted.accepted_runs,d.accepted_runs) || !eq(promoted.accepted_claims,d.accepted_claims)) fail('drain_not_promoted');
        const p = { version, path, id, operation_id: id, digest: r.metadata_manifest_digest, response: r, promoted: true };
        p.manifest = await pages(s,p); return p;
      },
      async readSources(s,p,password,localStores = [],resolveKey,sourceOrigins = []) {
        const importing=p.response.purpose==='mixed_offline_import';
        if(importing) {s=copy(s);p=copy(p);sourceOrigins=copy(sourceOrigins);}
        const fixed = await pages(s,p);
        if (!eq(fixed,p.manifest)) fail('manifest_changed');
        const meaning = new Map(), resolve = resolveKey || keyResolver || (async () => password);
        const semanticEq = (a,b) => protocol().canonicalJson(a) === protocol().canonicalJson(b);
        const restore=p.response.metadata_header?.purpose==='mixed_note_write' ? p.response.metadata_header.control.restore_source : null;
        const sourceKeys = importing ? fixed.verified_existing.map(v=>v.key) : p.version === 3 ? protocol().keyOrder([...fixed.DSET.flatMap(d => d.source_keys),...(restore?[restore.descriptor.key]:[])].filter((k,i,a) => a.findIndex(x => eq(x,k)) === i)) : fixed.entries.map(d => d.key);
        for (const k of sourceKeys) {
          const source = p.version === 3 ? fixed.S.find(e => eq(e.descriptor.key,k)) : fixed.entries.find(e => eq(e.key,k));
          if (!source || k.kind === 'reserved_offline_snapshot') {
            const revisions = localStores.flatMap(store => store.patches).filter(patch => patch.type === 'journal').flatMap(patch => patch.before.revisions || []);
            const original = revisions.find(r => r.revision_id === k.id);
            if (!original || !original.snapshot || original.snapshot.note.owner_id !== s.owner || original.snapshot.note.local_id !== s.local_id) fail('local_branch_source_missing');
            if (revisions.some(r=>r.revision_id===k.id && (!eq(r.snapshot,original.snapshot) || !eq(r.parent_ref,original.parent_ref)))) fail('local_branch_source_conflict');
            const snapshot=copy(protocol().validateSnapshot(original.snapshot));
            if (snapshot.note.content.startsWith('NOW_ENCRYPTED_V1:')) {
              const reservation=p.response.metadata_header?.reserved_branches?.find(r=>r.revision_id===k.id);
              snapshot.note.content=await protocol().decryptContent(snapshot.note.content,await resolve({key:k,
                representation_epoch:reservation?.source_representation_epoch ?? 'local-body:'+k.id,output:false}));
              protocol().validateSnapshot(snapshot);
            }
            meaning.set(json(k),snapshot); continue;
          }
          let raw;
          if (p.version === 2) {
            const r = await request(s,p.path + '/source','GET',{ ...query(s,p), source_schema: 2, metadata_manifest_digest: p.digest,
              kind: k.kind, representation_id: k.id, slot: k.slot, source_etag: source.source_etag });
            if (!eq(r.entry,source) || r.metadata_manifest_digest !== p.digest || !eq(r.metadata_context,p.response.metadata_context)) fail('source_changed');
            raw = r.value;
          } else {
            const bytes = []; let index = 0, total = null, size = null;
            const proof=importing?fixed.verified_existing.find(v=>eq(v.key,k)):null;
            do {
              const r = await request(s,p.path + '/source','GET',{ ...query(s,p), metadata_manifest_digest: p.digest, kind: k.kind,
                representation_id: k.id, slot: k.slot, source_etag: source.source_etag, chunk_index: index });
              if (!eq(r.descriptor,source.descriptor) || r.operation_id !== p.id || !eq(r.entry_key,k)
                || r.source_etag !== source.source_etag || r.metadata_manifest_digest !== p.digest) fail('source_changed');
              if (index === 0) { total = r.total_chunks; size = r.total_bytes; }
              if (r.total_chunks !== total || r.total_bytes !== size || !Number.isSafeInteger(total) || total < 0) fail('source_chunks');
              if(importing && (r.schema_version!==3 || !Number.isSafeInteger(size) || size<1 || total!==Math.ceil(size/262144)
                || source.descriptor.representation_epoch>0 && (size!==proof.total_bytes || total!==proof.total_chunks))) fail('import_source_framing');
              if (source.descriptor.is_null) {
                if (total !== 0 || size !== 0 || r.chunk_index !== null || r.data_base64 !== null) fail('source_null');
                raw = null; break;
              }
              if (r.chunk_index !== index || total < 1 || typeof r.data_base64 !== 'string') fail('source_chunks');
              const chunk=atob(r.data_base64);
              if(importing && (btoa(chunk)!==r.data_base64 || chunk.length!==Math.min(262144,size-index*262144))) fail('import_source_chunk');
              for (const c of chunk) bytes.push(c.charCodeAt(0));
              index++;
            } while (index < total);
            if (raw !== null) {
              if (bytes.length !== size) fail('source_length');
              raw = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new Uint8Array(bytes));
            }
          }
          const supplied = sourceOrigins.find(e => eq(e.key,k));
          let d, expected;
          if (p.version === 3) { d = source.descriptor; expected = supplied?.origin || { value: null, legacy: null }; }
          else {
            if (k.kind === 'note_body' && source.source_kind === 'content_v1') {
              if (typeof raw !== 'string') fail('source_body');
              meaning.set(json(k),raw.startsWith('NOW_ENCRYPTED_V1:')
                ? await protocol().decryptContent(raw,await resolve({ key:k,representation_epoch:source.representation_epoch })) : raw);
              continue;
            }
            const cipher = source.representation_epoch > 0, envelope = cipher && k.kind !== 'note_body' ? protocol().parseJson(raw) : null;
            const binding = envelope?.binding || null;
            if (binding && (binding.owner_id !== s.owner || binding.local_id !== s.local_id || binding.server_instance_id !== s.instance
              || binding.crypto_epoch !== source.representation_epoch || !eq(binding.destination_key,k)
              || !eq(binding.revision_ref,source.expected_binding.revision_ref) || !eq(binding.parent_ref,source.expected_binding.parent_ref))) fail('source_binding');
            d = { key: k, representation_kind: source.source_kind, representation_epoch: source.representation_epoch,
              representation_etag: await protocol().hashJson([k,source.source_etag]), is_null: raw === null,
              total_bytes: raw === null ? 0 : new TextEncoder().encode(raw).length,
              total_chunks: raw === null ? 0 : Math.ceil(new TextEncoder().encode(raw).length/262144),
              ciphertext_sha256: cipher && raw !== null ? await protocol().sha256(raw) : null, expected_binding: binding,
              revision_ref: binding?.revision_ref || null, parent_ref: binding?.parent_ref || null, physical_note_id: null, inventory_revision_id: null,
              operation_origin: source.operation_origin, ...(source.slot_version !== null ? { slot_version: source.slot_version } : {}) };
            expected = supplied?.origin || { value: source.operation_origin, legacy: null };
          }
          const value=await protocol().decryptRepresentation(raw,d,expected,resolve,p.version === 3 ? 3 : 2);
          if(importing) {
            protocol().validateSnapshot(value);
            if(value.note.owner_id!==s.owner || value.note.local_id!==s.local_id) fail('import_source_scope');
          }
          meaning.set(json(k),value);
        }
        return [...meaning].map(([key,value]) => ({key:JSON.parse(key),value}));
      },
      async stage(s,p,work,password,localStores = [],resolveKey,analysisOriginalPassword) {
        const importing=p.response.purpose==='mixed_offline_import',analyzing=p.response.purpose==='mixed_analysis_write';
        if(importing||analyzing) {s=copy(s);p=copy(p);work=copy(work);}
        const fixed = await pages(s,p);
        if (!eq(fixed,p.manifest) || !Array.isArray(work.transfers)) fail('manifest_changed');
        const destinations = p.version === 3 ? fixed.DSET.filter(d => !d.is_null && d.output_epoch > 0) : fixed.entries;
        if (!eq(protocol().keyOrder(work.transfers.map(t => t.key)),work.transfers.map(t => t.key)) || work.transfers.length !== destinations.length) fail('cipher_set');
        const meaning = new Map((await transport.readSources(s,p,password,localStores,resolveKey,work.source_origins || [])).map(v=>[json(v.key),v.value]));
        const semanticEq = (a,b) => protocol().canonicalJson(a) === protocol().canonicalJson(b);
        const resolve = resolveKey || keyResolver || (async () => password);
        let initialMeaning=null;
        if(analyzing){
          const A=globalThis.NowNoteProtectionAnalysis;
          if(p.response.metadata_header.control.request_type==='replan'){
            const a=work.replanned_analysis;fields(a,['plan','catalog']);
            await A.verifyReplanWriteWork(s,a.plan,p,a.catalog,work,analysisOriginalPassword,password);
            const o=a.plan.original;initialMeaning=await A.openTerminalBundle(o.scope,o.request,o.execution,o.work,analysisOriginalPassword);
          }else{
            const a=work.initial_analysis;fields(a,['request','execution','work','plan','catalog']);
            const verified=await A.validateInitialWriteManifest(s,a.plan,a.execution,a.catalog,{...p.response.metadata_header,...fixed});
            if(verified.metadata_manifest_digest!==p.digest||!eq(verified.counts,p.response.counts))fail('analysis_manifest_metadata');
            initialMeaning=await A.openTerminalBundle(s,a.request,a.execution,a.work,password);
            if(!eq(work.transfers.map(t=>({key:t.key,raw:t.raw})),a.work.transfers)||!eq(a.plan.transfers,a.work.transfers))fail('analysis_original_cipher');
          }
        }
        const writing=p.response.metadata_header?.purpose==='mixed_note_write';
        const imported=new Map();
        if(importing) {
          const entries=p.response.metadata_header.control.entries,branches=work.branches;
          if(!Array.isArray(branches) || !eq(branches.map(r=>r.revision_id),entries.map(e=>e.revision_id))) fail('import_branch_set');
          for(let n=0;n<entries.length;n++) {
            const e=entries[n],r=branches[n],value=protocol().validateSnapshot(r.snapshot);
            fields(r,['revision_id','parent_ref','origin_device_id','snapshot','representation']);
            if(!eq(r.parent_ref,e.parent_ref) || r.origin_device_id!==e.origin_device_id || value.note.owner_id!==s.owner || value.note.local_id!==s.local_id)
              fail('import_branch');
            if(e.source_epoch>0) {
              const rep=r.representation,key={kind:'offline_snapshot',id:e.revision_id,slot:'snapshot'};
              if(!rep) fail('import_cipher_source');fields(rep,['descriptor','raw','origin']);
              const d=protocol().validateDescriptor(rep.descriptor,3);
              if(!eq(d.key,key) || d.is_null || d.representation_kind!==e.source_kind || d.representation_epoch!==e.source_epoch
                || !eq(d.parent_ref,e.parent_ref) || !eq(d.revision_ref,{kind:'offline_branch',id:e.revision_id})
                || d.expected_binding?.server_instance_id!==s.instance) fail('import_cipher_source');
              const original=await protocol().decryptRepresentation(rep.raw,d,rep.origin,resolve,3);
              if(!semanticEq(original,value)) fail('import_cipher_meaning');
            } else if(r.representation!==null) fail('import_plain_source');
            imported.set(e.revision_id,value);
          }
          for(const old of fixed.existing) {
            if(!semanticEq(meaning.get(json(old.descriptor.key)),imported.get(old.revision_id))) fail('import_existing_meaning');
          }
          const plain=entries.filter(e=>e.target_epoch===0).map(e=>({revision_id:e.revision_id,snapshot:imported.get(e.revision_id).note}));
          const cipher=[];
          for(const v of fixed.verified_existing.filter(v=>v.descriptor.representation_epoch>0)) {
            const rep=branches.find(r=>r.revision_id===v.key.id)?.representation;
            const hash=rep && typeof rep.raw==='string' && await protocol().sha256(rep.raw);
            if(!rep || hash!==v.ciphertext_sha256 || new TextEncoder().encode(rep.raw).length!==v.total_bytes) fail('import_existing_cipher');
            cipher.push({revision_id:v.key.id,ciphertext_sha256:hash});
          }
          if(work.commit.client_verified_existing_set_digest!==await protocol().hashJson(fixed.verified_existing)
            || !semanticEq(work.commit.plain_entries,plain) || !semanticEq(work.commit.existing_ciphertexts,cipher)) fail('import_commit');
        }
        let after=null;
        if(writing) {
          const h=p.response.metadata_header,c=h.control;
          after=protocol().validateSnapshot(copy(work.after));
          if(after.note.owner_id!==s.owner || after.note.local_id!==s.local_id
            || Object.entries({...h.server_fields,...work.commit.projection}).some(([k,v])=>!semanticEq(after.note[k],v))
            || Object.entries(c.structure).some(([k,v])=>!semanticEq(after.note[k],v))) fail('write_meaning');
          const d=fixed.DSET.find(d=>d.destination_key.kind==='revision_before');
          const before=d.is_null?null:meaning.get(json(d.source_keys[0]));
          if(!semanticEq(work.commit.plain_after,c.target_current_mode==='plain'?after.note:null)
            || !semanticEq(work.commit.plain_before,!d.is_null&&d.output_epoch===0?before?.note:null)) fail('write_plain_meaning');
          const fields=['content','title','tags','source','note_type','parent_local_id','level'];
          if(c.operation==='delete' && (!before || after.note.deleted_at===null || fields.some(k=>!semanticEq(after.note[k],before.note[k])))) fail('delete_meaning');
          if(c.operation==='restore') {
            const original=meaning.get(json(c.restore_source.descriptor.key));
            if(!original || [...fields,'deleted_at'].some(k=>!semanticEq(after.note[k],original.note[k]))) fail('restore_meaning');
          }
        }
        if (p.response.metadata_header?.purpose === 'current_plain_transition') {
          const sources = fixed.S.map(e => e.descriptor), selected = p.response.metadata_header.selection.physical_note_id;
          const body = sources.find(d => d.key.kind === 'note_body' && d.key.id === String(selected));
          const inv = sources.find(d => d.key.kind === 'inventory_snapshot' && d.key.id === String(selected));
          if (!body || !inv) fail('selected_source_missing');
          const note = copy(meaning.get(json(inv.key))?.note), content = meaning.get(json(body.key));
          if (!note || note.content !== content) fail('current_meaning_mismatch');
          Object.assign(note,p.response.metadata_header.server_fields);
          if (!semanticEq(note,work.commit.plain_current)) fail('plain_current_meaning');
        }
        const records = [];
        for (const d of destinations) {
          const key = d.destination_key, entry = p.version === 3 ? key : d.key;
          const t = work.transfers.find(t => eq(t.key,key)); if (!t || typeof t.raw !== 'string') fail('cipher_missing');
          const epoch = p.version === 3 ? d.output_epoch : p.response.target_epoch;
          if (t.descriptor.representation_kind !== d.output_kind || t.descriptor.representation_epoch !== epoch
            || !eq(t.descriptor.key,key) || !eq(t.descriptor.expected_binding,d.expected_binding)) fail('output_binding');
          const outputKey = descriptor => resolve({...descriptor,output:p.response.metadata_header?.purpose !== 'current_plain_transition' && !(writing && key.kind==='revision_before')});
          const plain = await protocol().decryptRepresentation(t.raw,t.descriptor,t.origin,outputKey,3);
          const keys = p.version === 3 ? d.source_keys : [d.key];
          const expected=analyzing ? initialMeaning[key.slot] : importing ? imported.get(key.id) : writing && key.kind!=='revision_before' ? key.kind==='note_body'?after.note.content:after
            : keys.length===1 && meaning.has(json(keys[0])) ? meaning.get(json(keys[0])) : undefined;
          if (expected===undefined || !semanticEq(plain,expected) || !semanticEq(plain,t.semantic)) fail('output_semantic');
          const data = new TextEncoder().encode(t.raw), hash = await protocol().sha256(data), total = Math.ceil(data.length / 262144);
          const core = { ...(p.version === 2 ? { schema_version: 1, owner_id:s.owner,local_id:s.local_id,device_id:s.device,transition_id:p.id }
            : { ...access(s,3), operation_id: p.id, metadata_manifest_digest: p.digest }),
            entry_key: entry, source_etag: d.source_etag, target_epoch: epoch, total_chunks: total, total_bytes: data.length };
          for (let i=0;i<total;i++) {
            const chunk = data.slice(i*262144,(i+1)*262144); let binary = '';
            for (let n=0;n<chunk.length;n+=0x8000) binary += String.fromCharCode(...chunk.subarray(n,n+0x8000));
            const r = await request(s,p.path + '/chunks','PUT',{ ...core, chunk_index: i, chunk_sha256: await protocol().sha256(chunk), data_base64: btoa(binary) });
            if (r.chunk_index !== i || (p.version === 3 ? r.source_etag !== d.source_etag
              : r.transition_id !== p.id || !eq(r.entry_key,entry) || r.chunk_sha256 !== await protocol().sha256(chunk))) fail('chunk_receipt');
          }
          const sealed = await request(s,p.path + '/entries/seal','POST',{ ...core, ciphertext_sha256: hash });
          if (sealed.ciphertext_sha256 !== hash || sealed.sealed !== true) fail('seal_receipt');
          const downloaded = [];
          for (let i=0;i<total;i++) {
            const r = await request(s,p.path + '/staged','GET',{ ...query(s,p), kind: entry.kind, representation_id: entry.id, slot: entry.slot,
              source_etag: d.source_etag, target_epoch: epoch, chunk_index: i, ...(p.version === 2 ? { read_schema: 2 } : {}), metadata_manifest_digest: p.digest });
            if (r.chunk_index !== i || r.total_chunks !== total || r.total_bytes !== data.length || r.ciphertext_sha256 !== hash || r.source_etag !== d.source_etag) fail('staged_metadata');
            const bytes = Uint8Array.from(atob(r.data_base64),c => c.charCodeAt(0)); downloaded.push(...bytes);
          }
          const readback = new Uint8Array(downloaded);
          if (await protocol().sha256(readback) !== hash || new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(readback) !== t.raw) fail('staged_bytes');
          const actual = await protocol().decryptRepresentation(t.raw,t.descriptor,t.origin,outputKey,3);
          if (!semanticEq(actual,t.semantic)) fail('staged_semantic');
          records.push({ entry_key: entry, destination_key: key, source_etag: d.source_etag, output_kind: d.output_kind, target_epoch: epoch, total_bytes: data.length, ciphertext_sha256: hash });
        }
        const digest = await protocol().hashJson(records);
        if (work.commit.client_verified_ciphertext_manifest_digest !== digest || work.commit.metadata_manifest_digest !== p.digest
          || (p.version === 3 ? work.commit.client_decryption_verified !== true : Object.hasOwn(work.commit,'client_decryption_verified'))) fail('commit_manifest');
        return { verified: true };
      },
      async status(s,p,work) { return normalized(s,p,await request(s,p.path + '/status','GET',query(s,p)),work); },
      async commit(s,p,work) {
        ensureScope(s,work.commit);
        if (work.commit.schema_version !== p.version || (work.commit.operation_id || work.commit.transition_id) !== p.id || work.commit.metadata_manifest_digest !== p.digest) fail('commit_identity');
        return normalized(s,p,await request(s,p.path + '/commit','POST',copy(work.commit)),work);
      },
    };
    return transport;
  }
  globalThis.NowNoteProtectionState = Object.freeze({ create,createWrite,createImport,createRemote,inventory,validateScope,validateMarker,protectedRecord,scopeKey });
})();
