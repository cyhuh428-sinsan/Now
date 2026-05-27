from __future__ import annotations

import argparse
import json
import re
import shlex
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_CAPABILITIES = {
    "sync",
    "recordings",
    "analysis_jobs",
    "admin_ops",
    "backup_export",
    "backup_verify",
    "user_accounts",
    "user_profile",
    "user_timezone",
    "user_groups",
    "user_access_tokens",
    "two_factor_status",
}

DOCKER_VERSION_RE = re.compile(r"\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9_.-]+)?\b")


@dataclass
class CheckResult:
    name: str
    status: str
    message: str


def run_command(command: list[str], cwd: Path | None = None, timeout: int = 15) -> tuple[int, str]:
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError:
        return 127, "command not found"
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    stdout = decode_command_output(result.stdout).strip()
    stderr = decode_command_output(result.stderr).strip()
    output = "\n".join(part for part in [stdout, stderr] if part)
    output = output.replace("\x00", "")
    return result.returncode, output


def decode_command_output(data: bytes | str | None) -> str:
    if data is None:
        return ""
    if isinstance(data, str):
        return data
    if not data:
        return ""

    candidates = ["utf-8", sys.getfilesystemencoding(), "cp949"]
    if b"\x00" in data[:80]:
        candidates = ["utf-16", "utf-16-le", *candidates]

    for encoding in dict.fromkeys(candidates):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def windows_path_to_wsl(path: Path) -> str | None:
    resolved = str(path.resolve())
    if len(resolved) < 3 or resolved[1:3] != ":\\":
        return None
    drive = resolved[0].lower()
    rest = resolved[3:].replace("\\", "/")
    return f"/mnt/{drive}/{rest}"


def check_git() -> CheckResult:
    code, output = run_command(["git", "status", "--short"], ROOT)
    if code != 0:
        return CheckResult("Git 작업트리", "warn", output or "git status 실행 실패")
    if output.strip():
        return CheckResult("Git 작업트리", "warn", "커밋되지 않은 변경이 있습니다")
    return CheckResult("Git 작업트리", "ok", "깨끗함")


def check_wsl() -> CheckResult:
    if not shutil.which("wsl.exe"):
        return CheckResult("WSL", "bad", "wsl.exe를 찾을 수 없습니다")
    code, output = run_command(["wsl.exe", "-l", "-q"], timeout=15)
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    if code != 0 or not lines:
        return CheckResult("WSL", "warn", "사용 가능한 WSL 배포판을 확인하지 못했습니다")
    exec_code, exec_output = run_command(["wsl.exe", "-e", "sh", "-lc", "echo WSL_EXEC_OK"], timeout=15)
    if exec_code != 0 or "WSL_EXEC_OK" not in exec_output:
        return CheckResult(
            "WSL",
            "warn",
            f"배포판 목록은 보이지만 실행 확인 실패: {', '.join(lines)}",
        )
    wsl_root = windows_path_to_wsl(ROOT)
    if wsl_root:
        path_code, _ = run_command(["wsl.exe", "-e", "sh", "-lc", f"test -d {shlex.quote(wsl_root)}"], timeout=15)
        if path_code != 0:
            return CheckResult(
                "WSL",
                "warn",
                f"shell 실행 가능, 다만 현재 작업 경로를 WSL에서 확인하지 못함: {wsl_root}",
            )
    return CheckResult("WSL", "ok", ", ".join(lines))


def check_docker() -> CheckResult:
    docker = shutil.which("docker")
    if docker:
        code, output = run_command([docker, "version", "--format", "{{.Server.Version}}"], timeout=20)
        if code == 0:
            return CheckResult("Docker", "ok", f"Windows Docker Server {output.strip()}")
        windows_message = output or "Windows Docker 서버에 연결하지 못했습니다"
    else:
        windows_message = "Windows docker 명령을 찾을 수 없습니다"

    if shutil.which("wsl.exe"):
        code, output = run_command(
            [
                "wsl.exe",
                "-e",
                "sh",
                "-lc",
                "docker version --format '{{.Server.Version}}' 2>/dev/null || docker-compose --version 2>/dev/null",
            ],
            timeout=20,
        )
        docker_seen = DOCKER_VERSION_RE.search(output) or "Docker Compose version" in output
        wsl_warning = "wsl:" in output.lower() or "failed to translate" in output.lower()
        if code == 0 and output.strip() and docker_seen and not wsl_warning:
            return CheckResult("Docker", "ok", f"WSL Docker 확인: {output.strip()}")
        if code == 0 and output.strip() and docker_seen:
            return CheckResult("Docker", "warn", f"WSL Docker는 보이지만 WSL 경고가 있습니다: {output.strip()}")

    return CheckResult("Docker", "warn", windows_message)


def request_json(url: str, timeout: float) -> tuple[int, dict | None, str | None]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            text = res.read().decode("utf-8")
            return res.status, json.loads(text) if text else None, None
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        return exc.code, None, text
    except urllib.error.URLError as exc:
        return 0, None, str(exc)
    except TimeoutError:
        return 0, None, "timeout"


def check_server(base_url: str, timeout: float) -> list[CheckResult]:
    results: list[CheckResult] = []
    health_status, health_data, health_error = request_json(f"{base_url}/health", timeout)
    if health_status == 200:
        results.append(CheckResult("서버 health", "ok", json.dumps(health_data, ensure_ascii=False)))
    else:
        results.append(CheckResult("서버 health", "bad", health_error or f"HTTP {health_status}"))
        return results

    ready_status, ready_data, ready_error = request_json(f"{base_url}/health/ready", timeout)
    if ready_status == 200:
        results.append(CheckResult("서버 ready", "ok", json.dumps(ready_data, ensure_ascii=False)))
    else:
        results.append(CheckResult("서버 ready", "bad", ready_error or f"HTTP {ready_status}"))

    info_status, info_data, info_error = request_json(f"{base_url}/api/v1/server", timeout)
    if info_status != 200 or not isinstance(info_data, dict):
        results.append(CheckResult("서버 capability", "bad", info_error or f"HTTP {info_status}"))
        return results

    capabilities = info_data.get("capabilities")
    if not isinstance(capabilities, dict):
        results.append(CheckResult("서버 capability", "bad", "capabilities 응답이 없습니다"))
        return results

    missing = sorted(EXPECTED_CAPABILITIES - set(capabilities))
    if "public_server_readiness" not in info_data:
        missing.append("public_server_readiness")
    if missing:
        results.append(
            CheckResult(
                "서버 capability",
                "warn",
                "현재 실행 중인 서버가 오래된 배포본일 수 있습니다. 누락: " + ", ".join(missing),
            )
        )
    else:
        results.append(CheckResult("서버 capability", "ok", "최신 capability 확인"))
    return results


def print_results(results: list[CheckResult]) -> None:
    for result in results:
        print(f"[{result.status.upper()}] {result.name}: {result.message}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Check local NowNote development/deploy environment")
    parser.add_argument("--base-url", default="http://localhost:8750")
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    results = [check_git(), check_wsl(), check_docker()]
    results.extend(check_server(args.base_url.rstrip("/"), args.timeout))
    print_results(results)

    if args.strict and any(result.status != "ok" for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
