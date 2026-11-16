from contextlib import nullcontext

import pytest

from app import worker


@pytest.mark.parametrize('phase', ['claim', 'dispatch', 'process', 'finish'])
@pytest.mark.parametrize('outcome', ['done', 'failed', 'cancelled'])
def test_stop_drains_only_claimed_job(monkeypatch, phase, outcome):
    state = worker.ShutdownState()
    calls = []
    task = {'job_type': 'test', 'input_text': 'synthetic', 'run_id': 'run-1'}

    def call(name, result):
        calls.append(name)
        if name == phase:
            state.request()
        return result

    monkeypatch.setattr(worker, 'SessionLocal', nullcontext)
    monkeypatch.setattr(worker, 'candidate_jobs', lambda *_: [1, 2])
    monkeypatch.setattr(worker.related_drain, 'claim', lambda *_: call('claim', task))
    monkeypatch.setattr(worker.related_drain, 'dispatch', lambda *_: call('dispatch', task))
    monkeypatch.setattr(worker, 'process_analysis_job', lambda *_: call('process', '{}'))
    monkeypatch.setattr(worker.related_drain, 'finish', lambda *_args, **_kw: call('finish', {
        'settled': True, 'job_id': 1, 'run_id': 'run-1', 'outcome': outcome,
    }))
    assert worker.run_once(state) == (outcome == 'done')
    assert calls == ['claim', 'dispatch', 'process', 'finish']
    assert state.exit_code == 0


def test_finish_failure_is_not_retried_or_reported_as_clean(monkeypatch, caplog):
    state = worker.ShutdownState()
    calls = []
    task = {'job_type': 'test', 'input_text': 'synthetic', 'run_id': 'run-1'}
    monkeypatch.setattr(worker, 'SessionLocal', nullcontext)
    monkeypatch.setattr(worker, 'candidate_jobs', lambda *_: [1, 2])
    monkeypatch.setattr(worker.related_drain, 'claim', lambda *_: task)
    monkeypatch.setattr(worker.related_drain, 'dispatch', lambda *_: task)
    monkeypatch.setattr(worker, 'process_analysis_job', lambda *_: calls.append('process'))

    def finish(*_args, **_kw):
        state.request()
        calls.append('finish')
        raise RuntimeError('private error payload')

    monkeypatch.setattr(worker.related_drain, 'finish', finish)
    worker.run_once(state)
    assert calls == ['process', 'finish']
    assert state.exit_code != 0
    assert 'private error payload' not in caplog.text


def test_stop_during_candidate_lookup_prevents_claim(monkeypatch):
    state = worker.ShutdownState()
    monkeypatch.setattr(worker, 'SessionLocal', nullcontext)

    def candidates(*_):
        state.request()
        return [1]

    monkeypatch.setattr(worker, 'candidate_jobs', candidates)
    monkeypatch.setattr(worker.related_drain, 'claim', lambda *_: pytest.fail('claimed after shutdown'))
    assert worker.run_once(state) == 0


def test_unknown_commit_before_shutdown_stays_visible_after_later_success(monkeypatch):
    state = worker.ShutdownState()
    candidates = iter([[1], [2]])
    monkeypatch.setattr(worker, 'SessionLocal', nullcontext)
    monkeypatch.setattr(worker, 'candidate_jobs', lambda *_: next(candidates))

    def claim(_db, ident, _worker_id):
        if ident == 1:
            raise RuntimeError('unknown commit outcome')
        return {'job_type': 'test', 'input_text': 'synthetic', 'run_id': 'run-2'}

    monkeypatch.setattr(worker.related_drain, 'claim', claim)
    monkeypatch.setattr(worker.related_drain, 'dispatch', lambda _db, task: task)
    monkeypatch.setattr(worker, 'process_analysis_job', lambda *_: '{}')
    monkeypatch.setattr(worker.related_drain, 'finish', lambda *_args, **_kw: {
        'settled': True, 'job_id': 2, 'run_id': 'run-2', 'outcome': 'done',
    })
    assert worker.run_once(state) == 0
    assert worker.run_once(state) == 1
    state.request()
    assert worker.run_once(state) == 0
    assert state.exit_code == 1
