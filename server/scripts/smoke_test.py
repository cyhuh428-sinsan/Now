import argparse
import base64
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone


def request(method: str, url: str, token: str | None = None, data: dict | None = None):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as res:
        text = res.read().decode("utf-8")
        return res.status, json.loads(text) if text else None


def request_text(method: str, url: str, token: str | None = None):
    headers = {}
    if token:
        encoded = base64.b64encode(f"admin:{token}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"
    req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as res:
        text = res.read().decode("utf-8")
        return res.status, text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8750")
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    checks = [
        ("GET", "/health", None),
        ("GET", "/health/ready", None),
        ("GET", "/api/v1/server", None),
    ]

    for method, path, payload in checks:
        status, data = request(method, f"{base_url}{path}", args.token, payload)
        print(f"{method} {path}: {status} {data}")

    admin_pages = [
        "/monitor",
        "/admin",
        "/admin/notes",
        "/admin/recordings",
        "/admin/users",
        "/admin/devices",
        "/admin/sync",
        "/admin/ops",
        "/admin/export",
        "/admin/analysis",
        "/admin/help",
    ]
    for path in admin_pages:
        status, text = request_text("GET", f"{base_url}{path}", args.token)
        print(f"GET {path}: {status} html={len(text)} bytes")

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/notes?include_deleted=false",
        args.token,
    )
    print(
        "GET /api/v1/admin/export/notes:",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/ops", args.token)
    print(
        "GET /api/v1/admin/ops:",
        status,
        {
            "status": data.get("status"),
            "checks": len(data.get("checks", [])),
        },
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/users", args.token)
    print(
        "GET /api/v1/admin/users:",
        status,
        {
            "count": data.get("count"),
            "active": data.get("active"),
        },
    )

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sync_payload = {
        "owner_id": "local_user",
        "device_id": "smoke_test",
        "updated_after": None,
        "include_deleted": True,
        "notes": [
            {
                "owner_id": "local_user",
                "device_id": "smoke_test",
                "local_id": "smoke_note_001",
                "note_type": "daily",
                "title": "Smoke test memo",
                "content": "NowNote server smoke test",
                "parent_local_id": None,
                "level": 1,
                "tags": "test=smoke",
                "source": "smoke_test",
                "client_updated_at": now,
                "deleted_at": None,
            }
        ],
    }
    status, data = request("POST", f"{base_url}/api/v1/sync", args.token, sync_payload)
    print(
        "POST /api/v1/sync:",
        status,
        {
            "pushed": len(data.get("pushed_notes", [])),
            "pulled": len(data.get("pulled_notes", [])),
            "server_time": data.get("server_time"),
        },
    )

    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/admin/users/local_user",
        args.token,
        {
            "email": "local_user@example.com",
            "display_name": "Local User",
            "timezone": "Asia/Seoul",
            "group_name": "사용자",
            "two_factor_enabled": False,
            "is_active": True,
        },
    )
    print(
        "PATCH /api/v1/admin/users/local_user:",
        status,
        {"status": data.get("status"), "owner_id": data.get("user", {}).get("owner_id")},
    )

    status, data = request("GET", f"{base_url}/api/v1/users/local_user", args.token)
    print(
        "GET /api/v1/users/local_user:",
        status,
        {
            "status": data.get("status"),
            "timezone": data.get("user", {}).get("timezone"),
        },
    )

    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/users/local_user",
        args.token,
        {
            "email": "local_user@example.com",
            "display_name": "Local User",
            "timezone": "Asia/Seoul",
        },
    )
    print(
        "PATCH /api/v1/users/local_user:",
        status,
        {
            "status": data.get("status"),
            "timezone": data.get("user", {}).get("timezone"),
        },
    )


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8')}")
        raise
