"""2.3.6 P8 — 동기화 상태 조회 API + 실패 기록

검증 범위:
  - 성공한 동기화가 SyncLog에 succeeded=True로 기록된다
  - 실패한 동기화(upsert_note가 던지는 예외)도 succeeded=False + 실패 사유로
    기록되고, 부분 반영 없이 커밋된다
  - 실패해도 클라이언트가 받는 오류 응답(상태 코드, detail)은 그대로다
  - GET /api/v1/sync/status가 마지막 동기화 시각/성공 여부/실패 사유를 돌려준다
"""
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


def _device_id() -> str:
    return f"sync_status_device_{uuid.uuid4().hex[:8]}"


def _local_id() -> str:
    return f"local_{uuid.uuid4().hex[:8]}"


def _owner_id() -> str:
    return f"owner_{uuid.uuid4().hex[:8]}"


# ── 성공 기록 ─────────────────────────────────────────────────────────────────

def test_successful_sync_logs_succeeded_true(client: TestClient, db: Session) -> None:
    from app.models.note import SyncLog

    owner = _owner_id()
    device = _device_id()

    res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner,
            "device_id": device,
            "notes": [
                {
                    "owner_id": owner,
                    "device_id": device,
                    "local_id": _local_id(),
                    "note_type": "memo",
                    "title": "정상 노트",
                    "content": "내용",
                }
            ],
        },
    )
    assert res.status_code == 200, res.text

    log = db.scalar(
        select(SyncLog)
        .where(SyncLog.owner_id == owner, SyncLog.device_id == device)
        .order_by(SyncLog.id.desc())
    )
    assert log is not None
    assert bool(log.succeeded) is True
    assert log.failure_reason is None
    assert log.pushed_count == 1


# ── 실패 기록 ─────────────────────────────────────────────────────────────────

def test_failed_sync_logs_succeeded_false_with_reason(client: TestClient, db: Session) -> None:
    from app.models.note import SyncLog

    owner = _owner_id()
    device = _device_id()
    bad_local_id = _local_id()

    res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner,
            "device_id": device,
            "notes": [
                {
                    "owner_id": owner,
                    "device_id": device,
                    "local_id": bad_local_id,
                    "note_type": "tree",
                    "title": "레벨 2인데 부모가 없음",
                    "content": "",
                    "level": 2,
                    "parent_local_id": None,
                }
            ],
        },
    )
    # 클라이언트가 받는 오류 응답은 upsert_note()가 던지는 것과 같아야 한다
    assert res.status_code == 400
    assert res.json()["detail"] == "child note requires parent"

    log = db.scalar(
        select(SyncLog)
        .where(SyncLog.owner_id == owner, SyncLog.device_id == device)
        .order_by(SyncLog.id.desc())
    )
    assert log is not None
    assert bool(log.succeeded) is False
    assert log.failure_reason is not None
    assert bad_local_id in log.failure_reason
    assert "child note requires parent" in log.failure_reason


def test_failed_sync_does_not_partially_commit_notes(client: TestClient, db: Session) -> None:
    """같은 요청에 정상 노트와 실패 노트가 섞이면, 정상 노트도 커밋되지 않아야 한다."""
    from app.models.note import Note

    owner = _owner_id()
    device = _device_id()
    good_local_id = _local_id()
    bad_local_id = _local_id()

    res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner,
            "device_id": device,
            "notes": [
                {
                    "owner_id": owner,
                    "device_id": device,
                    "local_id": good_local_id,
                    "note_type": "memo",
                    "title": "정상 노트",
                    "content": "",
                },
                {
                    "owner_id": owner,
                    "device_id": device,
                    "local_id": bad_local_id,
                    "note_type": "tree",
                    "title": "잘못된 레벨",
                    "content": "",
                    "level": 2,
                    "parent_local_id": None,
                },
            ],
        },
    )
    assert res.status_code == 400

    persisted = db.scalar(select(Note).where(Note.owner_id == owner, Note.local_id == good_local_id))
    assert persisted is None


# ── 조회 API ──────────────────────────────────────────────────────────────────

def test_sync_status_reports_last_success(client: TestClient) -> None:
    owner = _owner_id()
    device = _device_id()

    client.post(
        "/api/v1/sync",
        json={"owner_id": owner, "device_id": device, "notes": []},
    )

    res = client.get(
        "/api/v1/sync/status",
        params={"owner_id": owner, "device_id": device},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["owner_id"] == owner
    assert data["device_id"] == device
    assert data["last_sync_succeeded"] is True
    assert data["last_synced_at"] is not None
    assert data["last_failure_reason"] is None
    assert len(data["recent"]) >= 1


def test_sync_status_reports_last_failure_reason(client: TestClient) -> None:
    owner = _owner_id()
    device = _device_id()
    bad_local_id = _local_id()

    client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner,
            "device_id": device,
            "notes": [
                {
                    "owner_id": owner,
                    "device_id": device,
                    "local_id": bad_local_id,
                    "note_type": "tree",
                    "title": "실패용",
                    "content": "",
                    "level": 2,
                    "parent_local_id": None,
                }
            ],
        },
    )

    res = client.get(
        "/api/v1/sync/status",
        params={"owner_id": owner, "device_id": device},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["last_sync_succeeded"] is False
    assert data["last_failure_reason"] is not None
    assert bad_local_id in data["last_failure_reason"]


def test_sync_status_unknown_device_returns_empty(client: TestClient) -> None:
    res = client.get(
        "/api/v1/sync/status",
        params={"owner_id": _owner_id(), "device_id": _device_id()},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["last_synced_at"] is None
    assert data["last_sync_succeeded"] is None
    assert data["recent"] == []
