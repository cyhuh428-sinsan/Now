from __future__ import annotations

import argparse
import json
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
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError:
        return 127, "command not found"
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    output = output.replace("\x00", "")
    return result.returncode, output


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
    return CheckResult("WSL", "ok", ", ".join(lines))


def check_docker() -> CheckResult:
    docker = shutil.which("docker")
    if not docker:
        return CheckResult("Docker", "warn", "docker 명령을 찾을 수 없습니다")
    code, output = run_command([docker, "version", "--format", "{{.Server.Version}}"], timeout=20)
    if code != 0:
        return CheckResult("Docker", "warn", output or "Docker 서버에 연결하지 못했습니다")
    return CheckResult("Docker", "ok", f"Server {output.strip()}")


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
