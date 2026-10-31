"""기존 library 경계에서 맵 저장·권한·충돌·백업을 검증한다."""
from copy import deepcopy
from uuid import uuid4

import pytest


def payload():
    return {"title": "합성 맵", "cards": [
        {"id": "a", "type": "note", "noteId": "synthetic-note", "text": "", "x": 0, "y": 2400, "width": 240, "color": "blue"},
        {"id": "b", "type": "text", "noteId": "", "text": "합성 생각", "x": 300, "y": 100, "width": 240, "color": "blue"},
    ], "edges": [{"id": "edge", "from": "a", "to": "b", "label": "연결"}], "zoom": 0.6}


def body(value=None, version=0, owner="sinsan"):
    return {"owner_id": owner, "schema_version": 1, "base_version": version,
            "mutation_id": str(uuid4()), "payload": payload() if value is None else value}


def test_canvas_roundtrip_replay_conflict_and_backup(client, user_sinsan):
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    path = f"/api/v1/canvases/{uuid4()}"
    request = body()
    response = client.put(path, json=request, headers=headers)
    assert response.status_code == 200
    assert response.json()["resource"]["payload"] == payload()
    assert client.put(path, json=request, headers=headers).json() == response.json()
    changed = body(version=1)
    changed["payload"]["title"] = "두 번째"
    assert client.put(path, json=changed, headers=headers).status_code == 200
    stale = client.put(path, json=body(version=1), headers=headers)
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "version_conflict"
    rows = client.get("/api/v1/canvases?owner_id=sinsan", headers=headers).json()["items"]
    assert next(row for row in rows if row["id"] == path.rsplit("/", 1)[1])["payload"]["title"] == "두 번째"
    from app.api.admin import _verify_backup_payload
    from app.services.library_backup import validate_library_backup
    backup = client.get("/api/v1/admin/export/all").json()
    assert all(check["status"] == "ok" for check in _verify_backup_payload(backup))
    resources, _ = validate_library_backup(backup)
    assert any(row.kind == "canvases" for row in resources)
    v3 = client.get("/api/v1/admin/export/all?backup_schema_version=3")
    assert v3.status_code == 200
    from app.services.note_backup import validate_backup
    assert validate_backup(v3.json())["library_resources"] >= 1
    deletion = {key: value for key, value in body(version=2).items() if key != "payload"}
    response = client.request("DELETE", path, json=deletion, headers=headers)
    assert response.status_code == 200
    assert response.json()["resource"]["payload"] is None
    assert client.put(path, json=body(version=3), headers=headers).status_code == 409


def test_canvas_owner_and_auth_preserved(client, user_sinsan, user_member):
    path = f"/api/v1/canvases/{uuid4()}"
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    assert client.put(path, json=body(), headers=headers).status_code == 200
    assert client.get("/api/v1/canvases?owner_id=sinsan").status_code == 401
    assert client.put(path, json=body(owner="member"), headers=headers).status_code in (401, 403)
    other = {"X-Now-Web-Session": user_member[1]}
    rows = client.get("/api/v1/canvases?owner_id=member", headers=other).json()["items"]
    assert all(row["owner_id"] == "member" for row in rows)


def test_canvas_quota_rejects_thirteenth_without_truncation(client, user_member):
    headers = {"X-Now-Web-Session": user_member[1]}
    for _ in range(12):
        assert client.put(f"/api/v1/canvases/{uuid4()}", json=body(owner="member"), headers=headers).status_code == 200
    response = client.put(f"/api/v1/canvases/{uuid4()}", json=body(owner="member"), headers=headers)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "resource_limit"


@pytest.mark.parametrize("invalid", ["duplicate-card", "duplicate-edge", "dangling", "self", "cache", "unknown", "infinity", "type"])
def test_canvas_rejects_invalid_without_partial_write(client, user_sinsan, invalid):
    value = deepcopy(payload())
    if invalid == "duplicate-card":
        value["cards"].append(deepcopy(value["cards"][0]))
    elif invalid == "duplicate-edge":
        value["edges"].append({**value["edges"][0], "id": "different"})
    elif invalid == "dangling":
        value["edges"][0]["to"] = "absent"
    elif invalid == "self":
        value["edges"][0]["to"] = "a"
    elif invalid == "cache":
        value["cards"][0]["text"] = "note body must not be copied"
    elif invalid == "unknown":
        value["cards"][0]["html"] = "unsupported"
    elif invalid == "infinity":
        value["cards"][0]["x"] = "Infinity"
    elif invalid == "type":
        value["zoom"] = True
    response = client.put(f"/api/v1/canvases/{uuid4()}", json=body(value),
                          headers={"X-Now-Web-Session": user_sinsan[1]})
    assert response.status_code == 422
