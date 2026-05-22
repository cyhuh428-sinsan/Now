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
    parser.add_argument("--strict", action="store_true", help="Exit with failure when any item remains")
    args = parser.parse_args()

    checklist_path = Path(args.checklist).resolve()
    if not checklist_path.exists():
        raise SystemExit(f"Checklist not found: {checklist_path}")

    items = parse_checklist(checklist_path)
    if not items:
        raise SystemExit(f"No checklist items found: {checklist_path}")

    print_summary(items, args.show_done)

    if args.strict and any(not item.checked for item in items):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
