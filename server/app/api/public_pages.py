from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter(tags=["public"])


def _privacy_policy_html() -> str:
    for path in _privacy_policy_candidates():
        if path.exists():
            return path.read_text(encoding="utf-8")
    return _privacy_policy_fallback()


def _privacy_policy_candidates() -> list[Path]:
    return [
        Path("/play_docs/nownote_site/index.html"),
        Path(__file__).resolve().parents[3] / "now_app" / "docs" / "nownote_site" / "index.html",
    ]


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy_home() -> HTMLResponse:
    return HTMLResponse(_privacy_policy_html())


@router.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy() -> HTMLResponse:
    return HTMLResponse(_privacy_policy_html())


@router.get("/privacy-policy", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy_alias() -> HTMLResponse:
    return HTMLResponse(_privacy_policy_html())


def _privacy_policy_fallback() -> str:
    return """<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 개인정보처리방침</title>
  <meta name="description" content="NowNote 앱 개인정보처리방침">
  <style>
    body {
      margin: 0;
      background: #f7f8fb;
      color: #1d2433;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      line-height: 1.72;
    }
    main {
      width: min(920px, calc(100% - 32px));
      margin: 0 auto;
      padding: 56px 0 72px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 34px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .panel {
      margin-top: 28px;
      padding: 28px;
      background: #ffffff;
      border: 1px solid #d9dee8;
      border-radius: 8px;
    }
    .meta {
      color: #667085;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>NowNote 개인정보처리방침</h1>
      <p class="meta">공개 URL: https://nownote.sinsan.kr/</p>
    </header>
    <section class="panel">
      <p>NowNote는 사용자의 개인 기록을 안전하게 관리하기 위해 필요한 최소한의 권한과 데이터를 사용합니다.</p>
      <p>개인정보처리방침 원본 페이지 파일을 찾을 수 없어 기본 안내 페이지를 표시합니다.</p>
    </section>
  </main>
</body>
</html>"""
