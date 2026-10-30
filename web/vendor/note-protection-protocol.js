/* Typed protection protocol. Pure validation/crypto: no storage, requests or UI. */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const PREFIX = 'NOW_ENCRYPTED_V1:';
  const ITERATIONS = 210000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const HEX = /^[0-9a-f]{64}$/;
  const SLOTS = Object.freeze({ note_body: 'content', revision_snapshot: 'after', revision_before: 'before',
    inventory_snapshot: 'current', offline_snapshot: 'snapshot', reserved_offline_snapshot: 'snapshot',
    analysis_input: 'input_text', analysis_result: 'result_json', analysis_error: 'error_message', recording_transcript: 'transcript' });
  const KINDS = Object.keys(SLOTS).sort();
  const LINKED = ['analysis_input', 'analysis_result', 'analysis_error', 'recording_transcript'];
  const FULL15 = ['id', 'owner_id', 'local_id', 'device_id', 'note_type', 'title', 'content', 'parent_local_id',
    'level', 'tags', 'source', 'deleted_at', 'client_updated_at', 'created_at', 'updated_at'];
  const BASE = ['head_version', 'head_revision_id', 'crypto_epoch', 'history_generation', 'protection_state',
    'inventory_revision_ids', 'identity_state', 'current_exists'];
  const D = ['key', 'representation_kind', 'representation_epoch', 'is_null', 'representation_version', 'representation_etag',
    'storage_operation_id', 'semantic_origin_id', 'origin_validator', 'origin_row_required', 'expected_binding', 'revision_ref',
    'parent_ref', 'physical_note_id', 'inventory_revision_id', 'linked_slot_version', 'ciphertext_sha256'];
  const OLD_D = ['key', 'representation_kind', 'representation_epoch', 'representation_etag', 'is_null', 'total_bytes',
    'total_chunks', 'ciphertext_sha256', 'expected_binding', 'revision_ref', 'parent_ref', 'physical_note_id', 'inventory_revision_id', 'operation_origin'];
  const fail = code => { throw new Error(`note_protection:${code}`); };
  const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const has = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const exact = (v, fields) => {
    if (!record(v) || Object.keys(v).length !== fields.length || fields.some(k => !has(v, k))) fail('object_fields');
  };
  const integer = (v, min = 0) => { if (!Number.isSafeInteger(v) || Object.is(v, -0) || v < min) fail('integer'); return v; };
  const text = v => { if (typeof v !== 'string') fail('string'); unicode(v); return v; };
  const bool = v => { if (typeof v !== 'boolean') fail('boolean'); };
  const uuid = v => { if (typeof v !== 'string' || !UUID.test(v)) fail('uuid'); };
  const hex = v => { if (typeof v !== 'string' || !HEX.test(v)) fail('sha256'); };
  const nullable = (v, check) => { if (v !== null) check(v); };
  function unicode(v) {
    for (let i = 0; i < v.length; i++) {
      const n = v.charCodeAt(i);
      if (n >= 0xd800 && n <= 0xdbff) {
        const next = v.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail('unicode');
      } else if (n >= 0xdc00 && n <= 0xdfff) fail('unicode');
    }
  }
  function compareUtf8(a, b) {
    const x = encoder.encode(text(a)), y = encoder.encode(text(b));
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  }
  function canonicalJson(value) {
    const visiting = new Set();
    function encode(v) {
      if (v === null) return 'null';
      if (typeof v === 'string') return JSON.stringify(text(v));
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') { integer(v, -Number.MAX_SAFE_INTEGER); return String(v); }
      if (!record(v) && !Array.isArray(v)) fail('json_type');
      if (visiting.has(v)) fail('json_cycle');
      visiting.add(v);
      let result;
      if (Array.isArray(v)) {
        if (Object.keys(v).length !== v.length) fail('json_array');
        result = `[${v.map(encode).join(',')}]`;
      } else {
        if (Object.prototype.toString.call(v) !== '[object Object]') fail('json_object');
        result = `{${Object.keys(v).sort(compareUtf8).map(k => `${JSON.stringify(text(k))}:${encode(v[k])}`).join(',')}}`;
      }
      visiting.delete(v);
      return result;
    }
    return encode(value);
  }
  // JSON.parse alone loses duplicate keys and rounds wire integers before validation.
  function parseJson(input) {
    const s = typeof input === 'string' ? input : decoder.decode(input);
    let i = 0;
    const space = () => { while (/[\t\n\r ]/.test(s[i] || '\0')) i++; };
    function string() {
      const start = i++;
      while (i < s.length) {
        const ch = s[i++];
        if (ch === '\\') { i++; continue; }
        if (ch === '"') return text(JSON.parse(s.slice(start, i)));
      }
      fail('json_string');
    }
    function value(depth) {
      if (depth > 128) fail('json_depth');
      space();
      if (s[i] === '"') return string();
      if (s[i] === '{') {
        i++; space(); const out = Object.create(null), seen = new Set();
        if (s[i] === '}') { i++; return out; }
        while (i < s.length) {
          space(); if (s[i] !== '"') fail('json_key');
          const key = string(); if (seen.has(key)) fail('json_duplicate'); seen.add(key);
          space(); if (s[i++] !== ':') fail('json_colon');
          out[key] = value(depth + 1); space();
          const ch = s[i++]; if (ch === '}') return out; if (ch !== ',') fail('json_object');
        }
      } else if (s[i] === '[') {
        i++; space(); const out = [];
        if (s[i] === ']') { i++; return out; }
        while (i < s.length) {
          out.push(value(depth + 1)); space();
          const ch = s[i++]; if (ch === ']') return out; if (ch !== ',') fail('json_array');
        }
      } else {
        for (const [token, v] of [['null', null], ['true', true], ['false', false]]) if (s.startsWith(token, i)) { i += token.length; return v; }
        const match = /^-?(?:0|[1-9][0-9]*)/.exec(s.slice(i));
        if (match) { i += match[0].length; return integer(Number(match[0]), -Number.MAX_SAFE_INTEGER); }
      }
      fail('json_value');
    }
    const result = value(0); space(); if (i !== s.length) fail('json_trailing'); return result;
  }
  const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
  async function sha256(value) {
    const bytes = typeof value === 'string' ? encoder.encode(text(value)) : value;
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
  }
  const hashJson = value => sha256(canonicalJson(value));
  function validateKey(k) {
    exact(k, ['kind', 'id', 'slot']);
    if (!has(SLOTS, k.kind) || SLOTS[k.kind] !== k.slot) fail('key_kind_slot');
    if (['note_body', 'inventory_snapshot', ...LINKED].includes(k.kind)) {
      if (typeof k.id !== 'string' || !/^[1-9][0-9]*$/.test(k.id) || k.id.length > 36) fail('physical_id');
    } else uuid(k.id);
    return k;
  }
  const compareKey = (a, b) => { for (const f of ['kind', 'id', 'slot']) { const n = compareUtf8(a[f], b[f]); if (n) return n; } return 0; };
  function keyOrder(keys) {
    keys.forEach(validateKey);
    const result = [...keys].sort(compareKey);
    if (result.some((k, i) => i > 0 && compareKey(result[i - 1], k) === 0)) fail('duplicate_key');
    return result;
  }
  function ref(r) { if (r !== null) { exact(r, ['kind', 'id']); if (!['note_revision', 'offline_branch'].includes(r.kind)) fail('ref_kind'); uuid(r.id); } }
  function validateBinding(b) {
    exact(b, ['server_instance_id', 'owner_id', 'local_id', 'transition_id', 'crypto_epoch', 'destination_key', 'revision_ref', 'parent_ref']);
    uuid(b.server_instance_id); text(b.owner_id); text(b.local_id); uuid(b.transition_id); integer(b.crypto_epoch, 1);
    validateKey(b.destination_key); ref(b.revision_ref); ref(b.parent_ref);
    return b;
  }
  function validateBase(b) {
    exact(b, BASE); integer(b.head_version); nullable(b.head_revision_id, uuid); integer(b.crypto_epoch); integer(b.history_generation);
    if (!['legacy', 'protected', 'updating', 'mixed_updating'].includes(b.protection_state)) fail('protection_state');
    if (!['empty', 'coherent', 'ambiguous', 'branch_only', 'related_only'].includes(b.identity_state)) fail('identity_state');
    bool(b.current_exists); if (!Array.isArray(b.inventory_revision_ids)) fail('inventory_refs');
    b.inventory_revision_ids.forEach(uuid);
    if (new Set(b.inventory_revision_ids).size !== b.inventory_revision_ids.length) fail('inventory_duplicate');
    return b;
  }
  function validateContext(c) {
    exact(c, ['base', 'current_mode', 'selected_physical_note_id', 'mixed_metadata_version']);
    validateBase(c.base); if (!['plain', 'protected', 'absent'].includes(c.current_mode) || c.mixed_metadata_version !== 1) fail('context_mode');
    nullable(c.selected_physical_note_id, v => integer(v, 1));
    if ((c.current_mode === 'absent') !== (c.selected_physical_note_id === null) || c.base.current_exists !== (c.selected_physical_note_id !== null)) fail('context_selection');
    return c;
  }
  function validateDescriptor(d, schema) {
    if (![1, 2, 3].includes(schema)) fail('schema');
    const linked = LINKED.includes(d?.key?.kind);
    exact(d, schema === 3 ? D : linked ? [...OLD_D, 'slot_version'] : OLD_D);
    validateKey(d.key); integer(d.representation_epoch); bool(d.is_null);
    ref(d.revision_ref); ref(d.parent_ref); nullable(d.physical_note_id, v => integer(v, 1)); nullable(d.inventory_revision_id, uuid);
    const body = d.key.kind === 'note_body';
    const plain = ['snapshot_v1', 'plain_text_v1'].includes(d.representation_kind);
    const allowed = body ? ['plain_text_v1', 'content_encrypted_v1'] : linked ? ['plain_text_v1', 'linked_text_envelope_v1'] : ['snapshot_v1', 'history_envelope_v1'];
    if (!allowed.includes(d.representation_kind) || plain !== (d.representation_epoch === 0)) fail('kind_epoch');
    if (d.is_null || plain) { if (d.ciphertext_sha256 !== null) fail('null_plain_digest'); } else hex(d.ciphertext_sha256);
    if (plain || body) { if (d.expected_binding !== null) fail('plain_body_binding'); }
    else if (!d.is_null || d.expected_binding !== null) {
      validateBinding(d.expected_binding);
      if (!equal(d.expected_binding.destination_key, d.key) || d.expected_binding.crypto_epoch !== d.representation_epoch
        || !equal(d.expected_binding.revision_ref, d.revision_ref) || !equal(d.expected_binding.parent_ref, d.parent_ref)) fail('descriptor_binding');
    }
    if (schema === 3) {
      integer(d.representation_version, 1); uuid(d.representation_etag); nullable(d.storage_operation_id, uuid); nullable(d.semantic_origin_id, uuid);
      bool(d.origin_row_required);
      const validators = body ? ['body_v1', 'body_mixed_v1'] : linked ? ['linked_v1', 'linked_mixed_v1'] : ['native_v1', 'native_mixed_v1', 'a2a_pre_origin_v0'];
      if (!validators.includes(d.origin_validator)) fail('origin_validator');
      if (d.origin_row_required !== ['native_v1', 'native_mixed_v1'].includes(d.origin_validator)) fail('origin_required');
      if (d.expected_binding !== null && d.expected_binding.transition_id !== d.storage_operation_id) fail('storage_origin');
      if (!plain && d.storage_operation_id === null) fail('storage_missing');
      if (linked) integer(d.linked_slot_version, 1); else if (d.linked_slot_version !== null) fail('linked_version');
    } else {
      hex(d.representation_etag); integer(d.total_bytes); integer(d.total_chunks);
      if (d.total_chunks !== Math.ceil(d.total_bytes / 262144) || (d.is_null && d.total_bytes !== 0)) fail('descriptor_length');
      if (linked) integer(d.slot_version, 1);
    }
    return d;
  }
  function validateDestination(d, purpose) {
    exact(d, ['destination_key', 'source_keys', 'source_etag', 'output_kind', 'output_epoch', 'is_null', 'expected_binding']);
    validateKey(d.destination_key); keyOrder(d.source_keys); uuid(d.source_etag); integer(d.output_epoch); bool(d.is_null);
    if (!['current_plain_transition', 'mixed_conversion', 'mixed_note_write', 'mixed_offline_import', 'mixed_analysis_write', 'mixed_transcript_write'].includes(purpose)) fail('purpose');
    if (d.is_null && ['mixed_analysis_write', 'mixed_transcript_write'].includes(purpose) && d.expected_binding !== null) fail('null_binding');
    checkOutput({ key: d.destination_key, ...d, operation_origin: null }, false);
    return d;
  }
  function validateSnapshot(s) {
    exact(s, ['schema_version', 'note']); if (s.schema_version !== 1) fail('snapshot_schema');
    exact(s.note, FULL15); const n = s.note;
    nullable(n.id, v => integer(v, 1)); integer(n.level, 1);
    for (const f of ['owner_id', 'local_id', 'device_id', 'note_type', 'title', 'content']) text(n[f]);
    for (const f of ['parent_local_id', 'tags', 'source']) nullable(n[f], text);
    for (const f of ['created_at', 'updated_at', 'client_updated_at', 'deleted_at']) {
      if (n[f] === null && ['deleted_at', 'client_updated_at'].includes(f)) continue;
      text(n[f]); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(n[f])) fail('snapshot_time');
    }
    return s;
  }
  function base64(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(out);
  }
  function unbase64(v) {
    if (typeof v !== 'string' || v.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)) fail('base64');
    const bytes = Uint8Array.from(atob(v), c => c.charCodeAt(0));
    if (base64(bytes) !== v) fail('base64'); return bytes;
  }
  async function derive(password, salt, iterations, usage) {
    if (typeof password !== 'string' || password.length === 0) fail('key_missing');
    const material = await crypto.subtle.importKey('raw', encoder.encode(text(password)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, [usage]);
  }
  async function encryptContent(value, password) {
    text(value);
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derive(password, salt, ITERATIONS, 'encrypt');
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
    return PREFIX + btoa(JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
      salt: base64(salt), iv: base64(iv), data: base64(new Uint8Array(data)) }));
  }
  async function decryptContent(value, password) {
    if (typeof value !== 'string' || !value.startsWith(PREFIX)) fail('content_cipher');
    const p = parseJson(unbase64(value.slice(PREFIX.length)));
    exact(p, ['v', 'alg', 'kdf', 'iterations', 'salt', 'iv', 'data']);
    if (p.v !== 1 || p.alg !== 'AES-GCM' || p.kdf !== 'PBKDF2-SHA256') fail('content_algorithm');
    integer(p.iterations, 1);
    if (p.iterations !== ITERATIONS) fail('content_iterations');
    const salt = unbase64(p.salt), iv = unbase64(p.iv), data = unbase64(p.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16) fail('content_parameters');
    const key = await derive(password, salt, p.iterations, 'decrypt');
    return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
  }
  function checkOutput(d, strict = true) {
    if (strict) exact(d, ['key', 'output_kind', 'output_epoch', 'is_null', 'expected_binding', 'operation_origin']);
    validateKey(d.key); integer(d.output_epoch); bool(d.is_null);
    const body = d.key.kind === 'note_body', linked = LINKED.includes(d.key.kind);
    const allowed = body ? ['plain_text_v1', 'content_encrypted_v1'] : linked ? ['plain_text_v1', 'linked_text_envelope_v1'] : ['snapshot_v1', 'history_envelope_v1'];
    if (!allowed.includes(d.output_kind) || (d.output_epoch === 0) !== ['snapshot_v1', 'plain_text_v1'].includes(d.output_kind)) fail('output_kind_epoch');
    if (body || d.output_epoch === 0) { if (d.expected_binding !== null) fail('output_binding'); }
    else if (!d.is_null || d.expected_binding !== null) {
      validateBinding(d.expected_binding);
      if (!equal(d.key, d.expected_binding.destination_key) || d.output_epoch !== d.expected_binding.crypto_epoch) fail('output_binding');
    }
  }
  function sourceContext(c, mixed) {
    exact(c, ['server_instance_id', 'base', 'catalog_digest']); uuid(c.server_instance_id); hex(c.catalog_digest);
    if (mixed) validateContext(c.base); else validateBase(c.base);
  }
  function validateOrigin(o) {
    if (o === null) return o;
    if (!record(o)) fail('semantic_origin');
    const p = o.purpose;
    if (p === 'protected_write' || p === 'protected_import') {
      exact(o, ['purpose', p === 'protected_write' ? 'quote_id' : 'import_id', 'mutation_id', 'operation', 'restore_source_ref', 'target_ciphertext_sha256']);
      uuid(o[p === 'protected_write' ? 'quote_id' : 'import_id']); uuid(o.mutation_id); ref(o.restore_source_ref); nullable(o.target_ciphertext_sha256, hex);
      if (!(p === 'protected_import' ? ['import'] : ['put', 'create', 'restore']).includes(o.operation)) fail('origin_operation');
      if ((o.operation === 'restore') !== (o.restore_source_ref !== null) || (o.operation === 'restore') !== (o.target_ciphertext_sha256 !== null)) fail('restore_origin');
    } else if (p === 'current_plain_transition') {
      exact(o, ['purpose', 'operation_id', 'mutation_id', 'source_inventory_ref', 'selected_physical_note_id', 'target_current_mode']);
      uuid(o.operation_id); uuid(o.mutation_id); ref(o.source_inventory_ref); integer(o.selected_physical_note_id, 1);
      if (o.source_inventory_ref === null || o.source_inventory_ref.kind !== 'note_revision' || o.target_current_mode !== 'plain') fail('plain_origin');
    } else if (p === 'mixed_note_write') {
      exact(o, ['purpose', 'operation_id', 'mutation_id', 'operation', 'restore_source_ref', 'restore_source_descriptor']);
      uuid(o.operation_id); uuid(o.mutation_id); ref(o.restore_source_ref);
      if (!['put', 'delete', 'create', 'restore'].includes(o.operation)) fail('origin_operation');
      if (o.restore_source_descriptor !== null) validateDescriptor(o.restore_source_descriptor, 3);
      if ((o.operation === 'restore') !== (o.restore_source_ref !== null) || (o.operation === 'restore') !== (o.restore_source_descriptor !== null)) fail('restore_origin');
    } else if (p === 'mixed_offline_import') {
      exact(o, ['purpose', 'operation_id', 'mutation_id', 'entries']); uuid(o.operation_id); uuid(o.mutation_id);
      if (!Array.isArray(o.entries) || o.entries.length === 0) fail('import_entries');
      const ids = new Set();
      for (const e of o.entries) {
        exact(e, ['revision_id', 'parent_ref', 'origin_device_id', 'source_kind', 'source_epoch', 'target_kind', 'target_epoch', 'expected_existing', 'provenance']);
        uuid(e.revision_id); if (ids.has(e.revision_id)) fail('import_duplicate'); ids.add(e.revision_id);
        ref(e.parent_ref); text(e.origin_device_id); integer(e.source_epoch); integer(e.target_epoch);
        for (const [kind, epoch] of [[e.source_kind, e.source_epoch], [e.target_kind, e.target_epoch]]) {
          if (!['snapshot_v1', 'history_envelope_v1'].includes(kind) || (epoch === 0) !== (kind === 'snapshot_v1')) fail('import_kind_epoch');
        }
        if (e.source_kind === 'history_envelope_v1' && e.target_kind !== 'history_envelope_v1') fail('import_plain_downgrade');
        nullable(e.expected_existing, d => validateDescriptor(d, 3));
        const ip = e.provenance, common = ['kind', 'origin_server_instance_id', 'origin_owner_id'];
        if (!record(ip)) fail('import_provenance');
        if (ip.kind === 'post_plain_draft') { exact(ip, [...common, 'mode_operation_id', 'mode_receipt_digest']); uuid(ip.mode_operation_id); hex(ip.mode_receipt_digest); }
        else if (ip.kind === 'cipher_branch') { exact(ip, [...common, 'origin_storage_operation_id']); nullable(ip.origin_storage_operation_id, uuid); }
        else if (ip.kind === 'plain_branch') { exact(ip, [...common, 'origin_revision_ref']); ref(ip.origin_revision_ref); }
        else fail('import_provenance');
        uuid(ip.origin_server_instance_id); text(ip.origin_owner_id);
      }
    } else if (p === 'mixed_analysis_write') {
      if (o.request_type === 'initial') {
        exact(o, ['purpose', 'operation_id', 'execution_id', 'request_type', 'source_context', 'source_digest', 'terminal_receipt_digest', 'original_bundle_digest', 'previous_write_id']);
        uuid(o.execution_id); sourceContext(o.source_context, true); hex(o.source_digest); hex(o.terminal_receipt_digest); hex(o.original_bundle_digest);
        if (o.previous_write_id !== null) fail('initial_origin');
      } else if (o.request_type === 'replan') {
        exact(o, ['purpose', 'operation_id', 'request_type', 'execution_ref', 'original_source_context', 'previous_write_id']);
        const r = o.execution_ref;
        exact(r, ['schema_version', 'execution_id', 'terminal_run_version', 'terminal_receipt_digest', 'original_bundle_digest']);
        if (![1, 3].includes(r.schema_version)) fail('execution_ref_schema');
        uuid(r.execution_id); integer(r.terminal_run_version, 1); hex(r.terminal_receipt_digest); hex(r.original_bundle_digest);
        sourceContext(o.original_source_context, r.schema_version === 3); nullable(o.previous_write_id, uuid);
      } else fail('analysis_origin');
      uuid(o.operation_id);
    } else if (p === 'mixed_transcript_write') {
      exact(o, ['purpose', 'operation_id', 'recording_id', 'previous_descriptor']);
      uuid(o.operation_id); integer(o.recording_id, 1); validateDescriptor(o.previous_descriptor, 3);
      if (o.previous_descriptor.key.kind !== 'recording_transcript' || o.previous_descriptor.key.id !== String(o.recording_id)) fail('transcript_origin');
    } else fail('semantic_origin');
    return o;
  }
  function originExpectation(e, d, schema) {
    exact(e, ['value', 'legacy']);
    if (e.legacy !== null && e.legacy !== 'a2a_pre_origin_v0') fail('legacy_evidence');
    if (e.value !== null) {
      validateOrigin(e.value);
      const id = e.value.operation_id ?? e.value.quote_id ?? e.value.import_id; uuid(id);
      if (schema === 3 && d.semantic_origin_id !== id) fail('semantic_origin_id');
    } else if (schema === 3 && d.semantic_origin_id !== null) fail('semantic_origin_missing');
    if (schema !== 3 && !equal(d.operation_origin, e.value)) fail('legacy_origin');
    if (e.legacy !== null && (e.value !== null || (schema === 3 && d.origin_validator !== e.legacy))) fail('legacy_evidence');
  }
  async function decryptRepresentation(raw, descriptor, expectedOrigin, keyResolver, schemaVersion) {
    // Copy across awaits so caller mutations cannot retarget an in-flight decryption.
    const d = parseJson(canonicalJson(validateDescriptor(descriptor, schemaVersion)));
    const e = parseJson(canonicalJson(expectedOrigin)); originExpectation(e, d, schemaVersion);
    if (d.is_null) { if (raw !== null) fail('null_representation'); return null; }
    text(raw);
    if (d.representation_epoch > 0 && await sha256(raw) !== d.ciphertext_sha256) fail('ciphertext_digest');
    if (schemaVersion !== 3 && encoder.encode(raw).length !== d.total_bytes) fail('raw_length');
    if (d.representation_kind === 'plain_text_v1') return raw;
    if (typeof keyResolver !== 'function') fail('key_resolver');
    if (d.representation_kind === 'content_encrypted_v1') return decryptContent(raw, await keyResolver(d));
    let value;
    if (d.representation_kind === 'snapshot_v1') value = validateSnapshot(parseJson(raw));
    else {
      const outer = parseJson(raw);
      exact(outer, ['schema_version', 'kind', 'crypto_epoch', 'binding', 'ciphertext']);
      if (outer.schema_version !== 1 || outer.kind !== d.representation_kind || outer.crypto_epoch !== d.representation_epoch || !equal(outer.binding, d.expected_binding)) fail('envelope_binding');
      const inner = parseJson(await decryptContent(outer.ciphertext, await keyResolver(d)));
      const linked = d.representation_kind === 'linked_text_envelope_v1';
      const fields = ['schema_version', 'binding', linked ? 'value' : 'snapshot', 'semantic_sha256'];
      if (!linked) fields.push('content_origin_kind');
      else if (has(inner, 'content_origin_kind')) fields.push('content_origin_kind');
      if (!linked && (has(inner, 'origin') || e.legacy === null)) fields.push('origin');
      exact(inner, fields);
      if (inner.schema_version !== 1 || !equal(inner.binding, d.expected_binding)) fail('inner_binding');
      if ((!linked && inner.content_origin_kind !== 'semantic') || (linked && has(inner, 'content_origin_kind') && inner.content_origin_kind !== 'linked_text')) fail('inner_meaning');
      if (!linked && (has(inner, 'origin') ? !equal(inner.origin, e.value) : e.legacy !== 'a2a_pre_origin_v0')) fail('inner_origin');
      value = linked ? text(inner.value) : validateSnapshot(inner.snapshot);
      hex(inner.semantic_sha256);
      if (await sha256(linked ? value : canonicalJson(value)) !== inner.semantic_sha256) fail('semantic_digest');
    }
    if (record(value) && has(value, 'note')) {
      if (d.expected_binding && (value.note.owner_id !== d.expected_binding.owner_id || value.note.local_id !== d.expected_binding.local_id)) fail('snapshot_scope');
      // Old snapshot_v1 may contain a v1 content cipher; its meaning is not that cipher string.
      if (d.representation_kind === 'snapshot_v1' && value.note.content.startsWith(PREFIX)) value.note.content = await decryptContent(value.note.content, await keyResolver(d));
    }
    return value;
  }
  async function encryptRepresentation(value, destination, password) {
    checkOutput(destination);
    const d = parseJson(canonicalJson(destination));
    validateOrigin(d.operation_origin);
    if (d.is_null) { if (value !== null) fail('null_output'); return null; }
    if (d.output_kind === 'content_encrypted_v1') return encryptContent(text(value), password);
    if (d.output_kind === 'plain_text_v1') return text(value);
    if (d.output_kind === 'snapshot_v1') return canonicalJson(validateSnapshot(value));
    const linked = d.output_kind === 'linked_text_envelope_v1';
    if (linked) text(value); else validateSnapshot(value);
    if (!linked && (value.note.owner_id !== d.expected_binding.owner_id || value.note.local_id !== d.expected_binding.local_id)) fail('snapshot_scope');
    value = parseJson(canonicalJson(value));
    const inner = { schema_version: 1, binding: d.expected_binding, [linked ? 'value' : 'snapshot']: value,
      semantic_sha256: await sha256(linked ? value : canonicalJson(value)) };
    if (!linked) { inner.content_origin_kind = 'semantic'; inner.origin = d.operation_origin; }
    return canonicalJson({ schema_version: 1, kind: d.output_kind, crypto_epoch: d.output_epoch, binding: d.expected_binding,
      ciphertext: await encryptContent(canonicalJson(inner), password) });
  }
  function count(items) {
    const stats = values => ({ total: values.length, nonnull: values.filter(v => !v.is_null).length, nulls: values.filter(v => v.is_null).length });
    return { ...stats(items), by_kind: KINDS.map(kind => ({ kind, ...stats(items.filter(v => v.key.kind === kind)) })) };
  }
  function cursorJson(token) {
    text(token);
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(token)) fail('cursor');
    const normalized = token.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    return parseJson(unbase64(normalized + '='.repeat((4 - normalized.length % 4) % 4)));
  }
  async function verifyCatalog(pages, expected) {
    const e = parseJson(canonicalJson(expected));
    exact(e, ['schema_version', 'server_instance_id', 'owner_id', 'local_id', 'device_id', 'context', 'catalog_digest']);
    if (![1, 2, 3].includes(e.schema_version)) fail('schema');
    uuid(e.server_instance_id); text(e.owner_id); text(e.local_id); text(e.device_id); hex(e.catalog_digest);
    if (e.schema_version === 3) validateContext(e.context);
    if (!Array.isArray(pages) || pages.length === 0) fail('pages_missing');
    const items = [], seenCursors = new Set(); let coverage, counts;
    const scope = e.schema_version === 3 ? await hashJson({ server_instance_id: e.server_instance_id, owner_id: e.owner_id, local_id: e.local_id,
      device_id: e.device_id, context: e.context, catalog_digest: e.catalog_digest }) : null;
    for (let index = 0; index < pages.length; index++) {
      const p = parseJson(canonicalJson(pages[index]));
      exact(p, e.schema_version === 3 ? ['schema_version', 'context', 'catalog_digest', 'counts', 'coverage', 'entries', 'next_cursor']
        : ['context', 'catalog_digest', 'counts', 'coverage', 'items', 'next_cursor']);
      if ((e.schema_version === 3 && p.schema_version !== 3) || !equal(p.context, e.context) || p.catalog_digest !== e.catalog_digest) fail('catalog_context');
      const rows = e.schema_version === 3 ? p.entries : p.items;
      if (!Array.isArray(rows)) fail('catalog_rows');
      for (const d of rows) { validateDescriptor(d, e.schema_version); items.push(d); }
      if (index === 0) { coverage = p.coverage; counts = p.counts; }
      else if (!equal(coverage, p.coverage) || !equal(counts, p.counts)) fail('catalog_metadata');
      if (p.next_cursor === null) { if (index !== pages.length - 1) fail('page_after_terminal'); }
      else {
        if (index === pages.length - 1 || rows.length === 0 || seenCursors.has(p.next_cursor)) fail('page_missing');
        seenCursors.add(p.next_cursor); const c = cursorJson(p.next_cursor);
        if (e.schema_version === 3) {
          exact(c, ['schema_version', 'scope_digest', 'last_key']);
          if (c.schema_version !== 3 || c.scope_digest !== scope || !equal(c.last_key, rows.at(-1).key)) fail('cursor_context');
        } else {
          exact(c, ['context', 'owner', 'local', 'after']);
          if (!equal(c.context, e.context) || c.owner !== e.owner_id || c.local !== e.local_id || !equal(c.after, rows.at(-1).key)) fail('cursor_context');
        }
      }
    }
    const ordered = keyOrder(items.map(d => d.key));
    if (!equal(ordered, items.map(d => d.key))) fail('catalog_order');
    if (e.schema_version === 3) {
      exact(coverage, ['supported_kinds', 'scope_complete', 'full_protection_complete']);
      if (!equal(coverage.supported_kinds, KINDS) || coverage.scope_complete !== true || coverage.full_protection_complete !== false || !equal(counts, count(items))) fail('catalog_counts');
      const digest = await hashJson({ server_instance_id: e.server_instance_id, owner_id: e.owner_id, local_id: e.local_id, context: e.context, entries: items });
      if (digest !== e.catalog_digest) fail('catalog_digest');
    } else {
      exact(coverage, ['scope', 'scope_complete', 'supported_kinds', 'full_protection_complete']);
      if (coverage.scope !== 'note_history' || coverage.scope_complete !== true || coverage.full_protection_complete !== false || !Array.isArray(coverage.supported_kinds)) fail('catalog_coverage');
      const legacyKinds = ['note_body', 'revision_snapshot', 'revision_before', 'inventory_snapshot', 'offline_snapshot'];
      if (items.some(d => LINKED.includes(d.key.kind))) legacyKinds.push(...LINKED);
      if (!equal(coverage.supported_kinds, legacyKinds)) fail('catalog_kinds');
      if (!equal(counts, Object.fromEntries(legacyKinds.map(k => [k, items.filter(d => d.key.kind === k).length])))) fail('catalog_counts');
      const context = Object.fromEntries(Object.entries(e.context).filter(([k]) => k !== 'catalog_digest'));
      if (e.context.server_instance_id !== e.server_instance_id || e.context.catalog_digest !== e.catalog_digest
        || await hashJson({ context, items }) !== e.catalog_digest) fail('catalog_digest');
    }
    return items;
  }
  globalThis.NowNoteProtectionProtocol = Object.freeze({ canonicalJson, parseJson, sha256, hashJson, keyOrder, validateKey,
    validateBinding, validateBase, validateContext, validateDescriptor, validateDestination, validateSnapshot, verifyCatalog,
    encryptContent, decryptContent, encryptRepresentation, decryptRepresentation });
})();
