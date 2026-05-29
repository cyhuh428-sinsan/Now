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
    "공용 서버 운영 적용": "공개 도메인이 NowNote 서버로 연결되는 reverse proxy 적용 상태를 확인해야 합니다.",
    "Google Play Console": "Play Console 화면에서 문구, Data safety, 내부 테스트 업로드를 확인해야 합니다.",
    "GitHub Actions": "GitHub Actions workflow 실행 기록 또는 Actions 읽기 권한이 필요합니다.",
    "오픈소스 라이선스 결정": "라이선스는 법적 선택이므로 사람이 최종 결정해야 합니다.",
    "기타": "개별 항목의 실제 조건을 확인해야 합니다.",
}

NEXT_ACTIONS = {
    "실제 Android 기기/모바일 화면": (
        "/admin/mobile에서 점검 순서를 확인하고, USB 디버깅 실기기를 연결한 뒤 "
        "now_app/scripts/check_android_runtime.py --require-physical, "
        "check_android_launch.py --require-physical 순서로 확인합니다."
    ),
    "WSL/Docker 서버 재배포": (
        "WSL 배포 경로에서 server/scripts/deploy_local.sh를 실행하고 smoke test 통과를 확인합니다."
    ),
    "공용 서버 운영 적용": (
        "Nginx Proxy Manager에서 nownote.sinsan.kr Proxy Host를 now-api:8080으로 연결하거나, "
        "서버 IP:8750으로 연결합니다. 루트 주소는 Web 프로그램, /privacy는 개인정보처리방침, "
        "/api/v1/server는 JSON을 반환하는지 확인합니다."
    ),
    "Google Play Console": (
        "/admin/play의 문서/이미지/수동 확인 항목을 기준으로 Play Console 값, Data safety, "
        "스크린샷, 내부 테스트 업로드를 사람이 최종 확인합니다."
    ),
    "GitHub Actions": (
        "GitHub Actions 화면에서 NowNote Preflight를 실행하거나, 토큰이 있으면 scripts/dispatch_github_actions.py로 실행 요청 후 "
        "scripts/check_github_actions_status.py로 통과 상태를 확인합니다."
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
    evidence_completed_keys = _completed_evidence_keys(items)
    done = sum(1 for item in items if _item_done(item, evidence_completed_keys))
    evidence_done = sum(
        1
        for item in items
        if not item.checked and _item_key(item) in evidence_completed_keys
    )
    remaining = len(items) - done
    sections = _section_summaries(items, evidence_completed_keys)
    blockers = _blocker_summaries(items, evidence_completed_keys)
    return {
        "name": "phase_one_release_readiness",
        "checked_at": datetime.utcnow(),
        "status": "ready" if remaining == 0 else "blocked",
        "source": str(checklist_path),
        "summary": {
            "done": done,
            "total": len(items),
            "remaining": remaining,
            "evidence_done": evidence_done,
        },
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


def _section_summaries(items: list[ChecklistItem], evidence_completed_keys: set[tuple[str, str, str]]) -> list[dict]:
    sections: list[str] = []
    for item in items:
        if item.section not in sections:
            sections.append(item.section)

    summaries: list[dict] = []
    for section in sections:
        section_items = [item for item in items if item.section == section]
        done = sum(1 for item in section_items if _item_done(item, evidence_completed_keys))
        remaining_items = [item for item in section_items if not _item_done(item, evidence_completed_keys)]
        summaries.append(
            {
                "name": section,
                "done": done,
                "total": len(section_items),
                "remaining": len(remaining_items),
                "items": [
                    {
                        "label": item.label,
                        "checked": _item_done(item, evidence_completed_keys),
                        "checked_source": _item_checked_source(item, evidence_completed_keys),
                    }
                    for item in section_items
                ],
            }
        )
    return summaries


def _blocker_summaries(items: list[ChecklistItem], evidence_completed_keys: set[tuple[str, str, str]]) -> list[dict]:
    groups: dict[str, list[ChecklistItem]] = {}
    for item in items:
        if _item_done(item, evidence_completed_keys):
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


def _completed_evidence_keys(items: list[ChecklistItem]) -> set[tuple[str, str, str]]:
    candidate_keys = {_item_key(item) for item in items if not item.checked}
    if not candidate_keys:
        return set()

    try:
        from sqlalchemy import select

        from app.db import SessionLocal
        from app.models.note import ReleaseEvidenceRecord
    except Exception:
        return set()

    latest: dict[tuple[str, str, str], str] = {}
    try:
        with SessionLocal() as db:
            records = db.scalars(
                select(ReleaseEvidenceRecord).order_by(
                    ReleaseEvidenceRecord.checked_at.desc(),
                    ReleaseEvidenceRecord.id.desc(),
                )
            ).all()
    except Exception:
        return set()

    for record in records:
        key = (
            str(record.group_name).strip(),
            str(record.section).strip(),
            str(record.label).strip(),
        )
        if key not in candidate_keys or key in latest:
            continue
        latest[key] = str(record.result).strip()
    return {key for key, result in latest.items() if result == "완료"}


def _item_done(item: ChecklistItem, evidence_completed_keys: set[tuple[str, str, str]]) -> bool:
    return item.checked or _item_key(item) in evidence_completed_keys


def _item_checked_source(item: ChecklistItem, evidence_completed_keys: set[tuple[str, str, str]]) -> str:
    if item.checked:
        return "checklist"
    if _item_key(item) in evidence_completed_keys:
        return "evidence"
    return "none"


def _item_key(item: ChecklistItem) -> tuple[str, str, str]:
    return (_classify_remaining_item(item), item.section, item.label)


def _classify_remaining_item(item: ChecklistItem) -> str:
    if "서버 재배포 점검" in item.section:
        return "WSL/Docker 서버 재배포"
    if "공용 서버 오픈 전 점검" in item.section:
        return "공용 서버 운영 적용"
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
