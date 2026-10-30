import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../vendor/note-protection-protocol.js', import.meta.url), 'utf8');
const box = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, atob, btoa };
vm.runInNewContext(source, box);
const P = box.NowNoteProtectionProtocol;
assert.ok(P, 'E4b1 protocol runtime is required');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const clone = v => JSON.parse(JSON.stringify(v));
const sha = v => createHash('sha256').update(v).digest('hex');
const u = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const key = { kind: 'revision_snapshot', id: u(1), slot: 'after' };
const bind = { server_instance_id: u(2), owner_id: 'alice', local_id: 'tree:원문', transition_id: u(3),
  crypto_epoch: 2, destination_key: key, revision_ref: { kind: 'note_revision', id: u(1) }, parent_ref: null };
const note = { id: 17, owner_id: 'alice', local_id: 'tree:원문', device_id: 'original-device', note_type: 'tree',
  title: '한글\r\n e\u0301 😀 ', content: ' 원문\r\n\t끝 ', parent_local_id: null, level: 1, tags: '', source: null,
  deleted_at: null, client_updated_at: null, created_at: '2026-10-29T01:02:03.123456Z', updated_at: '2026-10-30T01:02:03.000001Z' };
const snapshot = { schema_version: 1, note };
const origin = { purpose: 'protected_write', quote_id: u(7), mutation_id: u(8), operation: 'put', restore_source_ref: null, target_ciphertext_sha256: null };
const expectation = { value: origin, legacy: null };
const destination = (k = key, kind = 'history_envelope_v1') => ({ key: k, output_kind: kind, output_epoch: 2,
  is_null: false, expected_binding: kind === 'content_encrypted_v1' ? null : { ...bind, destination_key: k }, operation_origin: kind === 'history_envelope_v1' ? origin : null });
const descriptor = (raw, d = destination()) => ({ key: d.key, representation_kind: d.output_kind, representation_epoch: d.output_epoch,
  is_null: d.is_null, representation_version: 1, representation_etag: u(10), storage_operation_id: u(3),
  semantic_origin_id: d.operation_origin ? u(7) : null, origin_validator: d.output_kind === 'history_envelope_v1' ? 'native_v1' : d.output_kind === 'content_encrypted_v1' ? 'body_v1' : 'linked_v1',
  origin_row_required: d.output_kind === 'history_envelope_v1', expected_binding: d.expected_binding,
  revision_ref: d.expected_binding?.revision_ref ?? null, parent_ref: null, physical_note_id: null, inventory_revision_id: null,
  linked_slot_version: d.output_kind === 'linked_text_envelope_v1' ? 1 : null, ciphertext_sha256: raw === null ? null : sha(raw) });
const password = 'synthetic-only-password';
const resolve = async d => { assert.equal(d.representation_epoch, 2); return password; };
const decode = (raw, d, e = expectation) => P.decryptRepresentation(raw, d, e, resolve, 3);

// Independent fixture encoder: do not test encryption only against its own inverse.
async function oldCipher(text, pass = password) {
  const salt = new Uint8Array(16).fill(3), iv = new Uint8Array(12).fill(9);
  const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const k = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const data = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
  return `NOW_ENCRYPTED_V1:${btoa(JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: 210000,
    salt: Buffer.from(salt).toString('base64'), iv: Buffer.from(iv).toString('base64'), data: Buffer.from(data).toString('base64') }))}`;
}
const wrap = async inner => JSON.stringify({ schema_version: 1, kind: 'history_envelope_v1', crypto_epoch: 2, binding: bind, ciphertext: await oldCipher(JSON.stringify(inner)) });
await test('Python scalar ordering, numeric object keys, UTF8 and empty digest', async () => {
  assert.equal(P.canonicalJson({ '\u{10000}': 1, '\uE000': 2, '2': 3, '10': 4 }), '{"10":4,"2":3,"":2,"𐀀":1}');
  assert.equal(await P.hashJson([]), '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945');
  assert.equal(P.canonicalJson(snapshot), P.canonicalJson(P.parseJson(JSON.stringify(snapshot))));
});
for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, -0, undefined, '\ud800']) {
  await test('reject noncanonical scalar', () => assert.throws(() => P.canonicalJson(value)));
}
for (const text of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '1.0', '1e2', '9007199254740993', '{"v":true,}', '{"x":"\ud800"}']) {
  await test('strict wire JSON rejects loss or duplicate', () => assert.throws(() => P.parseJson(text)));
}
await test('key tuple UTF8 sort; strict typed IDs and slots', () => {
  const list = [{ kind: 'note_body', id: '2', slot: 'content' }, { kind: 'note_body', id: '10', slot: 'content' }];
  assert.equal(P.keyOrder(list)[0].id, '10');
  for (const bad of [{ ...key, slot: 'before' }, { ...key, id: u(1).toUpperCase().replace('4000','A000') }, { ...key, kind: 'unknown' }, { kind: 'note_body', id: '01', slot: 'content' }]) assert.throws(() => P.validateKey(bad));
});
await test('FULL15 exact values, unknown/missing/type rejection', () => {
  assert.equal(P.canonicalJson(P.validateSnapshot(snapshot)), P.canonicalJson(snapshot));
  for (const damage of [n => delete n.tags, n => n.extra = 1, n => n.level = true, n => n.created_at = null]) {
    const s = clone(snapshot); damage(s.note); assert.throws(() => P.validateSnapshot(s));
  }
});
let raw, desc;
await test('real crypto roundtrip preserves all 15 and original bytes', async () => {
  raw = await P.encryptRepresentation(snapshot, destination(), password);
  desc = descriptor(raw);
  assert.equal(P.canonicalJson(await decode(raw, desc)), P.canonicalJson(snapshot));
  assert.equal(desc.ciphertext_sha256, sha(raw));
});
await test('independent existing v1 body decrypt and mixed actual epoch', async () => {
  const d = destination({ kind: 'note_body', id: '17', slot: 'content' }, 'content_encrypted_v1');
  const r = await oldCipher(note.content);
  assert.equal(await decode(r, descriptor(r, d), { value: null, legacy: null }), note.content);
  assert.equal(await P.decryptContent(await P.encryptContent(note.content, password), password), note.content);
});
await test('wrong password / AEAD damage / cipher SHA reject', async () => {
  await assert.rejects(() => P.decryptRepresentation(raw, desc, expectation, async () => 'wrong', 3));
  await assert.rejects(() => decode(raw + ' ', desc));
  const r = JSON.parse(raw); r.ciphertext = r.ciphertext.slice(0, -3) + 'AAA';
  await assert.rejects(() => decode(JSON.stringify(r), descriptor(JSON.stringify(r))));
});
for (const field of ['kind', 'crypto_epoch', 'binding', 'extra']) {
  await test(`outer ${field} mismatch rejects`, async () => {
    const r = JSON.parse(raw); r[field] = field === 'crypto_epoch' ? 3 : field === 'binding' ? { ...bind, local_id: 'other' } : 'bad';
    const text = JSON.stringify(r); await assert.rejects(() => decode(text, descriptor(text)));
  });
}
for (const damage of [i => i.semantic_sha256 = '0'.repeat(64), i => i.binding = { ...bind, parent_ref: key },
  i => i.origin = null, i => delete i.origin, i => i.snapshot.note.tags = 'changed', i => i.extra = 'bad']) {
  await test('inner semantic hash binding origin FULL15 rejects', async () => {
    const i = { schema_version: 1, binding: bind, snapshot: clone(snapshot), origin, content_origin_kind: 'semantic', semantic_sha256: sha(P.canonicalJson(snapshot)) };
    damage(i); const r = await wrap(i); await assert.rejects(() => decode(r, descriptor(r)));
  });
}
await test('legacy missing origin only with positive evidence, never absence fallback', async () => {
  const i = { schema_version: 1, binding: bind, snapshot, content_origin_kind: 'semantic', semantic_sha256: sha(P.canonicalJson(snapshot)) };
  const r = await wrap(i), d = descriptor(r); d.origin_validator = 'a2a_pre_origin_v0'; d.origin_row_required = false; d.semantic_origin_id = null;
  await assert.rejects(() => decode(r, d, { value: null, legacy: null }));
  assert.equal(P.canonicalJson(await decode(r, d, { value: null, legacy: 'a2a_pre_origin_v0' })), P.canonicalJson(snapshot));
});
await test('plain snapshot old content cipher is actually decrypted without normalization', async () => {
  const s = clone(snapshot); s.note.content = await oldCipher(note.content);
  const d = descriptor(null); Object.assign(d, { representation_kind: 'snapshot_v1', representation_epoch: 0, storage_operation_id: null,
    semantic_origin_id: null, origin_validator: 'native_mixed_v1', ciphertext_sha256: null, expected_binding: null });
  const r = JSON.stringify(s);
  const v = await P.decryptRepresentation(r, d, { value: null, legacy: null }, async () => password, 3);
  assert.equal(v.note.content, note.content); assert.equal(v.note.title, note.title);
});
await test('linked exact empty text; accepted existing inner forms', async () => {
  const k = { kind: 'analysis_result', id: '9', slot: 'result_json' }, d = destination(k, 'linked_text_envelope_v1');
  d.expected_binding.revision_ref = null;
  const r = await P.encryptRepresentation('', d, password);
  assert.equal(await decode(r, descriptor(r, d), { value: null, legacy: null }), '');
  const inner = { schema_version: 1, binding: d.expected_binding, value: ' \r\n', content_origin_kind: 'linked_text', semantic_sha256: sha(' \r\n') };
  const w = JSON.stringify({ schema_version: 1, kind: d.output_kind, crypto_epoch: 2, binding: d.expected_binding, ciphertext: await oldCipher(JSON.stringify(inner)) });
  assert.equal(await decode(w, descriptor(w, d), { value: null, legacy: null }), ' \r\n');
});
await test('MA/MT null vs old nullable bindings and empty text are distinct', async () => {
  const d = destination({ kind: 'analysis_error', id: '9', slot: 'error_message' }, 'linked_text_envelope_v1');
  Object.assign(d, { is_null: true, expected_binding: null });
  assert.equal(await P.encryptRepresentation(null, d, password), null);
  assert.equal(await decode(null, descriptor(null, d), { value: null, legacy: null }), null);
  await assert.rejects(() => decode('', descriptor(null, d), { value: null, legacy: null }));
  const target = { destination_key: d.key, source_keys: [], source_etag: u(12), output_kind: d.output_kind,
    output_epoch: 2, is_null: true, expected_binding: null };
  P.validateDestination(target, 'mixed_analysis_write');
  assert.throws(() => P.validateDestination({ ...target, expected_binding: d.expected_binding || bind }, 'mixed_analysis_write'));
  const broken = descriptor(null, d); delete broken.is_null; assert.throws(() => P.validateDescriptor(broken, 3));
});
const base = { head_version: 2, head_revision_id: u(1), crypto_epoch: 4, history_generation: 5, protection_state: 'protected',
  inventory_revision_ids: [u(1)], identity_state: 'coherent', current_exists: true };
const context = { base, current_mode: 'protected', selected_physical_note_id: 17, mixed_metadata_version: 1 };
const access = { schema_version: 3, server_instance_id: u(2), owner_id: 'alice', local_id: 'tree:원문', device_id: 'device', context };
const kinds = ['analysis_error','analysis_input','analysis_result','inventory_snapshot','note_body','offline_snapshot','recording_transcript','reserved_offline_snapshot','revision_before','revision_snapshot'];
function counts(items) { return { total: items.length, nonnull: items.filter(x => !x.is_null).length, nulls: items.filter(x => x.is_null).length,
  by_kind: kinds.map(kind => ({ kind, total: items.filter(x => x.key.kind === kind).length, nonnull: items.filter(x => x.key.kind === kind && !x.is_null).length, nulls: items.filter(x => x.key.kind === kind && x.is_null).length })) }; }
const items = [desc];
const digest = await P.hashJson({ server_instance_id: access.server_instance_id, owner_id: access.owner_id, local_id: access.local_id, context, entries: items });
const page = { schema_version: 3, context, catalog_digest: digest, counts: counts(items), coverage: { supported_kinds: kinds, scope_complete: true, full_protection_complete: false }, entries: items, next_cursor: null };
await test('whole schema3 catalog digest binds context and ordered all pages', async () => {
  assert.equal((await P.verifyCatalog([page], { ...access, catalog_digest: digest })).length, 1);
});
for (const damage of [p => p.entries = [], p => p.entries.push(desc), p => p.context.current_mode = 'plain', p => p.counts.total++,
  p => p.next_cursor = 'missing', p => p.entries[0].representation_version++, p => p.entries[0].expected_binding.crypto_epoch++, p => p.extra = true]) {
  await test('catalog omission duplicate stale context metadata or terminal page fails', async () => {
    const p = clone(page); damage(p); await assert.rejects(() => P.verifyCatalog([p], { ...access, catalog_digest: digest }));
  });
}
await test('empty catalog verified with H(empty metadata entries)', async () => {
  const p = { ...page, entries: [], counts: counts([]) };
  p.catalog_digest = await P.hashJson({ server_instance_id: access.server_instance_id, owner_id: access.owner_id, local_id: access.local_id, context, entries: [] });
  assert.equal((await P.verifyCatalog([p], { ...access, catalog_digest: p.catalog_digest })).length, 0);
});
await test('actual two-page reconstruction; cursor repeats/context/ordering fail closed', async () => {
  const second = clone(desc); second.key.id = u(11); second.expected_binding.destination_key = second.key;
  second.expected_binding.revision_ref.id = u(11); second.revision_ref.id = u(11);
  const all = [desc, second];
  const h = await P.hashJson({ server_instance_id: access.server_instance_id, owner_id: access.owner_id, local_id: access.local_id, context, entries: all });
  const scope_digest = await P.hashJson({ server_instance_id: access.server_instance_id, owner_id: access.owner_id, local_id: access.local_id, device_id: access.device_id, context, catalog_digest: h });
  const token = btoa(P.canonicalJson({ schema_version: 3, scope_digest, last_key: desc.key })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const pages = [ { ...page, catalog_digest: h, counts: counts(all), entries: [desc], next_cursor: token },
    { ...page, catalog_digest: h, counts: counts(all), entries: [second] } ];
  const expected = { ...access, catalog_digest: h };
  assert.equal((await P.verifyCatalog(pages, expected)).length, 2);
  await assert.rejects(() => P.verifyCatalog([pages[1], pages[0]], expected));
  await assert.rejects(() => P.verifyCatalog([pages[0], pages[0], pages[1]], expected));
  await assert.rejects(() => P.verifyCatalog(pages, { ...expected, device_id: 'other-device' }));
  const damaged = clone(pages); damaged[0].next_cursor = btoa('{"schema_version":3}');
  await assert.rejects(() => P.verifyCatalog(damaged, expected));
});
for (const version of [1, 2]) {
  await test(`legacy schema${version} descriptor/decryption and catalog bytes preserved`, async () => {
    const old = Object.fromEntries(['key','representation_kind','representation_epoch','representation_etag','is_null','ciphertext_sha256','expected_binding','revision_ref','parent_ref','physical_note_id','inventory_revision_id'].map(k => [k, desc[k]]));
    Object.assign(old, { representation_etag: sha('opaque-legacy-cipher-etag'), total_bytes: Buffer.byteLength(raw), total_chunks: 1, operation_origin: origin });
    P.validateDescriptor(old, version);
    assert.equal(P.canonicalJson(await P.decryptRepresentation(raw, old, expectation, resolve, version)), P.canonicalJson(snapshot));
    const c = { server_instance_id: u(2), head_version: 2, head_revision_id: u(1), crypto_epoch: 2, history_generation: 5, identity_state: 'coherent', current_exists: true };
    const digest = await P.hashJson({ context: c, items: [old] }); c.catalog_digest = digest;
    const supported = ['note_body','revision_snapshot','revision_before','inventory_snapshot','offline_snapshot'];
    const p = { context: c, catalog_digest: digest, items: [old], next_cursor: null,
      counts: Object.fromEntries(supported.map(k => [k, k === 'revision_snapshot' ? 1 : 0])),
      coverage: { scope: 'note_history', supported_kinds: supported, scope_complete: true, full_protection_complete: false } };
    assert.equal((await P.verifyCatalog([p], { ...access, schema_version: version, context: c, catalog_digest: digest })).length, 1);
    const damaged = clone(p); delete damaged.items[0].operation_origin;
    await assert.rejects(() => P.verifyCatalog([damaged], { ...access, schema_version: version, context: c, catalog_digest: digest }));
  });
}
await test('exact nullable before and RC/old linked binding metadata do not collapse', async () => {
  const before = clone(desc); before.key = { kind: 'revision_before', id: key.id, slot: 'before' };
  before.is_null = true; before.ciphertext_sha256 = null; before.expected_binding.destination_key = before.key;
  assert.equal(await decode(null, before), null);
  const d = destination({ kind: 'recording_transcript', id: '5', slot: 'transcript' }, 'linked_text_envelope_v1');
  d.is_null = true; d.expected_binding.revision_ref = null;
  assert.equal(await decode(null, descriptor(null, d), { value: null, legacy: null }), null);
  const t = { destination_key: d.key, source_keys: [d.key], source_etag: u(19), output_kind: d.output_kind,
    output_epoch: 2, is_null: true, expected_binding: null };
  P.validateDestination(t, 'mixed_conversion'); P.validateDestination(t, 'mixed_transcript_write');
  await assert.rejects(() => P.encryptRepresentation('', d, password));
});
await test('Main-R1 MA/MT linked mixed origins survive RC storage change', async () => {
  for (const purpose of ['mixed_analysis_write', 'mixed_transcript_write']) {
    const isMA = purpose === 'mixed_analysis_write';
    const k = isMA ? { kind: 'analysis_result', id: '9', slot: 'result_json' } : { kind: 'recording_transcript', id: '8', slot: 'transcript' };
    const original = isMA ? { purpose, operation_id: u(7), execution_id: u(18), request_type: 'initial',
      source_context: { server_instance_id: u(2), base: context, catalog_digest: sha('source-catalog') }, source_digest: sha('source'), terminal_receipt_digest: sha('terminal'), original_bundle_digest: sha('bundle'), previous_write_id: null }
      : { purpose, operation_id: u(7), recording_id: 8, previous_descriptor: descriptor(null, { ...destination(k, 'linked_text_envelope_v1'), is_null: true, expected_binding: null }) };
    const d = destination(k, 'linked_text_envelope_v1'); d.expected_binding.revision_ref = null;
    for (const storage of [u(7), u(3)]) {
      d.expected_binding.transition_id = storage;
      const r = await P.encryptRepresentation('original result\r\n', d, password), sd = descriptor(r, d);
      Object.assign(sd, { origin_validator: 'linked_mixed_v1', semantic_origin_id: u(7), storage_operation_id: storage });
      P.validateDescriptor(sd, 3);
      assert.equal(await decode(r, sd, { value: original, legacy: null }), 'original result\r\n');
      await assert.rejects(() => decode(r, sd, { value: { ...original, operation_id: u(6) }, legacy: null }));
      await assert.rejects(() => decode(r, sd, { value: null, legacy: null }));
      const missing = clone(sd); missing.origin_validator = 'unknown'; assert.throws(() => P.validateDescriptor(missing, 3));
      const nd = { ...sd, is_null: true, ciphertext_sha256: null, expected_binding: null };
      assert.equal(await decode(null, nd, { value: original, legacy: null }), null);
    }
  }
});
await test('MW body_mixed_v1 descriptor remains body with null semantic origin', async () => {
  const d = destination({ kind: 'note_body', id: '17', slot: 'content' }, 'content_encrypted_v1');
  const r = await oldCipher(note.content), sd = descriptor(r, d); sd.origin_validator = 'body_mixed_v1';
  assert.equal(await decode(r, sd, { value: null, legacy: null }), note.content);
});
await test('Main-R2 encrypt freezes FULL15 before first await', async () => {
  const original = clone(snapshot), input = clone(snapshot), target = destination();
  const pending = P.encryptRepresentation(input, target, password);
  input.note.content = 'late mutation'; input.note.title = 'late title'; target.expected_binding.local_id = 'other';
  const r = await pending;
  assert.equal(P.canonicalJson(await decode(r, descriptor(r))), P.canonicalJson(original));
});
await test('Main-R3 untrusted KDF count rejected before any derive/import', async () => {
  const valid = await oldCipher('synthetic');
  for (const iterations of [1, 210001, Number.MAX_SAFE_INTEGER, true]) {
    const p = JSON.parse(atob(valid.slice('NOW_ENCRYPTED_V1:'.length))); p.iterations = iterations;
    let called = 0;
    const isolated = { crypto: { subtle: { importKey() { called++; throw new Error('unexpected KDF'); } } }, TextEncoder, TextDecoder, Uint8Array, atob, btoa };
    vm.runInNewContext(source, isolated);
    await assert.rejects(() => isolated.NowNoteProtectionProtocol.decryptContent('NOW_ENCRYPTED_V1:' + btoa(JSON.stringify(p)), password));
    assert.equal(called, 0, 'reject unsupported count before KDF work');
  }
});
await test('Review-I1 leading U+FEFF is actual content, not transport BOM', async () => {
  const text = '\uFEFF원문\r\n';
  assert.equal(await P.decryptContent(await oldCipher(text), password), text);
  assert.equal(await P.decryptContent(await P.encryptContent(text, password), password), text);
});
await test('Review-I2 every semantic origin has exact purpose-specific metadata', async () => {
  for (const damage of [o => delete o.mutation_id, o => delete o.operation, o => delete o.restore_source_ref,
    o => o.extra = 1, o => o.mutation_id = true, o => o.target_ciphertext_sha256 = 'bad']) {
    const invalid = clone(origin); damage(invalid);
    await assert.rejects(() => P.encryptRepresentation(snapshot, { ...destination(), operation_origin: invalid }, password));
  }
  const incomplete = { purpose: 'protected_write', quote_id: u(7) };
  const r = await wrap({ schema_version: 1, binding: bind, snapshot, origin: incomplete, content_origin_kind: 'semantic', semantic_sha256: sha(P.canonicalJson(snapshot)) });
  await assert.rejects(() => decode(r, descriptor(r), { value: incomplete, legacy: null }));
});
await test('Review-I3 wrong owner/local cannot be encrypted under another binding', async () => {
  for (const field of ['owner_id', 'local_id']) {
    const input = clone(snapshot); input.note[field] = 'other';
    await assert.rejects(() => P.encryptRepresentation(input, destination(), password));
  }
});
await test('all native semantic purposes and schema1/3 MA replan keep typed origins', async () => {
  const cp = { purpose: 'current_plain_transition', operation_id: u(7), mutation_id: u(8),
    source_inventory_ref: { kind: 'note_revision', id: u(1) }, selected_physical_note_id: 17, target_current_mode: 'plain' };
  const mw = { purpose: 'mixed_note_write', operation_id: u(7), mutation_id: u(8), operation: 'put', restore_source_ref: null, restore_source_descriptor: null };
  const pi = { purpose: 'protected_import', import_id: u(7), mutation_id: u(8), operation: 'import', restore_source_ref: null, target_ciphertext_sha256: null };
  const mi = { purpose: 'mixed_offline_import', operation_id: u(7), mutation_id: u(8), entries: [{ revision_id: u(19), parent_ref: null,
    origin_device_id: 'original-device', source_kind: 'snapshot_v1', source_epoch: 0, target_kind: 'history_envelope_v1', target_epoch: 2,
    expected_existing: null, provenance: { kind: 'plain_branch', origin_server_instance_id: u(2), origin_owner_id: 'alice', origin_revision_ref: null } }] };
  for (const value of [cp, mw, pi, mi]) {
    const r = await P.encryptRepresentation(snapshot, { ...destination(), operation_origin: value }, password);
    assert.equal(P.canonicalJson(await decode(r, descriptor(r), { value, legacy: null })), P.canonicalJson(snapshot));
    const invalid = clone(value); invalid.extra = true;
    await assert.rejects(() => decode(r, descriptor(r), { value: invalid, legacy: null }));
  }
  for (const schema_version of [1, 3]) {
    const value = { purpose: 'mixed_analysis_write', operation_id: u(7), request_type: 'replan', execution_ref: { schema_version,
      execution_id: u(18), terminal_run_version: 2, terminal_receipt_digest: sha('terminal'), original_bundle_digest: sha('bundle') },
      original_source_context: { server_instance_id: u(2), base: schema_version === 3 ? context : base, catalog_digest: sha('catalog') }, previous_write_id: null };
    const target = destination({ kind: 'analysis_result', id: '9', slot: 'result_json' }, 'linked_text_envelope_v1');
    target.expected_binding.revision_ref = null; target.operation_origin = value;
    const r = await P.encryptRepresentation('original terminal', target, password), sd = descriptor(r, target);
    sd.origin_validator = 'linked_mixed_v1';
    assert.equal(await decode(r, sd, { value, legacy: null }), 'original terminal');
    const invalid = clone(value); delete invalid.execution_ref.terminal_receipt_digest;
    await assert.rejects(() => decode(r, sd, { value: invalid, legacy: null }));
  }
});
await test('both generated bundles embed exact runtime and keep release gate/version', async () => {
  for (const relative of ['../app.js', '../../desktop/app/app.js']) {
    const app = (await readFile(new URL(relative, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
    assert.ok(app.includes(source.replace(/\r\n/g, '\n')));
    assert.ok(app.includes('const APP_VERSION = "2.3.9"'));
    assert.ok(app.includes('historyProtectionTransitionBlocked'));
  }
});
console.log(`E4b1 protocol: ${passed} PASS; synthetic memory/Web Crypto only; actual UI/DB/Provider NOT RUN`);
