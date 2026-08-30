"""앱/설치형 최신 버전 안내 (P10).

자동 업데이트 기능은 아니다. 최신 버전 번호, 플랫폼별 다운로드 링크,
GitHub Release 페이지 링크만 안내한다. `/api/v1/server`와 마찬가지로
연결 전(로그인 전)에도 읽을 수 있어야 하므로 무인증으로 연다.
"""
from fastapi import APIRouter

from app.core.capabilities import app_release_info

router = APIRouter(prefix="/api/v1/app", tags=["app"])


@router.get("/release")
def app_release() -> dict:
    return {"status": "ok", **app_release_info()}
