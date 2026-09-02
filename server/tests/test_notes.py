"""노트 API 테스트

검증 범위:
  - 노트 Upsert (생성/수정)
  - 삭제 (소프트 딜리트) — deleted_at 설정
  - 목록 조회 (include_deleted 파라미터)
  - 키워드 검색 (title / content)
  - 동기화 배치 API
"""
import uuid
from fastapi.testclient import TestClient


def _device_id() -> str:
    return f"test_device_{uuid.uuid4().hex[:8]}"


def _local_id() -> str:
    return f"local_{uuid.uuid4().hex[:8]}"


# ── Upsert ────────────────────────────────────────────────────────────────────

def test_upsert_note_creates_new_note(client: TestClient) -> None:
    device_id = _device_id()
    local_id = _local_id()
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": "local_user",
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "memo",
            "title": "테스트 노트",
            "content": "내용입니다",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "테스트 노트"
    assert data["local_id"] == local_id
    assert data["deleted_at"] is None


def test_upsert_note_updates_existing_note(client: TestClient) -> None:
    device_id = _device_id()
    local_id = _local_id()
    # 최초 생성
    client.post(
        "/api/v1/notes",
        json={
            "owner_id": "local_user",
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "memo",
            "title": "원래 제목",
            "content": "원래 내용",
        },
    )
    # 수정
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": "local_user",
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "memo",
            "title": "수정된 제목",
            "content": "수정된 내용",
        },
    )
    assert res.status_code == 200
    assert res.json()["title"] == "수정된 제목"
    assert res.json()["content"] == "수정된 내용"


# ── 삭제 (소프트 딜리트) ──────────────────────────────────────────────────────

def test_delete_note_sets_deleted_at(client: TestClient) -> None:
    device_id = _device_id()
    local_id = _local_id()
    client.post(
        "/api/v1/notes",
        json={
            "owner_id": "local_user",
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "memo",
            "title": "삭제할 노트",
            "content": "",
        },
    )

    del_res = client.delete(
        f"/api/v1/notes/{local_id}",
        params={"owner_id": "local_user", "device_id": device_id},
    )
    assert del_res.status_code == 200
    assert del_res.json()["deleted_at"] is not None


def test_delete_nonexistent_note_returns_404(client: TestClient) -> None:
    res = client.delete(
        "/api/v1/notes/non_existent_id",
        params={"owner_id": "local_user"},
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "note not found"


# ── 목록 조회 ─────────────────────────────────────────────────────────────────

def test_list_notes_excludes_deleted_by_default(client: TestClient) -> None:
    device_id = _device_id()
    alive_id = _local_id()
    dead_id = _local_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"

    for lid, title in [(alive_id, "살아있는 노트"), (dead_id, "삭제될 노트")]:
        client.post(
            "/api/v1/notes",
            json={
                "owner_id": owner,
                "device_id": device_id,
                "local_id": lid,
                "note_type": "memo",
                "title": title,
                "content": "",
            },
        )
    client.delete(f"/api/v1/notes/{dead_id}", params={"owner_id": owner})

    res = client.get("/api/v1/notes", params={"owner_id": owner})
    assert res.status_code == 200
    local_ids = [n["local_id"] for n in res.json()]
    assert alive_id in local_ids
    assert dead_id not in local_ids


def test_list_notes_include_deleted(client: TestClient) -> None:
    device_id = _device_id()
    dead_id = _local_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"

    client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": dead_id,
            "note_type": "memo",
            "title": "삭제 노트 포함 조회",
            "content": "",
        },
    )
    client.delete(f"/api/v1/notes/{dead_id}", params={"owner_id": owner})

    res = client.get("/api/v1/notes", params={"owner_id": owner, "include_deleted": "true"})
    assert res.status_code == 200
    local_ids = [n["local_id"] for n in res.json()]
    assert dead_id in local_ids


def test_list_worklog_notes_filters_actual_entries_by_client_period(client: TestClient) -> None:
    """빈 날짜를 자동 생성하지 않고, 기간 안의 실제 worklog만 반환한다."""
    device_id = _device_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    in_range_worklog = _local_id()
    out_range_worklog = _local_id()
    daily_note = _local_id()

    for payload in [
        {
            "owner_id": owner,
            "device_id": device_id,
            "local_id": in_range_worklog,
            "note_type": "worklog",
            "title": "9월 1일 작업 일지",
            "content": "실제 작성된 작업",
            "client_updated_at": "2026-09-01T10:00:00",
        },
        {
            "owner_id": owner,
            "device_id": device_id,
            "local_id": out_range_worklog,
            "note_type": "worklog",
            "title": "9월 3일 작업 일지",
            "content": "기간 밖 작업",
            "client_updated_at": "2026-09-03T10:00:00",
        },
        {
            "owner_id": owner,
            "device_id": device_id,
            "local_id": daily_note,
            "note_type": "daily",
            "title": "9월 1일 일자 메모",
            "content": "작업 일지가 아님",
            "client_updated_at": "2026-09-01T11:00:00",
        },
    ]:
        res = client.post("/api/v1/notes", json=payload)
        assert res.status_code == 200, res.text

    empty_res = client.get(
        "/api/v1/notes",
        params={
            "owner_id": owner,
            "note_type": "worklog",
            "date_from": "2026-09-02T00:00:00",
            "date_to": "2026-09-02T23:59:59",
        },
    )
    assert empty_res.status_code == 200
    assert empty_res.json() == []

    range_res = client.get(
        "/api/v1/notes",
        params={
            "owner_id": owner,
            "note_type": "worklog",
            "date_from": "2026-09-01T00:00:00",
            "date_to": "2026-09-01T23:59:59",
        },
    )
    assert range_res.status_code == 200
    local_ids = [item["local_id"] for item in range_res.json()]
    assert local_ids == [in_range_worklog]


def test_list_worklog_notes_accepts_mixed_timezone_period_bounds(client: TestClient) -> None:
    """클라이언트별 날짜 직렬화 차이가 있어도 서버는 UTC-naive 기준으로 정규화한다."""
    device_id = _device_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    local_id = _local_id()
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "worklog",
            "title": "timezone 작업 일지",
            "content": "timezone 확인",
            "client_updated_at": "2026-09-01T10:00:00",
        },
    )
    assert res.status_code == 200, res.text

    range_res = client.get(
        "/api/v1/notes",
        params={
            "owner_id": owner,
            "note_type": "worklog",
            "date_from": "2026-09-01T00:00:00+00:00",
            "date_to": "2026-09-01T23:59:59",
        },
    )
    assert range_res.status_code == 200
    assert [item["local_id"] for item in range_res.json()] == [local_id]


# ── 검색 ──────────────────────────────────────────────────────────────────────

def test_search_notes_by_title(client: TestClient) -> None:
    device_id = _device_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    keyword = f"UNIQUE_{uuid.uuid4().hex[:6]}"

    client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": _local_id(),
            "note_type": "memo",
            "title": f"제목에 {keyword} 포함",
            "content": "내용",
        },
    )
    # 관련 없는 노트
    client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": _local_id(),
            "note_type": "memo",
            "title": "전혀 다른 노트",
            "content": "전혀 다른 내용",
        },
    )

    res = client.get("/api/v1/notes/search", params={"q": keyword, "owner_id": owner})
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 1
    assert all(keyword in n["title"] or keyword in n["content"] for n in results)


def test_search_notes_by_content(client: TestClient) -> None:
    device_id = _device_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    keyword = f"CONTENT_{uuid.uuid4().hex[:6]}"

    client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": _local_id(),
            "note_type": "memo",
            "title": "일반 제목",
            "content": f"본문에 {keyword} 포함",
        },
    )

    res = client.get("/api/v1/notes/search", params={"q": keyword, "owner_id": owner})
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_search_excludes_deleted_notes(client: TestClient) -> None:
    device_id = _device_id()
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    keyword = f"DELETED_{uuid.uuid4().hex[:6]}"
    local_id = _local_id()

    client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": device_id,
            "local_id": local_id,
            "note_type": "memo",
            "title": f"{keyword} 삭제된 노트",
            "content": "",
        },
    )
    client.delete(f"/api/v1/notes/{local_id}", params={"owner_id": owner})

    res = client.get("/api/v1/notes/search", params={"q": keyword, "owner_id": owner})
    assert res.status_code == 200
    assert len(res.json()) == 0


def test_search_requires_query(client: TestClient) -> None:
    res = client.get("/api/v1/notes/search", params={"owner_id": "local_user"})
    assert res.status_code == 422  # Pydantic validation: min_length=1


# ── 동기화 배치 ───────────────────────────────────────────────────────────────

def test_sync_notes_batch(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    # device_id가 같으면 upsert 시 중복 등록 방지 로직이 race를 일으킬 수 있어
    # 각 노트마다 별도 device_id를 사용한다.
    notes = [
        {
            "owner_id": owner,
            "device_id": _device_id(),
            "local_id": _local_id(),
            "note_type": "memo",
            "title": f"배치 노트 {i}",
            "content": f"내용 {i}",
        }
        for i in range(3)
    ]

    res = client.post("/api/v1/notes/sync", json={"notes": notes})
    assert res.status_code == 200
    data = res.json()
    assert "notes" in data
    assert len(data["notes"]) == 3


def test_sync_empty_batch(client: TestClient) -> None:
    res = client.post("/api/v1/notes/sync", json={"notes": []})
    assert res.status_code == 200
    assert res.json()["notes"] == []
