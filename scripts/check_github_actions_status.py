from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_REPOSITORY = "cyhuh428-sinsan/Now"
DEFAULT_WORKFLOW = "preflight.yml"
DEFAULT_BRANCH = "main"
API_BASE_URL = "https://api.github.com"


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(errors="replace")


def request_json(url: str, token: str | None, timeout: int) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "NowNote-release-check",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code == 404:
            raise SystemExit(
                "GitHub API HTTP 404: workflow run을 조회할 수 없습니다.\n"
                "- 저장소에서 GitHub Actions가 아직 활성화되지 않았거나,\n"
                "- workflow 파일명이 다르거나 아직 한 번도 실행되지 않았거나,\n"
                "- 비공개 저장소인데 GITHUB_TOKEN 권한이 부족할 수 있습니다.\n"
                "GitHub Actions 화면에서 `NowNote Preflight`를 수동 실행한 뒤 다시 확인하세요."
            ) from exc
        raise SystemExit(f"GitHub API HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"GitHub API 연결 실패: {exc.reason}") from exc


def workflow_runs_url(repository: str, workflow: str, branch: str, per_page: int) -> str:
    workflow_part = urllib.parse.quote(workflow, safe="")
    query = urllib.parse.urlencode({"branch": branch, "per_page": per_page})
    return f"{API_BASE_URL}/repos/{repository}/actions/workflows/{workflow_part}/runs?{query}"


def run_label(run: dict) -> str:
    number = run.get("run_number", "-")
    status = run.get("status", "-")
    conclusion = run.get("conclusion") or "-"
    head_sha = str(run.get("head_sha") or "")[:7]
    html_url = run.get("html_url") or "-"
    return f"#{number} {status}/{conclusion} {head_sha} {html_url}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Check NowNote GitHub Actions preflight status")
    parser.add_argument("--repo", default=DEFAULT_REPOSITORY, help="GitHub repository in owner/name form")
    parser.add_argument("--workflow", default=DEFAULT_WORKFLOW, help="Workflow file name or workflow id")
    parser.add_argument("--branch", default=DEFAULT_BRANCH, help="Branch to inspect")
    parser.add_argument("--commit", help="Optional full commit SHA to match")
    parser.add_argument("--token-env", default="GITHUB_TOKEN", help="Environment variable name for a GitHub token")
    parser.add_argument("--per-page", type=int, default=10, help="Number of recent workflow runs to inspect")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout seconds")
    args = parser.parse_args()

    token = os.environ.get(args.token_env) or None
    data = request_json(workflow_runs_url(args.repo, args.workflow, args.branch, args.per_page), token, args.timeout)
    runs = data.get("workflow_runs") or []

    if args.commit:
        runs = [run for run in runs if str(run.get("head_sha") or "").lower() == args.commit.lower()]

    print("NowNote GitHub Actions status check")
    print(f"- repository: {args.repo}")
    print(f"- workflow: {args.workflow}")
    print(f"- branch: {args.branch}")
    if args.commit:
        print(f"- commit: {args.commit}")

    if not runs:
        print("확인 가능한 workflow run이 없습니다.")
        print("저장소가 비공개이면 GITHUB_TOKEN 환경변수를 설정하거나 GitHub Actions 화면에서 수동 실행하세요.")
        raise SystemExit(1)

    latest = runs[0]
    print(f"- latest: {run_label(latest)}")

    if latest.get("status") == "completed" and latest.get("conclusion") == "success":
        print("GitHub Actions preflight가 통과했습니다.")
        return

    print("GitHub Actions preflight가 아직 통과 상태가 아닙니다.")
    print("최근 실행:")
    for run in runs[:5]:
        print(f"- {run_label(run)}")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
