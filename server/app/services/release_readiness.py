from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


SECTION_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$")
CHECKBOX_RE = re.compile(r"^-\s+\[(?P<mark>[ xX])\]\s+(?P<label>.+?)\s*$")

BLOCKER_GUIDANCE = {
    "실제 Android 기기/모바일 화면": "USB 디버깅 실기기 또는 실제 앱 화면에서 확인해야 합니다.",
    "WSL/Docker 서버 재배포": "정상 WSL/Linux 배포 환경과 Docker Compose 실행 권한이 필요합니다.",
    "공용 서버 운영 결정": "실제 도메인, HTTPS, reverse proxy, 사용자 토큰 운영값을 확정해야 합니다.",
    "Google Play Console": "Play Console 화면에서 문구, Data safety, 내부 테스트 업로드를 확인해야 합니다.",
    "GitHub Actions": "GitHub Actions workflow 실행 기록 또는 Actions 읽기 권한이 필요합니다.",
    "오픈소스 라이선스 결정": "라이선스는 법적 선택이므로 사람이 최종 결정해야 합니다.",
    "기타": "개별 항목의 실제 조건을 확인해야 합니다.",
}

NEXT_ACTIONS = {
    "실제 Android 기기/모바일 화면": (
        "USB 디버깅 실기기를 연결한 뒤 now_app/scripts/check_android_runtime.py --require-physical, "
        "check_android_launch.py --require-physical, mobile_runtime_checklist_ko.md 순서로 확인합니다."
    ),
    "WSL/Docker 서버 재배포": (
        "WSL 배포 경로에서 server/scripts/deploy_local.sh를 실행하고 smoke test 통과를 확인합니다."
    ),
    "공용 서버 운영 결정": (
        "도메인/HTTPS/reverse proxy를 확정한 뒤 server/.env에 NOW_PUBLIC_BASE_URL, "
        "NOW_BEHIND_REVERSE_PROXY, NOW_USER_TOKEN_REQUIRED 값을 적용하고 public-server preflight를 실행합니다."
    ),
    "Google Play Console": (
        "/admin/play의 문서/이미지/수동 확인 항목을 기준으로 Play Console 값, Data safety, "
        "스크린샷, 내부 테스트 업로드를 사람이 최종 확인합니다."
    ),
    "GitHub Actions": (
        "GitHub Actions 화면에서 NowNote Preflight를 실행한 뒤 scripts/check_github_actions_status.py로 통과 상태를 확인합니다."
    ),
    "오픈소스 라이선스 결정": (
        "docs/LICENSE_DECISION.md를 기준으로 라이선스를 선택하고 LICENSE 파일을 추가한 뒤 체크리스트를 갱신합니다."
    ),
    "기타": "해당 체크리스트 항목의 실제 완료 조건을 확인한 뒤 docs/PHASE1_RELEASE_CHECKLIST.md를 갱신합니다.",
}


@dataclass(frozen=True)
class ChecklistItem:
    section: str
    label: str
    checked: bool


def release_readiness_summary() -> dict:
    checklist_path = _phase_one_checklist_path()
    if checklist_path is None:
        return {
            "name": "phase_one_release_readiness",
            "checked_at": datetime.utcnow(),
            "status": "bad",
            "source": None,
            "summary": {"done": 0, "total": 0, "remaining": 0},
            "sections": [],
            "blockers": [
                {
                    "name": "기타",
                    "count": 1,
                    "guidance": "docs/PHASE1_RELEASE_CHECKLIST.md 파일을 서버 이미지에서 찾을 수 없습니다.",
                    "items": [],
                }
            ],
        }

    items = _parse_checklist(checklist_path)
    done = sum(1 for item in items if item.checked)
    remaining = len(items) - done
    sections = _section_summaries(items)
    blockers = _blocker_summaries(items)
    return {
        "name": "phase_one_release_readiness",
        "checked_at": datetime.utcnow(),
        "status": "ready" if remaining == 0 else "blocked",
        "source": str(checklist_path),
        "summary": {"done": done, "total": len(items), "remaining": remaining},
        "sections": sections,
        "blockers": blockers,
    }


def _phase_one_checklist_path() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "docs" / "PHASE1_RELEASE_CHECKLIST.md",
        here.parents[2] / "PHASE1_RELEASE_CHECKLIST.md",
        Path("/docs/PHASE1_RELEASE_CHECKLIST.md"),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def _parse_checklist(path: Path) -> list[ChecklistItem]:
    section = "기타"
    items: list[ChecklistItem] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        section_match = SECTION_RE.match(line)
        if section_match:
            section = section_match.group("title").strip()
            continue
        checkbox_match = CHECKBOX_RE.match(line)
        if not checkbox_match:
            continue
        items.append(
            ChecklistItem(
                section=section,
                label=checkbox_match.group("label").strip(),
                checked=checkbox_match.group("mark").lower() == "x",
            )
        )
    return items


def _section_summaries(items: list[ChecklistItem]) -> list[dict]:
    sections: list[str] = []
    for item in items:
        if item.section not in sections:
            sections.append(item.section)

    summaries: list[dict] = []
    for section in sections:
        section_items = [item for item in items if item.section == section]
        done = sum(1 for item in section_items if item.checked)
        remaining_items = [item for item in section_items if not item.checked]
        summaries.append(
            {
                "name": section,
                "done": done,
                "total": len(section_items),
                "remaining": len(remaining_items),
                "items": [
                    {"label": item.label, "checked": item.checked}
                    for item in section_items
                ],
            }
        )
    return summaries


def _blocker_summaries(items: list[ChecklistItem]) -> list[dict]:
    groups: dict[str, list[ChecklistItem]] = {}
    for item in items:
        if item.checked:
            continue
        groups.setdefault(_classify_remaining_item(item), []).append(item)

    return [
        {
            "name": name,
            "count": len(group_items),
            "guidance": BLOCKER_GUIDANCE.get(name, BLOCKER_GUIDANCE["기타"]),
            "next_action": NEXT_ACTIONS.get(name, NEXT_ACTIONS["기타"]),
            "items": [
                {"section": item.section, "label": item.label}
                for item in group_items
            ],
        }
        for name, group_items in groups.items()
    ]


def _classify_remaining_item(item: ChecklistItem) -> str:
    if "서버 재배포 점검" in item.section:
        return "WSL/Docker 서버 재배포"
    if "공용 서버 오픈 전 점검" in item.section:
        return "공용 서버 운영 결정"
    if "Google Play 등록 전 점검" in item.section:
        if "실제 기기" in item.label:
            return "실제 Android 기기/모바일 화면"
        return "Google Play Console"
    if "실제 Android 기기" in item.label or "음성" in item.label or "녹음" in item.label:
        return "실제 Android 기기/모바일 화면"
    if "GitHub Actions" in item.label:
        return "GitHub Actions"
    if "라이선스" in item.label:
        return "오픈소스 라이선스 결정"
    return "기타"
