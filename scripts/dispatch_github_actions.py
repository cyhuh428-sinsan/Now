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
DEFAULT_REF = "main"
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


def github_actions_url(repository: str) -> str:
    return f"https://github.com/{repository}/actions"


def github_workflow_url(repository: str, workflow: str) -> str:
    workflow_part = urllib.parse.quote(workflow, safe="")
    return f"https://github.com/{repository}/actions/workflows/{workflow_part}"


def workflow_dispatch_url(repository: str, workflow: str) -> str:
    workflow_part = urllib.parse.quote(workflow, safe="")
    return f"{API_BASE_URL}/repos/{repository}/actions/workflows/{workflow_part}/dispatches"


def request_dispatch(url: str, token: str, ref: str, timeout: int) -> int:
    body = json.dumps({"ref": ref}).encode("utf-8")
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "NowNote-actions-dispatch",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response.read()
            return response.status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise GitHubApiError(exc.code, detail) from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"GitHub API 연결 실패: {exc.reason}") from exc


def print_api_error_guidance(exc: GitHubApiError, repository: str, workflow: str, ref: str) -> None:
    if exc.code in {401, 403}:
        print(f"GitHub API HTTP {exc.code}: GitHub 토큰 권한을 확인해야 합니다.")
        print("- `GITHUB_TOKEN` 또는 `GH_TOKEN`에 workflow/actions 쓰기 권한이 필요합니다.")
        print("- fine-grained token이라면 Actions: Read and write 권한을 확인하세요.")
        return
    if exc.code == 404:
        print("GitHub API HTTP 404: workflow dispatch 대상을 찾을 수 없습니다.")
        print("- 저장소 이름, workflow 파일명, 비공개 저장소 접근 권한을 확인하세요.")
        print(f"- Actions 화면: {github_actions_url(repository)}")
        print(f"- 워크플로우 화면: {github_workflow_url(repository, workflow)}")
        return
    if exc.code == 422:
        print("GitHub API HTTP 422: workflow dispatch 요청이 거절됐습니다.")
        print(f"- 브랜치 또는 ref가 존재하는지 확인하세요: {ref}")
        print("- workflow 파일에 `workflow_dispatch:`가 있는지 확인하세요.")
        return
    print(f"GitHub API HTTP {exc.code}: {exc.detail}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dispatch NowNote GitHub Actions preflight workflow")
    parser.add_argument("--repo", default=DEFAULT_REPOSITORY, help="GitHub repository in owner/name form")
    parser.add_argument("--workflow", default=DEFAULT_WORKFLOW, help="Workflow file name or workflow id")
    parser.add_argument("--ref", default=DEFAULT_REF, help="Branch, tag, or commit ref to run")
    parser.add_argument("--token-env", default="GITHUB_TOKEN", help="Environment variable name for a GitHub token")
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout seconds")
    parser.add_argument("--dry-run", action="store_true", help="Print the request target without calling GitHub")
    args = parser.parse_args()

    token, token_source = read_token(args.token_env)
    dispatch_url = workflow_dispatch_url(args.repo, args.workflow)

    print("NowNote GitHub Actions dispatch")
    print(f"- repository: {args.repo}")
    print(f"- workflow: {args.workflow}")
    print(f"- ref: {args.ref}")
    print(f"- token: {token_source or '없음'}")
    print(f"- actions: {github_actions_url(args.repo)}")
    print(f"- workflow page: {github_workflow_url(args.repo, args.workflow)}")

    if args.dry_run:
        print(f"- dispatch API: {dispatch_url}")
        print("dry-run: GitHub API 요청은 보내지 않았습니다.")
        return

    if not token:
        print("GitHub Actions 실행 요청을 보내려면 `GITHUB_TOKEN` 또는 `GH_TOKEN`이 필요합니다.")
        print("- 토큰에는 workflow/actions 쓰기 권한이 있어야 합니다.")
        print("- 토큰 없이 진행하려면 GitHub Actions 화면에서 `NowNote Preflight`를 수동 실행하세요.")
        raise SystemExit(1)

    try:
        status = request_dispatch(dispatch_url, token, args.ref, args.timeout)
    except GitHubApiError as exc:
        print_api_error_guidance(exc, args.repo, args.workflow, args.ref)
        raise SystemExit(1) from exc

    if status != 204:
        print(f"예상하지 못한 응답 상태입니다: HTTP {status}")
        raise SystemExit(1)

    print("GitHub Actions preflight 실행 요청을 보냈습니다.")
    print("잠시 뒤 상태 확인:")
    print(
        "python3 scripts/check_github_actions_status.py "
        f"--repo {args.repo} --workflow {args.workflow} --branch {args.ref}"
    )


if __name__ == "__main__":
    main()
