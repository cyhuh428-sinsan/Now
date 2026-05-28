# NowNote 설계 대비 현재 상태

기준일: 2026-05-28

이 문서는 긴 작업 기록을 다시 읽지 않아도 1차 목표 대비 현재 위치를 빠르게 확인하기 위한 현황판입니다.
세부 변경 이력은 `docs/WORK_PROGRESS.md`를 기준으로 남깁니다.

## 현재 마무리 수치

`docs/PHASE1_RELEASE_CHECKLIST.md` 기준 현재 상태는 57개 중 35개 완료, 22개 남음입니다.

- 모바일 앱 실제 점검: 8/12 완료.
- Web/설치형 점검: 12/12 완료.
- 서버 재배포 점검: 9/9 완료.
- 공용 서버 오픈 전 점검: 0/8 완료.
- Google Play 등록 전 점검: 3/10 완료.
- 공개 저장소 오픈 전 점검: 3/6 완료.

## 최신 코드 품질 상태

- 모바일 앱 전체 `dart analyze`는 최근 통과 기록이 있으나, 현재 PowerShell 세션에서는 Flutter/Dart 명령이 장시간 응답하지 않아 재확인은 보류 상태입니다.
- 모바일 핵심 표면 점검은 `now_app/scripts/verify_mobile_surface.py` 기준 119/119 통과 상태입니다.
- 서버 정적/문서/운영 표면 점검은 `server/scripts/preflight.py --env-file .env.example --allow-example` 기준 730/730 통과 상태입니다.
- Google Play 등록 자료 자동 확인은 `scripts/play_release_status.py --show-manual` 기준 27/27 OK, 수동 확인 9개 남음 상태입니다.
- 현재 실행 중인 `http://localhost:8750` 서버는 WSL/Docker 재배포 후 health/ready, 서버 capability, 운영 화면, smoke test가 통과한 상태입니다.
- GitHub Actions는 workflow 파일은 준비되어 있으나, 현재 최신 커밋 기준 workflow run/status가 아직 잡히지 않은 상태입니다.

## 1차 목표 기준

NowNote 1차 목표는 한국어 사용 흐름을 기준으로 한 로컬 우선 메모 프로그램입니다.
모바일은 빠른 일자별 메모와 음성 메모를 중심으로 보고, Web/설치형은 계층형 지식 메모를 중심으로 봅니다.
서버는 선택 사항이며, 개인 Docker 서버 또는 공용 NowNote 서버에 연결할 수 있는 구조로 준비합니다.

## 완료된 축

- 모바일 앱: 일자별 메모, 계층 메모, 음성 입력, 서버 연결 설정, 서버 동기화 흐름, Android 런타임 점검 스크립트, Android 설치/실행 점검 스크립트, Google Play 등록 준비 문서.
- Web/설치형 화면: 계층형 지식 메모, 일자별 메모 팝업 흐름, Markdown 작성/보기, 가져오기/내보내기, JSON 백업/복원, 검색, 본문 찾기, 탭 편집, 설정, 도움말.
- 서버: Docker Compose 기반 API, PostgreSQL, 녹음 저장소, 동기화 API, 녹음 업로드, 분석 작업 큐, 사용자/기기 관리, 운영 화면.
- 운영 화면: `/monitor`, `/admin`, 메모/녹음/사용자/기기/동기화/분석/백업/복구/배포/공용 서버 준비 상태 확인.
- 백업/복구: 전체 JSON 백업, 항목별 JSON 내보내기, 백업 검증, 복구 절차 문서, 고아/누락 녹음 파일 점검.
- 공용 서버 준비: 사용자별 접속 토큰, 토큰 확인 화면/API, 2단계 코드 검증, 사용자별 데이터 격리 smoke test, public preflight 기준.
- 공개 저장소 준비: README, 보안 정책, 기여 안내, 이슈/PR 템플릿, GitHub Actions preflight 설정, 민감정보 제외 기준.
- Google Play 빌드 준비: 로컬 업로드 키와 `key.properties` 준비, 서명된 AAB 빌드, Play release preflight 통과.

## 남은 1차 마무리

남은 항목은 `docs/PHASE1_RELEASE_CHECKLIST.md`를 기준으로 닫습니다.

### 실제 실행 환경 필요

- 실제 Android 기기에서 모바일 주요 흐름 점검.
### 운영 결정 필요

- 공용 서버를 열 경우 실제 도메인, HTTPS, reverse proxy, `NOW_USER_TOKEN_REQUIRED=true` 운영값 적용.
- 오픈소스 라이선스 선택과 LICENSE 파일 추가.

### 등록 화면 확인 필요

- 개인정보처리방침 URL 확정.
- Play Console 앱 설명, 권한 설명, Data safety, 스크린샷/기능 그래픽 최종 확인.
- 내부 테스트 트랙 업로드와 실제 기기 설치 테스트.

### 도구 한계로 보류

- Android 에뮬레이터에서는 앱 실행, 홈 오늘 메모, 일자별 메모 추가, 계층 메모 3단계와 삭제 제한, 서버 연결 테스트, 메모 동기화를 확인했다.
- 실제 Android 기기는 아직 연결하지 않아 완료 처리를 보류한다.

## 1차 범위 밖 또는 보류

- 메모 본문에 사진 첨부.
- 로그인 사용자 전용 암호화 저장의 실제 활성화.
- 대규모 사용자 운영을 위한 과금, 초대, 조직 관리.
- 고급 LLM 지식 분석과 장기 임베딩 작업 관리.

## 운영 원칙

- 사용자는 가능하면 Python/DB/CLI를 직접 실행하지 않고 화면과 API로 상태를 확인합니다.
- 배포 전 점검은 `server/scripts/preflight.py`, 실행 중 검증은 `server/scripts/smoke_test.py`가 담당합니다.
- 1차 마무리 남은 항목은 `scripts/release_readiness.py --show-blockers`로 외부 조건별로 분리해 봅니다.
- WSL/Linux 서버 갱신은 `server/scripts/deploy_local.sh`로 소스 갱신, preflight, compose 재기동, ready 확인, smoke test를 한 번에 실행할 수 있습니다.
- 로컬 개발/배포 환경 상태는 `scripts/local_environment_status.py`로 WSL/Docker/서버 capability를 한 번에 확인하고, 오래된 서버 배포본이 감지되면 재배포 기준을 함께 안내합니다.
- Google Play 등록 준비 상태는 `scripts/play_release_status.py`로 자동 확인 항목과 Play Console 수동 확인 항목을 분리해 봅니다.
- 오류나 대화 중단에 대비해 새 작업 단위는 `docs/WORK_PROGRESS.md`에 기록합니다.
- 실제 비밀값은 저장소에 올리지 않습니다.
