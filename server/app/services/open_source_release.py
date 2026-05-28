from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


CHECKBOX_RE = re.compile(r"^-\s+\[(?P<mark>[ xX])\]\s+(?P<label>.+?)\s*$")

REQUIRED_FILES = [
    ("README", "README.md"),
    ("보안 정책", "SECURITY.md"),
    ("기여 안내", "CONTRIBUTING.md"),
    ("PR 템플릿", ".github/PULL_REQUEST_TEMPLATE.md"),
    ("버그 이슈 템플릿", ".github/ISSUE_TEMPLATE/bug_report.md"),
    ("기능 제안 템플릿", ".github/ISSUE_TEMPLATE/feature_request.md"),
    ("GitHub Actions preflight", ".github/workflows/preflight.yml"),
    ("공개 저장소 오픈 점검", "docs/OPEN_SOURCE_RELEASE.md"),
    ("라이선스 선택 가이드", "docs/LICENSE_DECISION.md"),
]

CONTENT_CHECKS = [
    ("공개 안전 점검", "docs/OPEN_SOURCE_RELEASE.md", "verify_public_repo_safety.py"),
    ("Actions 상태 확인", "docs/OPEN_SOURCE_RELEASE.md", "check_github_actions_status.py"),
    ("비밀값 제외 기준", "docs/OPEN_SOURCE_RELEASE.md", "server/.env"),
    ("라이선스 후보 MIT", "docs/LICENSE_DECISION.md", "MIT License"),
    ("라이선스 후보 Apache", "docs/LICENSE_DECISION.md", "Apache License 2.0"),
    ("라이선스 후보 AGPL", "docs/LICENSE_DECISION.md", "AGPLv3"),
    ("기여 라이선스 후속", "docs/LICENSE_DECISION.md", "CONTRIBUTING.md"),
]


@dataclass(frozen=True)
class OpenSourceCheck:
    name: str
    status: str
    message: str


def open_source_release_summary() -> dict:
    checks = _build_checks()
    manual_items = _phase_one_public_repo_remaining()
    auto_checks = [check for check in checks if check.status != "manual"]
    ok_count = sum(1 for check in auto_checks if check.status == "ok")
    warn_count = sum(1 for check in auto_checks if check.status == "warn")
    manual_count = len(manual_items)

    return {
        "name": "open_source_release_readiness",
        "checked_at": datetime.utcnow(),
        "status": "ready" if warn_count == 0 and manual_count == 0 else "manual",
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


def _build_checks() -> list[OpenSourceCheck]:
    checks: list[OpenSourceCheck] = []
    for label, relative in REQUIRED_FILES:
        path = _resolve_file(relative)
        status = "ok" if path and path.stat().st_size > 0 else "warn"
        message = relative if status == "ok" else f"누락 또는 빈 파일: {relative}"
        checks.append(OpenSourceCheck(label, status, message))

    for label, relative, expected in CONTENT_CHECKS:
        text = _read_text(relative)
        status = "ok" if expected in text else "warn"
        message = relative if status == "ok" else f"문구 확인 필요: {expected}"
        checks.append(OpenSourceCheck(label, status, message))

    license_path = _resolve_file("LICENSE")
    checks.append(
        OpenSourceCheck(
            "LICENSE 파일",
            "ok" if license_path and license_path.stat().st_size > 0 else "manual",
            "LICENSE" if license_path else "라이선스 확정 후 루트 LICENSE 파일을 추가합니다.",
        )
    )
    return checks


def _phase_one_public_repo_remaining() -> list[str]:
    path = _resolve_file("docs/PHASE1_RELEASE_CHECKLIST.md")
    if path is None:
        return ["docs/PHASE1_RELEASE_CHECKLIST.md 파일을 찾을 수 없습니다."]

    in_section = False
    remaining: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            in_section = "공개 저장소 오픈 전 점검" in line
            continue
        if not in_section:
            continue
        match = CHECKBOX_RE.match(line)
        if match and match.group("mark").lower() != "x":
            remaining.append(match.group("label"))
    return remaining


def _read_text(relative: str) -> str:
    path = _resolve_file(relative)
    if path is None:
        return ""
    return path.read_text(encoding="utf-8")


def _resolve_file(relative: str) -> Path | None:
    here = Path(__file__).resolve()
    repo_root = here.parents[3]
    candidates = [repo_root / relative]

    if relative.startswith("docs/"):
        candidates.append(Path("/docs") / Path(relative).name)
    else:
        candidates.append(Path("/repo_docs") / relative)

    for path in candidates:
        if path.exists():
            return path
    return None
