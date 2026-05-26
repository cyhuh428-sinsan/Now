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


class GitHubApiError(Exception):
    def __init__(self, code: int, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(f"GitHub API HTTP {code}: {detail}")


def read_token(primary_env: str) -> tuple[str | None, str | None]:
    for env_name in dict.fromkeys([primary_env, "GITHUB_TOKEN", "GH_TOKEN"]):
        token = os.environ.get(env_name)
        if token:
            return token, env_name
    return None, None


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
        raise GitHubApiError(exc.code, detail) from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"GitHub API 연결 실패: {exc.reason}") from exc


def github_actions_url(repository: str) -> str:
    return f"https://github.com/{repository}/actions"


def github_workflow_url(repository: str, workflow: str) -> str:
    workflow_part = urllib.parse.quote(workflow, safe="")
    return f"https://github.com/{repository}/actions/workflows/{workflow_part}"


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


def print_header(repository: str, workflow: str, branch: str, commit: str | None, token_source: str | None) -> None:
    print("NowNote GitHub Actions status check")
    print(f"- repository: {repository}")
    print(f"- workflow: {workflow}")
    print(f"- branch: {branch}")
    if commit:
        print(f"- commit: {commit}")
    print(f"- token: {token_source or '없음'}")
    print(f"- actions: {github_actions_url(repository)}")
    print(f"- workflow page: {github_workflow_url(repository, workflow)}")


def print_api_error_guidance(exc: GitHubApiError, repository: str, workflow: str) -> None:
    if exc.code == 404:
        print("GitHub API HTTP 404: workflow run을 조회할 수 없습니다.")
        print("- 저장소에서 GitHub Actions가 아직 활성화되지 않았을 수 있습니다.")
        print("- `NowNote Preflight` 워크플로우가 아직 한 번도 실행되지 않았을 수 있습니다.")
        print("- 비공개 저장소라면 Actions 읽기 권한이 있는 `GITHUB_TOKEN` 또는 `GH_TOKEN`이 필요합니다.")
        print(f"- Actions 화면: {github_actions_url(repository)}")
        print(f"- 워크플로우 화면: {github_workflow_url(repository, workflow)}")
        print("GitHub Actions 화면에서 `NowNote Preflight`를 수동 실행한 뒤 다시 확인하세요.")
        return
    if exc.code in {401, 403}:
        print(f"GitHub API HTTP {exc.code}: GitHub 토큰 권한을 확인해야 합니다.")
        print("- `GITHUB_TOKEN` 또는 `GH_TOKEN`에 저장소 Actions 읽기 권한이 있는지 확인하세요.")
        print("- 조직/개인 저장소 정책에서 Actions API 접근이 막혀 있지 않은지 확인하세요.")
        return
    print(f"GitHub API HTTP {exc.code}: {exc.detail}")


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

    token, token_source = read_token(args.token_env)
    print_header(args.repo, args.workflow, args.branch, args.commit, token_source)

    try:
        data = request_json(workflow_runs_url(args.repo, args.workflow, args.branch, args.per_page), token, args.timeout)
    except GitHubApiError as exc:
        print_api_error_guidance(exc, args.repo, args.workflow)
        raise SystemExit(1) from exc

    runs = data.get("workflow_runs") or []

    if args.commit:
        runs = [run for run in runs if str(run.get("head_sha") or "").lower() == args.commit.lower()]

    if not runs:
        print("확인 가능한 workflow run이 없습니다.")
        print("저장소가 비공개이면 `GITHUB_TOKEN` 또는 `GH_TOKEN`을 설정하거나 GitHub Actions 화면에서 수동 실행하세요.")
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
