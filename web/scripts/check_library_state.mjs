import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

let source = '';
try { source = await readFile(new URL('../vendor/library-state.js', import.meta.url), 'utf8'); } catch {}
const sandbox = { crypto: webcrypto, TextEncoder, URL, structuredClone };
vm.runInNewContext(source, sandbox);
const L = sandbox.NowLibrary;
assert.ok(L, 'Stage D library model must be available');
const context = { url: 'https://example.test', owner: 'alice', enabled: true, auth: 'session' };
let current = context;
let saved;
const calls = [];
const rows = new Map();
const receipts = new Map();
let loseResponse = false;
const request = async (ctx, kind, id, method, body) => {
  calls.push({ ctx, kind, id, method, body: structuredClone(body) });
  if (method === 'GET') return { items: [...rows.values()].filter(r => r.owner_id === ctx.owner) };
  if (receipts.has(body.mutation_id)) return receipts.get(body.mutation_id);
  const old = rows.get(id);
  if (old?.deleted_at || (old?.version || 0) !== body.base_version) {
    throw Object.assign(new Error('conflict'), { status: 409, code: old?.deleted_at ? 'resource_deleted' : 'version_conflict' });
  }
  const resource = { id, owner_id: ctx.owner, schema_version: 1, version: (old?.version || 0) + 1,
    created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T01:00:00Z',
    deleted_at: method === 'DELETE' ? '2026-10-29T02:00:00Z' : null,
    payload: method === 'DELETE' ? null : body.payload };
  rows.set(id, resource);
  const result = { resource, mutation_id: body.mutation_id };
  receipts.set(body.mutation_id, result);
  if (loseResponse) { loseResponse = false; throw new Error('offline after commit'); }
  return result;
};
const make = (initial = saved) => L.create({ initial, context: () => current, request,
  write: async value => { saved = structuredClone(value); } });
let store = make();
const id = await store.put('templates', null, { name: '회의', content_template: '{{date}} {{title}} {{unknown}}' });
assert.equal(store.list('templates')[0].pending, true);
await store.sync();
assert.equal(store.list('templates')[0].version, 1);
await store.put('templates', id, { name: '수정', content_template: 'offline' });
loseResponse = true;
await store.sync();
const uncertain = saved.contexts[L.key(context)].outbox[0];
assert.equal(uncertain.sent, true);
store = make();
await store.sync();
assert.equal(store.list('templates')[0].version, 2);
assert.equal(calls.filter(c => c.body?.mutation_id === uncertain.body.mutation_id).length, 2);
await store.put('templates', id, { name: '로컬', content_template: 'keep me' });
rows.set(id, { ...rows.get(id), version: 3, payload: { name: '원격', content_template: 'remote' } });
await store.sync();
assert.equal(store.list('templates')[0].conflict.code, 'version_conflict');
assert.equal(store.list('templates')[0].payload.content_template, 'keep me');
await store.resolve('templates', id, 'local');
await store.sync();
assert.equal(rows.get(id).version, 4);
assert.equal(rows.get(id).payload.content_template, 'keep me');
await store.remove('templates', id);
await store.sync();
assert.equal(store.list('templates').length, 0);
// A replayed old receipt must never replace a newer tombstone.
const snapshot = structuredClone(saved);
snapshot.contexts[L.key(context)].outbox.push(uncertain);
store = make(snapshot);
await store.sync();
assert.equal(store.list('templates').length, 0);
const pending = await store.put('templates', null, { name: '분리', content_template: 'alice only' });
current = { ...context, owner: 'bob' };
await store.sync();
assert.equal(store.list('templates').length, 0);
assert.equal(rows.has(pending), false);
current = { ...context, url: 'https://other.test' };
assert.equal(store.list('templates').length, 0);
current = context;
await store.sync();
assert.equal(rows.get(pending).owner_id, 'alice');
const unknown = { schema_version: 99, future: { raw: 'preserve' } };
const readOnly = make(unknown);
assert.deepEqual(readOnly.export(), unknown);
await assert.rejects(readOnly.put('templates', null, { name: 'x', content_template: 'x' }));
assert.throws(() => L.validate('templates', { name: 'x', content_template: 'x', unknown: 1 }));
assert.throws(() => L.validate('templates', { name: 'x', content_template: 'NOW_ENCRYPTED_V1:secret' }));
const template = L.applyTemplate({ title_template: '{{title}}', content_template: '{{date}} {{time}} {{title}} {{other}}', properties: { project: '{{title}}' } }, '제목', new Date('2026-10-29T03:04:00'));
assert.equal(template.content, '2026-10-29 03:04 제목 {{other}}');
assert.equal(template.properties.project, '제목');
const q = { name: 'q', order: 0, filter: { text: 'a.*', tags: { all: ['t'], any: [] }, scope: { topic_id: 'topic', category_id: null }, favorite: true, updated: { from: null, to: null } }, sort: { field: 'title', direction: 'asc' } };
const notes = [{ id: 'b', title: 'B a.*', content: '', tags: ['t'], favorite: true, ancestors: ['topic'] }, { id: 'a', title: 'A a.*', tags: ['t'], favorite: true, ancestors: ['topic'] }, { id: 'c', title: 'A axx', tags: ['t'], favorite: true, ancestors: ['topic'] }];
assert.equal(L.evaluate(q, notes, new Set(['topic'])).map(n => n.id).join(), 'a,b');
assert.equal(L.evaluate(q, notes, new Set()).length, 0);
// A second save while the first request is in flight must also drain safely.
let racing, injected = false;
const raceId = crypto.randomUUID();
racing = L.create({ context: () => context, write: async () => {}, request: async (ctx, kind, id, method, body) => {
  const result = await request(ctx, kind, id, method, body);
  if (method === 'PUT' && !injected) {
    injected = true;
    await racing.put('templates', raceId, { name: 'second', content_template: 'second save' });
  }
  return result;
} });
await racing.put('templates', raceId, { name: 'first', content_template: 'first save' });
await racing.sync();
assert.equal(rows.get(raceId).payload.content_template, 'second save');
const restoreSnapshot = racing.export();
rows.set(raceId, { ...rows.get(raceId), version: 3, payload: { name: 'new remote', content_template: 'remote after backup' } });
await racing.import(restoreSnapshot, { restore: true });
await racing.sync();
const restoredDraft = racing.list('templates').find(r => r.id === raceId);
assert.equal(restoredDraft.payload.content_template, 'second save');
assert.equal(restoredDraft.conflict?.code, 'version_conflict', 'restoring an older backup must preserve its content as an explicit conflict');
const localOnly = L.create({ context: () => ({ ...context, enabled: false }), write: async () => {}, request });
const localDraft = await localOnly.put('templates', null, { name: 'never sent', content_template: '' });
await localOnly.remove('templates', localDraft);
assert.equal(localOnly.status().outbox.length, 0, 'deleting a never-sent new draft cancels it without a server DELETE');
let browserRaw = null;
assert.equal(typeof L.guardedWriter, 'function', 'Web persistence must reject stale-tab replacement of another pending journal');
const writerA = L.guardedWriter({ initial: null, read: () => browserRaw, write: raw => { browserRaw = raw; } });
const writerB = L.guardedWriter({ initial: null, read: () => browserRaw, write: raw => { browserRaw = raw; } });
await writerA({ outbox: ['alice pending'] });
await assert.rejects(writerB({ outbox: ['bob pending'] }));
assert.equal(browserRaw, JSON.stringify({ outbox: ['alice pending'] }));
console.log('Stage D library state: retry/restart/CAS/tombstone/context/unknown/variables/query PASS');
