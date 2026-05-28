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
