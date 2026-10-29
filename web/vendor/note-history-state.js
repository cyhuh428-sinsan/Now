/* Note history journal. Display projections and authentication are not persisted. */
(() => {
  'use strict';
  const copy = value => structuredClone(value);
  const key = ctx => JSON.stringify([String(ctx.url || '').replace(/\/+$/, ''), String(ctx.owner || '')]);
  const meaningFields = ['note_type', 'title', 'content', 'parent_local_id', 'level', 'tags', 'source', 'deleted_at'];
  const meaning = note => Object.fromEntries(meaningFields.map(field => [field, note[field] ?? (field === 'level' ? 1 : null)]));
  const same = (a, b) => JSON.stringify(meaning(a)) === JSON.stringify(meaning(b));
  const uuid = () => crypto.randomUUID();
  const emptyBase = () => ({ head_version: 0, head_revision_id: null, inventory_revision_ids: [], crypto_epoch: 0, replica_count: 0 });
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  function create({ initial, context, request, write, change = () => {} }) {
    let data = initial == null ? { schema_version: 1, contexts: {} } : copy(initial);
    let generation = 0, failed = null, writes = Promise.resolve(), running = null;
    const readable = () => data?.schema_version === 1 && record(data.contexts)
      && Object.values(data.contexts).every(c => record(c) && record(c.notes) && Object.values(c.notes).every(item =>
        record(item) && record(item.raw) && record(item.draft) && record(item.base)
        && Array.isArray(item.base.inventory_revision_ids) && Array.isArray(item.revisions)
        && item.revisions.every(r => record(r) && record(r.snapshot) && record(r.snapshot.note))
        && Array.isArray(item.outbox) && item.outbox.every(op => record(op) && record(op.body)) && Array.isArray(item.receipts)));
    const requireWritable = () => {
      if (!readable()) throw new Error('지원하지 않는 이력 형식입니다. 원본을 보존했습니다.');
      const ctx = context();
      if (!ctx.enabled || !ctx.owner) throw new Error('본인 계정으로 다시 인증하세요.');
      return ctx;
    };
    const bucket = (ctx, createBucket = false) => {
      if (!readable()) return null;
      if (createBucket) data.contexts[key(ctx)] ||= { notes: {} };
      return data.contexts[key(ctx)] || null;
    };
    const save = () => {
      const snapshot = copy(data);
      writes = writes.catch(() => {}).then(() => write(snapshot));
      return writes.then(() => { failed = null; change(); }, error => { failed = error; change(); throw error; });
    };
    const entry = id => bucket(context())?.notes[id] || null;
    const active = (ctx, epoch) => epoch === generation && context().enabled && key(context()) === key(ctx) && context().auth === ctx.auth;
    const common = (ctx, id, base) => ({ schema_version: 1, owner_id: ctx.owner, local_id: id,
      device_id: ctx.device, mutation_id: uuid(), crypto_epoch: base.crypto_epoch || 0 });
    const baseFields = base => ({ base_head_version: base.head_version, base_revision_id: base.head_revision_id,
      expected_inventory_revision_ids: copy(base.inventory_revision_ids),
      ...(base.replica_count > 1 ? { replica_policy: 'selected_head_only' } : {}) });
    const fromReceipt = (receipt, base) => ({ ...base, head_version: receipt.result_head_version,
      head_revision_id: receipt.result_revision_id, inventory_revision_ids: copy(receipt.result_inventory_revision_ids),
      crypto_epoch: receipt.crypto_epoch, history_generation: receipt.history_generation,
      replica_count: receipt.result_inventory_revision_ids.length });
    async function track(note, current, { localOnly = false, needsBaseline = false, original = null } = {}) {
      const ctx = requireWritable();
      if (note.owner_id !== ctx.owner) throw new Error('이력 소유자가 현재 계정과 다릅니다.');
      const c = bucket(ctx, true);
      if (c.notes[note.local_id]) return;
      c.notes[note.local_id] = { raw: copy(current?.snapshot?.note || original || note), draft: copy(note),
        base: copy(current || emptyBase()), revisions: [], outbox: [], receipts: [], conflict: null,
        dirty: !current, localOnly, needsBaseline, replicaSelected: (current?.replica_count || 0) < 2 };
      await save();
    }
    async function bindBaseline(id, current) {
      requireWritable(); const item = entry(id);
      if (!item || !item.needsBaseline) return;
      if (item.outbox.some(op => op.sent)) throw new Error('전송한 요청의 기준은 바꿀 수 없습니다.');
      if (current?.snapshot && !same(item.raw, current.snapshot.note)) item.conflict = {
        code: 'baseline_selection_required', local: copy(item.draft), remote: copy(current), base: copy(item.base),
      };
      item.base = copy(current || emptyBase());
      if (current?.snapshot) item.raw = copy(current.snapshot.note);
      item.needsBaseline = false;
      item.replicaSelected = (current?.replica_count || 0) < 2;
      const first = item.outbox[0];
      if (first && !first.sent && !first.waiting_for) first.body = { ...first.body, ...baseFields(item.base), crypto_epoch: item.base.crypto_epoch };
      await save();
    }
    async function edit(note) {
      const ctx = requireWritable(), item = entry(note.local_id);
      if (!item || note.owner_id !== ctx.owner) throw new Error('메모 이력 기준을 먼저 확인하세요.');
      item.draft = copy(note);
      item.dirty = !same(item.raw, note) || item.outbox.length > 0 || (!item.revisions.length && !item.base.head_revision_id);
      await save();
    }
    async function seal(id, reason = 'edit') {
      const ctx = requireWritable(), item = entry(id);
      if (!item || !item.dirty) return;
      const last = item.revisions.at(-1);
      if (last && same(last.snapshot.note, item.draft)
        && (item.localOnly || item.outbox.some(op => op.revision_id === last.revision_id))) return;
      const revision = { revision_id: uuid(), parent_ref: last ? { kind: 'offline_branch', id: last.revision_id }
        : item.base.head_revision_id ? { kind: 'note_revision', id: item.base.head_revision_id } : null,
        snapshot: { schema_version: 1, note: copy(item.draft) }, reason, created_at: new Date().toISOString(), imported: false };
      item.revisions.push(revision);
      const previous = item.outbox.at(-1);
      item.outbox.push({ id: uuid(), revision_id: revision.revision_id, sent: false, operation: 'put',
        body: { ...common(ctx, id, item.base), ...baseFields(item.base), note: meaning(item.draft) },
        waiting_for: previous?.body.mutation_id || null });
      await save();
    }
    async function sync() {
      if (running) return running;
      if (!context().enabled || context().online === false || !readable() || failed) return;
      const ctx = { ...context() }, epoch = generation;
      running = (async () => {
        for (const [id, item] of Object.entries(bucket(ctx)?.notes || {})) {
          if (!active(ctx, epoch) || failed) return;
          if (item.needsBaseline) {
            try {
              let current = null;
              try { current = await request(ctx, 'current', 'GET', { local_id: id }); }
              catch (error) { if (error.status !== 404) throw error; }
              if (!active(ctx, epoch)) return;
              await bindBaseline(id, current);
            } catch (error) {
              if (!active(ctx, epoch)) return;
              item.error = { code: error.code || 'baseline_unavailable', message: error.message }; await save(); continue;
            }
          }
          if (item.conflict || !item.replicaSelected || item.localOnly) continue;
          try { await importPending(id); }
          catch (error) {
            if (!active(ctx, epoch)) return;
            item.error = { code: error.code || 'import_failed', message: error.message };
            if (error.status === 409 || error.status === 423) item.conflict = { code: error.code, local: copy(item.draft), remote: null };
            await save(); continue;
          }
          while (item.outbox.length) {
            if (!active(ctx, epoch) || failed) return;
            const op = item.outbox[0];
            if (op.waiting_for) break;
            op.sent = true;
            await save();
            if (!active(ctx, epoch) || failed) return;
            let receipt;
            try {
              receipt = await request(ctx, op.operation === 'restore' ? 'restore' : 'current', op.operation === 'restore' ? 'POST' : 'PUT', copy(op.body));
              if (!active(ctx, epoch)) return;
              if (receipt.mutation_id !== op.body.mutation_id || !Array.isArray(receipt.result_inventory_revision_ids)) throw new Error('이력 저장 응답이 요청과 다릅니다.');
              item.receipts.push(copy(receipt));
              item.base = fromReceipt(receipt, item.base);
              const revision = item.revisions.find(r => r.revision_id === op.revision_id);
              if (revision) {
                revision.server_ref = { kind: 'note_revision', id: receipt.result_revision_id };
                item.raw = copy(revision.snapshot.note);
              }
              if (op.restored_snapshot) {
                item.raw = copy(op.restored_snapshot.note);
                if (same(item.draft, op.previous_draft)) item.draft = copy(item.raw);
              }
              item.completed_outbox ||= [];
              item.completed_outbox.push(copy(op));
              item.outbox.shift();
              const next = item.outbox[0];
              if (next?.waiting_for === op.body.mutation_id && !next.sent) {
                next.body = { ...next.body, ...baseFields(item.base), crypto_epoch: item.base.crypto_epoch };
                next.waiting_for = null;
              }
              item.dirty = !same(item.draft, item.raw);
              await save();
            } catch (error) {
              if (!active(ctx, epoch)) return;
              item.error = { code: error.code || 'request_failed', message: error.message };
              if (error.status === 409 || error.status === 423 || error.status === 401 || error.status === 403) {
                item.conflict = { code: error.code || 'version_conflict', base: copy(item.base), local: copy(item.draft), remote: null };
              }
              await save();
              break;
            }
          }
          if (!item.outbox.length && !item.dirty && !item.conflict && active(ctx, epoch)) {
            const previousDraft = copy(item.draft);
            try {
              const current = await request(ctx, 'current', 'GET', { local_id: id });
              if (!active(ctx, epoch)) return;
              if (!item.outbox.length && !item.dirty && same(previousDraft, item.draft)) {
                item.raw = copy(current.snapshot.note); item.draft = copy(current.snapshot.note); item.base = copy(current);
                item.replicaSelected = current.replica_count < 2;
                await save();
              }
            } catch (error) {
              if (active(ctx, epoch)) { item.error = { code: error.code || 'refresh_failed', message: error.message }; await save(); }
            }
          }
        }
      })().finally(() => { running = null; });
      return running;
    }
    async function compare(id) {
      const ctx = { ...requireWritable() }, epoch = generation, item = entry(id);
      if (!item) throw new Error('메모 이력 기준이 없습니다.');
      let remote;
      try { remote = await request(ctx, 'current', 'GET', { local_id: id }); }
      catch (error) { if (error.status !== 404) throw error; remote = emptyBase(); }
      if (!active(ctx, epoch)) throw new Error('사용자·서버 또는 복원 상태가 변경되었습니다.');
      item.comparison = copy(remote);
      if (item.conflict) item.conflict.remote = copy(remote);
      await save();
      return { local: copy(item.draft), remote: copy(remote), base: copy(item.base) };
    }
    const equalBase = (a, b) => a?.head_version === b?.head_version && a?.head_revision_id === b?.head_revision_id
      && a?.crypto_epoch === b?.crypto_epoch && JSON.stringify(a?.inventory_revision_ids) === JSON.stringify(b?.inventory_revision_ids);
    async function importPending(id) {
      const ctx = { ...requireWritable() }, epoch = generation, item = entry(id);
      if (!item || failed) throw new Error(failed?.message || '메모 이력 기준이 없습니다.');
      for (const revision of item.revisions) {
        if (!active(ctx, epoch) || failed) return;
        if (revision.imported) continue;
        revision.import_request ||= { ...common(ctx, id, item.base), entries: [{ revision_id: revision.revision_id,
          parent_ref: copy(revision.parent_ref), snapshot: copy(revision.snapshot) }] };
        await save();
        if (!active(ctx, epoch) || failed) return;
        const result = await request(ctx, 'revisions/import', 'POST', copy(revision.import_request));
        if (!active(ctx, epoch)) return;
        if (!result.imported_refs?.some(ref => ref.kind === 'offline_branch' && ref.id === revision.revision_id)) throw new Error('분기 수신 응답이 일치하지 않습니다.');
        revision.imported = true;
        await save();
      }
    }
    async function restore(id, targetRef, compared) {
      const ctx = { ...requireWritable() }, epoch = generation, item = entry(id);
      if (!item) throw new Error('메모 이력 기준이 없습니다.');
      const latest = await compare(id);
      if (!active(ctx, epoch) || !equalBase(latest.remote, compared)) throw new Error('비교본이 변경되었습니다. 다시 비교하고 선택하세요.');
      await seal(id, 'before_restore');
      await importPending(id);
      if (!active(ctx, epoch)) throw new Error('사용자·서버가 변경되었습니다.');
      if (item.outbox.some(op => op.sent) && !item.conflict) throw new Error('결과를 확인하지 못한 전송이 있습니다. 먼저 재연결하세요.');
      const target = await request(ctx, 'revision', 'GET', { local_id: id, revision_kind: targetRef.kind, revision_id: targetRef.id });
      if (!active(ctx, epoch)) throw new Error('사용자·서버가 변경되었습니다.');
      // Superseded requests remain archived; immutable revision bodies are never deleted.
      item.archived_outbox ||= [];
      item.archived_outbox.push(...item.outbox);
      item.outbox = [{ id: uuid(), operation: 'restore', sent: false, waiting_for: null,
        previous_draft: copy(item.draft), restored_snapshot: copy(target.snapshot),
        body: { ...common(ctx, id, compared), ...baseFields(compared), target_ref: copy(targetRef) } }];
      const mutationId = item.outbox[0].body.mutation_id;
      item.conflict = null;
      item.replicaSelected = true;
      await save();
      await sync();
      return copy(item.receipts.find(receipt => receipt.mutation_id === mutationId) || null);
    }
    async function restoreLocal(id, snapshot) {
      requireWritable();
      await seal(id, 'before_restore');
      if (!snapshot?.note || snapshot.note.owner_id !== context().owner || snapshot.note.local_id !== id) throw new Error('복원 대상이 이 메모와 다릅니다.');
      await edit(snapshot.note);
      await seal(id, 'restore');
    }
    return {
      track, edit, seal, sync, compare, importPending, restore, restoreLocal, bindBaseline,
      manages: id => Boolean(context().enabled && readable() && entry(id)),
      view: id => context().enabled && readable() && entry(id) ? copy(entry(id)) : null,
      entries: () => context().enabled && readable() ? copy(bucket(context())?.notes || {}) : {},
      export: () => copy(data),
      failure: () => failed?.message || '',
      status() {
        const notes = context().enabled && readable() ? Object.values(bucket(context())?.notes || {}) : [];
        return { pending: notes.filter(item => !item.localOnly && (item.dirty || item.outbox.length)).length,
          conflicts: notes.filter(item => item.conflict).length, revisions: notes.reduce((sum, item) => sum + item.revisions.length, 0),
          failed: Boolean(failed), unsupported: data !== null && !readable() };
      },
      invalidate() { generation++; },
      suspend() { generation++; data = null; failed = null; },
      suspended: () => data === null,
      hydrate(value) { if (!context().enabled) throw new Error('본인 계정으로 다시 인증하세요.'); generation++; data = value == null ? { schema_version: 1, contexts: {} } : copy(value); },
      async localOnly(id, value) { requireWritable(); const item = entry(id); if (item && item.localOnly !== value) { item.localOnly = value; await save(); } },
      async import(value) {
        requireWritable(); generation++;
        if (!value || value.schema_version !== 1 || !value.contexts) throw new Error('지원하지 않는 이력 형식입니다. 원본을 보존했습니다.');
        const previous = copy(data), next = copy(value);
        next.recovery_archives = [...(previous.recovery_archives || []), ...(next.recovery_archives || []),
          { restored_at: new Date().toISOString(), contexts: previous.contexts }];
        for (const c of Object.values(next.contexts)) for (const item of Object.values(c.notes || {})) {
          if (item.outbox?.length && !item.conflict) item.conflict = { code: 'backup_restored', local: copy(item.draft), remote: null };
        }
        data = next; await save();
      },
      async selectReplica(id, current) {
        requireWritable(); const item = entry(id);
        if (!item || JSON.stringify(item.base.inventory_revision_ids) !== JSON.stringify(current.inventory_revision_ids)
          || item.base.head_version !== current.head_version || item.base.head_revision_id !== current.head_revision_id) throw new Error('비교본이 변경되었습니다. 다시 선택하세요.');
        item.replicaSelected = true; await save();
      },
    };
  }
  globalThis.NowNoteHistory = { create, key, meaning, same };
})();
