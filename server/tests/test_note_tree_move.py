"""문서 이동(P7) 검증 — 주제/분류/메모를 다른 부모 아래로 옮기는 흐름

전용 이동 API는 없다. POST /api/v1/notes (또는 /sync)로 parent_local_id를 바꿔
upsert하면 app/services/note_sync.py의 validate_tree_parent()가 새 부모의
존재와 레벨을 검증한다. 하위 메모는 부모의 local_id가 안 바뀌므로 자동으로
옮겨진 부모를 따라간다. 이 흐름이 실제로 문서 이동에 맞게 동작하는지 확인한다.
"""
import uuid

from fastapi.testclient import TestClient


def _device_id() -> str:
    return f"test_device_{uuid.uuid4().hex[:8]}"


def _local_id() -> str:
    return f"local_{uuid.uuid4().hex[:8]}"


def _create_note(
    client: TestClient,
    *,
    owner_id: str,
    local_id: str,
    level: int,
    title: str,
    parent_local_id: str | None = None,
) -> dict:
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner_id,
            "device_id": _device_id(),
            "local_id": local_id,
            "note_type": "tree",
            "title": title,
            "content": "",
            "level": level,
            "parent_local_id": parent_local_id,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


# ── 1. 레벨 2(분류) 노트를 다른 레벨 1(주제) 아래로 이동 ──────────────────────

def test_move_level2_note_to_new_level1_parent(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    topic2 = _local_id()
    classification = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(client, owner_id=owner, local_id=topic2, level=1, title="주제2")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic1,
    )

    # 분류를 주제1 -> 주제2 아래로 이동
    moved = _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic2,
    )
    assert moved["parent_local_id"] == topic2

    res = client.get("/api/v1/notes", params={"owner_id": owner})
    assert res.status_code == 200
    by_local_id = {n["local_id"]: n for n in res.json()}
    assert by_local_id[classification]["parent_local_id"] == topic2


# ── 2. 이동된 분류 아래 메모(레벨 3)가 자동으로 새 위치를 따라가는지 ──────────

def test_child_notes_follow_moved_parent_automatically(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    topic2 = _local_id()
    classification = _local_id()
    memo = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(client, owner_id=owner, local_id=topic2, level=1, title="주제2")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic1,
    )
    _create_note(
        client,
        owner_id=owner,
        local_id=memo,
        level=3,
        title="메모",
        parent_local_id=classification,
    )

    # 분류만 이동. 메모는 다시 upsert하지 않는다.
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic2,
    )

    res = client.get("/api/v1/notes", params={"owner_id": owner})
    assert res.status_code == 200
    by_local_id = {n["local_id"]: n for n in res.json()}
    assert by_local_id[classification]["parent_local_id"] == topic2
    # 메모의 parent_local_id 값 자체는 분류의 local_id로 그대로이므로
    # 분류가 옮겨진 새 위치(주제2)를 자동으로 따라간다.
    assert by_local_id[memo]["parent_local_id"] == classification


# ── 3. 존재하지 않는 부모로 옮기려 하면 400 ───────────────────────────────────

def test_move_to_nonexistent_parent_returns_400(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    classification = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic1,
    )

    missing_parent = _local_id()
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": _device_id(),
            "local_id": classification,
            "note_type": "tree",
            "title": "분류",
            "content": "",
            "level": 2,
            "parent_local_id": missing_parent,
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "parent note not found"


# ── 4. 레벨이 맞지 않는 부모로 옮기려 하면 400 ────────────────────────────────

def test_move_to_wrong_level_parent_returns_400(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    classification = _local_id()
    memo = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic1,
    )
    _create_note(
        client,
        owner_id=owner,
        local_id=memo,
        level=3,
        title="메모",
        parent_local_id=classification,
    )

    # 레벨 3 메모를 레벨 1 주제의 직계 자식으로 옮기려는 시도 (레벨 2를 건너뜀)
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": _device_id(),
            "local_id": memo,
            "note_type": "tree",
            "title": "메모",
            "content": "",
            "level": 3,
            "parent_local_id": topic1,
        },
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "invalid parent note level"


# ── 5. 3단계 제한을 넘는 레벨은 스키마 단계에서 막힌다 ────────────────────────

def test_level_beyond_max_tree_level_rejected(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    classification = _local_id()
    memo = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification,
        level=2,
        title="분류",
        parent_local_id=topic1,
    )

    # 레벨 4 노트(메모의 하위)를 만들어 3단계를 넘기려는 시도
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": owner,
            "device_id": _device_id(),
            "local_id": memo,
            "note_type": "tree",
            "title": "메모",
            "content": "",
            "level": 4,
            "parent_local_id": classification,
        },
    )
    assert res.status_code == 422  # pydantic: level <= MAX_TREE_NOTE_LEVEL(3)


# ── 6. 같은 레벨의 형제 부모 사이로 이동(레벨 3 메모를 다른 레벨 2 분류로) ────

def test_move_level3_note_between_sibling_level2_parents(client: TestClient) -> None:
    owner = f"owner_{uuid.uuid4().hex[:6]}"
    topic1 = _local_id()
    classification_a = _local_id()
    classification_b = _local_id()
    memo = _local_id()

    _create_note(client, owner_id=owner, local_id=topic1, level=1, title="주제1")
    _create_note(
        client,
        owner_id=owner,
        local_id=classification_a,
        level=2,
        title="분류A",
        parent_local_id=topic1,
    )
    _create_note(
        client,
        owner_id=owner,
        local_id=classification_b,
        level=2,
        title="분류B",
        parent_local_id=topic1,
    )
    _create_note(
        client,
        owner_id=owner,
        local_id=memo,
        level=3,
        title="메모",
        parent_local_id=classification_a,
    )

    moved = _create_note(
        client,
        owner_id=owner,
        local_id=memo,
        level=3,
        title="메모",
        parent_local_id=classification_b,
    )
    assert moved["parent_local_id"] == classification_b

    res = client.get("/api/v1/notes", params={"owner_id": owner})
    assert res.status_code == 200
    by_local_id = {n["local_id"]: n for n in res.json()}
    assert by_local_id[memo]["parent_local_id"] == classification_b
