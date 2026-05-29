import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

from app.core.capabilities import API_VERSION
from app.core.config import get_settings


def public_route_summary(timeout_seconds: float = 5.0) -> dict:
    settings = get_settings()
    public_base_url = (settings.public_base_url or "").strip().rstrip("/")
    checks: list[dict[str, str | int | None]] = []

    if not public_base_url:
        return _summary(
            status="planned",
            public_base_url="",
            checks=[
                {
                    "name": "공개 URL",
                    "status": "planned",
                    "message": "NOW_PUBLIC_BASE_URL=https://도메인 설정 필요",
                    "http_status": None,
                }
            ],
        )

    checks.append(
        {
            "name": "공개 URL 형식",
            "status": "ok" if public_base_url.lower().startswith("https://") else "warn",
            "message": public_base_url,
            "http_status": None,
        }
    )
    checks.append(
        {
            "name": "Reverse proxy 설정",
            "status": "ok" if settings.behind_reverse_proxy else "warn",
            "message": "NOW_BEHIND_REVERSE_PROXY=true" if settings.behind_reverse_proxy else "NOW_BEHIND_REVERSE_PROXY=true 설정 필요",
            "http_status": None,
        }
    )
    checks.append(
        _json_endpoint_check(
            public_base_url,
            "/health/ready",
            timeout_seconds,
            expected_field="status",
            expected_value="ready",
        )
    )
    checks.append(
        _json_endpoint_check(
            public_base_url,
            "/api/v1/server",
            timeout_seconds,
            expected_field="api_version",
            expected_value=API_VERSION,
        )
    )
    return _summary(
        status=_summary_status(checks),
        public_base_url=public_base_url,
        checks=checks,
    )


def _json_endpoint_check(
    public_base_url: str,
    path: str,
    timeout_seconds: float,
    *,
    expected_field: str,
    expected_value: str,
) -> dict[str, str | int | None]:
    url = urllib.parse.urljoin(public_base_url + "/", path.lstrip("/"))
    try:
        request = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            http_status = response.status
            content_type = response.headers.get("Content-Type", "")
            body = response.read(4096).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return {
            "name": path,
            "status": "bad",
            "message": f"HTTP {exc.code}: {exc.reason}",
            "http_status": exc.code,
        }
    except Exception as exc:
        return {
            "name": path,
            "status": "bad",
            "message": f"연결 실패: {exc}",
            "http_status": None,
        }

    if http_status != 200:
        return {
            "name": path,
            "status": "bad",
            "message": f"HTTP {http_status}",
            "http_status": http_status,
        }
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        hint = "JSON이 아닙니다"
        if "<html" in body.lower():
            hint = "HTML이 반환됨. 정적 페이지 또는 reverse proxy 오연결 가능"
        return {
            "name": path,
            "status": "bad",
            "message": f"{hint}. Content-Type: {content_type or '확인 불가'}",
            "http_status": http_status,
        }

    actual_value = data.get(expected_field)
    if actual_value != expected_value:
        return {
            "name": path,
            "status": "bad",
            "message": f"{expected_field}={actual_value!r}, 기대값 {expected_value!r}",
            "http_status": http_status,
        }
    return {
        "name": path,
        "status": "ok",
        "message": f"JSON 응답 확인: {expected_field}={expected_value}",
        "http_status": http_status,
    }


def _summary(
    *,
    status: str,
    public_base_url: str,
    checks: list[dict[str, str | int | None]],
) -> dict:
    return {
        "name": "public_route",
        "checked_at": datetime.utcnow(),
        "status": status,
        "public_base_url": public_base_url,
        "checks": checks,
    }


def _summary_status(checks: list[dict[str, str | int | None]]) -> str:
    statuses = {str(check.get("status")) for check in checks}
    if "bad" in statuses:
        return "bad"
    if "warn" in statuses:
        return "warn"
    if "planned" in statuses:
        return "planned"
    return "ok"
