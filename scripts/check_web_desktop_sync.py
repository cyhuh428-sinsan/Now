"""Verify that the Web and desktop copies of the NowNote screen source stay in sync.

Web(`web/`)와 설치형(`desktop/app/`)은 같은 화면 소스를 두 벌 가지고 있다.
양쪽에만 있어야 하는 코드는 소스 안에 구역 표시 주석으로 남긴다.

    // #region nownote-only:desktop 사유
    ...
    // #endregion

    /* #region nownote-only:web 사유 */
    ...
    /* #endregion */

이 스크립트는 표시된 구역을 걷어낸 뒤 남은 내용을 비교한다.
남은 차이가 있으면 어느 줄이 어떻게 다른지 보여주고 종료 코드 1로 끝낸다.

이 스크립트는 검증만 한다. 한쪽을 다른 쪽에 덮어쓰지 않는다.
"""
from __future__ import annotations

import argparse
import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path

import sys

# Windows 콘솔이 cp949여도 한국어 출력이 깨지지 않게 한다.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


ROOT = Path(__file__).resolve().parents[1]

SIDE_WEB = "web"
SIDE_DESKTOP = "desktop"

SIDE_LABEL = {
    SIDE_WEB: "Web",
    SIDE_DESKTOP: "설치형",
}

# (Web 쪽 파일, 설치형 쪽 파일)
FILE_PAIRS = [
    (Path("web") / "app.js", Path("desktop") / "app" / "app.js"),
    (Path("web") / "styles.css", Path("desktop") / "app" / "styles.css"),
]

REGION_START_RE = re.compile(
    r"^\s*(?://|/\*)\s*#region\s+nownote-only:(?P<side>web|desktop)\s*(?P<reason>.*?)\s*(?:\*/)?\s*$"
)
REGION_END_RE = re.compile(r"^\s*(?://|/\*)\s*#endregion\b.*$")


@dataclass
class Region:
    side: str
    reason: str
    start_line: int
    end_line: int
    body_lines: int


@dataclass
class ParsedFile:
    path: Path
    side: str
    kept: list[str]
    regions: list[Region] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def read_lines(path: Path) -> list[str]:
    """줄바꿈 문자를 정규화해서 읽는다.

    두 파일 모두 CRLF와 LF가 섞여 있고 섞인 위치가 서로 다르다.
    화면 동작과 무관한 차이이므로 비교 전에 LF로 맞춘다.
    """
    text = path.read_text(encoding="utf-8-sig", newline="")
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def parse_file(rel_path: Path, side: str) -> ParsedFile:
    path = ROOT / rel_path
    parsed = ParsedFile(path=rel_path, side=side, kept=[])
    if not path.exists():
        parsed.errors.append(f"파일이 없습니다: {rel_path.as_posix()}")
        return parsed

    lines = read_lines(path)
    open_region: Region | None = None
    body_count = 0

    for number, line in enumerate(lines, start=1):
        start_match = REGION_START_RE.match(line)
        if start_match:
            if open_region is not None:
                parsed.errors.append(
                    f"{rel_path.as_posix()}:{number} 앞 구역이 #endregion 없이 다시 열렸습니다 "
                    f"(연 위치 {open_region.start_line}줄)"
                )
                return parsed
            region_side = start_match.group("side")
            reason = start_match.group("reason").strip()
            if region_side != side:
                parsed.errors.append(
                    f"{rel_path.as_posix()}:{number} nownote-only:{region_side} 구역이 "
                    f"{SIDE_LABEL[side]} 파일에 있습니다. 구역은 해당하는 쪽 파일에만 표시합니다"
                )
                return parsed
            if not reason:
                parsed.errors.append(
                    f"{rel_path.as_posix()}:{number} 구역에 사유가 비어 있습니다. "
                    f"#region nownote-only:{region_side} 뒤에 한 줄로 사유를 적습니다"
                )
                return parsed
            open_region = Region(
                side=region_side,
                reason=reason,
                start_line=number,
                end_line=0,
                body_lines=0,
            )
            body_count = 0
            continue

        if REGION_END_RE.match(line):
            if open_region is None:
                parsed.errors.append(
                    f"{rel_path.as_posix()}:{number} 열린 구역 없이 #endregion 이 나왔습니다"
                )
                return parsed
            open_region.end_line = number
            open_region.body_lines = body_count
            parsed.regions.append(open_region)
            open_region = None
            continue

        if open_region is None:
            parsed.kept.append(line)
        else:
            body_count += 1

    if open_region is not None:
        parsed.errors.append(
            f"{rel_path.as_posix()}:{open_region.start_line} 구역이 #endregion 으로 닫히지 않았습니다"
        )

    return parsed


def print_regions(parsed: ParsedFile) -> None:
    if not parsed.regions:
        print(f"  {parsed.path.as_posix()}: 표시된 구역 없음")
        return
    print(f"  {parsed.path.as_posix()}: 구역 {len(parsed.regions)}개")
    for region in parsed.regions:
        print(
            f"    - {region.start_line}-{region.end_line}줄 "
            f"[{SIDE_LABEL[region.side]} 전용, 본문 {region.body_lines}줄] {region.reason}"
        )


def report_difference(web: ParsedFile, desktop: ParsedFile) -> None:
    print(f"[FAIL] {web.path.as_posix()} 와 {desktop.path.as_posix()} 가 다릅니다")
    diff = difflib.unified_diff(
        web.kept,
        desktop.kept,
        fromfile=f"{web.path.as_posix()} (구역 제외)",
        tofile=f"{desktop.path.as_posix()} (구역 제외)",
        lineterm="",
        n=2,
    )
    for line in diff:
        print(f"  {line}")
    print(
        "  해석: '-' 로 시작하는 줄은 Web 에만, '+' 로 시작하는 줄은 설치형에만 있습니다."
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Web(web/)과 설치형(desktop/app/) 화면 소스가 갈라지지 않았는지 확인합니다"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="표시된 전용 구역 목록과 사유를 함께 출력합니다",
    )
    args = parser.parse_args()

    failures: list[str] = []
    checked_files = 0
    total_regions = 0

    for web_rel, desktop_rel in FILE_PAIRS:
        web = parse_file(web_rel, SIDE_WEB)
        desktop = parse_file(desktop_rel, SIDE_DESKTOP)

        errors = web.errors + desktop.errors
        if errors:
            for message in errors:
                print(f"[FAIL] {message}")
                failures.append(message)
            continue

        checked_files += 2
        total_regions += len(web.regions) + len(desktop.regions)

        if args.verbose:
            print(f"[구역] {web_rel.as_posix()} <-> {desktop_rel.as_posix()}")
            print_regions(web)
            print_regions(desktop)

        if web.kept == desktop.kept:
            print(
                f"[OK] {web_rel.as_posix()} <-> {desktop_rel.as_posix()} "
                f"- 전용 구역 {len(web.regions) + len(desktop.regions)}개를 뺀 나머지가 같습니다"
            )
        else:
            report_difference(web, desktop)
            failures.append(f"{web_rel.as_posix()} <-> {desktop_rel.as_posix()}")

    print()
    if failures:
        print(f"Web/설치형 소스 동기화 확인 실패 ({len(failures)}건)")
        for failure in failures:
            print(f"- {failure}")
        print()
        print("고치는 방법:")
        print("- 한쪽에만 반영된 수정이면 다른 쪽에도 같은 수정을 옮깁니다.")
        print("- 한쪽에만 있어야 하는 코드라면 그 쪽 파일에 전용 구역으로 표시합니다.")
        print("  예: // #region nownote-only:desktop 사유를 한 줄로 ... // #endregion")
        print("- 자세한 절차는 docs/NOW_WEB_DESKTOP_SYNC.md 를 참고합니다.")
        raise SystemExit(1)

    print(
        f"Web/설치형 소스 동기화 확인 통과 (파일 {checked_files}개, 전용 구역 {total_regions}개)"
    )


if __name__ == "__main__":
    main()
