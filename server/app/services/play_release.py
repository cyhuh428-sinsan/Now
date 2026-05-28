from __future__ import annotations

import re
import struct
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


CHECKBOX_RE = re.compile(r"^-\s+\[(?P<mark>[ xX])\]\s+(?P<label>.+?)\s*$")

REQUIRED_DOCS = [
    "google_play_release_checklist.md",
    "google_play_console_values_ko.md",
    "google_play_paste_ready_ko.md",
    "google_play_step_by_step_ko.md",
    "privacy_policy_draft_ko.md",
    "nownote_site/index.html",
]

EXPECTED_ASSET_DIMENSIONS = {
    "app_icon_512.png": (512, 512),
    "feature_graphic_1024x500.png": (1024, 500),
    "screenshot_01_home.png": (1080, 1920),
    "screenshot_02_daily_notes.png": (1080, 1920),
    "screenshot_03_tree_notes.png": (1080, 1920),
    "screenshot_04_voice.png": (1080, 1920),
}


@dataclass(frozen=True)
class PlayCheck:
    name: str
    status: str
    message: str


def play_release_summary() -> dict:
    docs_root = _play_docs_root()
    assets_root = _play_assets_root(docs_root)
    checks = _build_checks(docs_root, assets_root)
    manual_items = _phase_one_google_play_remaining()
    auto_checks = [check for check in checks if check.status != "manual"]
    ok_count = sum(1 for check in auto_checks if check.status == "ok")
    warn_count = sum(1 for check in auto_checks if check.status == "warn")
    manual_count = len(manual_items)
    return {
        "name": "google_play_release_readiness",
        "checked_at": datetime.utcnow(),
        "status": "ready" if warn_count == 0 and manual_count == 0 else "manual",
        "docs_root": str(docs_root) if docs_root else None,
        "assets_root": str(assets_root) if assets_root else None,
        "summary": {
            "auto_ok": ok_count,
            "auto_total": len(auto_checks),
            "warnings": warn_count,
            "manual": manual_count,
        },
        "checks": [
            {"name": check.name, "status": check.status, "message": check.message}
            for check in checks
        ],
        "manual_items": manual_items,
    }


def _play_docs_root() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "now_app" / "docs",
        Path("/play_docs"),
    ]
    for path in candidates:
        if path.exists() and _has_required_play_docs(path):
            return path
    for path in candidates:
        if path.exists():
            return path
    return None


def _has_required_play_docs(path: Path) -> bool:
    return all((path / relative).exists() for relative in REQUIRED_DOCS)


def _play_assets_root(docs_root: Path | None) -> Path | None:
    if docs_root is None:
        return None
    candidates = [docs_root / "play_assets", Path("/play_assets")]
    for path in candidates:
        if path.exists():
            return path
    return None


def _build_checks(docs_root: Path | None, assets_root: Path | None) -> list[PlayCheck]:
    checks: list[PlayCheck] = []
    if docs_root is None:
        return [PlayCheck("Play 문서 경로", "warn", "now_app/docs 또는 /play_docs를 찾을 수 없습니다.")]

    for relative in REQUIRED_DOCS:
        path = docs_root / relative
        status = "ok" if path.exists() and path.stat().st_size > 0 else "warn"
        message = relative if status == "ok" else f"누락 또는 빈 파일: {relative}"
        checks.append(PlayCheck(f"Play 문서: {Path(relative).name}", status, message))

    if assets_root is None:
        checks.append(PlayCheck("Play 이미지 경로", "warn", "play_assets 경로를 찾을 수 없습니다."))
    else:
        for filename, expected in EXPECTED_ASSET_DIMENSIONS.items():
            path = assets_root / filename
            checks.append(
                PlayCheck(
                    f"Play 이미지 파일: {filename}",
                    "ok" if path.exists() and path.stat().st_size > 0 else "warn",
                    filename if path.exists() else f"누락 또는 빈 파일: {filename}",
                )
            )
            dimensions = _read_png_dimensions(path)
            if dimensions is None:
                checks.append(PlayCheck(f"Play 이미지: {filename}", "warn", "PNG 크기 확인 실패"))
                continue
            width, height = dimensions
            expected_width, expected_height = expected
            status = "ok" if dimensions == expected else "warn"
            checks.append(
                PlayCheck(
                    f"Play 이미지: {filename}",
                    status,
                    f"{width}x{height}, 기준 {expected_width}x{expected_height}",
                )
            )

    checks.extend(_content_checks(docs_root))
    checks.append(
        PlayCheck(
            "로컬 릴리스 파일",
            "manual",
            "서명 키와 AAB는 서버 이미지에 포함하지 않고 scripts/play_release_status.py에서 로컬 확인합니다.",
        )
    )
    return checks


def _content_checks(docs_root: Path) -> list[PlayCheck]:
    checks: list[PlayCheck] = []
    console_values = _read_text(docs_root / "google_play_console_values_ko.md")
    paste_ready = _read_text(docs_root / "google_play_paste_ready_ko.md")
    privacy = _read_text(docs_root / "privacy_policy_draft_ko.md")

    checks.append(
        PlayCheck(
            "개인정보처리방침 URL",
            "ok" if "https://nownote.sinsan.kr/" in console_values else "warn",
            "google_play_console_values_ko.md",
        )
    )
    checks.append(
        PlayCheck(
            "Play 개발자 이메일",
            "ok" if "cyhuh428@gmail.com" in console_values else "warn",
            "google_play_console_values_ko.md",
        )
    )

    required_terms = ["Data safety", "마이크", "카메라", "사진 및 이미지", "캘린더", "알림", "Health Connect"]
    missing_terms = [term for term in required_terms if term not in paste_ready]
    checks.append(
        PlayCheck(
            "붙여넣기용 Play 입력값",
            "ok" if not missing_terms else "warn",
            "누락 없음" if not missing_terms else "누락: " + ", ".join(missing_terms),
        )
    )
    checks.append(
        PlayCheck(
            "개인정보처리방침 서버 전송 기준",
            "ok" if "사용자가 NowNote 서버 연결을 켠 경우" in privacy else "warn",
            "privacy_policy_draft_ko.md",
        )
    )
    return checks


def _phase_one_google_play_remaining() -> list[str]:
    path = _phase_one_checklist_path()
    if path is None:
        return ["docs/PHASE1_RELEASE_CHECKLIST.md 파일을 찾을 수 없습니다."]

    in_section = False
    remaining: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            in_section = "Google Play 등록 전 점검" in line
            continue
        if not in_section:
            continue
        match = CHECKBOX_RE.match(line)
        if match and match.group("mark").lower() != "x":
            remaining.append(match.group("label"))
    return remaining


def _phase_one_checklist_path() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "docs" / "PHASE1_RELEASE_CHECKLIST.md",
        Path("/docs/PHASE1_RELEASE_CHECKLIST.md"),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _read_png_dimensions(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    with path.open("rb") as file:
        header = file.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", header[16:24])
