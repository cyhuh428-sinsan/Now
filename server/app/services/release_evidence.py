from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.services.release_readiness import release_readiness_summary


@dataclass(frozen=True)
class EvidenceGuide:
    evidence: tuple[str, ...]
    action: str
    reference: tuple[str, ...]


DEFAULT_GUIDES = {
    "실제 Android 기기/모바일 화면": EvidenceGuide(
        evidence=(
            "USB 디버깅 실기기에서 실행 점검 스크립트 통과 결과",
            "해당 화면에서 저장, 재조회, 업로드가 성공한 실제 앱 화면 확인",
        ),
        action="/admin/mobile 순서대로 실기기 점검을 진행하고 결과를 작업 기록에 남깁니다.",
        reference=("/admin/mobile", "now_app/docs/mobile_runtime_checklist_ko.md"),
    ),
    "공용 서버 운영 결정": EvidenceGuide(
        evidence=(
            "실제 HTTPS 도메인으로 접속되는 서버 URL",
            "공용 서버 .env 운영값 적용 결과",
            "public-server preflight와 사용자별 데이터 격리 smoke test 통과 결과",
        ),
        action="/admin/public과 server/PUBLIC_SERVER.md 기준으로 도메인, HTTPS, 토큰 필수 모드를 확인합니다.",
        reference=("/admin/public", "server/PUBLIC_SERVER.md", "server/DEPLOY.md"),
    ),
    "Google Play Console": EvidenceGuide(
        evidence=(
            "Play Console 입력값 최종 화면 또는 저장 완료 상태",
            "Data safety, 권한 설명, 스크린샷, 내부 테스트 업로드 확인",
        ),
        action="/admin/play의 수동 확인 항목을 Play Console에서 하나씩 대조합니다.",
        reference=("/admin/play", "now_app/docs/google_play_release_checklist.md"),
    ),
    "GitHub Actions": EvidenceGuide(
        evidence=(
            "NowNote Preflight workflow run URL",
            "scripts/check_github_actions_status.py 통과 출력",
        ),
        action="GitHub Actions 화면에서 수동 실행하거나 토큰 환경에서 dispatch 스크립트로 실행 요청합니다.",
        reference=(
            "https://github.com/cyhuh428-sinsan/Now/actions/workflows/preflight.yml",
            "scripts/dispatch_github_actions.py",
            "scripts/check_github_actions_status.py",
        ),
    ),
    "오픈소스 라이선스 결정": EvidenceGuide(
        evidence=(
            "신산님이 확정한 라이선스 이름",
            "루트 LICENSE 파일 추가 결과",
            "README와 공개 준비 문서의 라이선스 항목 갱신 결과",
        ),
        action="docs/LICENSE_DECISION.md 기준으로 라이선스를 확정한 뒤 LICENSE 파일을 추가합니다.",
        reference=("/admin/open-source", "docs/LICENSE_DECISION.md"),
    ),
    "기타": EvidenceGuide(
        evidence=("해당 체크리스트 항목의 실제 완료 조건을 증명하는 화면 또는 명령 결과",),
        action="증빙을 확인한 뒤 docs/PHASE1_RELEASE_CHECKLIST.md를 갱신합니다.",
        reference=("docs/PHASE1_RELEASE_CHECKLIST.md",),
    ),
}


ITEM_GUIDES = {
    "실제 Android 기기에서 앱 실행.": EvidenceGuide(
        evidence=(
            "now_app/scripts/check_android_runtime.py --require-physical 통과 결과",
            "now_app/scripts/check_android_launch.py --require-physical 통과 결과",
            "실기기 모델명과 실행 시각",
        ),
        action="USB 디버깅 실기기를 연결한 뒤 런타임 점검과 앱 실행 점검을 순서대로 실행합니다.",
        reference=("/admin/mobile", "now_app/scripts/check_android_runtime.py", "now_app/scripts/check_android_launch.py"),
    ),
    "음성 메모 실시간 변환 확인.": EvidenceGuide(
        evidence=(
            "실시간 음성 입력으로 텍스트가 생성된 앱 화면",
            "저장 후 같은 메모를 다시 열어 내용이 유지된 화면",
        ),
        action="간단 메모와 계층 메모 중 하나에서 실시간 변환을 켜고 저장, 재조회까지 확인합니다.",
        reference=("/admin/mobile",),
    ),
    "음성 녹음 후 변환 흐름 확인.": EvidenceGuide(
        evidence=(
            "녹음 완료 후 텍스트 변환 결과 화면",
            "녹음 파일과 변환 텍스트가 함께 남은 상태",
        ),
        action="녹음 후 변환 모드로 메모를 저장하고 녹음 파일, 텍스트 보존 상태를 확인합니다.",
        reference=("/admin/mobile",),
    ),
    "녹음 업로드 상태 확인.": EvidenceGuide(
        evidence=(
            "/admin/recordings에서 해당 owner/device 녹음 행이 보이는 화면",
            "녹음 export API에서 transcript 또는 파일 메타데이터가 조회된 결과",
        ),
        action="서버 연결 상태에서 녹음 메모를 저장한 뒤 /admin/recordings와 export API로 업로드를 확인합니다.",
        reference=("/admin/recordings", "/api/v1/admin/export/recordings"),
    ),
    "실제 기기 설치 테스트.": EvidenceGuide(
        evidence=(
            "내부 테스트 또는 sideload 설치 완료 화면",
            "설치 후 첫 실행과 권한 요청 흐름 확인",
        ),
        action="릴리스 AAB/APK를 실제 기기에 설치하고 앱 실행, 권한 요청, 기본 메모 진입을 확인합니다.",
        reference=("/admin/mobile", "/admin/play"),
    ),
    "실제 공개 도메인 확정.": EvidenceGuide(
        evidence=(
            "운영에 사용할 최종 도메인 이름",
            "DNS가 실제 서버 공인 IP 또는 reverse proxy 진입점으로 연결된 확인 결과",
        ),
        action="공용 서버로 사용할 도메인을 확정하고 DNS 전파 상태를 확인합니다.",
        reference=("server/PUBLIC_SERVER.md", "/admin/public"),
    ),
    "`NOW_PUBLIC_BASE_URL=https://도메인` 설정.": EvidenceGuide(
        evidence=(
            "server/.env의 NOW_PUBLIC_BASE_URL 값이 https:// 실제 도메인인 상태",
            "/api/v1/server의 public_server_readiness에서 공개 URL 항목이 해소된 결과",
        ),
        action="공용 서버 .env에 HTTPS 공개 주소를 반영하고 서버를 재기동합니다.",
        reference=("server/.env", "server/PUBLIC_SERVER.md", "/api/v1/server"),
    ),
    "reverse proxy 적용.": EvidenceGuide(
        evidence=(
            "Nginx 또는 Caddy 설정 파일의 실제 도메인 반영 결과",
            "외부 브라우저에서 https://도메인/admin 접속 성공 화면",
        ),
        action="reverse proxy 예시 파일을 실제 도메인과 인증서 경로에 맞춰 적용합니다.",
        reference=("server/reverse_proxy/nginx.nownote.conf.example", "server/reverse_proxy/Caddyfile.example"),
    ),
    "`NOW_BEHIND_REVERSE_PROXY=true` 설정.": EvidenceGuide(
        evidence=(
            "server/.env의 NOW_BEHIND_REVERSE_PROXY=true 설정",
            "HTTPS reverse proxy 뒤에서 /health/ready와 /api/v1/server가 정상 응답한 결과",
        ),
        action="reverse proxy 적용 후 서버 환경값을 true로 바꾸고 public-server preflight를 다시 실행합니다.",
        reference=("server/.env", "server/scripts/preflight.py"),
    ),
    "사용자별 접속 토큰 발급.": EvidenceGuide(
        evidence=(
            "/admin/users에서 공용 서버 사용자 계정 생성 또는 확인",
            "사용자별 접속 토큰 발급 완료 화면 또는 token_issued 집계",
        ),
        action="/admin/users에서 사용자별 접속 토큰을 발급하고 토큰 원문을 사용자에게 안전하게 전달합니다.",
        reference=("/admin/users", "/auth/token", "docs/SERVER_AUTH_POLICY.md"),
    ),
    "`NOW_USER_TOKEN_REQUIRED=true` 설정.": EvidenceGuide(
        evidence=(
            "server/.env의 NOW_USER_TOKEN_REQUIRED=true 설정",
            "사용자 토큰 없는 데이터 API 요청이 차단되는 smoke test 결과",
        ),
        action="공용 서버 오픈 전 사용자별 접속 토큰 필수 모드를 켜고 smoke test를 실행합니다.",
        reference=("server/.env", "server/scripts/smoke_test.py", "/admin/public"),
    ),
    "공용 서버 기준 `python3 scripts/preflight.py --public-server` 통과.": EvidenceGuide(
        evidence=(
            "python3 scripts/preflight.py --public-server 통과 출력",
            "NOW_PUBLIC_BASE_URL, NOW_BEHIND_REVERSE_PROXY, NOW_USER_TOKEN_REQUIRED 운영값 적용 확인",
        ),
        action="공용 서버 .env 적용 후 public-server preflight를 실행합니다.",
        reference=("server/PUBLIC_SERVER.md", "server/scripts/preflight.py"),
    ),
    "사용자별 데이터 격리 smoke test 통과.": EvidenceGuide(
        evidence=(
            "smoke_test.py --issue-local-user-token 또는 --user-token 통과 출력",
            "다른 사용자 토큰으로 데이터 접근이 차단된 검증 결과",
        ),
        action="사용자별 토큰 필수 모드에서 smoke test를 실행합니다.",
        reference=("server/scripts/smoke_test.py", "/admin/public"),
    ),
    "개인정보처리방침 URL 확정.": EvidenceGuide(
        evidence=(
            "공개 접근 가능한 개인정보처리방침 URL",
            "Play Console 앱 콘텐츠 또는 스토어 설정에 URL 저장 완료 화면",
        ),
        action="개인정보처리방침 초안을 실제 공개 URL에 올리고 Play Console 값과 대조합니다.",
        reference=("now_app/docs/privacy_policy_draft_ko.md", "now_app/docs/nownote_site/index.html", "/admin/play"),
    ),
    "Play Console 앱 설명 문구 최종 확인.": EvidenceGuide(
        evidence=(
            "Play Console 기본 스토어 등록정보의 최종 앱 설명 저장 화면",
            "now_app/docs/google_play_paste_ready_ko.md 문구와의 대조 결과",
        ),
        action="/admin/play 문서 초안을 기준으로 Play Console 설명 문구를 최종 저장합니다.",
        reference=("/admin/play", "now_app/docs/google_play_paste_ready_ko.md"),
    ),
    "권한 사용 설명 최종 확인.": EvidenceGuide(
        evidence=(
            "마이크, 알림, 이미지/카메라, Health Connect 권한 설명 입력 완료 화면",
            "권한 설명이 현재 1차 기능 범위와 맞는지 확인한 결과",
        ),
        action="Play Console 권한 설명을 현재 앱 기능과 대조하고 오래된 사진 첨부 표현이 없는지 확인합니다.",
        reference=("now_app/docs/google_play_step_by_step_ko.md", "now_app/android/app/src/main/AndroidManifest.xml"),
    ),
    "Data safety 답변 최종 확인.": EvidenceGuide(
        evidence=(
            "Play Console Data safety 저장 완료 화면",
            "선택 서버 동기화, 음성/텍스트 저장, Android 백업 제외 정책 반영 확인",
        ),
        action="Data safety 답변을 개인정보처리방침과 권한 설명 문서 기준으로 최종 확정합니다.",
        reference=("/admin/play", "now_app/docs/google_play_release_checklist.md"),
    ),
    "스크린샷과 기능 그래픽 최종 확인.": EvidenceGuide(
        evidence=(
            "Play Console에 업로드한 스크린샷과 기능 그래픽 화면",
            "scripts/play_release_status.py의 이미지 크기 자동 확인 통과 결과",
        ),
        action="자동 확인된 이미지 초안을 Play Console에 업로드하고 실제 노출 순서를 확인합니다.",
        reference=("now_app/docs/play_assets", "scripts/play_release_status.py", "/admin/play"),
    ),
    "내부 테스트 트랙 업로드.": EvidenceGuide(
        evidence=(
            "Play Console 내부 테스트 트랙에 AAB 업로드 완료 화면",
            "테스터 배포 또는 검토 가능 상태",
        ),
        action="서명된 AAB를 내부 테스트 트랙에 업로드하고 출시 노트를 저장합니다.",
        reference=("now_app/build/app/outputs/bundle/release", "now_app/docs/google_play_release_checklist.md"),
    ),
    "GitHub Actions preflight 통과 확인.": EvidenceGuide(
        evidence=(
            "GitHub Actions의 NowNote Preflight 성공 run URL",
            "scripts/check_github_actions_status.py 성공 출력",
        ),
        action="workflow_dispatch 또는 GitHub 화면으로 NowNote Preflight를 실행하고 상태 확인 스크립트로 재확인합니다.",
        reference=("scripts/dispatch_github_actions.py", "scripts/check_github_actions_status.py"),
    ),
    "오픈소스 라이선스 선택.": EvidenceGuide(
        evidence=("신산님이 확정한 라이선스 이름과 선택 사유",),
        action="MIT, Apache 2.0, AGPLv3 후보 중 하나를 결정합니다.",
        reference=("docs/LICENSE_DECISION.md",),
    ),
    "선택한 라이선스 파일 추가.": EvidenceGuide(
        evidence=("루트 LICENSE 파일 존재와 README 라이선스 항목 반영",),
        action="확정된 라이선스 원문을 루트 LICENSE 파일로 추가합니다.",
        reference=("LICENSE", "README.md", "docs/OPEN_SOURCE_RELEASE.md"),
    ),
}


def release_evidence_summary() -> dict:
    readiness = release_readiness_summary()
    evidence_items = []
    for blocker in readiness.get("blockers", []):
        group_name = blocker.get("name", "기타")
        for item in blocker.get("items", []):
            label = item.get("label", "")
            guide = ITEM_GUIDES.get(label, DEFAULT_GUIDES.get(group_name, DEFAULT_GUIDES["기타"]))
            evidence_items.append(
                {
                    "group": group_name,
                    "section": item.get("section", "기타"),
                    "label": label,
                    "evidence": list(guide.evidence),
                    "action": guide.action,
                    "reference": list(guide.reference),
                }
            )

    groups: list[dict] = []
    for group_name in dict.fromkeys(item["group"] for item in evidence_items):
        group_items = [item for item in evidence_items if item["group"] == group_name]
        groups.append(
            {
                "name": group_name,
                "count": len(group_items),
                "items": group_items,
            }
        )

    return {
        "name": "phase_one_manual_evidence",
        "checked_at": datetime.utcnow(),
        "status": "ready" if not evidence_items else "manual",
        "source": readiness.get("source"),
        "summary": {
            "remaining": len(evidence_items),
            "groups": len(groups),
        },
        "groups": groups,
        "items": evidence_items,
    }


def release_evidence_template() -> dict:
    evidence = release_evidence_summary()
    lines = [
        "# NowNote 1차 수동 증빙 기록",
        "",
        f"- 기준 시각: {evidence['checked_at'].isoformat()}Z",
        f"- 상태: {evidence['status']}",
        f"- 남은 증빙 항목: {evidence['summary']['remaining']}",
        f"- 증빙 유형: {evidence['summary']['groups']}",
        "",
        "## 기록 방법",
        "",
        "- 완료 처리는 실제 화면, URL, 명령 결과, 설치 결과처럼 다시 확인 가능한 증빙이 있을 때만 합니다.",
        "- 외부 서비스나 실제 기기 확인이 필요한 항목은 추측으로 완료 처리하지 않습니다.",
        "- 증빙 위치에는 화면 경로, 파일 경로, URL, 실행 결과 위치를 적습니다.",
        "",
    ]
    if not evidence["groups"]:
        lines.extend(
            [
                "## 남은 항목 없음",
                "",
                "- 확인일:",
                "- 확인자:",
                "- 결과: 완료",
                "- 증빙 위치:",
                "- 메모:",
            ]
        )
    for group in evidence["groups"]:
        lines.extend(["", f"## {group['name']} ({group['count']}건)", ""])
        for item in group["items"]:
            lines.extend(
                [
                    f"### {item['label']}",
                    "",
                    f"- 영역: {item['section']}",
                    "- 확인일:",
                    "- 확인자:",
                    "- 결과: 미확인 / 완료 / 보류 / 재확인 필요",
                    "- 증빙 위치:",
                    "- 실제 확인 내용:",
                    "- 메모:",
                    "- 필요 증빙:",
                ]
            )
            lines.extend(f"  - {value}" for value in item["evidence"])
            lines.extend(
                [
                    f"- 다음 행동: {item['action']}",
                    "- 참고:",
                ]
            )
            lines.extend(f"  - {value}" for value in item["reference"])
            lines.append("")

    return {
        "name": "phase_one_manual_evidence_template",
        "checked_at": evidence["checked_at"],
        "status": evidence["status"],
        "summary": evidence["summary"],
        "content": "\n".join(lines).strip() + "\n",
    }
