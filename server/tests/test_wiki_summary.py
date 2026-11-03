"""Opt-in catalog summaries retain existing auth and never return source/body text."""
import json
import pytest
from .test_note_v2 import subject, based, get_current
from .test_wikis import make, put, approved


def listing(client, s, **params):
    return client.get('/api/v1/wikis', params={'owner_id': s['owner'], 'summary': True, **params}, headers=s['headers'])


def test_summary_is_opt_in_and_contains_only_verified_title_topic_and_flags(client, subject):
    s = subject
    _, doc, request, route = make(client, s)
    assert put(client, s, route, request).status_code == 200
    update = based(request, get_current(client, s, request['local_id']))
    update['note']['content'] = json.dumps(approved(doc, s['owner']))
    assert put(client, s, route, update).status_code == 200
    ordinary = client.get('/api/v1/wikis', params={'owner_id': s['owner']}, headers=s['headers'])
    assert 'summary' not in ordinary.json()['items'][0]
    response = listing(client, s)
    assert response.status_code == 200, response.text
    row = response.json()['items'][0]
    assert row['summary'] == {'schema_version': 1, 'readable': True, 'protected': False, 'approved': True,
                              'title': doc['drafts'][0]['title'], 'topic': doc['drafts'][0]['topic'], 'stale': False}
    assert 'Generated body' not in response.text and 'Original quote' not in response.text
    assert 'sections' not in response.text and 'citations' not in response.text and 'source_manifest' not in response.text
    assert response.headers['cache-control'] == 'no-store'
    assert row['payload'] == ordinary.json()['items'][0]['payload']


def test_source_unavailable_summary_hides_title_topic_and_approval(client, subject):
    s = subject
    _, doc, request, route = make(client, s)
    assert put(client, s, route, request).status_code == 200
    from app.models.note_history import NoteRevision
    revision = s['db'].get(NoteRevision, doc['drafts'][0]['source_manifest'][0]['source_revision_id'])
    revision.snapshot_json = '{}'
    s['db'].commit()
    response = listing(client, s)
    assert response.status_code == 200, response.text
    summary = response.json()['items'][0]['summary']
    assert summary['readable'] is False and summary['title'] is None and summary['topic'] is None
    assert summary['approved'] is False
    assert doc['drafts'][0]['title'] not in response.text


def test_summary_cannot_cross_owner_and_read_errors_do_not_expose_exception_text(client, subject, monkeypatch):
    s = subject
    _, _, request, route = make(client, s)
    assert put(client, s, route, request).status_code == 200
    assert listing(client, s, owner_id=s['other']).status_code in (401, 403)
    from app.services import wikis
    monkeypatch.setattr(wikis, 'get', lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError('CONFIDENTIAL_DIAGNOSTIC')))
    response = listing(client, s)
    assert response.status_code == 200, response.text
    assert response.json()['items'][0]['summary']['readable'] is False
    assert 'CONFIDENTIAL_DIAGNOSTIC' not in response.text


def test_protected_and_trashed_summaries_never_publish_titles(client, subject):
    from .test_note_crypto_conversion import convert
    from .test_wiki_lifecycle import command, state, history
    s = subject
    _, doc, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    convert(client, s, request['local_id'])
    before = history(s)
    response = listing(client, s)
    summary = response.json()['items'][0]['summary']
    assert summary['protected'] is True and summary['readable'] is False
    assert summary['title'] is None and summary['topic'] is None
    assert doc['drafts'][0]['title'] not in response.text
    assert history(s) == before
    version = state(client, s, path)['resource']['version']
    assert client.post(path + '/trash', json=command(s, version), headers=s['headers']).status_code == 200
    assert listing(client, s).json()['items'] == []
    response = listing(client, s, include_deleted=True)
    row = response.json()['items'][0]
    assert row['deleted_at'] and row['summary']['readable'] is False
    assert row['summary']['title'] is None and row['summary']['topic'] is None
    assert history(s) == before


@pytest.mark.parametrize('phase', ['prepared', 'staging', 'ready'])
def test_summary_does_not_commit_expired_source_transition_cleanup(client, subject, phase):
    from datetime import datetime, timedelta
    from uuid import uuid4
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence
    s = subject
    _, _, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    ident = str(uuid4())
    db = s['db']
    db.add(NoteCryptoTransition(id=ident, owner_id=s['owner'], local_id='wiki-source',
        mutation_id=str(uuid4()), actor_device_id='actor', conditions_json='{}',
        manifest_digest='0' * 64, state=phase, lease_version=1,
        expires_at=datetime.utcnow() - timedelta(seconds=1), created_at=datetime.utcnow()))
    db.flush()
    db.add(NoteCryptoFence(owner_id=s['owner'], local_id='wiki-source', transition_id=ident))
    db.commit()
    response = listing(client, s)
    assert response.status_code == 200
    assert response.json()['items'][0]['summary']['readable'] is True
    db.expire_all()
    assert db.get(NoteCryptoTransition, ident).state == phase
    assert db.get(NoteCryptoFence, (s['owner'], 'wiki-source')).transition_id == ident
