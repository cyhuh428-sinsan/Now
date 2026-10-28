/* NowNote 사용자 템플릿·저장조건. Note 동기화와 분리된 durable outbox. */
(() => {
  'use strict';
  const kinds = ['templates', 'saved-queries'];
  const copy = value => structuredClone(value);
  const uuid = () => crypto.randomUUID();
  const key = ctx => JSON.stringify([String(ctx.url || '').replace(/\/+$/, ''), ctx.owner || 'local']);
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const fields = (v, allowed) => {
    if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) throw new Error('지원하지 않는 형식입니다. 원본을 보존합니다.');
  };
  const strings = v => Array.isArray(v) && v.every(s => typeof s === 'string');
  function validate(kind, payload) {
    if (!kinds.includes(kind)) throw new Error('지원하지 않는 자원입니다.');
    fields(payload, kind === 'templates' ? ['name', 'description', 'title_template', 'content_template', 'properties', 'variables'] : ['name', 'order', 'filter', 'sort']);
    if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length > 240) throw new Error('이름은 1~240자로 입력하세요.');
    if (kind === 'templates') {
      if (typeof payload.content_template !== 'string') throw new Error('템플릿 본문이 필요합니다.');
      for (const field of ['description', 'title_template']) if (payload[field] !== undefined && typeof payload[field] !== 'string') throw new Error('템플릿 문자열 형식 오류');
      if (JSON.stringify(payload).includes('NOW_ENCRYPTED_V1:')) throw new Error('암호화 메모는 템플릿으로 저장할 수 없습니다.');
      if (payload.properties !== undefined && (!object(payload.properties) || !Object.values(payload.properties).every(v => typeof v === 'string'))) throw new Error('속성은 문자열 사전이어야 합니다.');
      if (payload.variables !== undefined && (!strings(payload.variables) || payload.variables.some(v => !['date', 'time', 'title'].includes(v)))) throw new Error('지원하지 않는 변수입니다.');
    } else {
      if (payload.order !== undefined && !Number.isInteger(payload.order)) throw new Error('목록 순서는 정수입니다.');
      const f = payload.filter || {};
      fields(f, ['text', 'tags', 'scope', 'favorite', 'updated']);
      if (f.text !== undefined && typeof f.text !== 'string') throw new Error('검색어 형식 오류');
      if (f.tags !== undefined) {
        fields(f.tags, ['all', 'any']);
        for (const v of Object.values(f.tags)) if (!strings(v)) throw new Error('태그 형식 오류');
      }
      if (f.scope !== undefined) {
        fields(f.scope, ['topic_id', 'category_id']);
        if (Object.values(f.scope).some(v => v !== null && typeof v !== 'string')) throw new Error('범위 형식 오류');
      }
      if (f.favorite !== undefined && f.favorite !== null && typeof f.favorite !== 'boolean') throw new Error('즐겨찾기 형식 오류');
      if (f.updated !== undefined) {
        fields(f.updated, ['from', 'to']);
        for (const v of Object.values(f.updated)) if (v !== null && (typeof v !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v)))) throw new Error('수정 기간에는 시간대가 있는 날짜를 입력하세요.');
        if (f.updated.from && f.updated.to && Date.parse(f.updated.from) > Date.parse(f.updated.to)) throw new Error('시작일이 종료일보다 늦습니다.');
      }
      if (payload.sort !== undefined) {
        fields(payload.sort, ['field', 'direction']);
        if (!['updated_at', 'title'].includes(payload.sort.field || 'updated_at') || !['asc', 'desc'].includes(payload.sort.direction || 'desc')) throw new Error('정렬 형식 오류');
      }
    }
    if (new TextEncoder().encode(JSON.stringify(payload)).length > (kind === 'templates' ? 1048576 : 16384)) throw new Error('저장 용량 한도를 초과했습니다. 내용을 자르지 않았습니다.');
    return copy(payload);
  }
  const supported = r => {
    try { if (r.schema_version !== 1) return false; if (!r.deleted_at) validate(r.kind, r.payload); return true; } catch { return false; }
  };
  function applyTemplate(payload, title, date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    const vars = { title, date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
    const replace = s => String(s || '').replace(/\{\{(date|time|title)\}\}/g, (_, name) => vars[name]);
    return { title: replace(payload.title_template || payload.name), content: replace(payload.content_template),
      properties: Object.fromEntries(Object.entries(payload.properties || {}).map(([k, v]) => [k, replace(v)])) };
  }
  function evaluate(query, notes, scopeIds) {
    validate('saved-queries', query);
    const f = query.filter || {}, scope = f.scope || {}, sort = query.sort || {};
    const required = [scope.topic_id, scope.category_id].filter(Boolean);
    if (required.some(id => !scopeIds.has(id))) return [];
    const text = String(f.text || '').toLocaleLowerCase();
    return notes.filter(n => {
      if (n.deleted || n.authorized === false) return false;
      if (required.some(id => n.id !== id && !(n.ancestors || []).includes(id))) return false;
      if (text && !`${n.title || ''}\n${n.content || ''}`.toLocaleLowerCase().includes(text)) return false;
      const tags = new Set(n.tags || []);
      if ((f.tags?.all || []).some(t => !tags.has(t))) return false;
      if (f.tags?.any?.length && !f.tags.any.some(t => tags.has(t))) return false;
      if (typeof f.favorite === 'boolean' && Boolean(n.favorite) !== f.favorite) return false;
      const stamp = Date.parse(n.updated_at);
      if ((f.updated?.from && !(stamp >= Date.parse(f.updated.from))) || (f.updated?.to && !(stamp <= Date.parse(f.updated.to)))) return false;
      return true;
    }).sort((a, b) => {
      const value = sort.field === 'title' ? String(a.title || '').localeCompare(String(b.title || ''), 'ko') : (Date.parse(a.updated_at) || 0) - (Date.parse(b.updated_at) || 0);
      return (sort.direction === 'asc' ? value : -value) || String(a.id).localeCompare(String(b.id));
    });
  }
  function guardedWriter({ initial, read, write, lock = action => action() }) {
    let previous = initial;
    return async value => lock(() => {
      if (read() !== previous) throw new Error('다른 탭에서 저장 자료를 변경했습니다. 이 창의 변경을 백업한 후 다시 열어주세요. 덮어쓰지 않았습니다.');
      const next = JSON.stringify(value);
      write(next);
      previous = next;
    });
  }
  function create({ initial, context, request, write, change = () => {} }) {
    let data = initial == null ? { schema_version: 1, contexts: {} } : copy(initial);
    let generation = 0;
    let writeChain = Promise.resolve();
    const locks = new Map();
    const readable = () => data?.schema_version === 1 && object(data.contexts) && Object.values(data.contexts).every(c => object(c) && object(c.resources) && Array.isArray(c.outbox) && object(c.conflicts));
    const writable = () => { if (!readable()) throw new Error('지원하지 않는 보관 형식입니다. 백업 원본을 보존했습니다.'); };
    const save = () => {
      const value = copy(data);
      writeChain = writeChain.catch(() => {}).then(() => write(value));
      return writeChain.then(() => change());
    };
    const bucket = ctx => {
      writable();
      const k = key(ctx);
      return data.contexts[k] ||= { resources: {}, outbox: [], conflicts: {} };
    };
    const resourceKey = (kind, id) => `${kind}/${id}`;
    const merge = (c, kind, rows, owner) => {
      for (const row of rows) {
        if (row.owner_id !== owner || typeof row.id !== 'string' || !Number.isInteger(row.version)) throw new Error('서버 응답의 소유자/버전이 일치하지 않습니다.');
        const k = resourceKey(kind, row.id), old = c.resources[k];
        if (!old || row.version >= old.version) c.resources[k] = copy({ ...row, kind });
      }
    };
    const list = kind => {
      if (!readable()) return [];
      const c = bucket(context()), map = new Map();
      for (const r of Object.values(c.resources)) if (r.kind === kind) map.set(r.id, { ...copy(r), readonly: !supported(r) });
      for (const op of c.outbox) if (op.kind === kind) {
        const old = map.get(op.id) || { id: op.id, version: 0, schema_version: 1, kind };
        map.set(op.id, { ...old, payload: copy(op.body.payload), deleted_at: op.method === 'DELETE' ? 'pending' : null, pending: true, error: op.error, readonly: !supported({ ...old, payload: op.body.payload, deleted_at: op.method === 'DELETE' ? 'pending' : null }) });
      }
      return [...map.values()].filter(r => !r.deleted_at).map(r => ({ ...r, conflict: copy(c.conflicts[resourceKey(kind, r.id)] || null) }))
        .sort((a, b) => (a.payload?.order || 0) - (b.payload?.order || 0) || String(a.payload?.name || a.id).localeCompare(String(b.payload?.name || b.id), 'ko'));
    };
    async function enqueue(kind, id, method, payload) {
      writable();
      if (!kinds.includes(kind)) throw new Error('지원하지 않는 자원입니다.');
      const ctx = context(), c = bucket(ctx);
      id ||= uuid();
      const k = resourceKey(kind, id), remote = c.resources[k], existing = list(kind).find(r => r.id === id);
      if (remote?.deleted_at || existing?.readonly) throw new Error('삭제되었거나 지원하지 않는 자료입니다. 새 사본으로 저장하세요.');
      if (c.conflicts[k]) throw new Error('충돌 내용을 먼저 비교하고 선택하세요.');
      const pending = c.outbox.filter(o => o.kind === kind && o.id === id);
      if (method === 'DELETE' && !remote && pending.length && pending.every(o => !o.sent)) {
        c.outbox = c.outbox.filter(o => !(o.kind === kind && o.id === id));
        await save();
        return id;
      }
      if (method === 'PUT') {
        payload = validate(kind, payload);
        if (!existing && list(kind).length >= 100) throw new Error('종류별 최대 100개입니다.');
      }
      const previous = c.outbox.filter(o => o.kind === kind && o.id === id).at(-1);
      if (previous && !previous.sent) {
        previous.method = method;
        previous.body.mutation_id = uuid();
        delete previous.error;
        if (method === 'PUT') previous.body.payload = payload; else delete previous.body.payload;
      } else {
        c.outbox.push({ kind, id, method, sent: false, body: { owner_id: ctx.owner, schema_version: 1,
          base_version: previous ? null : remote?.version || 0, mutation_id: uuid(), ...(method === 'PUT' ? { payload } : {}) } });
      }
      await save();
      return id;
    }
    async function run(ctx, epoch) {
      const k = key(ctx), c = bucket(ctx);
      const active = () => generation === epoch && key(context()) === k && context().enabled && context().auth === ctx.auth;
      const pull = async kind => {
        if (!active()) return false;
        const result = await request(ctx, kind, null, 'GET');
        merge(c, kind, result.items, ctx.owner);
        await save();
        return active();
      };
      try {
        for (const kind of kinds) if (!await pull(kind)) return;
        delete c.error;
        // One immutable request at a time; subsequent local edits wait for its actual receipt version.
        const attempted = new Set();
        while (true) {
          const op = c.outbox.find(item => !attempted.has(item));
          if (!op) break;
          attempted.add(op);
          const rk = resourceKey(op.kind, op.id);
          if (!active()) return;
          if (c.conflicts[rk] || op.body.base_version === null) continue;
          try {
            fields(op.body, ['owner_id', 'schema_version', 'base_version', 'mutation_id', ...(op.method === 'PUT' ? ['payload'] : [])]);
            if (!kinds.includes(op.kind) || !['PUT', 'DELETE'].includes(op.method) || op.body.owner_id !== ctx.owner || op.body.schema_version !== 1 || !Number.isInteger(op.body.base_version) || op.body.base_version < 0) throw new Error('지원하지 않는 전송 형식입니다. 원본을 보존합니다.');
            if (op.method === 'PUT') validate(op.kind, op.body.payload);
          } catch (error) { op.error = { code: 'unsupported_outbox', message: error.message }; await save(); continue; }
          op.sent = true;
          delete op.error;
          await save();
          try {
            if (!active()) return;
            const result = await request(ctx, op.kind, op.id, op.method, copy(op.body));
            if (result.resource.id !== op.id || result.resource.owner_id !== ctx.owner) throw new Error('서버 응답이 요청과 다릅니다.');
            merge(c, op.kind, [result.resource], ctx.owner);
            c.outbox.splice(c.outbox.indexOf(op), 1);
            const next = c.outbox.find(o => o.kind === op.kind && o.id === op.id);
            if (next?.body.base_version === null) next.body.base_version = result.resource.version;
            await save();
            if (!await pull(op.kind)) return;
          } catch (error) {
            op.error = { code: error.code || 'connection_error', message: error.message };
            if (error.status === 409 && ['version_conflict', 'resource_deleted'].includes(error.code)) {
              c.conflicts[rk] = { code: error.code, local: copy(c.outbox.filter(o => o.kind === op.kind && o.id === op.id)), remote: copy(c.resources[rk] || null) };
              await pull(op.kind);
              c.conflicts[rk].remote = copy(c.resources[rk] || null);
            }
            await save();
            if (!error.status || [401, 403].includes(error.status)) return;
          }
        }
      } catch (error) { c.error = error.message; await save(); }
    }
    async function sync() {
      writable();
      const ctx = { ...context() }, epoch = generation, k = `${key(ctx)}:${epoch}`;
      if (!ctx.enabled || !ctx.auth) return;
      if (locks.has(k)) return locks.get(k);
      const running = run(ctx, epoch).finally(() => locks.delete(k));
      locks.set(k, running);
      return running;
    }
    async function resolve(kind, id, choice) {
      const ctx = context(), c = bucket(ctx), rk = resourceKey(kind, id), conflict = c.conflicts[rk];
      if (!conflict) return;
      const local = c.outbox.filter(o => o.kind === kind && o.id === id).at(-1);
      if (!['local', 'remote'].includes(choice)) throw new Error('명시적으로 선택하세요.');
      c.outbox = c.outbox.filter(o => !(o.kind === kind && o.id === id));
      delete c.conflicts[rk];
      if (choice === 'local' && local) {
        const remote = c.resources[rk];
        if (local.method === 'PUT') {
          const newId = remote?.deleted_at ? uuid() : id;
          c.outbox.push({ kind, id: newId, method: 'PUT', sent: false, body: { owner_id: ctx.owner, schema_version: 1, base_version: remote?.deleted_at ? 0 : remote?.version || 0, mutation_id: uuid(), payload: copy(local.body.payload) } });
        } else if (remote && !remote.deleted_at) c.outbox.push({ kind, id, method: 'DELETE', sent: false, body: { owner_id: ctx.owner, schema_version: 1, base_version: remote.version, mutation_id: uuid() } });
      }
      await save();
    }
    return { list, put: (kind, id, payload) => enqueue(kind, id, 'PUT', payload), remove: (kind, id) => enqueue(kind, id, 'DELETE'), sync, resolve,
      export: () => copy(data), readonly: () => !readable(),
      status: () => readable() ? copy(bucket(context())) : { error: '지원하지 않는 보관 형식: 원본 보존, 읽기 전용' },
      import: async (value, { restore = false } = {}) => {
        generation++;
        data = copy(value);
        // Restoring an old cache is a user edit, not permission to overwrite a newer server copy.
        if (restore && readable()) for (const [scope, c] of Object.entries(data.contexts)) {
          let owner;
          try { owner = JSON.parse(scope)[1]; } catch { continue; }
          for (const r of Object.values(c.resources)) {
            if (!supported(r) || r.deleted_at || r.owner_id !== owner || c.outbox.some(o => o.kind === r.kind && o.id === r.id) || c.conflicts[resourceKey(r.kind, r.id)]) continue;
            c.outbox.push({ kind: r.kind, id: r.id, method: 'PUT', sent: false, body: { owner_id: owner, schema_version: 1,
              base_version: r.version, mutation_id: uuid(), payload: copy(r.payload) } });
          }
        }
        await save();
      } };
  }
  globalThis.NowLibrary = { create, validate, applyTemplate, evaluate, key, guardedWriter };
})();
