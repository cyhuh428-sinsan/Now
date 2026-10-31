"""E5 snapshot and recovery tests use only the conftest synthetic database."""
import json
from uuid import uuid4

import pytest
from .test_note_crypto import subject
from .test_note_mixed import enabled


@pytest.fixture()
def admin_headers(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setenv('NOW_API_TOKEN', 'qa-backup-v3-only')
    get_settings.cache_clear()
    yield {'Authorization': 'Bearer qa-backup-v3-only'}
    get_settings.cache_clear()


def test_v3_is_explicit_same_snapshot_and_preserves_existing_export(client, db, admin_headers):
    from sqlalchemy import event
    from app.db import engine
    from app.models.note import Note
    from app.models.note_history import NoteHead

    local='e5-snapshot-'+str(uuid4())
    row=Note(owner_id='sinsan', local_id=local, device_id='e5-synthetic', note_type='tree',
             title='Backup fixture', content='Exact\r\n한국어\n', parent_local_id=None, level=1,
             tags='[]', source='web-tree')
    db.add(row);db.commit()
    existing=client.get('/api/v1/admin/export/all', headers=admin_headers)
    assert existing.status_code==200
    assert existing.json()['backup_schema_version']==2
    reads=[]
    def observe(connection,cursor,statement,parameters,context,executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            reads.append((id(connection),connection.in_transaction()))
    event.listen(engine,'before_cursor_execute',observe)
    try:
        response=client.get('/api/v1/admin/export/all', params={'backup_schema_version':3},headers=admin_headers)
    finally:
        event.remove(engine,'before_cursor_execute',observe)
    assert response.status_code==200
    value=response.json()
    assert value['backup_schema_version']==3
    assert response.headers['cache-control']=='no-store'
    assert len({ident for ident,active in reads})==1 and all(active for ident,active in reads)
    required={'notes','recordings','users','devices','analysis_jobs','sync_logs','release_evidence_records','library_resources','library_mutations',
              'server_identity','note_heads','note_revisions','note_inventory','note_offline_branches','note_mutations',
              'note_crypto_transitions','note_crypto_entries','note_crypto_fences','note_crypto_uploads','note_crypto_chunks','note_representation_origins',
              'note_mixed_schema','note_mixed_scopes','note_mixed_slots','note_linked_schema','note_linked_texts','note_related_drains','note_analysis_runs','note_protected_analysis_claims'}
    assert set(value['items'])==required
    assert value['section_counts']=={key:len(rows) for key,rows in value['items'].items()}
    current=next(r for r in value['items']['notes'] if r['local_id']==local)
    assert current['content']=='Exact\r\n한국어\n'
    assert value['server_instance_id']==value['items']['server_identity'][0]['instance_id']
    assert value['includes_recording_files'] is False
    for user in value['items']['users']:
        assert not {'password_hash','password_recovery_hash','access_token_hash'} & set(user)
    for device in value['items']['devices']:
        assert not {'access_token_hash','access_token_value'} & set(device)
    assert not {'web_sessions','user_mail_settings'} & set(value['items'])
    assert value['recovery']['requires_reauthentication'] is True
    assert client.get('/api/v1/admin/export/all',params={'backup_schema_version':4},headers=admin_headers).status_code==422
    assert client.get('/api/v1/admin/export/all',params={'backup_schema_version':3}).status_code==401


def test_v3_uses_the_existing_verifier_without_weakening_v2(client, admin_headers):
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();assert value['backup_schema_version']==3
    verified=client.post('/api/v1/admin/export/verify',json={'backup':value},headers=admin_headers)
    assert verified.status_code==200 and verified.json()['status']=='ok'
    assert all(verified.json()['summary'].get(key)==len(rows) for key,rows in value['items'].items())
    damaged=json.loads(json.dumps(value));damaged['items'].pop('note_heads')
    rejected=client.post('/api/v1/admin/export/verify',json={'backup':damaged},headers=admin_headers)
    assert rejected.status_code==200 and rejected.json()['status']!='ok'


def rehash(value):
    from app.api.admin import _backup_content_sha256
    value['section_counts']={key:len(rows) for key,rows in value['items'].items()}
    value['summary']=dict(value['section_counts'])
    value['content_sha256']=_backup_content_sha256({key:item for key,item in value.items() if key!='content_sha256'})
    return value


@pytest.mark.parametrize('damage',['head_ref','parent_ref','owner','boolean_version'])
def test_v3_rejects_rehashed_graph_and_type_damage(client,subject,admin_headers,damage):
    from .test_note_crypto_conversion import seed
    from .test_note_crypto import context
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}}
    seed(client,s,'e5-graph')
    context(client,s,'e5-graph')
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();assert value['items']['note_heads'] and value['items']['note_revisions']
    if damage=='head_ref':value['items']['note_heads'][0]['head_revision_id']=str(uuid4())
    if damage=='parent_ref':value['items']['note_revisions'][0]['parent_revision_id']=str(uuid4())
    if damage=='owner':value['items']['note_revisions'][0]['owner_id']='e5-other-owner'
    if damage=='boolean_version':value['items']['note_heads'][0]['version']=True
    with pytest.raises(ValueError):validate_backup(rehash(value))


@pytest.mark.parametrize('damage',[None,'slot_missing','operation_missing','chunk_bytes'])
def test_v3_preserves_protected_ledger_and_rejects_rehashed_loss(client,subject,admin_headers,damage):
    from .test_note_crypto_conversion import seed,convert
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-protected'
    seed(client,s,local);convert(client,s,local)
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();assert value['items']['note_crypto_chunks'] and value['items']['note_mixed_slots']
    if damage is None:
        validate_backup(value)
        assert all('SYNTHETIC' not in row['content'] for row in value['items']['notes'])
    else:
        if damage=='slot_missing':value['items']['note_mixed_slots'].pop()
        if damage=='operation_missing':value['items']['note_crypto_transitions'].pop()
        if damage=='chunk_bytes':value['items']['note_crypto_chunks'][0]['data_base64']='AAAA'
        with pytest.raises(ValueError):validate_backup(rehash(value))


def test_v3_pending_export_is_read_only_and_not_a_completed_transition(client,subject,admin_headers):
    from .test_note_crypto_conversion import seed
    from .test_note_crypto import prepare
    from app.models.note_crypto import NoteCryptoTransition
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-pending'
    seed(client,s,local);_,prepared=prepare(client,s,local)
    s['db'].expire_all();row=s['db'].get(NoteCryptoTransition,prepared['transition_id'])
    before=(row.state,row.conditions_json,row.lease_version,row.expires_at)
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();pending=value['recovery']['incomplete_operations']
    from app.services.note_backup import validate_backup
    validate_backup(value)
    assert value['recovery']['requires_reconciliation'] is True
    assert any(op['id']==prepared['transition_id'] and op['state']=='prepared' for op in pending)
    s['db'].expire_all();row=s['db'].get(NoteCryptoTransition,prepared['transition_id'])
    assert before==(row.state,row.conditions_json,row.lease_version,row.expires_at)


def test_v3_export_rejects_corrupt_source_without_repairing_it(client,subject,admin_headers):
    from sqlalchemy import select,delete
    from .test_note_crypto_conversion import seed,convert
    from app.models.note_mixed import MixedSlot
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-corrupt-source'
    seed(client,s,local);convert(client,s,local)
    target=s['db'].scalar(select(MixedSlot).where(MixedSlot.owner_id==s['owner'],MixedSlot.local_id==local))
    key=target.key_json
    s['db'].execute(delete(MixedSlot).where(MixedSlot.owner_id==s['owner'],MixedSlot.local_id==local,MixedSlot.key_json==key));s['db'].commit()
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==409
    assert response.headers['cache-control']=='no-store'
    assert response.json()=={'detail':{'code':'backup_inconsistent'}}
    s['db'].expire_all();assert s['db'].get(MixedSlot,(s['owner'],local,key)) is None


def test_v3_rejects_boolean_counts_even_with_matching_checksum(client,admin_headers):
    from app.services.note_backup import validate_backup
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();value['section_counts']['server_identity']=True;value['summary']['server_identity']=True
    from app.api.admin import _backup_content_sha256
    value['content_sha256']=_backup_content_sha256({key:item for key,item in value.items() if key!='content_sha256'})
    with pytest.raises(ValueError):validate_backup(value)


@pytest.mark.parametrize('schema',[1,3])
@pytest.mark.parametrize('damage',[None,'claim_request','terminal_bundle'])
def test_v3_preserves_original_execution_and_rejects_rehashed_metadata(client,subject,enabled,admin_headers,schema,damage):
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-execution'
    if schema==1:
        from .test_protected_analysis import started,make_bundle,settle_body,PA
        request,execution=started(client,s,local);bm,_=make_bundle(execution)
        response=client.post(PA+'/claims/settle',json=settle_body(s,local,execution,bm),headers=s['headers'])
    else:
        from .test_mixed_analysis_claims import started,bundle,settle_body,MX
        request,execution=started(client,s,local);bm,_=bundle(execution)
        response=client.post(MX+'/settle',json=settle_body(request,execution,bm),headers=s['headers'])
    assert response.status_code==200
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();claim=value['items']['note_protected_analysis_claims'][0]
    if damage is None:
        validate_backup(value)
        assert json.loads(claim['conditions_json'])['request']==request
        assert json.loads(claim['progress_json'])['terminal_bundle']==bm
    else:
        if damage=='claim_request':
            conditions=json.loads(claim['conditions_json']);conditions['request']['schema_version']=float(schema);claim['conditions_json']=json.dumps(conditions)
        else:
            progress=json.loads(claim['progress_json']);progress['terminal_bundle']['source_digest']='0'*64;claim['progress_json']=json.dumps(progress)
        with pytest.raises(ValueError):validate_backup(rehash(value))


@pytest.mark.parametrize('damage',['manifest','actor','fence','state','entry_etag'])
def test_v3_rejects_rehashed_pending_operation_damage(client,subject,admin_headers,damage):
    from .test_note_crypto_conversion import seed
    from .test_note_crypto import prepare
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-pending-integrity'
    seed(client,s,local);prepare(client,s,local)
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();op=value['items']['note_crypto_transitions'][0]
    if damage=='manifest':op['manifest_digest']='0'*64
    if damage=='actor':op['actor_device_id']='missing-device'
    if damage=='fence':value['items']['note_crypto_fences']=[]
    if damage=='state':op['state']='uploading'
    if damage=='entry_etag':value['items']['note_crypto_entries'][0]['source_etag']='00000000-0000-0000-0000-000000000000'
    with pytest.raises(ValueError):validate_backup(rehash(value))


def test_v3_recovery_includes_staging_without_expiring_source(client,subject,admin_headers):
    from .test_note_crypto_conversion import seed
    from .test_note_crypto import prepare
    from app.models.note_crypto import NoteCryptoTransition
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-staging'
    seed(client,s,local);_,prepared=prepare(client,s,local)
    row=s['db'].get(NoteCryptoTransition,prepared['transition_id']);row.state='staging';s['db'].commit()
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    assert response.json()['recovery']['requires_reconciliation'] is True
    assert response.json()['recovery']['incomplete_operations'][0]['state']=='staging'
    s['db'].expire_all();assert s['db'].get(NoteCryptoTransition,row.id).state=='staging'


@pytest.mark.parametrize('flow',['cp_rc','write','import','analysis','transcript'])
def test_v3_preserves_original_mixed_operations(client,subject,enabled,admin_headers,flow):
    from .test_note_crypto_conversion import seed,convert
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-mixed-'+flow
    if flow=='cp_rc':
        from .test_note_mixed import ready_cp,ready_rc
        seed(client,s,local);convert(client,s,local)
        _,op,m,body=ready_cp(client,s,local)
        response=client.post('/api/v2/notes/current-plain/commit',json=body,headers=s['headers'])
        assert response.status_code==200
        origin={'purpose':'current_plain_transition','operation_id':op['operation_id'],'mutation_id':body['mutation_id'],
                'source_inventory_ref':m['selection']['inventory_revision_ref'],
                'selected_physical_note_id':m['selection']['physical_note_id'],'target_current_mode':'plain'}
        _,_,_,body,_=ready_rc(client,s,local,origins={op['operation_id']:origin})
        response=client.post('/api/v2/notes/mixed-conversions/commit',json=body,headers=s['headers'])
        assert response.status_code==200
    elif flow=='write':
        from .test_note_mixed_writes import ready_write,MW
        seed(client,s,local);convert(client,s,local)
        _,_,_,body=ready_write(client,s,local)
        response=client.post(MW+'/commit',json=body,headers=s['headers']);assert response.status_code==200
    elif flow=='import':
        from .test_note_mixed_imports import import_one_cipher
        import_one_cipher(client,s,local)
    elif flow=='analysis':
        from .test_note_mixed_related import settled,staged,MA
        body,_,raws,_=settled(client,s,local)
        response=client.post(MA+'/prepare',json=body,headers=s['headers']);assert response.status_code==201
        _,commit=staged(client,s,body,response.json(),MA,raws)
        response=client.post(MA+'/commit',json=commit,headers=s['headers']);assert response.status_code==200
    else:
        from .test_note_mixed_related import test_transcript_only_publish_preserves_file_identity_and_times
        test_transcript_only_publish_preserves_file_identity_and_times(client,s,enabled,'E5 transcript\r\n')
    s['db'].rollback()
    from app.services.note_backup import export_snapshot
    export_snapshot(s['db'])
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();validate_backup(value)
    operations=value['items']['note_crypto_transitions']
    assert any(op['purpose']!='conversion' and op['state']=='committed' for op in operations)
    if flow=='cp_rc':
        damaged=json.loads(json.dumps(value))
        old=next(op for op in damaged['items']['note_crypto_transitions'] if op['purpose']=='conversion')
        old['receipt_json']='{}'
        with pytest.raises(ValueError):validate_backup(rehash(damaged))
        damaged=json.loads(json.dumps(value))
        old=next(op for op in damaged['items']['note_crypto_transitions'] if op['purpose']=='conversion')
        receipt=json.loads(old['receipt_json']);receipt['history_generation']+=1;old['receipt_json']=json.dumps(receipt)
        with pytest.raises(ValueError):validate_backup(rehash(damaged))
    mixed=next(op for op in operations if op['purpose']!='conversion')
    if flow=='import':
        for damage in ('existing_digest','existing_cipher'):
            damaged=json.loads(json.dumps(value))
            target=next(op for op in damaged['items']['note_crypto_transitions'] if op['id']==mixed['id'])
            core=json.loads(target['commit_conditions_json'])
            if damage=='existing_digest':core['client_verified_existing_set_digest']='0'*64
            else:core['existing_ciphertexts']=[{'revision_id':str(uuid4()),'ciphertext_sha256':'0'*64}]
            target['commit_conditions_json']=json.dumps(core)
            with pytest.raises(ValueError):validate_backup(rehash(damaged))
    damaged=json.loads(json.dumps(value))
    target=next(op for op in damaged['items']['note_crypto_transitions'] if op['id']==mixed['id'])
    receipt=json.loads(target['receipt_json']);receipt['result']['base']['history_generation']+=1
    target['receipt_json']=json.dumps(receipt)
    with pytest.raises(ValueError):validate_backup(rehash(damaged))
    conditions=json.loads(mixed['conditions_json']);conditions['M0']['target_epoch']+=1
    mixed['conditions_json']=json.dumps(conditions)
    with pytest.raises(ValueError):validate_backup(rehash(value))


def test_v3_empty_restore_preserves_cipher_and_identity_without_credentials(client,subject,admin_headers,tmp_path):
    from sqlalchemy import create_engine,select
    from app.services.note_backup import restore_empty,SECTIONS,export_snapshot
    from sqlalchemy.orm import Session
    from .test_note_crypto_conversion import seed,convert
    s={**subject,'headers':{**subject['headers'],**admin_headers}}
    seed(client,s,'e5-restore');convert(client,s,'e5-restore')
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    backup=response.json();target=create_engine('sqlite:///'+str(tmp_path/'empty.sqlite'))
    try:
        result=restore_empty(target,backup)
        assert result['section_counts']==backup['section_counts']
        assert result['requires_reauthentication'] is True
        with Session(target) as restored:
            again=export_snapshot(restored)
            for section in SECTIONS:
                if section not in ('users','devices'):
                    assert again['items'][section]==backup['items'][section]
            from app.models.note import UserAccount,UserDevice
            assert all(user.password_hash is None and user.access_token_hash is None for user in restored.scalars(select(UserAccount)))
            assert all(device.access_token_hash is None and device.access_token_value is None for device in restored.scalars(select(UserDevice)))
        with pytest.raises(ValueError,match='target_not_empty'):restore_empty(target,backup)
    finally:target.dispose()


@pytest.mark.parametrize('occupied',['identity','credential','unknown'])
def test_v3_restore_rejects_any_existing_target_without_changes(client,admin_headers,tmp_path,occupied):
    from sqlalchemy import create_engine,text
    from app.db import Base
    from app.services.note_backup import restore_empty
    backup=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers).json()
    target=create_engine('sqlite:///'+str(tmp_path/'occupied.sqlite'))
    try:
        with target.begin() as connection:
            Base.metadata.create_all(connection)
            if occupied=='identity':connection.execute(text("INSERT INTO server_identity (id,instance_id) VALUES (1,:id)"),{'id':str(uuid4())})
            elif occupied=='credential':
                connection.execute(text("INSERT INTO user_mail_settings (owner_id,sender_name,sender_email,smtp_host,smtp_port,security,smtp_username,smtp_password_encrypted,test_recipient,created_at,updated_at) VALUES ('synthetic','','','',587,'starttls','','synthetic','','2026-01-01','2026-01-01')"))
            else:connection.execute(text('CREATE TABLE unrelated_project (id INTEGER PRIMARY KEY)'))
        with pytest.raises(ValueError,match='target_'):restore_empty(target,backup)
        with target.connect() as connection:
            assert connection.scalar(text('SELECT COUNT(*) FROM server_identity'))==(1 if occupied=='identity' else 0)
    finally:target.dispose()


def test_v3_restore_sql_failure_rolls_back_all_inserted_rows(client,subject,admin_headers,tmp_path):
    from sqlalchemy import create_engine,event,inspect,text
    from app.services.note_backup import restore_empty
    from .test_note_crypto_conversion import seed,convert
    s={**subject,'headers':{**subject['headers'],**admin_headers}}
    seed(client,s,'e5-rollback');convert(client,s,'e5-rollback')
    backup=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers).json()
    target=create_engine('sqlite:///'+str(tmp_path/'rollback.sqlite'))
    def fail(connection,cursor,statement,parameters,context,executemany):
        if statement.lower().startswith('insert into note_crypto_chunks'):raise RuntimeError('synthetic_restore_failure')
    event.listen(target,'before_cursor_execute',fail)
    try:
        with pytest.raises(RuntimeError,match='synthetic_restore_failure'):restore_empty(target,backup)
        event.remove(target,'before_cursor_execute',fail)
        with target.connect() as connection:
            for table in inspect(connection).get_table_names():
                assert connection.scalar(text('SELECT COUNT(*) FROM '+connection.dialect.identifier_preparer.quote(table)))==0
        assert restore_empty(target,backup)['section_counts']==backup['section_counts']
    finally:target.dispose()


def test_v3_cli_defaults_to_validation_and_requires_explicit_empty_target(client,admin_headers,tmp_path):
    import os,subprocess,sys
    from pathlib import Path
    backup=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers).json()
    source=tmp_path/'backup.json';source.write_text(json.dumps(backup),encoding='utf-8')
    target=tmp_path/'cli.sqlite'
    script=Path(__file__).resolve().parents[1]/'scripts'/'restore_notes.py'
    command=[sys.executable,str(script),'--backup',str(source)]
    env={**os.environ,'NOW_DATABASE_URL':'sqlite:///'+str(target),'NOW_API_TOKEN':''}
    checked=subprocess.run(command,env=env,capture_output=True,text=True,timeout=40)
    assert checked.returncode==0 and json.loads(checked.stdout)['database_changed'] is False
    assert not target.exists()
    missing=dict(env);missing.pop('NOW_DATABASE_URL')
    rejected=subprocess.run(command+['--apply'],env=missing,capture_output=True,text=True,timeout=40)
    assert rejected.returncode==2 and not target.exists()
    applied=subprocess.run(command+['--apply'],env=env,capture_output=True,text=True,timeout=40)
    assert applied.returncode==0 and json.loads(applied.stdout)['database_changed'] is True
    assert json.loads(applied.stdout)['requires_reauthentication'] is True
    repeated=subprocess.run(command+['--apply'],env=env,capture_output=True,text=True,timeout=40)
    assert repeated.returncode==2
    assert str(target) not in repeated.stderr and 'sqlite:' not in repeated.stderr


def test_v3_preserves_existing_empty_local_id(client,subject,admin_headers):
    from .test_note_crypto_conversion import seed
    from .test_note_crypto import context
    s={**subject,'headers':{**subject['headers'],**admin_headers}}
    seed(client,s,'');context(client,s,'')
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    assert any(row['local_id']=='' for row in response.json()['items']['note_heads'])


@pytest.mark.parametrize('damage',['run_job','drain_transition','drain_cohort'])
def test_v3_rejects_rehashed_drain_and_worker_reference_loss(client,subject,admin_headers,damage):
    from .test_related_text import drain
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-drain-reference'
    response=client.post('/api/v1/analysis/jobs',json={'owner_id':s['owner'],'note_local_id':local,'job_type':'memo_summary','input_text':'synthetic'},headers=s['headers'])
    assert response.status_code==200
    drain(client,s,local)
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    backup=response.json();row=backup['items']['note_related_drains'][0]
    if damage=='run_job':backup['items']['note_analysis_runs'][0]['job_id']=2147483000
    elif damage=='drain_transition':row['state']='promoted';row['transition_id']=str(uuid4())
    else:
        c=json.loads(row['conditions_json']);c['accepted_runs'][0]['run_id']=str(uuid4());row['conditions_json']=json.dumps(c)
    with pytest.raises(ValueError):validate_backup(rehash(backup))


@pytest.mark.parametrize('damage',[None,'receipt','manifest','forged_origin'])
def test_v3_native_analysis_storage_survives_rotation_and_rejects_old_receipt_damage(client,subject,enabled,admin_headers,damage):
    from .test_protected_analysis import prepared,upload,PA
    from .test_note_mixed import ready_rc
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-native-history'
    body,intent,_,raws=prepared(client,s,local)
    commit=upload(client,s,local,PA,body,intent,raws)
    assert client.post(PA+'/commit',json=commit,headers=s['headers']).status_code==200
    _,_,_,commit,_=ready_rc(client,s,local)
    assert client.post('/api/v2/notes/mixed-conversions/commit',json=commit,headers=s['headers']).status_code==200
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    backup=response.json()
    if damage is None:validate_backup(backup)
    else:
        row=next(row for row in backup['items']['note_crypto_transitions'] if row['purpose']=='protected_analysis_write')
        if damage=='receipt':row['receipt_json']='{}'
        elif damage=='manifest':row['manifest_digest']='0'*64
        else:
            from app.services.related_writes import metadata,h
            from types import SimpleNamespace
            c=json.loads(row['conditions_json']);c['origin']['source_digest']='0'*64
            row['conditions_json']=json.dumps(c)
            row['manifest_digest']=h({**metadata(SimpleNamespace(**row),c),'slots':c['slots'],'origin':c['origin']})
            receipt=json.loads(row['receipt_json']);receipt['source_digest']='0'*64
            receipt['origin_digest']=h(c['origin']);receipt['metadata_manifest_digest']=row['manifest_digest']
            row['receipt_json']=json.dumps(receipt)
            core=json.loads(row['commit_conditions_json']);core['metadata_manifest_digest']=row['manifest_digest'];row['commit_conditions_json']=json.dumps(core)
        with pytest.raises(ValueError):validate_backup(rehash(backup))


@pytest.mark.parametrize('flow',['write','import'])
def test_v3_preserves_original_native_write_and_import(client,subject,admin_headers,flow):
    from app.services.note_backup import validate_backup
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-native-'+flow
    if flow=='write':
        from .test_note_protected_writes import qbody,quote,stage,commit
        body=qbody(client,s,local);prepared=quote(client,s,body)
        result=stage(client,s,body,prepared);commit(client,s,result[0])
    else:
        from .test_note_protected_import import request,entry,prepare,stage,commit
        body=request(client,s,local,[entry()]);prepared=prepare(client,s,body)
        result=stage(client,s,body,prepared);commit(client,s,result[0])
    response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
    assert response.status_code==200
    value=response.json();row=next(row for row in value['items']['note_crypto_transitions'] if row['purpose']=='protected_'+flow)
    receipt=json.loads(row['receipt_json']);receipt['history_generation']+=1;row['receipt_json']=json.dumps(receipt)
    with pytest.raises(ValueError):validate_backup(rehash(value))


@pytest.mark.parametrize('purpose',['protected_analysis_write','mixed_analysis_write'])
def test_sequence_floor_includes_unpublished_analysis_intent(purpose):
    from app.services.note_backup import restore_sequences
    class Connection:
        def __init__(self):self.statements=[]
        def scalar(self,statement,params=None):
            if params is not None:return 'public.analysis_jobs_id_seq' if params['table_name']=='analysis_jobs' else None
            return 10
        def exec_driver_sql(self,statement):self.statements.append(statement)
    connection=Connection()
    backup={'items':{'note_protected_analysis_claims':[{'job_id':10}],
                     'note_crypto_transitions':[{'purpose':purpose,'conditions_json':json.dumps({'job_id':11})}]}}
    restore_sequences(connection,backup)
    assert connection.statements==['ALTER SEQUENCE public.analysis_jobs_id_seq RESTART WITH 12']


@pytest.mark.parametrize('schema',[1,3])
def test_postgres_empty_restore_reserved_publication_and_allocator_rollback(client,subject,enabled,admin_headers,schema):
    import os,base64
    url=os.environ.get('NOW_E5_TEST_POSTGRES_URL')
    if not url:pytest.skip('E5 전용 PostgreSQL QA URL 필요')
    from sqlalchemy import create_engine,event,inspect,select,text,func
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session
    from sqlalchemy.schema import CreateSchema,DropSchema
    from app.db import Base,get_db
    from app.main import app
    from app.services.note_backup import export_snapshot,restore_empty
    from app.services.user_accounts import issue_user_device_access_token
    from app.models.note import AnalysisJob,Recording,UserDevice
    from .test_note_crypto_conversion import decrypt
    from .test_note_mixed import mcontext,rq,MR
    assert os.environ.get('NOW_E5_QA_CONFIRMED')=='isolated-nownote240qa'
    assert make_url(url).database=='now'
    s={**subject,'headers':{**subject['headers'],**admin_headers}};local='e5-pg-'+str(schema)
    if schema==1:
        from .test_protected_analysis import prepared,upload,replan_body,reencrypt,PA
        body,intent,bm,raws=prepared(client,s,local)
        aborted=client.post(PA+'/abort',json={'schema_version':1,'owner_id':s['owner'],'local_id':local,
            'device_id':'actor','server_instance_id':body['server_instance_id'],'write_id':intent['write_id'],
            'lease_version':intent['lease_version']},headers=s['headers'])
        assert aborted.status_code==200
        with s['engine'].begin() as connection:
            connection.execute(AnalysisJob.__table__.insert().values(id=bm['original_job_id'],owner_id=s['other'],
                note_local_id=None,job_type='memo_summary',status='done',input_text='synthetic unrelated'))
        body=replan_body(client,s,local,body,intent,bm,previous_state='aborted')
        response=client.post(PA+'/replans',json=body,headers=s['headers']);assert response.status_code==201
        intent=response.json();raws=reencrypt(intent,raws,bm['original_epoch'])
        published_id=int(intent['slots'][0]['key']['id']);assert published_id>bm['original_job_id']
        commit=upload(client,s,local,PA,body,intent,raws);prefix=PA
    else:
        from .test_note_mixed_related import settled,staged,MA
        body,bm,raws,_=settled(client,s,local)
        response=client.post(MA+'/prepare',json=body,headers=s['headers']);assert response.status_code==201
        intent=response.json();_,commit=staged(client,s,body,intent,MA,raws);prefix=MA
        published_id=bm['original_job_id']
    s['db'].rollback();backup=export_snapshot(s['db'])
    admin=create_engine(url,hide_parameters=True);name='e5_restore_'+uuid4().hex
    target=None;old_backend=app.dependency_overrides.get(get_db)
    try:
        with admin.begin() as connection:connection.execute(CreateSchema(name))
        target=create_engine(url,connect_args={'options':'-c search_path='+name},hide_parameters=True)
        Base.metadata.create_all(target)
        with target.connect() as connection:
            sequence=connection.scalar(text("SELECT pg_get_serial_sequence('analysis_jobs','id')"))
            before=tuple(connection.execute(text('SELECT last_value,is_called FROM '+sequence)).one())
        def fail(connection,cursor,statement,parameters,context,executemany):
            if statement.startswith('ALTER SEQUENCE') and 'analysis_jobs_id_seq' in statement:raise RuntimeError('synthetic_sequence_rollback')
        event.listen(target,'after_cursor_execute',fail)
        try:
            with pytest.raises(RuntimeError,match='synthetic_sequence_rollback'):restore_empty(target,backup)
        finally:event.remove(target,'after_cursor_execute',fail)
        with target.connect() as connection:
            assert tuple(connection.execute(text('SELECT last_value,is_called FROM '+sequence)).one())==before
            for table in inspect(connection).get_table_names():
                assert connection.scalar(text('SELECT COUNT(*) FROM '+connection.dialect.identifier_preparer.quote(table)))==0
        assert restore_empty(target,backup)['section_counts']==backup['section_counts']
        def backend():
            with Session(target,autoflush=False) as request_db:yield request_db
        app.dependency_overrides[get_db]=backend
        from app.models.note import SyncLog
        inserted=False
        def concurrent_log(connection,cursor,statement,parameters,context,executemany):
            nonlocal inserted
            if not inserted and statement.lstrip().startswith('SELECT notes.'):
                inserted=True
                with target.begin() as writer:
                    writer.execute(SyncLog.__table__.insert().values(owner_id=s['owner'],device_id='actor'))
        event.listen(target,'after_cursor_execute',concurrent_log)
        try:
            response=client.get('/api/v1/admin/export/all',params={'backup_schema_version':3},headers=admin_headers)
        finally:event.remove(target,'after_cursor_execute',concurrent_log)
        assert inserted and response.status_code==200 and response.headers['cache-control']=='no-store'
        exported=response.json()
        assert exported['section_counts']==backup['section_counts'],'PG snapshot must exclude a row committed after the first section read'
        for section in backup['items']:
            if section not in ('users','devices'):assert exported['items'][section]==backup['items'][section]
        with target.connect() as connection:
            assert connection.scalar(select(func.count()).select_from(SyncLog))==len(backup['items']['sync_logs'])+1
        with Session(target,autoflush=False) as restored:
            assert all(row.access_token_hash is None and row.access_token_value is None for row in restored.scalars(select(UserDevice)))
            # Explicit synthetic reauthentication uses the existing management function, not restore.
            _,token=issue_user_device_access_token(restored,owner_id=s['owner'],device_id='actor',display_name='E5 synthetic QA')
            restored.commit()
            headers={**admin_headers,'X-Now-User-Token':token}
            from .test_note_v2 import body as note_body
            response=client.put('/api/v2/notes/current',json=note_body(s,'e5-unrelated-note'),headers=headers)
            assert response.status_code==200
            from app.models.note import Note
            created=restored.scalar(select(Note).where(Note.owner_id==s['owner'],Note.local_id=='e5-unrelated-note'))
            assert created.id>max([r['id'] for r in backup['items']['notes']]+[0])
            response=client.post('/api/v1/analysis/jobs',json={'owner_id':s['owner'],'note_local_id':None,'job_type':'memo_summary','input_text':'synthetic unrelated'},headers=headers)
            assert response.status_code==200 and response.json()['id']>published_id
            with target.begin() as connection:
                rid=connection.execute(Recording.__table__.insert().values(owner_id=s['owner'],note_local_id=None,device_id='actor',local_id=str(uuid4()),file_name='synthetic.wav',content_type='audio/wav',storage_path='synthetic-no-file',transcript=None).returning(Recording.id)).scalar_one()
                assert rid>max([r['id'] for r in backup['items']['recordings']]+[0])
            response=client.post(prefix+'/commit',json=commit,headers=headers)
            assert response.status_code==200
            restored.expire_all();assert restored.get(AnalysisJob,published_id) is not None
            peer={**s,'headers':headers,'engine':target,'db':restored}
            a,context=mcontext(client,peer,local)
            catalog=client.get(MR+'/catalog',params=rq(a,context),headers=headers)
            assert catalog.status_code==200
            descriptor=next(d for d in catalog.json()['entries'] if d['key']['kind']=='analysis_result' and d['key']['id']==str(published_id))
            key=descriptor['key']
            received=client.get(MR+'/representation',params={**rq(a,context),'kind':key['kind'],'representation_id':key['id'],'slot':key['slot'],'representation_etag':descriptor['representation_etag'],'chunk_index':0},headers=headers)
            assert received.status_code==200
            raw=base64.b64decode(received.json()['data_base64'])
            original=next(value for encoded,value in raws.items() if json.loads(encoded)==key)
            assert raw==original
            outer=json.loads(raw);inner=json.loads(decrypt(outer['ciphertext'],descriptor['representation_epoch']))
            assert inner['binding']==outer['binding']==descriptor['expected_binding']
            assert inner['value'] is not None
    finally:
        if old_backend is None:app.dependency_overrides.pop(get_db,None)
        else:app.dependency_overrides[get_db]=old_backend
        if target is not None:target.dispose()
        with admin.begin() as connection:connection.execute(DropSchema(name,cascade=True))
        admin.dispose()
