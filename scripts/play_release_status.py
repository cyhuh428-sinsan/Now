from __future__ import annotations

import argparse
import re
import struct
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOW_APP = ROOT / "now_app"
ANDROID = NOW_APP / "android"
PLAY_DOCS = NOW_APP / "docs"
PLAY_ASSETS = PLAY_DOCS / "play_assets"
PHASE1_CHECKLIST = ROOT / "docs" / "PHASE1_RELEASE_CHECKLIST.md"
PLAY_CHECKLIST = PLAY_DOCS / "google_play_release_checklist.md"

REQUIRED_DOCS = [
    PLAY_DOCS / "google_play_release_checklist.md",
    PLAY_DOCS / "google_play_console_values_ko.md",
    PLAY_DOCS / "google_play_paste_ready_ko.md",
    PLAY_DOCS / "google_play_step_by_step_ko.md",
    PLAY_DOCS / "privacy_policy_draft_ko.md",
    PLAY_DOCS / "nownote_site" / "index.html",
]

REQUIRED_ASSETS = [
    PLAY_ASSETS / "app_icon_512.png",
    PLAY_ASSETS / "feature_graphic_1024x500.png",
    PLAY_ASSETS / "screenshot_01_home.png",
    PLAY_ASSETS / "screenshot_02_daily_notes.png",
    PLAY_ASSETS / "screenshot_03_tree_notes.png",
    PLAY_ASSETS / "screenshot_04_voice.png",
]

EXPECTED_ASSET_DIMENSIONS = {
    PLAY_ASSETS / "app_icon_512.png": (512, 512),
    PLAY_ASSETS / "feature_graphic_1024x500.png": (1024, 500),
    PLAY_ASSETS / "screenshot_01_home.png": (1080, 1920),
    PLAY_ASSETS / "screenshot_02_daily_notes.png": (1080, 1920),
    PLAY_ASSETS / "screenshot_03_tree_notes.png": (1080, 1920),
    PLAY_ASSETS / "screenshot_04_voice.png": (1080, 1920),
}

LOCAL_RELEASE_FILES = [
    ANDROID / "key.properties",
    ANDROID / "upload-keystore.jks",
    NOW_APP / "build" / "app" / "outputs" / "bundle" / "release" / "app-release.aab",
]

CHECKBOX_RE = re.compile(r"^-\s+\[(?P<mark>[ xX])\]\s+(?P<label>.+?)\s*$")


@dataclass
class Check:
    name: str
    status: str
    message: str


def add_file_check(checks: list[Check], path: Path, label: str) -> None:
    if path.exists() and path.stat().st_size > 0:
        checks.append(Check(label, "ok", str(path.relative_to(ROOT))))
    elif path.exists():
        checks.append(Check(label, "warn", f"빈 파일: {path.relative_to(ROOT)}"))
    else:
        checks.append(Check(label, "warn", f"파일 없음: {path.relative_to(ROOT)}"))


def read_png_dimensions(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    with path.open("rb") as file:
        header = file.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", header[16:24])


def add_png_dimension_check(checks: list[Check], path: Path, expected: tuple[int, int]) -> None:
    dimensions = read_png_dimensions(path)
    if dimensions is None:
        checks.append(Check(f"Play 이미지 크기: {path.name}", "warn", "PNG 크기 확인 실패"))
        return

    width, height = dimensions
    expected_width, expected_height = expected
    status = "ok" if dimensions == expected else "warn"
    checks.append(
        Check(
            f"Play 이미지 크기: {path.name}",
            status,
            f"{width}x{height}, 기준 {expected_width}x{expected_height}",
        )
    )


def git_check_ignore(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", str(relative)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def parse_checked_items(path: Path) -> tuple[int, int]:
    done = 0
    total = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        match = CHECKBOX_RE.match(line)
        if not match:
            continue
        total += 1
        if match.group("mark").lower() == "x":
            done += 1
    return done, total


def extract_phase1_google_play() -> tuple[int, int, list[str]]:
    if not PHASE1_CHECKLIST.exists():
        return 0, 0, ["1차 체크리스트 파일 없음"]

    in_section = False
    done = 0
    total = 0
    remaining: list[str] = []
    for line in PHASE1_CHECKLIST.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            in_section = "Google Play 등록 전 점검" in line
            continue
        if not in_section:
            continue
        match = CHECKBOX_RE.match(line)
        if not match:
            continue
        total += 1
        label = match.group("label")
        if match.group("mark").lower() == "x":
            done += 1
        else:
            remaining.append(label)
    return done, total, remaining


def check_play_texts(checks: list[Check]) -> None:
    console_values_path = PLAY_DOCS / "google_play_console_values_ko.md"
    paste_path = PLAY_DOCS / "google_play_paste_ready_ko.md"
    privacy_path = PLAY_DOCS / "privacy_policy_draft_ko.md"

    if console_values_path.exists():
        text = console_values_path.read_text(encoding="utf-8")
        checks.append(
            Check(
                "개인정보처리방침 URL 문서화",
                "ok" if "https://nownote.sinsan.kr/" in text else "warn",
                "google_play_console_values_ko.md",
            )
        )
        checks.append(
            Check(
                "Play 개발자 이메일 문서화",
                "ok" if "cyhuh428@gmail.com" in text else "warn",
                "google_play_console_values_ko.md",
            )
        )

    if paste_path.exists():
        text = paste_path.read_text(encoding="utf-8")
        requirements = [
            ("Data safety 초안", "Data safety"),
            ("마이크", "마이크 권한"),
            ("카메라", "카메라 권한"),
            ("사진 및 이미지", "사진/이미지 권한"),
            ("캘린더", "캘린더 권한"),
            ("알림", "알림 권한"),
            ("Health Connect", "Health Connect 권한"),
        ]
        missing = [label for needle, label in requirements if needle not in text]
        checks.append(
            Check(
                "붙여넣기용 Play 입력값",
                "ok" if not missing else "warn",
                "누락 없음" if not missing else "누락: " + ", ".join(missing),
            )
        )

    if privacy_path.exists():
        text = privacy_path.read_text(encoding="utf-8")
        checks.append(
            Check(
                "개인정보처리방침 서버 전송 기준",
                "ok" if "사용자가 NowNote 서버 연결을 켠 경우" in text else "warn",
                "privacy_policy_draft_ko.md",
            )
        )


def build_checks() -> list[Check]:
    checks: list[Check] = []

    for doc in REQUIRED_DOCS:
        add_file_check(checks, doc, f"Play 문서: {doc.name}")
    for asset in REQUIRED_ASSETS:
        add_file_check(checks, asset, f"Play 이미지: {asset.name}")
    for asset, expected in EXPECTED_ASSET_DIMENSIONS.items():
        add_png_dimension_check(checks, asset, expected)

    for path in LOCAL_RELEASE_FILES:
        add_file_check(checks, path, f"로컬 릴리스 파일: {path.name}")

    key_properties = ANDROID / "key.properties"
    upload_key = ANDROID / "upload-keystore.jks"
    checks.append(
        Check(
            "key.properties Git 제외",
            "ok" if git_check_ignore(key_properties) else "warn",
            "now_app/android/key.properties",
        )
    )
    checks.append(
        Check(
            "upload-keystore.jks Git 제외",
            "ok" if git_check_ignore(upload_key) else "warn",
            "now_app/android/upload-keystore.jks",
        )
    )

    if PLAY_CHECKLIST.exists():
        done, total = parse_checked_items(PLAY_CHECKLIST)
        checks.append(Check("Play 세부 체크리스트", "ok" if total and done == total else "manual", f"{done}/{total} 완료"))

    done, total, remaining = extract_phase1_google_play()
    checks.append(Check("1차 Google Play 체크리스트", "manual" if remaining else "ok", f"{done}/{total} 완료"))
    for item in remaining:
        checks.append(Check("수동 확인 필요", "manual", item))

    check_play_texts(checks)
    return checks


def print_checks(checks: list[Check], show_manual: bool) -> None:
    auto_checks = [check for check in checks if check.status != "manual"]
    ok_count = sum(1 for check in auto_checks if check.status == "ok")
    warn_count = sum(1 for check in auto_checks if check.status == "warn")
    manual_count = sum(1 for check in checks if check.status == "manual")

    print("NowNote Google Play 등록 준비 상태")
    print(f"- 자동 확인: {ok_count}/{len(auto_checks)} OK")
    print(f"- 경고: {warn_count}")
    print(f"- 수동 확인: {manual_count}")
    print()

    for check in checks:
        if check.status == "manual" and not show_manual:
            continue
        print(f"[{check.status.upper()}] {check.name} - {check.message}")

    if not show_manual and manual_count:
        print()
        print(f"수동 확인 항목 {manual_count}개는 --show-manual 옵션으로 볼 수 있습니다.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize NowNote Google Play release readiness")
    parser.add_argument("--show-manual", action="store_true", help="수동 확인 항목까지 표시")
    parser.add_argument("--strict", action="store_true", help="경고 또는 수동 확인 항목이 있으면 실패")
    args = parser.parse_args()

    checks = build_checks()
    print_checks(checks, args.show_manual)

    if args.strict and any(check.status != "ok" for check in checks):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
