from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAUNCH_CHECK = ROOT / "scripts" / "check_android_launch.py"


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class CommandResult:
    ok: bool
    stdout: str
    stderr: str
    returncode: int | None
    error: str = ""

    @property
    def output(self) -> str:
        return "\n".join(part for part in [self.stdout, self.stderr, self.error] if part).strip()


@dataclass
class Check:
    status: str
    name: str
    message: str

    @property
    def failed(self) -> bool:
        return self.status == "FAIL"


def find_android_tool(name: str, relative_path: str) -> str | None:
    path_value = shutil.which(name)
    if path_value:
        return path_value
    if os.name == "nt":
        path_value = shutil.which(f"{name}.exe")
        if path_value:
            return path_value

    candidates: list[Path] = []
    for env_name in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        env_value = os.environ.get(env_name)
        if env_value:
            candidates.append(Path(env_value) / relative_path)

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        candidates.append(Path(local_app_data) / "Android" / "Sdk" / relative_path)

    home = Path.home()
    candidates.extend(
        [
            home / "AppData" / "Local" / "Android" / "Sdk" / relative_path,
            home / "Android" / "Sdk" / relative_path,
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def run_command(command: list[str], timeout: int, cwd: Path = ROOT) -> CommandResult:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        return CommandResult(False, "", "", None, str(exc))
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return CommandResult(False, stdout, stderr, None, f"{timeout}초 안에 끝나지 않았습니다")

    return CommandResult(
        completed.returncode == 0,
        completed.stdout.strip(),
        completed.stderr.strip(),
        completed.returncode,
    )


def parse_adb_devices(output: str) -> list[dict[str, str]]:
    devices: list[dict[str, str]] = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        serial = parts[0]
        devices.append(
            {
                "serial": serial,
                "state": parts[1],
                "type": "emulator" if serial.startswith("emulator-") else "device",
            }
        )
    return devices


def adb_command(adb: str, serial: str, *args: str) -> list[str]:
    return [adb, "-s", serial, *args]


def add(checks: list[Check], status: str, name: str, message: str) -> None:
    checks.append(Check(status, name, message))


def print_checks(checks: list[Check]) -> None:
    for check in checks:
        print(f"[{check.status}] {check.name} - {check.message}")


def list_avds(emulator: str, timeout: int) -> list[str]:
    result = run_command([emulator, "-list-avds"], timeout)
    if not result.ok:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def connected_emulators(adb: str, timeout: int) -> list[dict[str, str]]:
    result = run_command([adb, "devices", "-l"], timeout)
    if not result.ok:
        return []
    return [
        device
        for device in parse_adb_devices(result.stdout)
        if device["type"] == "emulator" and device["state"] == "device"
    ]


def start_emulator(emulator: str, avd: str, headless: bool, no_snapshot: bool) -> None:
    command = [emulator, "-avd", avd]
    if headless:
        command.extend(["-no-window", "-no-audio"])
    if no_snapshot:
        command.extend(["-no-snapshot"])

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS

    subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
    )


def wait_for_emulator(adb: str, timeout: int, interval: float) -> str | None:
    deadline = time.monotonic() + timeout
    seen_serial: str | None = None
    while time.monotonic() < deadline:
        emulators = connected_emulators(adb, 10)
        if emulators:
            seen_serial = emulators[0]["serial"]
            boot = run_command(adb_command(adb, seen_serial, "shell", "getprop", "sys.boot_completed"), 10)
            if boot.ok and boot.stdout.strip() == "1":
                run_command(adb_command(adb, seen_serial, "shell", "input", "keyevent", "82"), 10)
                return seen_serial
        time.sleep(interval)
    return seen_serial


def run_launch_check(serial: str, timeout: int, skip_install: bool) -> CommandResult:
    command = [
        sys.executable,
        str(LAUNCH_CHECK),
        "--serial",
        serial,
        "--timeout",
        str(timeout),
    ]
    if skip_install:
        command.append("--skip-install")
    return run_command(command, timeout=max(timeout * 3, 90))


def should_retry_launch_without_install(result: CommandResult) -> bool:
    output = result.output
    return (
        "INSTALL_FAILED_INSUFFICIENT_STORAGE" in output
        and "[OK] 패키지 설치 확인" in output
        and "[OK] 현재 화면 패키지" in output
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare an Android emulator for NowNote mobile checks")
    parser.add_argument("--avd", help="AVD name to start. Defaults to the first registered AVD")
    parser.add_argument("--start", action="store_true", help="Start the emulator when no emulator is connected")
    parser.add_argument("--headless", action="store_true", help="Start emulator without a visible window")
    parser.add_argument("--no-snapshot", action="store_true", help="Start emulator without loading/saving snapshots")
    parser.add_argument("--launch-app", action="store_true", help="Run check_android_launch.py after boot")
    parser.add_argument("--skip-install", action="store_true", help="Launch an already installed app without adb install")
    parser.add_argument("--timeout", type=int, default=240, help="Boot wait timeout seconds")
    parser.add_argument("--interval", type=float, default=5.0, help="Boot polling interval seconds")
    args = parser.parse_args()

    checks: list[Check] = []
    adb = find_android_tool("adb", "platform-tools/adb.exe" if os.name == "nt" else "platform-tools/adb")
    emulator = find_android_tool("emulator", "emulator/emulator.exe" if os.name == "nt" else "emulator/emulator")

    if adb:
        add(checks, "OK", "ADB", adb)
    else:
        add(checks, "FAIL", "ADB", "Android SDK platform-tools의 adb를 찾지 못했습니다")

    if emulator:
        add(checks, "OK", "Android emulator CLI", emulator)
    else:
        add(checks, "FAIL", "Android emulator CLI", "Android SDK emulator 도구를 찾지 못했습니다")

    if not adb or not emulator:
        print("NowNote Android emulator check")
        print_checks(checks)
        raise SystemExit(1)

    avds = list_avds(emulator, 20)
    if avds:
        add(checks, "OK", "AVD 목록", ", ".join(avds[:5]))
    else:
        add(checks, "FAIL", "AVD 목록", "등록된 AVD가 없습니다")

    running = connected_emulators(adb, 20)
    if running:
        serial = running[0]["serial"]
        add(checks, "OK", "실행 중인 에뮬레이터", serial)
    elif args.start and avds:
        avd = args.avd or avds[0]
        if avd not in avds:
            add(checks, "FAIL", "선택한 AVD", f"등록된 AVD가 아닙니다: {avd}")
            serial = None
        else:
            add(checks, "OK", "선택한 AVD", avd)
            start_emulator(emulator, avd, args.headless, args.no_snapshot)
            serial = wait_for_emulator(adb, args.timeout, args.interval)
            if serial:
                add(checks, "OK", "에뮬레이터 부팅", serial)
            else:
                add(checks, "FAIL", "에뮬레이터 부팅", f"{args.timeout}초 안에 부팅 완료를 확인하지 못했습니다")
    else:
        serial = None
        add(checks, "WARN", "실행 중인 에뮬레이터", "없음. 시작하려면 --start 옵션을 사용하세요")

    if args.launch_app:
        if serial:
            launch = run_launch_check(serial, 60, args.skip_install)
            if launch.ok:
                add(checks, "OK", "NowNote 설치/실행 점검", "check_android_launch.py 통과")
            elif not args.skip_install and should_retry_launch_without_install(launch):
                retry_launch = run_launch_check(serial, 60, True)
                if retry_launch.ok:
                    add(
                        checks,
                        "WARN",
                        "APK 재설치",
                        "에뮬레이터 저장공간 부족으로 재설치는 실패했지만 기존 설치 앱 실행은 확인됨",
                    )
                    add(checks, "OK", "NowNote 실행 점검", "check_android_launch.py --skip-install 통과")
                else:
                    add(
                        checks,
                        "FAIL",
                        "NowNote 설치/실행 점검",
                        retry_launch.output or "check_android_launch.py 재확인 실패",
                    )
            else:
                add(checks, "FAIL", "NowNote 설치/실행 점검", launch.output or "check_android_launch.py 실패")
        else:
            add(checks, "FAIL", "NowNote 설치/실행 점검", "실행 가능한 에뮬레이터가 없습니다")

    print("NowNote Android emulator check")
    print_checks(checks)
    if serial:
        print()
        print("다음 확인 명령")
        skip_install_option = " --skip-install" if args.skip_install else ""
        print(f"- python scripts/check_android_launch.py --serial {serial}{skip_install_option}")

    failures = [check for check in checks if check.failed]
    if failures:
        print()
        print(f"Android 에뮬레이터 점검 실패: {len(failures)}개")
        raise SystemExit(1)

    print()
    print("Android 에뮬레이터 점검을 마쳤습니다.")


if __name__ == "__main__":
    main()
