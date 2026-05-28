from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HOST_SERVER_URL = "http://127.0.0.1:8750"
DEFAULT_EMULATOR_SERVER_URL = "http://10.0.2.2:8750"


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


@dataclass
class Result:
    status: str
    name: str
    message: str

    @property
    def is_failure(self) -> bool:
        return self.status == "FAIL"


@dataclass
class CommandResult:
    ok: bool
    stdout: str
    stderr: str
    returncode: int | None
    error: str = ""


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


def run_command(command: list[str], timeout: int) -> CommandResult:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
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
        state = parts[1]
        devices.append(
            {
                "serial": serial,
                "state": state,
                "type": "emulator" if serial.startswith("emulator-") else "device",
                "detail": " ".join(parts[2:]),
            }
        )

    return devices


def check_url(url: str, timeout: int) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            status = getattr(response, "status", response.getcode())
            return 200 <= status < 300, f"HTTP {status}"
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}"
    except urllib.error.URLError as exc:
        return False, str(exc.reason)
    except TimeoutError:
        return False, f"{timeout}초 안에 응답 없음"


def add(results: list[Result], status: str, name: str, message: str) -> None:
    results.append(Result(status, name, message))


def flutter_status(result: CommandResult) -> tuple[str, str]:
    first_line = result.stdout.splitlines()[0] if result.stdout else ""
    if result.ok:
        return "OK", first_line or "flutter 확인됨"
    if first_line.startswith("Flutter "):
        detail = result.error or result.stderr or "명령 종료가 지연되었습니다"
        return "WARN", f"{first_line} ({detail})"
    return "FAIL", result.error or result.stderr or first_line or "flutter --version 실패"


def print_results(results: list[Result]) -> None:
    for result in results:
        print(f"[{result.status}] {result.name} - {result.message}")


def main() -> None:
    parser = argparse.ArgumentParser(description="NowNote Android runtime readiness check")
    parser.add_argument("--server-url", default=DEFAULT_HOST_SERVER_URL, help="Host-side server URL to test")
    parser.add_argument(
        "--emulator-server-url",
        default=DEFAULT_EMULATOR_SERVER_URL,
        help="Server URL to enter in the Android emulator app",
    )
    parser.add_argument("--require-server", action="store_true", help="Fail when the host server is not ready")
    parser.add_argument("--require-physical", action="store_true", help="Fail when no physical Android device is connected")
    parser.add_argument("--timeout", type=int, default=8, help="Command and HTTP timeout seconds")
    args = parser.parse_args()

    results: list[Result] = []

    add(results, "OK" if (ROOT / "pubspec.yaml").exists() else "FAIL", "Flutter project", str(ROOT))
    add(
        results,
        "OK" if (ROOT / "android" / "app" / "build.gradle.kts").exists() else "FAIL",
        "Android project",
        "android/app/build.gradle.kts",
    )

    flutter = shutil.which("flutter")
    if flutter:
        flutter_result = run_command([flutter, "--version"], args.timeout)
        status, message = flutter_status(flutter_result)
        add(results, status, "Flutter CLI", message)
    else:
        add(results, "FAIL", "Flutter CLI", "PATH에서 flutter를 찾지 못했습니다")

    adb = find_android_tool("adb", "platform-tools/adb.exe" if os.name == "nt" else "platform-tools/adb")
    connected_devices: list[dict[str, str]] = []
    if adb:
        adb_result = run_command([adb, "devices", "-l"], args.timeout)
        connected_devices = [device for device in parse_adb_devices(adb_result.stdout) if device["state"] == "device"]
        if adb_result.ok:
            add(results, "OK", "ADB", adb)
        else:
            message = adb_result.error or adb_result.stderr or "adb devices -l 실패"
            add(results, "FAIL", "ADB", message)
    else:
        add(results, "FAIL", "ADB", "Android SDK platform-tools의 adb를 찾지 못했습니다")

    emulator_devices = [device for device in connected_devices if device["type"] == "emulator"]
    physical_devices = [device for device in connected_devices if device["type"] == "device"]
    if connected_devices:
        serials = ", ".join(device["serial"] for device in connected_devices)
        add(results, "OK", "실행 가능한 Android 기기", serials)
    else:
        add(results, "FAIL", "실행 가능한 Android 기기", "adb devices -l 기준 연결된 device 상태 기기가 없습니다")

    if emulator_devices:
        add(results, "OK", "Android 에뮬레이터", ", ".join(device["serial"] for device in emulator_devices))
    else:
        add(results, "WARN", "Android 에뮬레이터", "현재 연결된 에뮬레이터가 없습니다")

    if physical_devices:
        add(results, "OK", "실제 Android 기기", ", ".join(device["serial"] for device in physical_devices))
    elif args.require_physical:
        add(results, "FAIL", "실제 Android 기기", "실기기 점검 옵션이 켜졌지만 연결된 실기기가 없습니다")
    else:
        add(results, "WARN", "실제 Android 기기", "실기기 점검 전 USB 디버깅 기기를 연결해야 합니다")

    emulator = find_android_tool("emulator", "emulator/emulator.exe" if os.name == "nt" else "emulator/emulator")
    if emulator:
        avd_result = run_command([emulator, "-list-avds"], args.timeout)
        avds = [line.strip() for line in avd_result.stdout.splitlines() if line.strip()]
        if avd_result.ok and avds:
            add(results, "OK", "AVD 목록", ", ".join(avds[:5]))
        elif avd_result.ok:
            add(results, "WARN", "AVD 목록", "등록된 AVD가 없습니다")
        else:
            add(results, "WARN", "AVD 목록", avd_result.error or avd_result.stderr or "emulator -list-avds 실패")
    else:
        add(results, "WARN", "Android emulator CLI", "Android SDK emulator 도구를 찾지 못했습니다")

    health_ok, health_message = check_url(f"{args.server_url.rstrip('/')}/health", args.timeout)
    ready_ok, ready_message = check_url(f"{args.server_url.rstrip('/')}/health/ready", args.timeout)
    server_ok = health_ok and ready_ok
    server_status = "OK" if server_ok else ("FAIL" if args.require_server else "WARN")
    add(
        results,
        server_status,
        "NowNote 서버",
        f"{args.server_url} health={health_message}, ready={ready_message}",
    )

    print("NowNote Android runtime check")
    print_results(results)

    if connected_devices:
        first_serial = connected_devices[0]["serial"]
        print()
        print("다음 실행 명령")
        print(f"- flutter run -d {first_serial}")
        if emulator_devices:
            print(f"- 에뮬레이터 앱 서버 주소: {args.emulator_server_url}")
        print(f"- 실제 기기 서버 주소: 같은 네트워크의 PC IP 또는 실제 서버 도메인")
    else:
        print()
        print("다음 실행 명령")
        print("- python scripts/check_android_emulator.py")
        print("- python scripts/check_android_emulator.py --start --launch-app")

    failures = [result for result in results if result.is_failure]
    if failures:
        print()
        print(f"실제 모바일 점검을 시작하기 전에 {len(failures)}개 항목을 먼저 해결해야 합니다.")
        raise SystemExit(1)

    print()
    print("실제 모바일 점검을 시작할 수 있는 상태입니다.")


if __name__ == "__main__":
    main()
