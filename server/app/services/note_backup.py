"""Explicit E5 snapshot format; credentials and client decryption keys are excluded."""
import base64
import json
from datetime import datetime
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, text, create_engine, Boolean, DateTime, Integer, LargeBinary, String
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import inspect, func
from fastapi import HTTPException

from app.core.capabilities import API_VERSION
from app.core.config import get_settings
from app.models.library import LibraryResource, LibraryMutation
from app.models.note import Note, Recording, UserAccount, UserDevice, AnalysisJob, SyncLog, ReleaseEvidenceRecord
from app.models.note_crypto import (ServerIdentity, NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence,
                                   NoteCryptoUpload, NoteCryptoChunk, NoteRepresentationOrigin)
from app.models.note_history import NoteHead, NoteRevision, NoteInventory
from app.models.note_v2 import NoteOfflineBranch, NoteMutation
from app.models.note_mixed import MixedSchema, MixedScope, MixedSlot
from app.models.note_related import LinkedSchema, LinkedText, RelatedDrain, AnalysisRun
from app.models.protected_analysis import ProtectedAnalysisClaim


SECTIONS = {
    'notes': Note, 'recordings': Recording, 'users': UserAccount, 'devices': UserDevice,
    'analysis_jobs': AnalysisJob, 'sync_logs': SyncLog, 'release_evidence_records': ReleaseEvidenceRecord,
    'library_resources': LibraryResource, 'library_mutations': LibraryMutation,
    'server_identity': ServerIdentity, 'note_heads': NoteHead, 'note_revisions': NoteRevision,
    'note_inventory': NoteInventory, 'note_offline_branches': NoteOfflineBranch, 'note_mutations': NoteMutation,
    'note_crypto_transitions': NoteCryptoTransition, 'note_crypto_entries': NoteCryptoEntry,
    'note_crypto_fences': NoteCryptoFence, 'note_crypto_uploads': NoteCryptoUpload,
    'note_crypto_chunks': NoteCryptoChunk, 'note_representation_origins': NoteRepresentationOrigin,
    'note_mixed_schema': MixedSchema, 'note_mixed_scopes': MixedScope, 'note_mixed_slots': MixedSlot,
    'note_linked_schema': LinkedSchema, 'note_linked_texts': LinkedText, 'note_related_drains': RelatedDrain,
    'note_analysis_runs': AnalysisRun, 'note_protected_analysis_claims': ProtectedAnalysisClaim,
}
EXCLUDED = {'users': {'password_hash', 'password_recovery_hash', 'access_token_hash'},
            'devices': {'access_token_hash', 'access_token_value'}}
DERIVED = {'users': {'access_token_configured', 'password_configured'}, 'devices': {'access_token_configured'}}


def recovery_metadata(items):
    from app.services.note_crypto_fence import ACTIVE_STATES
    active = set(ACTIVE_STATES)
    operations = [{name: row[name] for name in ('owner_id', 'local_id', 'id', 'purpose', 'state')}
                  for row in items['note_crypto_transitions'] if row['state'] in active]
    operation_states = {row['id']: row['state'] for row in items['note_crypto_transitions']}
    drains = [{name: row[name] for name in ('owner_id', 'local_id', 'id', 'state', 'transition_id')}
              for row in items['note_related_drains'] if row['state'] in ('draining', 'ready') or
              row['state'] == 'promoted' and operation_states.get(row['transition_id']) in active]
    executions = [{name: row[name] for name in ('owner_id', 'local_id', 'id', 'state')}
                  for row in items['note_protected_analysis_claims'] if row['state'] in ('client_pending', 'client_running', 'cancel_requested')]
    return {'requires_reauthentication': True, 'includes_client_journals': False,
            'requires_reconciliation': bool(operations or drains or executions),
            'incomplete_operations': operations, 'incomplete_drains': drains, 'incomplete_executions': executions}


def export_snapshot(db):
    from app.api.admin import _model_to_dict, _backup_content_sha256
    bind = db.get_bind()
    engine = bind.engine if isinstance(bind, Connection) else bind
    with engine.connect() as connection:
        if connection.dialect.name == 'postgresql':
            connection = connection.execution_options(isolation_level='REPEATABLE READ')
        with Session(connection, autoflush=False) as snapshot:
            if connection.dialect.name == 'sqlite':
                snapshot.execute(text('BEGIN'))
            elif connection.dialect.name == 'postgresql':
                snapshot.execute(text('SET TRANSACTION READ ONLY'))
            items = {}
            for section, model in SECTIONS.items():
                rows = []
                for row in snapshot.scalars(select(model).order_by(*model.__table__.primary_key.columns)):
                    value = _model_to_dict(row)
                    if section == 'note_crypto_chunks':
                        value['data_base64'] = base64.b64encode(value.pop('data')).decode('ascii')
                    rows.append(value)
                items[section] = rows
            if len(items['server_identity']) != 1:
                raise ValueError('backup_identity_missing')
            value = jsonable_encoder({
                'name': 'now_note_server_backup', 'backup_schema_version': 3, 'api_version': API_VERSION,
                'server': get_settings().server_name, 'exported_at': datetime.utcnow(),
                'server_instance_id': items['server_identity'][0]['instance_id'],
                'includes_recording_files': False, 'includes_deleted_notes': True,
                'summary': {key: len(rows) for key, rows in items.items()},
                'section_counts': {key: len(rows) for key, rows in items.items()},
                'recovery': recovery_metadata(items), 'items': items,
            })
            value['content_sha256'] = _backup_content_sha256(value)
            validate_backup(value)
            return value


def validate_backup(value):
    from app.api.admin import _backup_content_sha256
    from app.services.library_backup import validate_library_backup
    required = {'name', 'backup_schema_version', 'api_version', 'server', 'exported_at', 'server_instance_id',
                'includes_recording_files', 'includes_deleted_notes', 'summary', 'section_counts', 'recovery', 'items', 'content_sha256'}
    if not isinstance(value, dict) or set(value) != required or value['name'] != 'now_note_server_backup' or \
       type(value['backup_schema_version']) is not int or value['backup_schema_version'] != 3 or value['api_version'] != API_VERSION:
        raise ValueError('backup_format')
    if value['includes_recording_files'] is not False or value['includes_deleted_notes'] is not True:
        raise ValueError('backup_coverage')
    items = value['items']
    if not isinstance(items, dict) or set(items) != set(SECTIONS):
        raise ValueError('backup_sections')
    counts = {}
    for section, model in SECTIONS.items():
        rows = items[section]
        if not isinstance(rows, list):
            raise ValueError('backup_section')
        columns = {col.name for col in model.__table__.columns} - EXCLUDED.get(section, set())
        if section == 'note_crypto_chunks':
            columns = columns - {'data'} | {'data_base64'}
        columns |= DERIVED.get(section, set())
        keys = set()
        for row in rows:
            if not isinstance(row, dict) or set(row) != columns:
                raise ValueError('backup_columns')
            key = tuple(row[col.name] for col in model.__table__.primary_key.columns)
            if key in keys:
                raise ValueError('backup_duplicate')
            keys.add(key)
        counts[section] = len(rows)
    if any(not isinstance(value[name], dict) or set(value[name]) != set(counts)
           or any(type(n) is not int or n < 0 for n in value[name].values()) for name in ('section_counts', 'summary')):
        raise ValueError('backup_counts')
    if value['section_counts'] != counts or value['summary'] != counts:
        raise ValueError('backup_counts')
    identity = items['server_identity']
    if len(identity) != 1 or identity[0]['id'] != 1 or str(UUID(value['server_instance_id'])) != value['server_instance_id'] or identity[0]['instance_id'] != value['server_instance_id']:
        raise ValueError('backup_identity')
    if value['recovery'] != recovery_metadata(items):
        raise ValueError('backup_recovery')
    unsigned = {key: item for key, item in value.items() if key != 'content_sha256'}
    if value['content_sha256'] != _backup_content_sha256(unsigned):
        raise ValueError('backup_checksum')
    validate_library_backup(value)
    validate_rows(items)
    return counts


def decoded_row(section, model, row):
    result = {}
    for column in model.__table__.columns:
        if column.name in EXCLUDED.get(section, set()):
            continue
        name = 'data_base64' if section == 'note_crypto_chunks' and column.name == 'data' else column.name
        value = row[name]
        if value is None:
            if not column.nullable:
                raise ValueError('backup_null_column')
        elif isinstance(column.type, LargeBinary):
            if not isinstance(value, str) or len(value) > 349528:
                raise ValueError('backup_binary')
            raw = base64.b64decode(value, validate=True)
            if base64.b64encode(raw).decode('ascii') != value:
                raise ValueError('backup_binary')
            value = raw
        elif isinstance(column.type, Boolean):
            if type(value) is not bool:
                raise ValueError('backup_boolean')
        elif isinstance(column.type, Integer):
            flag = section in ('users', 'devices') and column.name in ('is_active', 'two_factor_enabled')
            if type(value) is not int and not (flag and type(value) is bool):
                raise ValueError('backup_integer')
        elif isinstance(column.type, DateTime):
            if not isinstance(value, str):
                raise ValueError('backup_time')
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if value.tzinfo is not None:
                if value.utcoffset().total_seconds() != 0:
                    raise ValueError('backup_time')
                value = value.replace(tzinfo=None)
        elif isinstance(column.type, String):
            if not isinstance(value, str) or column.type.length and len(value) > column.type.length:
                raise ValueError('backup_text')
            value.encode('utf-8')
        else:
            raise ValueError('backup_column_type')
        result[column.name] = value
    for key in DERIVED.get(section, set()):
        if type(row[key]) is not bool:
            raise ValueError('backup_credential_flag')
    return result


def validate_rows(items):
    from app.db import Base
    # Core inserts bypass ORM capture hooks. Nothing is loaded into the source DB.
    engine = create_engine('sqlite:///:memory:')
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql('PRAGMA foreign_keys=ON')
            Base.metadata.create_all(connection)
            for table in Base.metadata.sorted_tables:
                match = next(((section, model) for section, model in SECTIONS.items() if model.__table__ is table), None)
                if match is None:
                    continue
                section, model = match
                for row in items[section]:
                    connection.execute(table.insert().values(**decoded_row(section, model, row)))
            connection.exec_driver_sql('PRAGMA query_only=ON')
            with Session(connection, autoflush=False) as validation:
                validate_graphs(validation)
                validate_wikis(validation)
                validate_operations(validation)
                validate_related_references(validation)
                validate_executions(validation)
                validate_uploads(validation)
    except (SQLAlchemyError, HTTPException, KeyError, TypeError, AttributeError, ValueError) as exc:
        detail = exc.detail.get('code') if isinstance(exc, HTTPException) and isinstance(exc.detail, dict) else None
        code = detail if isinstance(detail, str) and detail.replace('_', '').isalnum() else type(exc).__name__
        if type(exc) is ValueError and str(exc).startswith('backup_') and str(exc).replace('_','').isascii() and str(exc).replace('_','').isalnum():
            code = str(exc)
        raise ValueError('backup_references:' + code) from None
    finally:
        engine.dispose()


def validate_wikis(db):
    from app.services import wiki_guards as guard
    from app.services.wikis import parse_document, dependencies
    from app.schemas.note_v2 import Snapshot
    rows = list(db.scalars(select(LibraryResource).where(LibraryResource.kind == 'wikis')))
    indexes = {(row.owner_id, guard.link(row).artifact_local_id): row for row in rows}
    for row in rows:
        link = guard.link(row)
        key = (row.owner_id, link.artifact_local_id)
        if db.get(NoteHead, key) is None:
            raise ValueError('backup_wiki_head')
        refs = {(ref.owner_id, ref.local_id) for ref in link.dependencies}
        for owner, local in refs:
            source = db.get(NoteHead, (owner, local))
            if source is None or (owner, local) in indexes:
                raise ValueError('backup_wiki_source')
            if source.crypto_epoch > 0 and not guard.fully_protected(db, *key):
                raise ValueError('backup_wiki_plaintext_dependency')
        snapshots = []
        for model in (NoteRevision, NoteInventory, NoteOfflineBranch):
            for record in db.scalars(select(model).where(model.owner_id == key[0], model.local_id == key[1])):
                if record.representation_kind == 'snapshot_v1':
                    snapshots.append(record.snapshot_json)
                    before = getattr(record, 'before_snapshot_json', None)
                    if before is not None:
                        snapshots.append(before)
        for raw in snapshots:
            note = Snapshot.model_validate_json(raw).note
            if note.source != 'wiki-artifact' or note.title != 'AI Wiki ' + row.id:
                raise ValueError('backup_wiki_projection')
            value = parse_document(note.content, row.owner_id, row.id)
            if not set(dependencies([value])).issubset(refs):
                raise ValueError('backup_wiki_dependencies')
    for note in db.scalars(select(Note).where(Note.source == 'wiki-artifact')):
        if (note.owner_id, note.local_id) not in indexes:
            raise ValueError('backup_wiki_index')


def validate_graphs(db):
    from app.services.note_crypto import validate_existing_graph
    from app.services.note_mixed_metadata import validate as validate_mixed
    from app.schemas.note_v2 import Snapshot
    heads = {(row.owner_id, row.local_id): row for row in db.scalars(select(NoteHead))}
    revisions = list(db.scalars(select(NoteRevision)))
    inventory = list(db.scalars(select(NoteInventory)))
    branches = list(db.scalars(select(NoteOfflineBranch)))
    notes = list(db.scalars(select(Note)))
    scopes = set(heads) | {(row.owner_id, row.local_id) for row in revisions + inventory + branches}
    for owner, local in scopes:
        head = heads.get((owner, local))
        if head is None or not owner or min(head.crypto_epoch, head.version, head.history_generation) < 0:
            raise ValueError('backup_head')
        own = lambda rows: [row for row in rows if (row.owner_id, row.local_id) == (owner, local)]
        actual, inv, native, offline = own(notes), own(inventory), own(revisions), own(branches)
        validate_existing_graph(actual, inv, native, offline, head, independent=True)
        if head.crypto_epoch > 0:
            validate_mixed(db, owner, local)
        else:
            for row in inv + native + offline:
                if row.representation_epoch != 0 or row.representation_kind != 'snapshot_v1':
                    raise ValueError('backup_epoch')
                snapshot = Snapshot.model_validate_json(row.snapshot_json).note
                if (snapshot.owner_id, snapshot.local_id) != (owner, local):
                    raise ValueError('backup_snapshot_scope')
                physical = getattr(row, 'note_id', None)
                if physical is not None and snapshot.id != physical:
                    raise ValueError('backup_snapshot_identity')
                if isinstance(row, NoteRevision) and row.before_snapshot_json is not None:
                    before = Snapshot.model_validate_json(row.before_snapshot_json).note
                    if (before.owner_id, before.local_id, before.id) != (owner, local, row.note_id):
                        raise ValueError('backup_snapshot_scope')
    for row in db.scalars(select(MixedScope)):
        if (row.owner_id, row.local_id) not in heads or heads[(row.owner_id, row.local_id)].crypto_epoch < 1:
            raise ValueError('backup_mixed_scope')


def validate_uploads(db):
    from app.services import note_crypto_storage as store
    from app.services.note_v2 import canonical
    entries = {(row.transition_id, row.key_json): row for row in db.scalars(select(NoteCryptoEntry))}
    uploads = {(row.transition_id, row.key_json): row for row in db.scalars(select(NoteCryptoUpload))}
    grouped = {}
    for chunk in db.scalars(select(NoteCryptoChunk)):
        key = (chunk.transition_id, chunk.key_json)
        upload = uploads.get(key)
        if upload is None or key not in entries or chunk.chunk_index < 0 or chunk.chunk_index >= upload.total_chunks:
            raise ValueError('backup_chunk_reference')
        if len(chunk.data) != min(262144, upload.total_bytes - chunk.chunk_index * 262144) or store.sha(chunk.data) != chunk.chunk_sha256:
            raise ValueError('backup_chunk_bytes')
        grouped.setdefault(key, []).append(chunk)
    for key, upload in uploads.items():
        entry = entries.get(key)
        parsed = json.loads(upload.key_json, object_pairs_hook=store.strict_object)
        if entry is None or canonical(parsed) != upload.key_json or upload.total_bytes < 1 or upload.total_chunks != (upload.total_bytes + 262143) // 262144:
            raise ValueError('backup_upload')
        chunks = sorted(grouped.get(key, []), key=lambda row: row.chunk_index)
        if upload.ciphertext_sha256 is not None:
            if len(chunks) != upload.total_chunks:
                raise ValueError('backup_sealed_chunks')
            raw = b''.join(row.data for row in chunks)
            if store.sha(raw) != upload.ciphertext_sha256:
                raise ValueError('backup_ciphertext')
            binding = json.loads(entry.binding_json) if entry.binding_json is not None else None
            operation = db.get(NoteCryptoTransition, upload.transition_id)
            epoch = output_epoch(operation, entry)
            if type(epoch) is not int or epoch < 1:
                raise ValueError('backup_output_epoch')
            store.validate_output(raw, entry.output_kind, epoch, binding)


def validate_operations(db):
    from app.services import note_crypto as prep, note_crypto_storage as store
    from app.services import note_mixed_operations as mixed, note_mixed_related as related
    from app.services.note_crypto_fence import ACTIVE_STATES, TERMINAL_STATES
    from app.services.note_v2 import canonical
    identity = db.get(ServerIdentity, 1).instance_id
    fences = {row.transition_id: row for row in db.scalars(select(NoteCryptoFence))}
    operations = {row.id: row for row in db.scalars(select(NoteCryptoTransition))}
    for ident, fence in fences.items():
        row = operations.get(ident)
        if row is None or (fence.owner_id, fence.local_id) != (row.owner_id, row.local_id):
            raise ValueError('backup_fence')
    for row in operations.values():
        if row.state not in ACTIVE_STATES + TERMINAL_STATES or row.lease_version < 1:
            raise ValueError('backup_operation_state')
        if row.state in ACTIVE_STATES and row.id not in fences:
            raise ValueError('backup_fence')
        if db.get(NoteHead, (row.owner_id, row.local_id)) is None or db.scalar(select(UserDevice).where(
            UserDevice.owner_id == row.owner_id, UserDevice.device_id == row.actor_device_id)) is None:
            raise ValueError('backup_operation_scope')
        c = json.loads(row.conditions_json)
        request = c['request_core'] if row.purpose in ('protected_analysis_write', 'protected_transcript_write') else c['request']
        if tuple(request[k] for k in ('owner_id', 'local_id', 'device_id', 'mutation_id', 'server_instance_id')) != (
            row.owner_id, row.local_id, row.actor_device_id, row.mutation_id, identity):
            raise ValueError('backup_operation_scope')
        entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
        cores = sorted([prep.entry_result(entry) for entry in entries], key=lambda e: canonical(e['key']))
        if row.purpose in ('conversion', 'protected_write'):
            if c.get('schema_version') == 2:
                from app.services.related_conversion import fixed
                fixed(row)
                expected = [{key: item[key] for key in ('key', 'source_etag', 'source_kind', 'output_kind', 'representation_epoch')}
                            for item in c['metadata_sets']['entries']]
                if canonical(cores) != canonical(sorted(expected, key=lambda e: canonical(e['key']))):
                    raise ValueError('backup_operation_manifest')
            elif store.sha(store.canonical_bytes(cores)) != row.manifest_digest:
                raise ValueError('backup_operation_manifest')
        elif row.purpose == 'protected_import':
            from app.services.note_protected_import import condition
            condition(row)
        elif row.purpose in ('current_plain_transition', 'mixed_conversion', 'mixed_note_write', 'mixed_offline_import',
                             'mixed_analysis_write', 'mixed_transcript_write'):
            m = mixed.fixed(row)
            expected = {canonical(d['destination_key']): d for d in m['DSET'] if not d['is_null'] and d['output_epoch'] > 0}
            if {entry.key_json for entry in entries} != set(expected):
                raise ValueError('backup_operation_manifest')
            for entry in entries:
                d = expected[entry.key_json]
                binding = json.loads(entry.binding_json) if entry.binding_json is not None else None
                if (entry.source_etag, entry.source_kind, entry.output_kind, entry.representation_epoch) != (
                    d['source_etag'], 'client_pending', d['output_kind'], d['output_epoch']) or canonical(binding) != canonical(d['expected_binding']):
                    raise ValueError('backup_operation_entry')
            if row.state == 'committed' and row.purpose in related.PURPOSES:
                related.validate_receipt(db, row, m)
            elif row.state == 'committed':
                validate_mixed_receipt(db,row,m)
        elif row.purpose in ('protected_analysis_write', 'protected_transcript_write'):
            validate_native_linked_operation(db, row, entries)
        else:
            raise ValueError('backup_operation_purpose')
        if row.state == 'committed':
            if row.receipt_json is None or row.commit_conditions_json is None:
                raise ValueError('backup_operation_receipt')
            if row.purpose in ('conversion','protected_write','protected_import'):
                validate_native_receipt(db,row,entries)
        elif row.state in ACTIVE_STATES and (row.receipt_json is not None or row.commit_conditions_json is not None):
            raise ValueError('backup_operation_receipt')


def validate_mixed_receipt(db,row,m):
    from app.services import note_mixed_metadata as meta, note_mixed_operations as ops, note_crypto_storage as store
    from app.schemas.note_mixed import Commit,ConversionCommit,MixedImportCommit
    from app.schemas.note_v2 import timestamp
    core=json.loads(row.commit_conditions_json);r=json.loads(row.receipt_json)
    if row.purpose=='mixed_offline_import':
        parsed=MixedImportCommit.model_validate({**core,'plain_entries':[]}).model_dump(exclude={'plain_entries'})
        expected_cipher=[{'revision_id':v['key']['id'],'ciphertext_sha256':v['ciphertext_sha256']}
                         for v in m['verified_existing'] if v['ciphertext_sha256'] is not None]
        if core['client_verified_existing_set_digest']!=meta.h(m['verified_existing']) or meta.canonical(core['existing_ciphertexts'])!=meta.canonical(expected_cipher):
            raise ValueError('backup_mixed_existing')
    else:
        parsed=(ConversionCommit if row.purpose==ops.RC else Commit).model_validate(core).model_dump()
    if meta.canonical(parsed)!=meta.canonical(core) or tuple(core[k] for k in ('owner_id','local_id','device_id','server_instance_id','operation_id','mutation_id','metadata_manifest_digest'))!=(
        row.owner_id,row.local_id,row.actor_device_id,m['server_instance_id'],row.id,row.mutation_id,row.manifest_digest) or meta.canonical(core['base'])!=meta.canonical(m['base']):
        raise ValueError('backup_mixed_commit')
    records=[]
    for d in m['DSET']:
        if d['is_null'] or d['output_epoch']==0:continue
        upload=db.get(NoteCryptoUpload,(row.id,meta.canonical(d['destination_key'])))
        if upload is None or upload.ciphertext_sha256 is None:raise ValueError('backup_mixed_cipher')
        records.append({'entry_key':d['destination_key'],'destination_key':d['destination_key'],'source_etag':d['source_etag'],
                        'output_kind':d['output_kind'],'target_epoch':d['output_epoch'],'total_bytes':upload.total_bytes,'ciphertext_sha256':upload.ciphertext_sha256})
    digest=meta.h(records)
    if core['client_verified_ciphertext_manifest_digest']!=digest:raise ValueError('backup_mixed_cipher')
    result=json.loads(meta.canonical(m['base']));base=result['base']
    bump=bool(m['DSET']) if row.purpose=='mixed_offline_import' else True
    base['head_version']+=int(bump);base['history_generation']+=int(bump)
    if row.purpose in (ops.CP,'mixed_note_write'):
        new_ref=m['revision_ref']['id'];old_ref=base['head_revision_id']
        base.update(head_revision_id=new_ref,inventory_revision_ids=sorted([ident for ident in base['inventory_revision_ids'] if ident!=old_ref]+[new_ref]),
                    identity_state='coherent',current_exists=True)
        result['current_mode']='plain' if row.purpose==ops.CP else m['control']['target_current_mode']
        result['selected_physical_note_id']=m['selection']['physical_note_id'] if row.purpose==ops.CP else m['server_fields']['id']
    elif row.purpose==ops.RC:
        if core['target_epoch']!=m['target_epoch']:raise ValueError('backup_mixed_commit')
        base['crypto_epoch']=m['target_epoch'];result['current_mode']=m['target_current_mode']
        if m['reserved_branches'] and not base['current_exists']:base['identity_state']='branch_only'
    elif bump and not base['current_exists']:
        base['identity_state']='branch_only'
    sections=('S','DSET','P','O') if row.purpose in (ops.CP,ops.RC) else ('S','DSET','P','O','existing','verified_existing')
    stamp=r.get('committed_at')
    if not isinstance(stamp,str) or timestamp(stamp)!=stamp:raise ValueError('backup_mixed_time')
    expected={'schema_version':3,'purpose':row.purpose,'operation_id':row.id,'mutation_id':row.mutation_id,
              'server_instance_id':m['server_instance_id'],'owner_id':row.owner_id,'local_id':row.local_id,'result':result,
              'metadata_manifest_digest':row.manifest_digest,'set_digests':{s:meta.h(m[s]) for s in sections},
              'origin_expectations_digest':meta.h(m['O']),'committed_at':stamp}
    if row.purpose in (ops.CP,ops.RC):
        expected.update(counts=ops.counts(m),applied_counts=ops.counts(m)['DSET'],client_verified_ciphertext_manifest_digest=digest)
    else:expected['ciphertext_manifest_digest']=digest
    if meta.canonical(expected)!=meta.canonical(r):raise ValueError('backup_mixed_result')


def output_epoch(operation, entry):
    if operation.purpose in ('conversion','protected_write','protected_import','protected_analysis_write','protected_transcript_write'):
        return json.loads(operation.conditions_json)['request']['target_epoch']
    return entry.representation_epoch


def validate_native_receipt(db,row,entries):
    from app.services import note_crypto_storage as store
    from app.services.note_v2 import canonical
    from app.schemas.note_crypto import CommitTransition
    from app.schemas.related_text import CommitRelated
    from app.schemas.note_protected_write import QuoteCommit
    from app.schemas.note_protected_import import ImportCommit
    c=json.loads(row.conditions_json);r=json.loads(row.receipt_json);core=json.loads(row.commit_conditions_json)
    model=(CommitRelated if c.get('schema_version')==2 else CommitTransition) if row.purpose=='conversion' else QuoteCommit if row.purpose=='protected_write' else ImportCommit
    if row.purpose=='protected_write':
        # The original commit intentionally omits plaintext projection fields.
        projection={**c['request']['structure'],'title':'','tags':None,'source':None}
        parsed=model.model_validate({**core,'projection':projection}).model_dump(exclude={'projection'})
    else:
        parsed=model.model_validate(core).model_dump()
    if canonical(parsed)!=canonical(core):
        raise ValueError('backup_native_commit')
    id_field={'conversion':'transition_id','protected_write':'quote_id','protected_import':'import_id'}[row.purpose]
    if tuple(core[k] for k in ('owner_id','local_id','device_id','server_instance_id',id_field,'metadata_manifest_digest'))!=(
        row.owner_id,row.local_id,row.actor_device_id,c['server_instance_id'],row.id,row.manifest_digest):
        raise ValueError('backup_native_commit')
    if row.purpose!='conversion' and core['mutation_id']!=row.mutation_id:
        raise ValueError('backup_native_commit')
    records=[]
    for entry in sorted(entries,key=lambda e:store.key_order(json.loads(e.key_json))):
        u=db.get(NoteCryptoUpload,(row.id,entry.key_json))
        if u is None or u.ciphertext_sha256 is None:
            raise ValueError('backup_native_cipher')
        key=json.loads(entry.key_json)
        records.append({'entry_key':key,'destination_key':store.destination(key),'source_etag':entry.source_etag,
                        'output_kind':entry.output_kind,'target_epoch':output_epoch(row,entry),
                        'total_bytes':u.total_bytes,'ciphertext_sha256':u.ciphertext_sha256})
    digest=store.sha(store.canonical_bytes(records))
    if core['client_verified_ciphertext_manifest_digest']!=digest or r.get('ciphertext_manifest_digest')!=digest:
        raise ValueError('backup_native_cipher')
    epoch=c['request']['target_epoch']
    if tuple(r.get(k) for k in ('owner_id','local_id','server_instance_id','crypto_epoch'))!=(row.owner_id,row.local_id,c['server_instance_id'],epoch):
        raise ValueError('backup_native_receipt')
    manifest_field='manifest_digest' if row.purpose=='protected_write' else 'metadata_manifest_digest'
    if r.get(manifest_field)!=row.manifest_digest:
        raise ValueError('backup_native_receipt')
    if c.get('origin_metadata_version')==1:
        if type(r.get('origin_metadata_version')) is not int or r['origin_metadata_version']!=1 or r.get('origin_expectations_digest')!=store.sha(store.canonical_bytes(c['origin_expectations'])):
            raise ValueError('backup_native_origin')
    validate_native_result(row,c,core,r,records,digest)


def validate_native_result(row,c,core,r,records,digest):
    from app.services import note_crypto_storage as store
    from app.services.note_v2 import canonical
    from app.schemas.note_v2 import timestamp
    base=c['base'];epoch=c['request']['target_epoch']
    expected={'server_instance_id':c['server_instance_id'],'owner_id':row.owner_id,'local_id':row.local_id,
              'crypto_epoch':epoch,'ciphertext_manifest_digest':digest}
    if row.purpose=='conversion':
        mapping={'base_head_version':'head_version','base_revision_id':'head_revision_id',
                 'expected_inventory_revision_ids':'inventory_revision_ids','expected_history_generation':'history_generation','from_epoch':'crypto_epoch'}
        if any(canonical(core[k])!=canonical(base[v]) for k,v in mapping.items()) or core['target_epoch']!=epoch:
            raise ValueError('backup_native_base')
        expected.update({**base,'crypto_epoch':epoch,'protection_state':'protected','head_version':base['head_version']+1,
                         'history_generation':base['history_generation']+1,
                         'identity_state':'branch_only' if base['identity_state']=='empty' else base['identity_state']})
        counts={kind:0 for kind in store.KINDS};applied=dict(counts)
        if c.get('schema_version')==2:
            from app.services.related_text import SLOTS
            counts.update({key:0 for key in SLOTS});applied.update({key:0 for key in SLOTS})
        for record in records:
            counts[record['entry_key']['kind']]+=1;applied[record['destination_key']['kind']]+=1
        expected.update(metadata_manifest_digest=row.manifest_digest,expected_counts=counts,applied_counts=applied,
                        reserved_branch_ids=sorted(branch['revision_id'] for branch in c['request']['local_branches']))
        if c.get('schema_version')==2:
            from app.services.related_conversion import status_fields,hash_value
            nulls={}
            for key in c['null_slots']:nulls[key['kind']]=nulls.get(key['kind'],0)+1
            expected.update(linked_metadata_version=1,linked_expectations_digest=hash_value(c['linked_expectations']),
                            linked_counts=status_fields(row)['linked_counts'],null_expected_counts=nulls,null_applied_counts=nulls,
                            full_protection_complete=False,protected_analysis_execution_v1=False)
    elif row.purpose=='protected_write':
        mapping={'base_head_version':'head_version','base_revision_id':'head_revision_id',
                 'expected_inventory_revision_ids':'inventory_revision_ids','expected_history_generation':'history_generation'}
        if any(canonical(core[k])!=canonical(base[v]) for k,v in mapping.items()) or core['crypto_epoch']!=epoch:
            raise ValueError('backup_native_base')
        inventories=[ident for ident in base['inventory_revision_ids'] if ident!=base['head_revision_id']]
        inventories.append(c['revision_ref']['id'])
        stamp=r.get('committed_at')
        if not isinstance(stamp,str) or timestamp(stamp)!=stamp:raise ValueError('backup_native_time')
        expected.update(operation=c['request']['operation'],result_revision_id=c['revision_ref']['id'],
                        result_head_version=base['head_version']+1,result_inventory_revision_ids=sorted(inventories),
                        note_id=c['server_fields']['id'],history_generation=base['history_generation']+1,
                        identity_state='coherent',current_exists=True,protection_state='protected',
                        manifest_digest=row.manifest_digest,committed_at=stamp)
    else:
        from app.services.note_protected_import import verified_existing
        if core['crypto_epoch']!=epoch or core['client_verified_existing_set_digest']!=store.sha(store.canonical_bytes(verified_existing(c))):
            raise ValueError('backup_native_base')
        statuses={e['key']['id']:'already_present' for e in c['existing_entries']}
        statuses.update({e['key']['id']:'new' for e in c['new_entries']})
        expected.update(import_id=row.id,mutation_id=row.mutation_id,
                        imported_refs=[{'kind':'offline_branch','id':ident,'status':statuses[ident],'crypto_epoch':epoch} for ident in sorted(statuses)],
                        result_head_version=base['head_version'],result_revision_id=base['head_revision_id'],
                        result_inventory_revision_ids=base['inventory_revision_ids'],history_generation=base['history_generation']+len(c['new_entries']),
                        identity_state='branch_only' if not base['crypto_epoch'] or c['new_entries'] and base['identity_state']=='related_only' else base['identity_state'],
                        current_exists=base['current_exists'],protection_state='protected',metadata_manifest_digest=row.manifest_digest,
                        existing_set_digest=core['client_verified_existing_set_digest'])
    if c.get('origin_metadata_version')==1:
        expected.update(origin_metadata_version=1,origin_expectations_digest=store.sha(store.canonical_bytes(c['origin_expectations'])))
    if canonical(r)!=canonical(expected):
        raise ValueError('backup_native_result')


def validate_native_linked_operation(db, row, entries):
    from app.services import related_writes as linked, protected_analysis as claims
    from app.services.note_v2 import canonical
    from app.schemas.protected_analysis import Commit
    c = linked.fixed(row)
    slots = {canonical(s['key']): s for s in c['slots'] if not s['is_null']}
    if {entry.key_json for entry in entries} != set(slots):
        raise ValueError('backup_linked_manifest')
    for entry in entries:
        slot = slots[entry.key_json]
        if (entry.source_etag, entry.output_kind, entry.source_kind, entry.representation_epoch) != (
            slot['source_etag'], 'linked_text_envelope_v1',
            'client_pending' if row.purpose == linked.ANALYSIS else 'linked_text_envelope_v1', c['request']['target_epoch']) or json.loads(entry.binding_json) != slot['expected_binding']:
            raise ValueError('backup_linked_entry')
    if row.purpose == linked.ANALYSIS:
        claim = db.get(ProtectedAnalysisClaim, c['execution_id'])
        receipt = claims.receipt(claim) if claim is not None else None
        if claim is None or (claim.owner_id, claim.local_id) != (row.owner_id, row.local_id) or receipt is None or linked.h(receipt) != c['terminal_receipt_digest']:
            raise ValueError('backup_linked_execution')
        claim_fixed = claims.fixed(claim)
        bundle = json.loads(claim.progress_json)['terminal_bundle']
        request = c['request_core']
        previous = request.get('previous_write_id') if c['request_type']=='replan' else None
        if canonical(c['origin']) != canonical(linked.claim_origin(claim,claim_fixed,bundle,previous)):
            raise ValueError('backup_linked_origin')
        expected_nulls = sorted([(slot['key']['kind'],slot['is_null']) for slot in bundle['slot_nulls']])
        if expected_nulls != sorted([(slot['key']['kind'],slot['is_null']) for slot in c['slots']]):
            raise ValueError('backup_linked_origin')
        if c['request_type']=='initial' and (row.id,c['job_id'],c['job_id_mode'],request['terminal_run_version']) != (
            claim.id,claim.job_id,claim.job_id_mode,receipt['terminal_run_version']):
            raise ValueError('backup_linked_origin')
        if c['request_type']=='initial' and canonical(request['bundle_metadata']) != canonical(bundle):
            raise ValueError('backup_linked_origin')
    if row.state != 'committed':
        return
    core = json.loads(row.commit_conditions_json)
    if canonical(Commit.model_validate(core).model_dump()) != canonical(core) or tuple(core[k] for k in (
        'owner_id','local_id','device_id','server_instance_id','write_id','mutation_id','target_epoch','metadata_manifest_digest')) != (
        row.owner_id,row.local_id,row.actor_device_id,c['server_instance_id'],row.id,row.mutation_id,c['request']['target_epoch'],row.manifest_digest):
        raise ValueError('backup_linked_commit')
    records = []
    for key, slot in slots.items():
        upload = db.get(NoteCryptoUpload,(row.id,key))
        if upload is None or upload.ciphertext_sha256 is None:
            raise ValueError('backup_linked_cipher')
        records.append({'entry_key':slot['key'],'destination_key':slot['key'],'source_etag':slot['source_etag'],
                        'output_kind':'linked_text_envelope_v1','target_epoch':c['request']['target_epoch'],
                        'total_bytes':upload.total_bytes,'ciphertext_sha256':upload.ciphertext_sha256})
    if core['client_verified_ciphertext_manifest_digest'] != linked.h(records):
        raise ValueError('backup_linked_cipher')
    if row.purpose==linked.ANALYSIS and c['request_type']=='initial' and canonical(records) != canonical(bundle['ciphertext_manifest']):
        raise ValueError('backup_linked_cipher')
    receipt = json.loads(row.receipt_json)
    generation = receipt.get('history_generation')
    if type(generation) is not int or generation != c['base']['history_generation']+1:
        raise ValueError('backup_linked_receipt')
    expected = {'write_id':row.id,'purpose':row.purpose,'execution_id':c['execution_id'],'job_id':c['job_id'],
                'recording_id':c['request_core'].get('recording_id'),'source_digest':c['origin'].get('source_digest'),
                'origin_digest':linked.h(c['origin']),'crypto_epoch':c['request']['target_epoch'],'history_generation':generation,
                'slot_receipts':[{'key':s['key'],'is_null':s['is_null'],'slot_version':s['target_slot_version'],'storage_operation_id':row.id} for s in c['slots']],
                'metadata_manifest_digest':row.manifest_digest,'ciphertext_manifest_digest':linked.h(records)}
    if canonical(receipt) != canonical(expected):
        raise ValueError('backup_linked_receipt')


def validate_related_references(db):
    from app.services.note_v2 import canonical
    from app.schemas.related_text import DrainPrepare
    identity = db.get(ServerIdentity,1).instance_id
    for row in db.scalars(select(AnalysisRun)):
        job = db.get(AnalysisJob,row.job_id)
        if job is None or (job.owner_id,job.note_local_id) != (row.owner_id,row.local_id) or row.run_version < 1 or row.source_epoch < 0:
            raise ValueError('backup_worker_reference')
        if row.receipt_json is not None:
            r = json.loads(row.receipt_json)
            expected = {'job_id':row.job_id,'run_id':row.run_id,'source_epoch':row.source_epoch,'outcome':job.status,
                        'terminal_run_version':row.run_version,'input_slot_version':row.input_slot_version,
                        'result_slot_version':r.get('result_slot_version'),'error_slot_version':r.get('error_slot_version'),
                        'job_updated_at':job.updated_at.isoformat(timespec='microseconds')+'Z','settled':True}
            if canonical(r) != canonical(expected) or job.status not in ('done','failed','cancelled'):
                raise ValueError('backup_worker_receipt')
    for row in db.scalars(select(RelatedDrain)):
        c = json.loads(row.conditions_json);request = c['request']
        if canonical(DrainPrepare.model_validate(request).model_dump()) != canonical(request) or row.state not in ('draining','ready','promoted','aborted','expired') or min(row.drain_version,row.lease_version)<1:
            raise ValueError('backup_drain')
        if tuple(request[k] for k in ('owner_id','local_id','device_id','mutation_id','server_instance_id')) != (
            row.owner_id,row.local_id,row.actor_device_id,row.mutation_id,identity) or c['server_instance_id'] != identity:
            raise ValueError('backup_drain_scope')
        if row.transition_id is not None:
            operation = db.get(NoteCryptoTransition,row.transition_id)
            if operation is None or (operation.owner_id,operation.local_id) != (row.owner_id,row.local_id) or row.state!='promoted':
                raise ValueError('backup_drain_transition')
        elif row.state=='promoted':
            raise ValueError('backup_drain_transition')
        for accepted in c['accepted_runs']:
            run = db.get(AnalysisRun,accepted['job_id'])
            if run is None or (run.owner_id,run.local_id,run.run_id,run.source_epoch,run.input_slot_version) != (
                row.owner_id,row.local_id,accepted['run_id'],accepted['source_epoch'],accepted['input_slot_version']) or run.run_version < accepted['initial_run_version']:
                raise ValueError('backup_drain_cohort')
        for accepted in c.get('accepted_claims',[]):
            claim = db.get(ProtectedAnalysisClaim,accepted['execution_id'])
            if claim is None or (claim.owner_id,claim.local_id,claim.job_id) != (row.owner_id,row.local_id,accepted['original_job_id']) or claim.run_version < accepted['initial_run_version']:
                raise ValueError('backup_drain_cohort')


def validate_executions(db):
    from app.services import protected_analysis as native, mixed_analysis as mixed
    from app.services.note_v2 import canonical
    from app.schemas.mixed_related import LegacyDispatchReceipt, LegacyTerminalReceipt
    identity = db.get(ServerIdentity, 1).instance_id
    for row in db.scalars(select(ProtectedAnalysisClaim)):
        conditions = json.loads(row.conditions_json)
        request = conditions['request'];schema = request.get('schema_version')
        if type(schema) is not int or schema not in (1, 3) or not 1 <= row.job_id <= 2147483647 or min(row.run_version, row.lease_version) < 1:
            raise ValueError('backup_execution')
        service = native if schema == 1 else mixed
        if canonical(service.Claim.model_validate(request).model_dump()) != canonical(request):
            raise ValueError('backup_execution_request')
        fixed = service.fixed(row)
        if request['server_instance_id'] != identity or db.get(NoteHead, (row.owner_id, row.local_id)) is None:
            raise ValueError('backup_execution_scope')
        device = db.scalar(select(UserDevice).where(UserDevice.owner_id == row.owner_id, UserDevice.device_id == row.actor_device_id))
        if device is None:
            raise ValueError('backup_execution_actor')
        if schema == 1 and (type(fixed['job_id']) is not int or fixed['job_id'] != row.job_id):
            raise ValueError('backup_execution_id')
        source_job = request['source_job_id']
        if source_job is not None:
            job = db.get(AnalysisJob, source_job)
            if job is None or (job.owner_id, job.note_local_id) != (row.owner_id, row.local_id):
                raise ValueError('backup_execution_source')
        for source in request['source_keys']:
            descriptor = source if schema == 1 else source['descriptor']
            key = descriptor['key'];kind = key['kind']
            if kind in ('note_body', 'inventory_snapshot'):
                target = db.get(Note, int(key['id']));local = getattr(target, 'local_id', None)
            elif kind in ('revision_snapshot', 'revision_before'):
                target = db.get(NoteRevision, key['id']);local = getattr(target, 'local_id', None)
            elif kind == 'offline_snapshot':
                target = db.get(NoteOfflineBranch, key['id']);local = getattr(target, 'local_id', None)
            elif kind in ('analysis_input', 'analysis_result', 'analysis_error', 'recording_transcript'):
                target = db.get(Recording if kind == 'recording_transcript' else AnalysisJob, int(key['id']));local = getattr(target, 'note_local_id', None)
            else:
                raise ValueError('backup_execution_source')
            if target is None or (target.owner_id, local) != (row.owner_id, row.local_id):
                raise ValueError('backup_execution_source')
            binding = descriptor.get('expected_binding')
            refs = {descriptor.get('storage_operation_id'), descriptor.get('semantic_origin_id')}
            if binding is not None:
                if (binding['server_instance_id'], binding['owner_id'], binding['local_id']) != (identity, row.owner_id, row.local_id):
                    raise ValueError('backup_execution_source')
                refs.add(binding['transition_id'])
            for ident in refs - {None}:
                operation = db.get(NoteCryptoTransition, ident)
                if operation is None or (operation.owner_id, operation.local_id, operation.state) != (row.owner_id, row.local_id, 'committed'):
                    raise ValueError('backup_execution_source')
        receipt = service.receipt(row);progress = json.loads(row.progress_json)
        bundle = progress.get('terminal_bundle')
        if bundle is not None:
            parsed = service.Bundle.model_validate(bundle)
            if canonical(parsed.model_dump()) != canonical(bundle) or receipt is None or receipt['outcome'] != parsed.outcome or receipt['bundle_digest'] != parsed.bundle_digest:
                raise ValueError('backup_execution_bundle')
            service.validate_bundle(row, parsed)
        if schema == 1:
            for name, model in (('dispatch_receipt', LegacyDispatchReceipt), ('terminal_receipt', LegacyTerminalReceipt)):
                value = progress.get(name)
                if value is not None and canonical(model.model_validate(value).model_dump()) != canonical(value):
                    raise ValueError('backup_execution_receipt')


def restore_empty(engine, backup):
    from app.db import Base
    counts = validate_backup(backup)
    if engine.dialect.name not in ('sqlite', 'postgresql'):
        raise ValueError('target_dialect')
    by_table = {model.__tablename__: (section, model) for section, model in SECTIONS.items()}
    with engine.begin() as connection:
        if connection.dialect.name == 'sqlite':
            connection.exec_driver_sql('PRAGMA foreign_keys=ON')
            connection.exec_driver_sql('BEGIN IMMEDIATE')
        existing = set(inspect(connection).get_table_names())
        if existing - set(Base.metadata.tables) or inspect(connection).get_view_names():
            raise ValueError('target_unknown_tables')
        quote = connection.dialect.identifier_preparer.quote
        if connection.dialect.name == 'postgresql' and existing:
            connection.exec_driver_sql('LOCK TABLE '+', '.join(quote(name) for name in sorted(existing))+' IN ACCESS EXCLUSIVE MODE')
        for name in existing:
            if connection.execute(select(Base.metadata.tables[name]).limit(1)).first() is not None:
                raise ValueError('target_not_empty')
        Base.metadata.create_all(connection)
        for table in Base.metadata.sorted_tables:
            if table.name not in by_table:
                continue
            section, model = by_table[table.name]
            for row in backup['items'][section]:
                connection.execute(table.insert().values(**decoded_row(section, model, row)))
        if connection.dialect.name == 'postgresql':
            restore_sequences(connection, backup)
        with Session(connection, autoflush=False) as restored:
            validate_graphs(restored)
            validate_operations(restored)
            validate_related_references(restored)
            validate_executions(restored)
            validate_uploads(restored)
    return {'section_counts': counts, 'requires_reauthentication': True,
            'server_started': False, 'includes_recording_files': False,
            'requires_reconciliation': backup['recovery']['requires_reconciliation']}


def restore_sequences(connection, backup):
    # Explicit PK insertion does not advance PG sequences. RESTART is transactional.
    floors = {}
    for section, model in SECTIONS.items():
        pk = list(model.__table__.primary_key.columns)
        if len(pk) != 1 or not isinstance(pk[0].type, Integer):
            continue
        sequence = connection.scalar(text('SELECT pg_get_serial_sequence(:table_name,:column_name)'),
                                     {'table_name':model.__tablename__, 'column_name':pk[0].name})
        if sequence is None:
            continue
        maximum = connection.scalar(select(func.max(pk[0]))) or 0
        if model is AnalysisJob:
            maximum = max([maximum] + [row['job_id'] for row in backup['items']['note_protected_analysis_claims']])
            for row in backup['items']['note_crypto_transitions']:
                if row['purpose'] in ('mixed_analysis_write','protected_analysis_write'):
                    job_id = json.loads(row['conditions_json'])['job_id']
                    if type(job_id) is not int or job_id < 1:
                        raise ValueError('backup_reserved_id')
                    maximum = max(maximum, job_id)
        if maximum >= 2147483647:
            raise ValueError('target_id_space_exhausted')
        floors[sequence] = maximum + 1
    for sequence, value in floors.items():
        # pg_get_serial_sequence supplies a server-quoted qualified identifier.
        connection.exec_driver_sql('ALTER SEQUENCE '+sequence+' RESTART WITH '+str(value))
