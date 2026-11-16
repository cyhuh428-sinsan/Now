"""Run with Linux Docker and an existing NowNote dependency image; no production resources."""
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4


def fixture(mode):
    from sqlalchemy import select

    from app import worker
    from app.models.note_related import AnalysisRun

    assert os.getpid() == 1
    worker.create_tables()
    if mode != 'idle':
        with worker.SessionLocal() as db:
            db.add_all([worker.AnalysisJob(owner_id='qa', job_type='memo_summary',
                                           status='queued', input_text='synthetic') for _ in range(2)])
            db.commit()

    calls = []

    def analyze(_job):
        calls.append(1)
        print('QA active', flush=True)
        deadline = time.monotonic() + 10
        while not signal.getsignal(signal.SIGTERM).__self__.requested:
            if time.monotonic() >= deadline:
                raise AssertionError('Shutdown signal not observed')
            time.sleep(0.025)
        return '{}'

    worker.process_analysis_job = analyze
    if mode == 'uncertain':
        def fail_finish(*_args, **_kwargs):
            raise RuntimeError('synthetic commit acknowledgement failure')
        worker.related_drain.finish = fail_finish

    code = worker.main()
    with worker.SessionLocal() as db:
        jobs = list(db.scalars(select(worker.AnalysisJob).order_by(worker.AnalysisJob.id)))
        runs = list(db.scalars(select(AnalysisRun)))
        if mode == 'idle':
            assert code == 0 and not jobs and not runs and not calls
        else:
            assert calls == [1] and len(runs) == 1 and jobs[1].status == 'queued'
            if mode == 'active':
                receipt = json.loads(runs[0].receipt_json)
                assert code == 0 and jobs[0].status == 'done' and receipt['settled'] is True
                assert receipt['job_id'] == jobs[0].id and receipt['run_id'] == runs[0].run_id
            else:
                assert code == 1 and jobs[0].status == 'running' and runs[0].receipt_json is None
    print('QA verified', flush=True)
    return code


def smoke(image):
    server = str(Path(__file__).resolve().parents[1])

    def docker(*args):
        return subprocess.check_output(['docker', *args], text=True, stderr=subprocess.STDOUT, timeout=25)

    for sig in ('SIGTERM', 'SIGINT'):
        for mode in ('idle', 'active', 'uncertain'):
            name = 'nownote-stop-qa-' + uuid4().hex[:12]
            ident = docker('run', '-d', '--name', name, '--network', 'none', '--read-only',
                           '--tmpfs', '/tmp', '-w', '/qa', '-e', 'PYTHONPATH=/qa',
                           '-e', 'NOW_DATABASE_URL=sqlite:////tmp/qa.db', '-e', 'NOW_WORKER_POLL_SECONDS=60',
                           '-v', server + ':/qa:ro', '--entrypoint', 'python', image,
                           '-B', 'tests/worker_signal_smoke.py', '--fixture', mode).strip()
            try:
                marker = 'NowNote worker started' if mode == 'idle' else 'QA active'
                deadline = time.monotonic() + 10
                while marker not in (logs := docker('logs', ident)):
                    if time.monotonic() >= deadline:
                        raise AssertionError(logs)
                    time.sleep(0.05)
                started = time.monotonic()
                # Docker stop on the product default signal, explicit SIGINT for parity.
                docker('stop', '--timeout', '4', '--signal', sig, ident)
                elapsed = time.monotonic() - started
                code = int(docker('inspect', '--format', '{{.State.ExitCode}}', ident))
                logs = docker('logs', ident)
                assert code == (1 if mode == 'uncertain' else 0) and 'QA verified' in logs, logs
                if mode == 'idle':
                    assert elapsed < 3, elapsed
                print(f'{sig} {mode}: exit={code}, {elapsed:.2f}s, PASS', flush=True)
            finally:
                docker('rm', '-f', ident)


if __name__ == '__main__':
    if sys.argv[1] == '--fixture':
        sys.exit(fixture(sys.argv[2]))
    smoke(sys.argv[1])
