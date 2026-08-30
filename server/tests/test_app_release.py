"""앱/설치형 최신 버전 안내 엔드포인트 검증 (P10)

- 연결 전에도 읽어야 하므로 무인증으로 응답하는지
- 최신 버전, 플랫폼별 다운로드 링크, Release 페이지 링크가 응답에 있는지
- asset 이름이 NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md의 규칙과 일치하는지
- 자동 업데이트용 엔드포인트(`/api/v1/app/update`)로 오해될 경로를 만들지 않았는지
"""
import re

import pytest
from fastapi.testclient import TestClient


def test_app_release_needs_no_auth_header(client: TestClient) -> None:
    res = client.get("/api/v1/app/release")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"


def test_app_release_router_has_no_auth_dependency() -> None:
    from app.api.app_release import router

    assert router.dependencies == []


def test_app_release_public_even_with_api_token(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """NOW_API_TOKEN이 설정된 서버에서도 버전 안내는 열려 있어야 한다."""
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "api_token", "test-secret-token")
    res = client.get("/api/v1/app/release")
    assert res.status_code == 200


def test_app_release_body_shape(client: TestClient) -> None:
    from app.core.capabilities import GITHUB_RELEASE_REPO, LATEST_APP_VERSION

    body = client.get("/api/v1/app/release").json()

    assert body["latest_version"] == LATEST_APP_VERSION
    assert body["release_tag"] == f"v{LATEST_APP_VERSION}"
    assert body["release_url"] == (
        f"https://github.com/{GITHUB_RELEASE_REPO}/releases/tag/v{LATEST_APP_VERSION}"
    )

    downloads = body["downloads"]
    exe_url = downloads["windows_installer"]
    apk_url = downloads["android_apk"]

    # NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md의 asset 이름 규칙
    assert exe_url.endswith(f"NowNote-Setup-{LATEST_APP_VERSION}-x64.exe")
    assert apk_url.endswith(f"NowNote-{LATEST_APP_VERSION}.apk")
    download_prefix = (
        f"https://github.com/{GITHUB_RELEASE_REPO}/releases/download/v{LATEST_APP_VERSION}/"
    )
    assert exe_url == download_prefix + f"NowNote-Setup-{LATEST_APP_VERSION}-x64.exe"
    assert apk_url == download_prefix + f"NowNote-{LATEST_APP_VERSION}.apk"


def test_app_release_version_looks_like_semver(client: TestClient) -> None:
    body = client.get("/api/v1/app/release").json()
    assert re.fullmatch(r"\d+\.\d+\.\d+", body["latest_version"])


def test_app_release_path_is_not_the_declared_absent_update_path() -> None:
    """capabilities.py가 여전히 '/api/v1/app/update'는 없다고 선언하므로 그 경로와 겹치지 않아야 한다."""
    from app.main import app

    paths = {getattr(route, "path", "") for route in app.routes}
    assert "/api/v1/app/update" not in paths
    assert "/api/v1/app/release" in paths


def test_app_release_matches_server_capability_flag(client: TestClient) -> None:
    """/api/v1/app/release가 실제로 동작하므로 app_update_info는 True로 선언돼야 한다.

    capability는 선언과 동작이 일치해야 한다는 원칙(M7)에 따라, 이 엔드포인트가
    붙은 뒤에는 False로 남겨두지 않는다.
    """
    res = client.get("/api/v1/server")
    assert res.status_code == 200
    assert res.json()["capabilities"]["app_update_info"] is True
