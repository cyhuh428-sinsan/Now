from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APK = ROOT / "build" / "app" / "outputs" / "flutter-apk" / "app-debug.apk"
DEFAULT_PACKAGE = "com.sinsan.nownote"


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
        devices.append(
            {
                "serial": serial,
                "state": parts[1],
                "type": "emulator" if serial.startswith("emulator-") else "device",
            }
        )
    return devices


def adb_command(adb: str, serial: str | None, *args: str) -> list[str]:
    command = [adb]
    if serial:
        command.extend(["-s", serial])
    command.extend(args)
    return command


def add(checks: list[Check], status: str, name: str, message: str) -> None:
    checks.append(Check(status, name, message))


def pick_device(devices: list[dict[str, str]], serial: str | None) -> dict[str, str] | None:
    available = [device for device in devices if device["state"] == "device"]
    if serial:
        return next((device for device in available if device["serial"] == serial), None)
    return available[0] if available else None


def print_checks(checks: list[Check]) -> None:
    for check in checks:
        print(f"[{check.status}] {check.name} - {check.message}")


def parse_data_available_kib(df_output: str) -> int | None:
    lines = [line.strip() for line in df_output.splitlines() if line.strip()]
    if len(lines) < 2:
        return None
    parts = lines[-1].split()
    if len(parts) < 4:
        return None
    try:
        return int(parts[3])
    except ValueError:
        return None


def mib(value: int) -> str:
    return f"{value / (1024 * 1024):.0f}MB"


def apk_native_abis(apk_path: Path) -> set[str]:
    abis: set[str] = set()
    try:
        with zipfile.ZipFile(apk_path) as archive:
            for name in archive.namelist():
                parts = name.split("/")
                if len(parts) >= 3 and parts[0] == "lib" and parts[-1].endswith(".so"):
                    abis.add(parts[1])
    except zipfile.BadZipFile:
        return set()
    return abis


def parse_device_abis(primary: str, abi_list: str) -> list[str]:
    values: list[str] = []
    for raw in [primary, *abi_list.replace("\n", ",").split(",")]:
        value = raw.strip()
        if value and value not in values:
            values.append(value)
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Install and launch NowNote on a connected Android device")
    parser.add_argument("--apk", default=str(DEFAULT_APK), help="APK path to install")
    parser.add_argument("--package", default=DEFAULT_PACKAGE, help="Android package name")
    parser.add_argument("--serial", help="ADB device serial to use")
    parser.add_argument("--require-physical", action="store_true", help="Fail when the selected device is an emulator")
    parser.add_argument("--skip-install", action="store_true", help="Launch only, without adb install")
    parser.add_argument("--timeout", type=int, default=60, help="ADB command timeout seconds")
    args = parser.parse_args()

    checks: list[Check] = []
    apk_path = Path(args.apk).resolve()

    adb = find_android_tool("adb", "platform-tools/adb.exe" if os.name == "nt" else "platform-tools/adb")
    if not adb:
        add(checks, "FAIL", "ADB", "Android SDK platform-tools의 adb를 찾지 못했습니다")
        print("NowNote Android install/launch check")
        print_checks(checks)
        raise SystemExit(1)
    add(checks, "OK", "ADB", adb)

    devices_result = run_command([adb, "devices", "-l"], args.timeout)
    devices = parse_adb_devices(devices_result.stdout)
    selected = pick_device(devices, args.serial)
    if not devices_result.ok:
        add(checks, "FAIL", "Android 기기 목록", devices_result.output or "adb devices -l 실패")
    elif not selected:
        add(checks, "FAIL", "실행 가능한 Android 기기", "device 상태의 에뮬레이터 또는 실기기가 없습니다")
    else:
        add(checks, "OK", "선택된 Android 기기", f"{selected['serial']} ({selected['type']})")
        if args.require_physical and selected["type"] != "device":
            add(checks, "FAIL", "실제 Android 기기", "실기기 점검 옵션이 켜졌지만 선택된 기기가 에뮬레이터입니다")
        elif selected["type"] == "device":
            add(checks, "OK", "실제 Android 기기", selected["serial"])
        else:
            add(checks, "WARN", "실제 Android 기기", "현재 선택된 대상은 에뮬레이터입니다")

    if not args.skip_install:
        if apk_path.exists() and apk_path.stat().st_size > 0:
            add(checks, "OK", "APK 파일", str(apk_path))
        else:
            add(checks, "FAIL", "APK 파일", f"파일을 찾지 못했습니다: {apk_path}")

    if any(check.failed for check in checks) or not selected:
        print("NowNote Android install/launch check")
        print_checks(checks)
        raise SystemExit(1)

    serial = selected["serial"]
    if not args.skip_install:
        primary_abi_result = run_command(adb_command(adb, serial, "shell", "getprop", "ro.product.cpu.abi"), args.timeout)
        abi_list_result = run_command(adb_command(adb, serial, "shell", "getprop", "ro.product.cpu.abilist"), args.timeout)
        device_abis = parse_device_abis(primary_abi_result.output, abi_list_result.output)
        native_abis = apk_native_abis(apk_path)
        if native_abis and device_abis:
            matched_abis = sorted(native_abis.intersection(device_abis))
            if matched_abis:
                add(checks, "OK", "APK ABI 호환성", f"기기 {device_abis[0]}, APK {', '.join(matched_abis)}")
            else:
                add(
                    checks,
                    "FAIL",
                    "APK ABI 호환성",
                    f"기기 ABI {', '.join(device_abis)}와 APK ABI {', '.join(sorted(native_abis))}가 맞지 않습니다",
                )
        elif native_abis:
            add(checks, "WARN", "APK ABI 호환성", "기기 ABI를 확인하지 못했습니다")
        else:
            add(checks, "WARN", "APK ABI 호환성", "APK에서 native library ABI를 찾지 못했습니다")

        storage = run_command(adb_command(adb, serial, "shell", "df", "-k", "/data"), args.timeout)
        available_kib = parse_data_available_kib(storage.output)
        if available_kib is None:
            add(checks, "WARN", "Android 저장공간", "df -k /data 결과를 해석하지 못했습니다")
        else:
            available_bytes = available_kib * 1024
            apk_size = apk_path.stat().st_size if apk_path.exists() else 0
            if apk_size and available_bytes < apk_size * 3:
                add(
                    checks,
                    "WARN",
                    "Android 저장공간",
                    f"여유 {mib(available_bytes)}, APK {mib(apk_size)}. 재설치 실패 시 --skip-install 또는 AVD 저장공간 정리가 필요합니다",
                )
            else:
                add(checks, "OK", "Android 저장공간", f"여유 {mib(available_bytes)}")

        install = run_command(adb_command(adb, serial, "install", "-r", str(apk_path)), args.timeout)
        install_output = install.output
        if install.ok and "Success" in install_output:
            add(checks, "OK", "APK 설치", "Success")
        else:
            guidance = ""
            if "INSTALL_FAILED_INSUFFICIENT_STORAGE" in install_output:
                guidance = " 에뮬레이터 저장공간을 정리하거나 이미 설치된 앱은 --skip-install로 실행 확인하세요."
            add(checks, "FAIL", "APK 설치", (install_output or "adb install 실패") + guidance)

    package_check = run_command(adb_command(adb, serial, "shell", "pm", "path", args.package), args.timeout)
    if package_check.ok and args.package in package_check.output:
        add(checks, "OK", "패키지 설치 확인", package_check.output.splitlines()[0])
    else:
        add(checks, "FAIL", "패키지 설치 확인", package_check.output or f"{args.package}를 찾지 못했습니다")

    crash_clear = run_command(adb_command(adb, serial, "logcat", "-b", "crash", "-c"), args.timeout)
    if not crash_clear.ok:
        add(checks, "WARN", "크래시 로그 초기화", crash_clear.output or "crash buffer 초기화 실패")

    launch = run_command(
        adb_command(
            adb,
            serial,
            "shell",
            "monkey",
            "-p",
            args.package,
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
        ),
        args.timeout,
    )
    if launch.ok and ("Events injected: 1" in launch.output or "Monkey finished" in launch.output):
        add(checks, "OK", "앱 실행 요청", "launcher intent 전달")
    else:
        add(checks, "FAIL", "앱 실행 요청", launch.output or "monkey launch 실패")

    time.sleep(5)

    pid = run_command(adb_command(adb, serial, "shell", "pidof", args.package), args.timeout)
    if pid.ok and pid.output.strip():
        add(checks, "OK", "앱 프로세스", pid.output.strip())
    else:
        add(checks, "WARN", "앱 프로세스", "pidof 결과가 없습니다. 화면에서 앱 실행 상태를 확인하세요")

    activity = run_command(adb_command(adb, serial, "shell", "dumpsys", "activity", "top"), args.timeout)
    if args.package in activity.output:
        add(checks, "OK", "현재 화면 패키지", args.package)
    else:
        add(checks, "WARN", "현재 화면 패키지", "dumpsys activity top에서 패키지를 찾지 못했습니다")

    crash = run_command(adb_command(adb, serial, "logcat", "-b", "crash", "-d", "-t", "200"), args.timeout)
    if crash.ok and args.package in crash.output and "FATAL EXCEPTION" in crash.output:
        first_line = next(
            (line.strip() for line in crash.output.splitlines() if "FATAL EXCEPTION" in line or "MissingLibraryException" in line),
            "앱 실행 직후 크래시가 감지됐습니다",
        )
        add(checks, "FAIL", "앱 크래시 확인", first_line)
    elif crash.ok:
        add(checks, "OK", "앱 크래시 확인", "실행 직후 crash buffer에 앱 크래시 없음")
    else:
        add(checks, "WARN", "앱 크래시 확인", crash.output or "crash buffer 확인 실패")

    process_state = run_command(adb_command(adb, serial, "shell", "dumpsys", "activity", "processes"), args.timeout)
    if args.package in process_state.output and "mCrashing=true" in process_state.output:
        add(checks, "FAIL", "프로세스 크래시 상태", "ActivityManager가 앱을 crashing 상태로 보고합니다")
    elif process_state.ok:
        add(checks, "OK", "프로세스 크래시 상태", "crashing 상태 아님")
    else:
        add(checks, "WARN", "프로세스 크래시 상태", process_state.output or "프로세스 상태 확인 실패")

    print("NowNote Android install/launch check")
    print_checks(checks)

    failures = [check for check in checks if check.failed]
    if failures:
        print()
        print(f"Android 설치/실행 점검 실패: {len(failures)}개")
        raise SystemExit(1)

    print()
    print("Android 설치/실행 점검을 통과했습니다.")


if __name__ == "__main__":
    main()
