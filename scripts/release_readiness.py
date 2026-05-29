from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "docs" / "PHASE1_RELEASE_CHECKLIST.md"

SECTION_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$")
CHECKBOX_RE = re.compile(r"^-\s+\[(?P<mark>[ xX])\]\s+(?P<label>.+?)\s*$")


@dataclass
class ChecklistItem:
    section: str
    label: str
    checked: bool


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
    "WSL/Docker 서버 재배포": "WSL 배포 경로에서 server/scripts/deploy_local.sh를 실행하고 smoke test 통과를 확인합니다.",
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
    "오픈소스 라이선스 결정": "docs/LICENSE_DECISION.md를 기준으로 라이선스를 선택하고 LICENSE 파일을 추가한 뒤 체크리스트를 갱신합니다.",
    "기타": "해당 체크리스트 항목의 실제 완료 조건을 확인한 뒤 docs/PHASE1_RELEASE_CHECKLIST.md를 갱신합니다.",
}


def parse_checklist(path: Path) -> list[ChecklistItem]:
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


def section_order(items: list[ChecklistItem]) -> list[str]:
    ordered: list[str] = []
    for item in items:
        if item.section not in ordered:
            ordered.append(item.section)
    return ordered


def classify_remaining_item(item: ChecklistItem) -> str:
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


def remaining_by_blocker(items: list[ChecklistItem]) -> dict[str, list[ChecklistItem]]:
    groups: dict[str, list[ChecklistItem]] = {}
    for item in items:
        if item.checked:
            continue
        group = classify_remaining_item(item)
        groups.setdefault(group, []).append(item)
    return groups


def print_blockers(items: list[ChecklistItem]) -> None:
    groups = remaining_by_blocker(items)
    if not groups:
        print("## 남은 항목 유형")
        print("- 없음")
        print()
        return

    print("## 남은 항목 유형")
    for group_name, group_items in groups.items():
        guidance = BLOCKER_GUIDANCE.get(group_name, BLOCKER_GUIDANCE["기타"])
        next_action = NEXT_ACTIONS.get(group_name, NEXT_ACTIONS["기타"])
        print(f"### {group_name} ({len(group_items)}개)")
        print(f"- 기준: {guidance}")
        print(f"- 다음 행동: {next_action}")
        for item in group_items:
            print(f"- [{item.section}] {item.label}")
        print()


def print_summary(items: list[ChecklistItem], show_done: bool) -> None:
    done = [item for item in items if item.checked]
    remaining = [item for item in items if not item.checked]

    print("NowNote 1차 마무리 상태")
    print(f"- 전체: {len(done)}/{len(items)} 완료")
    print(f"- 남은 항목: {len(remaining)}")
    print()

    for section in section_order(items):
        section_items = [item for item in items if item.section == section]
        section_done = [item for item in section_items if item.checked]
        section_remaining = [item for item in section_items if not item.checked]

        print(f"## {section} ({len(section_done)}/{len(section_items)})")

        if show_done and section_done:
            print("완료")
            for item in section_done:
                print(f"- {item.label}")

        if section_remaining:
            print("남음")
            for item in section_remaining:
                print(f"- {item.label}")
        else:
            print("남음")
            print("- 없음")
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize NowNote phase-one release readiness")
    parser.add_argument("--checklist", default=str(CHECKLIST), help="Checklist markdown path")
    parser.add_argument("--show-done", action="store_true", help="Also print completed items")
    parser.add_argument("--show-blockers", action="store_true", help="Group remaining items by required external condition")
    parser.add_argument("--strict", action="store_true", help="Exit with failure when any item remains")
    args = parser.parse_args()

    checklist_path = Path(args.checklist).resolve()
    if not checklist_path.exists():
        raise SystemExit(f"Checklist not found: {checklist_path}")

    items = parse_checklist(checklist_path)
    if not items:
        raise SystemExit(f"No checklist items found: {checklist_path}")

    print_summary(items, args.show_done)
    if args.show_blockers:
        print_blockers(items)

    if args.strict and any(not item.checked for item in items):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
