# NowNote 작업 진행 기록

이 파일은 작업 중 오류나 대화 중단에 대비해 현재 진행 상태를 남기는 기록입니다.
새 기능을 시작하거나, 중간 판단이 바뀌거나, 검증/커밋이 끝날 때 갱신합니다.

## 2026-05-21 15:34 KST

### 다음 작업 시작

- 공개 저장소 첫 화면에서 GitHub Actions preflight 상태를 바로 확인할 수 있게 보강.

### 확인 내용

- GitHub Actions preflight 워크플로는 추가되어 있었지만 루트 README에는 상태 배지가 없었음.
- 공개 저장소를 보는 사람이 현재 기본 점검 통과 여부를 첫 화면에서 바로 확인하기 어려웠음.

### 구현 내용

- 루트 `README.md` 제목 아래에 NowNote Preflight GitHub Actions 배지를 추가.
- preflight가 루트 README의 preflight 상태 배지 존재 여부를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 493/493 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 15:21 KST

### 다음 작업 시작

- GitHub Actions preflight 워크플로 추가.

### 확인 내용

- 공개 저장소 기준으로 push/PR 때 자동으로 도는 GitHub Actions 워크플로가 없었음.
- 서버 `preflight.py`와 `smoke_test.py` 문법 확인, `.env.example` 기준 preflight는 외부 의존성 없이 실행 가능함.

### 구현 내용

- `.github/workflows/preflight.yml` 추가.
- `main` 브랜치 push와 PR에서 Python 3.12로 `py_compile`과 `preflight --env-file .env.example --allow-example`를 실행하도록 구성.
- preflight가 GitHub Actions 워크플로의 trigger, Python 버전, 문법 확인, preflight 명령을 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 492/492 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 15:05 KST

### 다음 작업 시작

- GitHub 이슈/PR 템플릿 추가.

### 확인 내용

- 공개 저장소 기준으로 bug/feature issue template과 PR template이 없었음.
- 버그 신고나 기능 제안에 민감정보가 포함되거나, PR에서 preflight/smoke 확인이 빠질 가능성이 있었음.

### 구현 내용

- `.github/ISSUE_TEMPLATE/bug_report.md` 추가.
- `.github/ISSUE_TEMPLATE/feature_request.md` 추가.
- `.github/PULL_REQUEST_TEMPLATE.md` 추가.
- preflight가 이슈/PR 템플릿의 영향 범위, 민감정보 금지, 1차 범위, 검증 명령, 회귀 방지 점검 문구를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 486/486 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 14:49 KST

### 다음 작업 시작

- 공개 저장소 기여 안내 문서 추가.

### 확인 내용

- 공개 저장소에는 보안 정책은 추가됐지만, 수정/기여자가 따라야 할 한국어 우선, 1차 범위, 민감정보, 점검 기준을 한곳에 정리한 문서가 없었음.
- NowNote는 모바일/Web/서버/문서가 함께 움직이므로 변경 전 영향 범위 확인 기준이 필요함.

### 구현 내용

- `CONTRIBUTING.md`를 추가해 기본 원칙, 작업 위치, 민감정보 금지, 변경 전 확인, preflight/smoke 점검, 작업 진행 기록, 커밋 기준을 정리.
- 루트 README에 기여 안내 링크를 추가.
- preflight가 기여 안내의 한국어 우선, 1차 범위, 민감정보 금지, 점검 명령, 작업 기록, 회귀 방지 점검 기준을 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 465/465 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 14:33 KST

### 다음 작업 시작

- 공개 저장소 보안 정책 문서 추가.

### 확인 내용

- 공개 저장소 루트에 별도 `SECURITY.md`가 없었음.
- NowNote는 서버 토큰, 사용자별 접속 토큰, Android 서명 키, 서버 `.env` 등 공개 이슈에 올리면 안 되는 민감정보가 있음.

### 구현 내용

- `SECURITY.md`를 추가해 보안 신고 방법, 민감정보 기준, 개인/공용 서버 운영 보안 조건, 데이터 보호 기준, 배포 전 점검 명령을 정리.
- 루트 README에 보안 정책 링크를 추가.
- preflight가 보안 정책의 연락처, 민감정보 제외, 공용 서버 조건, 2단계 코드/사용자 토큰 저장 정책, Android 백업 제외, 공용 서버 preflight 안내를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 453/453 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 14:18 KST

### 다음 작업 시작

- WSL 배포 로그 확인 안내 회귀 방지 점검 보강.

### 확인 내용

- `DEPLOY.md`에는 WSL 환경에서 `docker compose` 옵션 호환 문제가 있으면 `docker-compose` 명령을 쓰는 안내가 있음.
- 사용자 환경에서 실제로 `docker compose logs now-api --tail=80`이 실패하고 `docker-compose logs now-api --tail=80`이 동작했던 사례가 있었음.
- 기존 preflight/smoke는 배포 화면의 WSL 로그 확인 명령까지는 고정하지 않았음.

### 구현 내용

- preflight가 `DEPLOY.md`의 `docker-compose up --build -d`, `docker-compose logs now-api --tail=80`, `docker-compose logs now-worker --tail=80`, 8750 health/server 확인 명령을 확인하도록 보강.
- smoke test가 `/admin/deploy` 화면에 WSL `docker-compose` 로그 확인 안내가 표시되는지 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 440/440 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 14:03 KST

### 다음 작업 시작

- Google Play 출시 문서와 Android 권한/백업 규칙 정합성 점검 보강.

### 확인 내용

- Play 문서의 카메라/사진 목적은 `메모에 사진 첨부`가 아니라 캡처, 식사, 패션, 여행 등 생활 기록 기준으로 정리되어 있음.
- Android Manifest는 마이크, 카메라, 이미지, 알림, Health Connect 권한과 `CAPTURE_AUDIO_OUTPUT` 제거 규칙을 포함함.
- Android 자동 클라우드 백업 규칙은 database/sharedpref/file을 제외하고 있음.

### 구현 내용

- preflight가 Android Manifest의 주요 권한, 위험 권한 제거 규칙, 백업 규칙 연결을 확인하도록 보강.
- preflight가 backup/data extraction 규칙의 클라우드 백업 제외 기준을 확인하도록 보강.
- preflight가 Google Play 등록 문서, 개인정보처리방침 초안, 공개 개인정보 페이지의 서버 전송/권한/백업/보안 저장소 문구를 확인하도록 보강.
- Play 제출 문서에 `메모에 사진` 표현이 다시 들어오지 않도록 회귀 점검 추가.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 432/432 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 13:48 KST

### 다음 작업 시작

- 공개 저장소 기준 민감정보 제외 규칙 점검 보강.

### 확인 내용

- 실제 `server/.env`, `now_app/android/key.properties`, `now_app/android/upload-keystore.jks`는 git 추적 목록에 없었음.
- `.gitignore`에는 해당 파일 제외 규칙이 이미 있었음.
- Android 서명 예시 파일은 `CHANGE_ME` placeholder를 사용하고 있었음.

### 구현 내용

- preflight가 `.gitignore`의 서버 `.env`, Android key properties, upload keystore 제외 규칙을 확인하도록 보강.
- preflight가 `key.properties.example`의 placeholder와 ignored keystore 경로를 확인하도록 보강.
- 루트 README에 실제 `.env`, Android `key.properties`, `upload-keystore.jks`를 Git에 올리지 않는다는 정책을 추가.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 387/387 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 13:33 KST

### 다음 작업 시작

- 공개 저장소 첫 화면 기준의 루트 README 추가.

### 확인 내용

- 저장소 루트에는 `README.md`가 없었음.
- GitHub 공개 저장소 기준으로 모바일 앱, Web/설치형 화면, 서버, 도움말의 시작 위치가 바로 보이지 않았음.

### 구현 내용

- 루트 `README.md`를 추가해 NowNote의 목적, 구성, 1차 목표, 단독/서버 연결 사용 방식, 서버 빠른 실행, 현재 정책을 정리.
- preflight가 루트 README의 핵심 항목과 Flutter 기본 템플릿 문구 부재를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 377/377 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 13:18 KST

### 다음 작업 시작

- 모바일 앱 README가 Flutter 기본 템플릿으로 남아 있는 문제 정리.

### 확인 내용

- `now_app/README.md`가 `A new Flutter project` 기본 문서 그대로 남아 있었음.
- 공개 저장소 기준으로 모바일 앱의 실제 1차 범위, 서버 연결, Markdown 가져오기, 암호화 저장 상태를 설명하지 못했음.

### 구현 내용

- 모바일 README를 NowNote 모바일 앱 설명으로 교체.
- 빠른 입력, 음성 메모, 일자별 메모, 계층 메모, 서버 연결, 백업/가져오기, 암호화 1차 비활성 상태를 문서화.
- preflight가 모바일 README의 핵심 문구와 Flutter 기본 템플릿 제거 여부를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 364/364 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 13:02 KST

### 다음 작업 시작

- 모바일 서버 연결 설정에서 2단계 인증 코드 저장 여부 확인과 회귀 방지 점검 추가.

### 확인 내용

- 모바일 `ServerSettings` 저장 대상은 서버 사용 여부, 서버 주소, API 토큰, 사용자별 접속 토큰, 사용자 ID, 기기 ID, 마지막 동기화 시각임.
- 2단계 인증 코드는 `ServerSettings` 모델에 저장 필드가 없고, 연결 테스트 때 `/api/v1/auth/token-login` 요청에만 전달됨.

### 구현 내용

- preflight가 모바일 2단계 인증 코드 입력란과 연결 테스트 전달 경로를 확인하도록 보강.
- preflight가 모바일 코드에 `now_server_two_factor` 저장 키나 `ServerSettings`의 2단계 코드 저장 필드가 생기지 않도록 확인.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 355/355 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 12:30 KST

### 다음 작업 시작

- 모바일 앱 내부 도움말의 서버 연결 입력값 설명 보강.

### 확인 내용

- 실제 모바일 서버 설정 화면에는 서버 주소, API 토큰, 사용자별 접속 토큰, 2단계 인증 코드, 사용자 ID, 기기 ID 입력란이 있음.
- 모바일 앱 내부 도움말은 서버 주소, API 토큰, 사용자 ID까지만 설명해 공용 서버 연결 흐름과 조금 어긋났음.

### 구현 내용

- 모바일 도움말의 서버 연결 사용자 항목에 기기 ID를 추가.
- 공용 서버가 요구하면 사용자별 접속 토큰과 2단계 인증 코드도 입력한다고 명시.
- preflight가 모바일 도움말의 서버 연결 입력값과 공용 서버 토큰/2단계 안내를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 351/351 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 11:19 KST

### 다음 작업 시작

- `/admin/deploy` 배포 체크리스트 화면의 공용 서버 토큰 강제 설정 안내 smoke 검증 추가.

### 확인 내용

- DEPLOY 문서에는 `NOW_USER_TOKEN_REQUIRED=true` 공용 서버 조건이 반영됨.
- 하지만 smoke test의 `/admin/deploy` 화면 검증은 아직 해당 문구 노출을 확인하지 않았음.

### 구현 내용

- smoke test가 `/admin/deploy` 화면에서 `NOW_USER_TOKEN_REQUIRED=true` 문구를 확인하도록 추가.
- preflight가 smoke test의 해당 검증 문구를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 349/349 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 11:14 KST

### 다음 작업 시작

- 공용 서버 preflight 실패 기준과 사용자 문서의 설명을 일치시킴.

### 확인 내용

- `.env.example --allow-example --public-server` 기준 현재 실패 항목은 2개임.
- `NOW_USER_TOKEN_REQUIRED=true` 설정과 공개 HTTPS/reverse proxy 설정이 공용 서버 오픈 전 필수 조건임.
- 일부 도움말과 DEPLOY 문서는 HTTPS/reverse proxy만 남은 것처럼 읽힐 수 있었음.

### 구현 내용

- 한국어/영어 공통 도움말에 사용자별 접속 토큰 강제 설정과 HTTPS/reverse proxy가 모두 공용 서버 오픈 전 조건임을 명시.
- Web 도움말과 모바일 도움말도 같은 기준으로 수정.
- 인증 정책 문서와 DEPLOY 문서의 `--public-server` 설명에 `NOW_USER_TOKEN_REQUIRED=true`를 포함.
- preflight가 도움말/DEPLOY/인증 정책 문서의 사용자별 접속 토큰 강제 설정 안내를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 348/348 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.
- `uv run python scripts\preflight.py --env-file .env.example --allow-example --public-server`는 의도적으로 실패. 실패 항목은 `NOW_USER_TOKEN_REQUIRED=true`와 `HTTPS/reverse proxy` 2개로 확인.

## 2026-05-21 11:05 KST

### 다음 작업 시작

- 도움말 정합성 회귀 방지를 preflight에 추가.

### 확인 내용

- preflight는 2단계 인증 코드와 암호화 1차 비활성 안내가 존재하는지는 확인하고 있었음.
- 하지만 오래된 `로그인 화면, 실제 2단계 인증` 미완료 문구나 `나중에 로그인 기반 암호화 저장` 표현이 다시 들어오는지는 막지 못했음.

### 구현 내용

- `check_text_not_contains()`를 추가해 문서에 남으면 안 되는 오래된 표현을 점검.
- 한국어/영어 공통 도움말의 암호화 저장 운영 준비 표현을 확인.
- Web/모바일 도움말에서 오래된 공용 서버 미완료 표현이 없는지 확인.
- 모바일 도움말이 현재 남은 공용 서버 항목인 `공개 HTTPS와 reverse proxy 환경`을 설명하는지 확인.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 341/341 checks.
- `uv run python -m py_compile scripts\preflight.py` 통과.
- `git diff --check` 통과.
- 일반 `python -m py_compile`은 이 Windows 셸에 `python` 명령이 없어 실패했으나, 프로젝트에서 사용하는 `uv run python`으로 동일 파일 검증 완료.

## 2026-05-21 10:43 KST

### 다음 작업 시작

- 공통 도움말의 서버 연결 사용자 설명에서 암호화 저장 미래형 표현 정리.

### 확인 내용

- 암호화 저장은 현재 1차 범위에서 비활성 기능임.
- 서버 연결 사용자 설명의 `나중에 로그인 기반 암호화 저장을 사용하려고 할 때` 표현은 당장 사용 가능한 기능처럼 오해될 수 있음.

### 구현 내용

- 한국어 도움말을 `로그인 기반 암호화 저장이 필요한 운영 구조를 준비하려고 할 때`로 수정.
- 영어 도움말도 같은 의미로 수정.

### 검증

- 한국어/영어 도움말에서 오래된 미래형 암호화 저장 표현 제거 확인.
- `git diff --check` 통과.

## 2026-05-21 10:37 KST

### 다음 작업 시작

- 모바일 도움말의 공용 서버 오픈 전 점검 문구를 현재 서버 구현 상태와 맞춤.

### 확인 내용

- 공통/Web 도움말은 공용 서버 남은 항목을 공개 HTTPS와 reverse proxy 환경으로 설명함.
- 모바일 도움말에는 오래된 `로그인 화면, 실제 2단계 인증` 문구가 남아 있었음.
- 현재 서버는 사용자별 접속 토큰 로그인과 2단계 코드 검증이 구현된 상태임.

### 구현 내용

- 모바일 도움말의 공용 서버 오픈 전 점검 문구를 `공개 HTTPS와 reverse proxy 환경` 확인으로 수정.
- 도움말 화면 구조와 다른 항목은 변경하지 않음.

### 검증

- 모바일/공통/Web/서버 도움말에서 오래된 `로그인 화면`, `실제 2단계 인증` 미완료 표현 제거 확인.
- 모바일 도움말과 Web/서버 문서의 `공개 HTTPS`, `reverse proxy` 표현 일치 확인.
- `git diff --check` 통과.

## 2026-05-21 08:38 KST

### 다음 작업 시작

- 모바일 음성 입력 설정의 비활성 STT 선택지 설명 보완.

### 확인 내용

- OpenAI/Google STT는 아직 비활성 선택지라 `준비 중` 배지가 맞음.
- 하지만 기존 UI는 비활성 상태에서 원래 부가 설명인 `높은 정확도 · 유료`, `실시간 스트리밍 · 유료`를 가려 사용자가 선택지 차이를 보기 어려웠음.

### 구현 내용

- 비활성 STT 선택지는 `준비 중` 배지를 유지하되, 본문 설명에 원래 부가 설명을 함께 표시.
- 사용 가능 여부와 선택 동작은 변경하지 않음.
- 위젯 테스트에 비활성 선택지 부가 설명 노출 검증 추가.

### 검증

- `rg`로 비활성 STT 설명과 테스트 기대값 반영 확인.
- `git diff --check` 통과.
- `flutter test test\features\settings\voice_settings_page_test.dart`와 단일 위젯 테스트 실행은 Windows Flutter 실행 환경에서 120초 타임아웃.
- `dart format`도 같은 실행 환경에서 120초 타임아웃. 변경 줄은 수동 확인 결과 포맷 영향이 없는 단일 표현식 변경.

## 2026-05-21 08:33 KST

### 다음 작업 시작

- Web/설치형 README의 1차 실제 상태와 맞지 않는 문구 정리.

### 확인 내용

- `web/README.md`가 Web 클라이언트를 설치형 전 단계로만 설명하고 있었음.
- 암호화 저장을 1차 제공 기능처럼 표현해 공통 도움말의 `1차 비활성` 기준과 어긋났음.
- 단순 알림을 앱 안 토스트로 바꾼 최신 변경이 README에 반영되지 않았음.

### 구현 내용

- Web 클라이언트를 설치형 프로그램과 같은 화면 흐름을 검증하는 로컬 우선 클라이언트로 설명.
- 암호화 저장을 `1차 범위에서는 비활성`으로 수정.
- 화면 알림 토스트 동작을 1차 범위에 추가.
- `추후`, `나중에`처럼 불필요하게 미뤄 보이는 표현을 현재 설계 방향에 맞게 정리.

### 검증

- `web/README.md`에서 오래된 `확장하기 전 단계`, `추후`, `나중에`, `암호화 저장 제공` 표현 제거 확인.
- `git diff --check` 통과.

## 2026-05-21 08:18 KST

### 다음 작업 시작

- Web/설치형 메모 화면의 브라우저 기본 `alert()` 제거.

### 확인 내용

- 단순 안내/오류 메시지가 브라우저 기본 경고창으로 떠서 앱 UI 흐름과 맞지 않았음.
- 삭제/가져오기처럼 사용자의 명시적 확인이 필요한 `confirm()`은 현재 동작을 유지해야 함.

### 구현 내용

- `web/index.html`에 접근성용 `toastRegion` 추가.
- `web/styles.css`에 화면 오른쪽 아래 토스트 UI 추가.
- `web/app.js`에 `showNotice()`를 추가하고 단순 `alert()` 호출을 성공/오류 토스트로 교체.
- 영구 삭제, 백업 교체, Markdown 가져오기 확인 등 `confirm()` 흐름은 변경하지 않음.

### 검증

- `node --check web/app.js` 통과.
- `rg "alert\\(" web/app.js -n` 결과 없음.
- `git diff --check` 통과.

## 2026-05-21 08:12 KST

### 다음 작업 시작

- 모바일 회의/대화 화면에 남아 있는 오래된 탭 주석 정리.

### 구현 방침

- 현재 UI는 이미 `대화` 탭으로 표시되므로, 동작 변경 없이 주석만 실제 화면 구조와 맞춘다.

### 구현 내용

- `now_app/lib/features/meeting/meetings_page.dart`의 오래된 `대화2 탭 (면담 → 대화로 통합 예정)` 주석을 현재 화면명인 `대화 탭`으로 정리.
- 화면 표시, 라우팅, 데이터 필터링, 저장 동작은 변경하지 않음.

### 검증

- 오래된 `대화2 탭`, `면담 → 대화로 통합 예정` 표현이 더 이상 남아 있지 않음.
- `git diff --check` 통과.

## 2026-05-21 06:58 KST

### 다음 작업 시작

- 모바일 식사 기록 화면에 남아 있는 `TODO` 사용자 ID 주석 정리.

### 구현 방침

- 현재 1차 모바일 앱은 로컬 단독 사용자 기본값 `local_user`를 사용하므로 동작은 바꾸지 않는다.
- 같은 파일 안의 반복 사용자 ID를 상수로 모으고, 서버 로그인 사용자 연결은 전역 사용자 컨텍스트 작업 때 처리할 후속 기준으로 남긴다.

### 구현 내용

- `now_app/lib/features/meal/meal_page.dart`의 `TODO: 실제 userId는 인증 후 교체` 주석 제거.
- 식사 기록 화면의 반복 `local_user` 값을 `_localUserId` 상수로 정리.
- 조회와 저장 모두 기존과 같은 `local_user` 값을 사용하므로 동작은 유지.

### 검증

- `rg`로 식사 기록 화면의 `TODO`와 반복 `const userId = 'local_user'` 제거 확인.
- `git diff --check` 통과.
- `dart --version`은 Windows 셸에서 30초 안에 응답하지 않아 Dart 도구 검증은 보류.

## 2026-05-21 04:13 KST

### 다음 작업 시작

- 암호화 저장 도움말을 1차 실제 구현 상태와 맞춤.

### 구현 방침

- 암호화 저장은 현재 1차에서 비활성 상태임을 명확히 표현.
- 향후 서버 로그인 사용자 전용으로 사용자 비밀번호/복구키 기반 키 분리를 적용한다는 방향만 유지.
- Web/모바일/공통 도움말 문구를 같은 기준으로 맞추고 preflight 회귀 점검을 추가.

### 구현 내용

- `docs/HELP.md`, `docs/HELP.en.md`의 암호화 저장 설명을 1차 비활성 상태로 수정.
- `web/help.html`의 한국어/영어 암호화 저장 설명을 같은 기준으로 수정.
- 모바일 앱 도움말의 암호화 저장 설명을 1차 비활성 상태로 수정.
- preflight가 공통/Web/모바일 도움말의 암호화 1차 비활성 안내를 확인하도록 보강.

### 검증

- `rg`로 오래된 암호화 저장 설계 문구가 남지 않았고 새 1차 비활성 안내가 반영됐는지 확인.
- `uv run python -m py_compile scripts/preflight.py` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (333/333 checks)` 출력 확인.

## 2026-05-21 04:08 KST

### 다음 작업 시작

- 공통/Web/관리자 도움말의 공용 서버 남은 항목 설명을 현재 구현 상태와 맞춤.

### 구현 방침

- 사용자 토큰 확인 화면/API와 2단계 코드 검증은 준비 완료로 설명.
- 공용 서버 정식 오픈 전 남은 핵심 항목은 HTTPS/reverse proxy 공개 운영 환경으로 좁혀 설명.
- smoke/preflight가 오래된 "로그인 화면/실제 2단계 인증 미완료" 문구에 묶이지 않도록 함께 갱신.

### 구현 내용

- `docs/HELP.md`, `docs/HELP.en.md`의 공용 서버 주의 문구를 현재 구현 상태 기준으로 갱신.
- `web/help.html`의 공용 서버 설명을 사용자별 접속 토큰/2단계 코드 검증 제공, HTTPS/reverse proxy 확인 필요로 수정.
- `/admin/help` 안내 문구를 사용자 토큰 확인 화면/API, 2단계 코드 검증, 공개 운영 환경 점검 기준으로 수정.
- smoke/preflight의 도움말 점검 기준을 오래된 로그인 화면 문구에서 사용자 토큰 확인 화면/API와 2단계 코드 검증으로 변경.

### 검증

- 오래된 "로그인 화면/실제 2단계 인증 미완료" 문구가 문서/도움말/점검 코드에서 제거됐는지 `rg`로 확인.
- `uv run python -m py_compile app/api/monitor.py scripts/smoke_test.py scripts/preflight.py` 통과.
- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (326/326 checks)` 출력 확인.

## 2026-05-21 03:47 KST

### 다음 작업 시작

- 서버 인증 기준 문서를 최신 클라이언트 인증 흐름과 맞춤.

### 구현 방침

- 앱/Web/설치형 프로그램이 저장/입력하는 값에 사용자별 접속 토큰과 2단계 인증 코드를 명시.
- 인증 정책 문서의 해당 문구를 preflight에서 확인해 회귀를 막음.

### 구현 내용

- `docs/SERVER_AUTH_POLICY.md`에 클라이언트가 저장하는 사용자별 접속 토큰을 명시.
- 2단계 인증 코드는 저장하지 않고 확인 요청에만 사용한다는 정책 추가.
- preflight가 인증 정책 문서의 사용자 토큰 입력값과 2단계 코드 비저장 정책을 확인하도록 보강.

### 검증

- `uv run python -m py_compile scripts/preflight.py` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (325/325 checks)` 출력 확인.

## 2026-05-21 03:46 KST

### 다음 작업 시작

- 도움말의 2단계 인증 코드 안내가 회귀하지 않도록 preflight 점검 보강.

### 구현 방침

- `docs/HELP.md`, `docs/HELP.en.md` 존재와 2단계 코드 안내 문구를 preflight에서 확인.

### 구현 내용

- preflight에 한국어/영어 도움말 파일 존재 확인 추가.
- preflight에 한국어/영어 도움말의 2단계 코드 입력 안내 확인 추가.

### 검증

- `uv run python -m py_compile scripts/preflight.py` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (323/323 checks)` 출력 확인.

## 2026-05-21 03:39 KST

### 다음 작업 시작

- 사용자 도움말의 서버 연결 입력값 예시를 실제 2단계 인증 코드 입력 흐름과 맞춤.

### 구현 방침

- 한국어/영어 공통 도움말의 서버 연결 필수값과 예시에 2단계 인증 코드 항목을 추가.
- Web 도움말은 직전 작업에서 이미 갱신됐으므로 공통 문서의 누락분만 보완.

### 구현 내용

- `docs/HELP.md` 서버 연결 필수값과 예시에 2단계 인증 코드 항목 추가.
- `docs/HELP.en.md` 서버 연결 필수값과 예시에 Two-factor code 항목 추가.

### 검증

- `rg`로 공통 도움말과 Web 도움말의 2단계 코드 안내 반영 확인.
- `git diff --check` 통과.

## 2026-05-20 23:28 KST

### 다음 작업 시작

- Web/모바일 클라이언트의 사용자 토큰 로그인/2단계 코드 연결이 회귀하지 않도록 preflight 점검 보강.

### 구현 방침

- preflight가 Web 연결 테스트의 `/api/v1/auth/token-login`, 2단계 코드 입력, `token_code` capability 표시를 확인하도록 추가.
- preflight가 모바일 연결 테스트의 `/api/v1/auth/token-login`, 2단계 코드 입력, `token_code` capability 표시를 확인하도록 추가.

### 구현 내용

- Web 소스 점검에 사용자 토큰 로그인 API, 2단계 코드 입력, `token_code` capability 표시 확인 추가.
- 모바일 서버 동기화/설정 소스 점검에 사용자 토큰 로그인 API, 2단계 코드 전송, 2단계 입력 필드, `token_code` capability 표시 확인 추가.

### 검증

- `uv run python -m py_compile scripts/preflight.py` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (317/317 checks)` 출력 확인.

## 2026-05-20 23:11 KST

### 다음 작업 시작

- Web/설치형과 모바일 서버 연결 화면을 새 사용자 토큰 로그인/2단계 인증 API와 맞춤.

### 구현 방침

- 서버 연결 테스트가 `/api/v1/server` 확인 후 사용자별 접속 토큰이 있으면 `/api/v1/auth/token-login`까지 검증하도록 연결.
- 2단계 인증 사용자는 화면에서 6자리 코드를 입력해 연결 테스트를 완료할 수 있게 한다.
- 기존 동기화/프로필/분석/녹음 요청의 사용자 토큰 헤더 흐름은 유지한다.
- 서버 capability의 `two_factor_auth=token_code`를 준비된 2단계 인증으로 표시하도록 Web/모바일 문구를 맞춘다.

### 구현 내용

- Web/설치형 서버 설정에 `2단계 인증 코드` 입력란 추가.
- Web/설치형 연결 테스트가 사용자별 접속 토큰 입력 시 `/api/v1/auth/token-login`을 호출하도록 연결.
- Web/설치형 capability 표시에서 `two_factor_auth=token_code`를 `2단계 인증`으로 표시하도록 보강.
- 모바일 서버 설정 화면에 `2단계 인증 코드` 입력란 추가.
- 모바일 연결 테스트가 사용자별 접속 토큰 입력 시 `/api/v1/auth/token-login`을 호출하도록 연결.
- 모바일 서버 연결 성공 문구에서 `two_factor_auth=token_code`를 `2단계 인증`으로 표시하도록 보강.
- 도움말과 Web README의 2단계 인증 안내를 실제 코드 입력 흐름 기준으로 갱신.

### 검증

- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (310/310 checks)` 출력 확인.
- `dart --version`, `flutter --version`은 Windows 셸에서 20초 안에 응답하지 않아 모바일 도구 검증은 보류.

## 2026-05-20 18:24 KST

### 다음 작업 시작

- 공용 서버 HTTPS/reverse proxy 준비 상태를 운영 설정 기반으로 동적 판정.

### 구현 내용

- 설정값 `NOW_PUBLIC_BASE_URL`, `NOW_BEHIND_REVERSE_PROXY` 추가.
- `.env.example`에 공용 서버 공개 URL/reverse proxy 설정 항목 추가.
- 공용 서버 준비 상태에서 공개 HTTPS/reverse proxy 항목을 동적 판정하도록 변경.
- `NOW_PUBLIC_BASE_URL`이 `https://`로 시작하고 `NOW_BEHIND_REVERSE_PROXY=true`이면 준비 완료, 아니면 remaining에 유지.
- `--public-server` preflight가 공개 URL과 reverse proxy 설정을 실제로 확인하도록 변경.
- README, DEPLOY, 인증 정책 문서의 공개 운영 설정 안내 갱신.

### 검증

- `uv run --project server python -m py_compile`로 config/capabilities/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (310/310 checks)` 출력 확인.
- 기본 설정에서는 `public_https_reverse_proxy`가 remaining에 남는 것 확인.
- `NOW_PUBLIC_BASE_URL=https://now.example.com`, `NOW_BEHIND_REVERSE_PROXY=true` 환경에서는 공용 서버 준비 상태가 `ready`, remaining 빈 목록으로 바뀌는 것 확인.

## 2026-05-20 18:08 KST

### 다음 작업 시작

- 공용 서버 준비 항목 중 2단계 인증 절차 구현.

### 구현 내용

- `POST /api/v1/auth/token-login`에 선택 필드 `two_factor_code` 추가.
- 사용자 `two_factor_enabled=true`이면 토큰 로그인 때 6자리 2단계 코드를 필수로 검증.
- 코드가 없으면 `two factor code required`, 틀리면 `invalid two factor code`로 차단.
- 토큰 확인 화면 `/auth/token`에 2단계 인증 코드 입력란 추가.
- `TWO_FACTOR_AUTH_STATUS`를 `token_code`로 변경하고 공용 서버 준비 상태에서 2단계 코드 검증 절차를 준비 완료로 이동.
- smoke test에 2단계 사용자 생성, 코드 없는 로그인 차단, 잘못된 코드 차단, 정상 코드 로그인 검증 추가.
- README, DEPLOY, 인증 정책, preflight 기준 갱신.

### 검증

- `uv run --project server python -m py_compile`로 auth/capabilities/smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (305/305 checks)` 출력 확인.
- `app.api.server.server_info()` 직접 호출로 `real_two_factor_challenge` 준비 완료와 remaining 제거 확인. 현재 remaining은 HTTPS/reverse proxy 한 항목.

## 2026-05-20 17:48 KST

### 다음 작업 시작

- 공용 서버 준비 항목 중 로그인/토큰 전달의 1차 구현.

### 구현 내용

- 공개 사용자 토큰 확인 화면 `GET /auth/token` 추가.
- 사용자 토큰 확인 API `POST /api/v1/auth/token-login` 추가.
- 토큰 확인 성공 시 `last_login_at`, `last_seen_at`, `access_token_last_used_at`을 갱신.
- 잘못된 토큰, 미발급 토큰, 비활성 사용자를 명확한 오류로 차단.
- main 앱에 auth 화면/API 라우터 연결.
- 공용 서버 준비 상태에서 `login_or_token_delivery`를 사용자 토큰 확인 화면/API 준비 완료 항목으로 이동.
- smoke/preflight/README/DEPLOY/인증 정책 문서 갱신.

### 검증

- `uv run --project server python -m py_compile`로 auth/main/capabilities/smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (298/298 checks)` 출력 확인.
- `app.api.server.server_info()` 직접 호출로 `login_or_token_delivery` 준비 완료와 remaining 제거 확인. 현재 remaining은 실제 2단계 인증/HTTPS 두 항목.

## 2026-05-20 17:32 KST

### 다음 작업 시작

- 공용 서버 준비 상태에서 사용자별 데이터 격리 자동 검증 항목을 준비 완료로 전환.

### 구현 내용

- `user_data_isolation_verification`을 남은 항목에서 준비 완료 항목으로 이동.
- 준비 완료 메시지를 메모, 검색, 동기화, 녹음, 분석 작업 smoke 검증 기준으로 명확화.
- smoke test가 서버 정보, 공용 서버 준비 화면, 운영 점검 화면에서 데이터 격리 자동 검증을 준비 완료 항목으로 확인하도록 수정.
- preflight의 공용 서버 점검에서 데이터 격리 항목을 실패가 아닌 준비 완료 확인으로 변경.
- README, DEPLOY, 인증 정책 문서의 남은 공용 서버 항목에서 데이터 격리 검증을 제거하고 준비 완료 항목으로 설명.

### 검증

- `uv run --project server python -m py_compile`로 capabilities/smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (287/287 checks)` 출력 확인.
- `app.api.server.server_info()` 직접 호출로 `user_data_isolation_verification` 준비 완료와 remaining 제거 확인. 현재 remaining은 로그인/2단계 인증/HTTPS 세 항목.
- `git diff --check` 통과.

## 2026-05-20 17:19 KST

### 다음 작업 시작

- 사용자별 데이터 격리 smoke test 범위를 동기화, 녹음, 분석 작업까지 확대.

### 구현 내용

- smoke test의 multipart 요청 함수가 검증 대상 사용자 토큰을 명시적으로 받을 수 있도록 보강.
- `local_user` 동기화 pull 응답에 `smoke_admin_user` 메모가 섞이지 않는지 확인.
- `local_user` 녹음 목록에 `smoke_admin_user` 녹음이 섞이지 않는지 확인하고, `smoke_admin_user`는 자기 녹음을 확인할 수 있는지 검증.
- `local_user` 분석 작업 목록에 `smoke_admin_user` 분석 작업이 섞이지 않는지 확인하고, `smoke_admin_user`는 자기 작업을 확인할 수 있는지 검증.
- preflight와 README의 데이터 격리 smoke test 설명 갱신.

### 검증

- `uv run --project server python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (287/287 checks)` 출력 확인.
- `git diff --check` 통과.

## 2026-05-20 17:07 KST

### 다음 작업 시작

- 사용자별 데이터 격리 smoke test를 실제 데이터 응답 기준으로 추가 보강.

### 구현 내용

- smoke test에서 `smoke_admin_user`의 메모를 생성한 뒤 `local_user` 메모 목록에 섞이지 않는지 확인.
- `local_user` 검색 결과에 다른 사용자 메모가 노출되지 않는지 확인.
- `smoke_admin_user`는 자기 메모를 정상 조회할 수 있는지 확인.
- preflight가 위 데이터 격리 smoke 검증 코드 존재를 확인하도록 보강.
- README의 smoke test 설명에 메모 목록/검색의 사용자별 데이터 격리 검증을 추가.

### 검증

- `uv run --project server python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (284/284 checks)` 출력 확인.
- `git diff --check` 통과.

## 2026-05-20 16:52 KST

### 다음 작업 시작

- 공용 서버 준비 항목 중 사용자별 데이터 격리 검증 보강.

### 구현 내용

- smoke test에 다른 사용자 토큰으로 `local_user` 데이터 API 접근 시 `invalid user token`으로 차단되는지 확인하는 검증 추가.
- preflight가 위 cross-user token isolation 검증 코드 존재를 확인하도록 보강.
- README의 smoke test 설명에 다른 사용자 토큰 차단 검증을 추가.
- 데이터 격리 항목은 아직 공용 서버 준비 완료로 넘기지 않음. 현재는 토큰 기준 접근 차단 검증을 강화한 단계.

### 검증

- `uv run --project server python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (281/281 checks)` 출력 확인.
- `git diff --check` 통과.

## 2026-05-20 16:36 KST

### 다음 작업 시작

- 공용 서버 준비 항목 중 사용자별 기기 조회/해제 API 보강.

### 구현 내용

- `GET /api/v1/users/{owner_id}/devices` 추가.
- `PATCH /api/v1/users/{owner_id}/devices/{device_id}` 추가.
- 사용자별 접속 토큰 검증 후 자기 기기 목록 조회와 활성/비활성 변경을 수행하도록 연결.
- 기기 상태 변경 API는 기존에 등록된 기기만 변경하고, 없는 기기는 `404 device not found`로 차단하도록 보강.
- 공용 서버 준비 상태에서 `user_device_self_management`를 준비 완료 항목으로 추가.
- 공용 서버 남은 항목에서 사용자별 기기 등록/해제 흐름 제거.
- README, DEPLOY, 인증 정책 문서, smoke/preflight 검증 기준 갱신.

### 검증

- `uv run --project server python -m py_compile`로 users/capabilities/smoke/preflight 문법 확인 통과.
- `rg`로 사용자 기기 자기관리 API와 공용 서버 준비 항목 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (280/280 checks)` 출력 확인.
- `app.api.server.server_info()` 직접 호출로 `user_device_self_management` 준비 완료와 `user_device_registration` 남은 항목 제거 확인.
- Windows 로컬에서는 서버 컨테이너를 띄우지 않아 live smoke test는 실행하지 않음. WSL 배포 환경에서 `scripts/smoke_test.py --base-url http://localhost:8750`로 확인 가능.

## 2026-05-20 16:20 KST

### 다음 작업 시작

- 공용 서버 준비 상태 API/운영 점검 기준을 더 구체화.

### 구현 내용

- `/api/v1/server`의 `public_server_readiness`가 기존 `remaining` 외에 준비 완료 항목 `ready`와 상세 `items`를 함께 반환하도록 보강.
- 사용자별 접속 토큰, 사용자 프로필 관리, 기기 레지스트리, 백업/복구 점검을 준비 완료 항목으로 명시.
- 로그인/토큰 전달 화면, 실제 2단계 인증 절차, 사용자별 기기 등록/해제 흐름, 데이터 격리 검증, 공개 HTTPS/reverse proxy는 남은 항목으로 유지.
- Admin API와 monitor 운영 화면이 공통 `public_server_readiness_checks()` 기준을 사용하도록 중복 점검 목록 제거.
- smoke/preflight/README가 준비 완료 항목과 상세 항목을 확인하도록 갱신.

### 검증

- `uv run --project server python -m py_compile`로 capabilities/admin/monitor/server/smoke/preflight 문법 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (273/273 checks)` 출력 확인.
- `app.api.server.server_info()` 직접 호출로 `public_server_readiness.ready`, `remaining`, `items` 응답 구조 확인.
- FastAPI `TestClient` 기반 앱 전체 라우팅 검증은 현재 Windows 로컬 uv 환경에서 `python-multipart` import가 잡히지 않아 직접 수행하지 못함. requirements에는 `python-multipart==0.0.20`이 포함되어 있음.

## 2026-05-20 15:46 KST

### 다음 작업 시작

- preflight가 Web/모바일의 공용 서버 준비 상태 연동도 확인하도록 보강.

### 구현 내용

- preflight에 Web 앱 소스와 Web README 존재 확인 추가.
- preflight가 Web의 `public_server_readiness` 응답 파싱, `publicServerReadiness` 상태 저장, 표시 라벨, i18n 문구를 확인하도록 보강.
- preflight가 Web README의 공용 서버 준비 상태 표시 설명을 확인하도록 보강.
- preflight에 모바일 서버 동기화 서비스와 서버 설정 화면 존재 확인 추가.
- preflight가 모바일의 `ServerPublicReadiness` 모델, 응답 파싱, 요약 문구, 화면 표시 연결을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 preflight 문법 확인 통과.
- `rg`로 Web/모바일 공용 서버 준비 상태 회귀 방지 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (269/269 checks)` 출력 확인.

## 2026-05-20 15:37 KST

### 다음 작업 시작

- 모바일 서버 연결 화면에 공용 서버 준비 상태 표시.

### 구현 내용

- `ServerConnectionResult`에 `ServerPublicReadiness` 모델 추가.
- 모바일 서버 연결 테스트가 `/api/v1/server`의 `public_server_readiness`를 파싱하도록 연결.
- 서버 연결 성공 메시지에 공용 서버 준비 상태 요약을 포함.
- 서버 연결 결과 카드에 공용 서버 준비 상태 요약을 별도 줄로 표시.

### 검증

- `rg`로 `ServerPublicReadiness`, `public_server_readiness`, `publicReadiness`, 공용 서버 준비 상태 문구 연결 확인.
- 변경부 주변 소스 확인으로 모델/파싱/표시 경로 확인.
- `dart analyze`와 `dart format`은 각각 120초 제한 안에 완료되지 않아 도구 검증은 수행하지 못함.

## 2026-05-20 15:30 KST

### 다음 작업 시작

- Web/설치형 서버 연결 화면에 공용 서버 준비 상태 표시.

### 구현 내용

- 서버 연결 테스트 응답의 `public_server_readiness`를 Web 설정에 저장하도록 추가.
- 서버 capability 칩 영역에 공용 서버 준비 상태와 남은 항목 수를 함께 표시하도록 보강.
- 한국어/영어 언어팩에 공용 서버 준비 상태 표시 문구 추가.
- 저장된 설정 정규화에 `publicServerReadiness` 필드 보정 추가.
- Web README에 서버 연결 테스트 후 공용 서버 준비 상태도 표시한다고 반영.

### 검증

- `node --check web/app.js` 문법 확인 통과.
- `rg`로 `publicServerReadiness`, `public_server_readiness`, `publicReadiness` 연결 확인.
- 브라우저 직접 검증은 in-app browser의 `file:///D:/Project/Now/web/index.html` 접근 정책 차단으로 수행하지 못함.

## 2026-05-20 15:22 KST

### 다음 작업 시작

- `/api/v1/server` 응답에 공용 서버 준비 상태 요약 추가.

### 구현 내용

- `server/app/core/capabilities.py`에 `PUBLIC_SERVER_READINESS`와 `public_server_readiness()` 추가.
- `/api/v1/server` 응답에 `public_server_readiness` 추가.
- smoke test가 서버 정보 응답의 공용 서버 준비 상태와 잔여 항목을 확인하도록 보강.
- preflight가 capability/source/smoke의 공용 서버 준비 상태 연결을 확인하도록 보강.
- README의 `/api/v1/server` 설명에 `public_server_readiness` 의미 추가.

### 검증

- `uv run ... python -m py_compile`로 capabilities/server/smoke/preflight 문법 확인 통과.
- FastAPI `TestClient`로 `/api/v1/server`의 `public_server_readiness.status=planned`와 잔여 항목 확인.
- `rg`로 `public_server_readiness`, `PUBLIC_SERVER_READINESS`, 공용 서버 준비 상태 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (255/255 checks)` 출력 확인.

## 2026-05-20 15:12 KST

### 다음 작업 시작

- 공용 서버 준비 기준을 관리자 화면에서 바로 확인하는 `/admin/public` 화면 추가.

### 구현 내용

- `/admin/public` 화면을 추가해 `docs/SERVER_AUTH_POLICY.md`를 관리자 화면에서 바로 확인하도록 연결.
- 관리자 홈과 도움말의 공용 서버 설명에서 `/admin/public`으로 이동할 수 있게 보강.
- smoke test가 `/admin/public` 화면의 사용자별 토큰, 실제 2단계 인증, 데이터 격리 기준과 사용자/기기 관리 링크를 확인하도록 보강.
- preflight가 README, monitor 라우트, smoke test의 공용 서버 준비 화면 연결을 확인하도록 보강.
- README 운영 화면 목록과 설명에 `/admin/public` 추가.

### 검증

- `uv run ... python -m py_compile`로 monitor/smoke/preflight 문법 확인 통과.
- `rg`로 `/admin/public`, `_admin_public_html`, `SERVER_AUTH_POLICY` 연결 확인.
- FastAPI `TestClient`로 `/admin/public` 200 응답과 핵심 문구/링크 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (249/249 checks)` 출력 확인.

## 2026-05-20 05:07 KST

### 다음 작업 시작

- 녹음 관리 화면에 누락 녹음 파일 목록 링크 추가.

### 구현 내용

- `/admin/recordings` 안내 영역에 `누락 녹음 파일 JSON` 링크 추가.
- smoke test가 녹음 관리 화면의 고아/누락 녹음 파일 JSON 링크를 확인하도록 보강.
- preflight가 monitor 화면과 smoke test의 누락 녹음 파일 링크 검증을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 monitor/smoke/preflight 문법 확인 통과.
- `rg`로 녹음 관리 화면, smoke test, preflight의 `누락 녹음 파일 JSON`/`recording-missing-files` 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (243/243 checks)` 출력 확인.

## 2026-05-20 04:55 KST

### 다음 작업 시작

- 누락 녹음 파일 summary 필드 문서화.

### 구현 내용

- README에 `recording_missing_files`가 백업 JSON 메타데이터와 실제 저장소 원본 파일 불일치 지표라는 설명 추가.
- RECOVERY 문서의 복구 전 확인 순서에 `summary.recording_missing_files` 기준 추가.
- preflight가 README/RECOVERY의 누락 녹음 파일 summary 문서화 여부를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 preflight 문법 확인 통과.
- `rg`로 README/RECOVERY/preflight의 `recording_missing_files`, `summary.recording_missing_files` 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (239/239 checks)` 출력 확인.

## 2026-05-20 04:43 KST

### 다음 작업 시작

- 내보내기 요약에 누락 녹음 파일 운영 지표 추가.

### 구현 내용

- `/api/v1/admin/export/summary`와 전체 백업 summary에 `recording_missing_files`를 추가.
- `/admin/export` 화면에 누락 녹음 파일 export 링크와 건수를 추가.
- smoke test와 preflight가 누락 녹음 파일 요약 필드와 화면 링크를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- 임시 SQLite DB에서 실제 파일이 있는 녹음 1건과 누락 녹음 1건을 구성해 `recording_missing_files=1`, `total_export_items=2` 계산 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (237/237 checks)` 출력 확인.

## 2026-05-20 04:32 KST

### 다음 작업 시작

- 누락 녹음 파일 운영 기준 문서화.

### 구현 내용

- README에 `/api/v1/admin/export/recording-missing-files`와 `/admin/ops`의 `누락 녹음 파일` bad 상태 기준 추가.
- RECOVERY 문서에 누락 목록 JSON 보관과 저장소 백업에서 원본 파일을 먼저 찾는 복구 순서 추가.
- DEPLOY 문서에 누락 녹음 파일 bad 상태 확인과 배포 전 저장소 볼륨 백업 확인 기준 추가.
- preflight가 README/RECOVERY/DEPLOY의 누락 녹음 파일 문서화 여부를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 preflight 문법 확인 통과.
- `rg`로 README/RECOVERY/DEPLOY/preflight의 `recording-missing-files`, `누락 녹음 파일`, 저장소 백업 복구 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (234/234 checks)` 출력 확인.

## 2026-05-20 04:20 KST

### 다음 작업 시작

- DB 녹음 메타데이터는 있지만 실제 저장 파일이 없는 누락 녹음 파일 감지.

### 구현 내용

- `/api/v1/admin/export/recording-missing-files`를 추가해 저장소 파일이 없는 녹음 메타데이터 목록을 JSON으로 확인할 수 있게 보강.
- `/api/v1/admin/ops`와 `/admin/ops`에 "누락 녹음 파일" 점검 항목 추가.
- smoke test와 preflight가 누락 녹음 파일 export/API/화면 점검 항목을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- 임시 SQLite DB에서 실제 파일이 있는 녹음 1건과 없는 녹음 1건을 구성해 `_recording_missing_files()`가 누락 1건만 반환하는 것 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (228/228 checks)` 출력 확인.

## 2026-05-20 04:06 KST

### 다음 작업 시작

- 고아 녹음 파일 운영 지표와 목록 API 문서화.

### 구현 내용

- README에 `recording_orphan_files`, `recording_orphan_bytes`, `고아 녹음 파일 JSON` 확인 기준 추가.
- RECOVERY 문서에 복구 전 고아 녹음 파일 목록 보관과 자동 삭제 금지 기준 추가.
- DEPLOY 문서에 `/admin/ops` 고아 녹음 파일 항목 확인과 `/api/v1/admin/export/recording-orphans` 목록 보관 기준 추가.
- preflight가 README/RECOVERY/DEPLOY의 고아 녹음 파일 문서화 여부를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 preflight 문법 확인 통과.
- `rg`로 README/RECOVERY/DEPLOY/preflight의 `recording_orphan_files`, `recording_orphan_bytes`, `고아 녹음 파일 JSON`, `recording-orphans` 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (221/221 checks)` 출력 확인.

## 2026-05-20 03:51 KST

### 다음 작업 시작

- 내보내기 요약에 고아 녹음 파일 운영 지표 추가.

### 구현 내용

- `/api/v1/admin/export/summary`와 전체 백업 summary에 `recording_orphan_files`, `recording_orphan_bytes`를 추가.
- `/admin/export` 화면에 고아 녹음 파일 export 링크와 건수를 추가.
- smoke test와 preflight가 고아 녹음 파일 요약 필드와 화면 링크를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- 임시 SQLite DB와 임시 저장소에서 DB 녹음 1건, 고아 파일 1건을 구성해 `recording_orphan_files=1`, `recording_orphan_bytes=12`, `total_export_items=1` 계산 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (214/214 checks)` 출력 확인.

## 2026-05-20 03:37 KST

### 다음 작업 시작

- 고아 녹음 파일 감지 결과를 운영자가 확인할 수 있는 목록 API와 화면 링크 추가.

### 구현 내용

- `/api/v1/admin/export/recording-orphans`를 추가해 DB 메타데이터와 연결되지 않은 저장소 파일 목록을 JSON으로 확인할 수 있게 보강.
- `/admin/recordings` 화면에 "고아 녹음 파일 JSON" 링크와 삭제 전 백업 확인 안내를 추가.
- smoke test와 preflight가 고아 녹음 파일 export API와 화면 링크를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- 임시 저장소에서 DB가 아는 파일 1개와 모르는 파일 1개를 만든 뒤 고아 파일 목록의 `relative_path`, `size_bytes`, `modified_at` 생성 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (209/209 checks)` 출력 확인.

## 2026-05-20 03:20 KST

### 다음 작업 시작

- 운영 점검에서 DB 메타데이터 없이 저장소에 남은 고아 녹음 파일 감지.

### 구현 내용

- `/api/v1/admin/ops`가 `NOW_STORAGE_DIR` 실제 파일과 DB `Recording.storage_path`를 비교해 고아 녹음 파일 수를 집계하도록 보강.
- `/admin/ops` 화면에도 같은 "고아 녹음 파일" 점검 항목을 추가.
- smoke test와 preflight가 운영 점검 API/화면의 고아 녹음 파일 항목과 요약 필드를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- 임시 저장소에서 DB가 아는 파일 1개와 모르는 파일 1개를 만든 뒤 API/화면 helper 모두 고아 파일 1건으로 집계하는 것 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (203/203 checks)` 출력 확인.

## 2026-05-20 03:08 KST

### 다음 작업 시작

- 녹음 저장 안전 이름의 빈 값/점 경로 경계값 보강.

### 구현 내용

- `_safe_name()`이 빈 문자열, `.`, `..` 값을 실제 경로 의미로 쓰지 않고 `_`로 대체하도록 보강.
- smoke test가 `local_id=".."`, 파일명 `"."` 업로드 후 저장 파일명이 안전한 대체 이름으로 시작하는지 확인하도록 보강.
- preflight가 빈 값/점 경로 대체 처리를 정적 검사하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 recording_storage/smoke/preflight 문법 확인 통과.
- 임시 `NOW_STORAGE_DIR`에서 `owner_id=".."`, `device_id="."`, `local_id=".."`, 파일명 `"."` 조합 저장 시 저장소 내부에만 파일이 생성되고 파일명이 `_` 대체 이름으로 시작하는 것 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (198/198 checks)` 출력 확인.

## 2026-05-20 02:52 KST

### 다음 작업 시작

- 녹음 교체 파일 정리 실패 격리 보강.

### 구현 내용

- `delete_recording_file()`이 저장소 내부 파일 삭제 중 `OSError`가 발생해도 업로드 응답을 실패시키지 않도록 보강.
- preflight가 녹음 파일 정리 helper의 OS 오류 격리 처리를 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 recording_storage/preflight 문법 확인 통과.
- `rg`로 `except OSError`, `delete_recording_file`, preflight 확인 문구 연결 확인.
- 임시 파일 테스트로 저장소 밖 파일은 삭제하지 않고, 저장소 안 파일은 삭제하며, 이미 없는 파일 호출은 조용히 통과하는 것 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (197/197 checks)` 출력 확인.

## 2026-05-20 02:39 KST

### 다음 작업 시작

- 녹음 재업로드 시 기존 파일 정리 보강.

### 구현 내용

- `delete_recording_file()` 추가.
- 삭제 대상이 `NOW_STORAGE_DIR` 내부 파일일 때만 삭제하도록 storage root guard 추가.
- 같은 owner/device/local_id 녹음 재업로드 시 DB 메타데이터를 갱신한 뒤 이전 저장 파일을 정리하도록 연결.
- smoke test가 같은 `local_id` 재업로드 후 파일명이 갱신되고 목록에는 같은 local_id가 1건만 노출되는지 확인하도록 보강.
- preflight가 녹음 저장소 삭제 helper와 smoke test 재업로드 확인 문구를 검사하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 recordings API/recording_storage/smoke/preflight 문법 확인 통과.
- `rg`로 `delete_recording_file`, storage root guard, smoke 재업로드 확인 문구 연결 확인.
- 임시 SQLite DB와 별도 `NOW_STORAGE_DIR`에서 같은 owner/device/local_id 녹음을 두 번 업로드해:
  - DB/export에는 같은 local_id가 1건만 남음.
  - 새 파일은 존재함.
  - 이전 파일은 삭제됨.
- 일반 preflight 실행 결과 `NowNote server preflight passed (196/196 checks)` 출력 확인.

## 2026-05-20 02:26 KST

### 다음 작업 시작

- 녹음 저장 디렉터리 owner/device 경로 안전성 보강.

### 구현 내용

- 녹음 저장 디렉터리 생성 시 `owner_id`, `device_id`도 파일 시스템 경로 용도로 안전하게 정리하도록 수정.
- DB 메타데이터의 `owner_id`, `device_id`는 원본 값을 그대로 보존.
- smoke test가 저장 경로에 상위 경로 이동이 남지 않고 owner/device 디렉터리 아래에 저장되는지 확인하도록 보강.
- preflight가 녹음 owner/device 경로 안전성 smoke 기준을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 recording_storage/smoke/preflight 문법 확인 통과.
- `rg`로 owner/device 경로 안전 처리와 smoke/preflight 확인 문구 연결 확인.
- 임시 SQLite DB와 별도 `NOW_STORAGE_DIR`에서 경로 문자가 포함된 `owner_id`, `device_id`, `local_id`를 업로드해도:
  - 메타데이터 owner/device/local_id는 원본 유지.
  - 저장 경로에 `/../` 이동이 남지 않음.
  - 저장 경로가 정리된 owner/device 디렉터리 아래에 생성됨.
- 일반 preflight 실행 결과 `NowNote server preflight passed (191/191 checks)` 출력 확인.

## 2026-05-20 02:14 KST

### 다음 작업 시작

- 녹음 저장 파일명 경로 안전성 보강.

### 구현 내용

- 녹음 파일 저장 시 업로드 파일명뿐 아니라 `local_id`도 파일명 용도로 안전하게 정리하도록 수정.
- DB 메타데이터의 `local_id`는 원본 값을 그대로 보존.
- smoke test가 경로 문자가 포함된 `local_id`와 파일명을 업로드해도 저장 파일명에 `/`, `\`, `..` 경로 이동이 남지 않는지 확인하도록 추가.
- preflight가 녹음 경로 안전성 smoke 기준을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 recording_storage/smoke/preflight 문법 확인 통과.
- `rg`로 `local_id` 파일명 안전 처리, 녹음 경로 안전성 smoke, preflight 확인 문구 연결 확인.
- 임시 SQLite DB와 별도 `NOW_STORAGE_DIR`에서 경로 문자가 포함된 `local_id`/파일명을 업로드해도:
  - 메타데이터 `local_id`는 원본 유지.
  - 저장 `file_name`에는 `/`, `\`, 시작 `..`이 남지 않음.
  - `storage_path`에 `/../` 이동이 남지 않음.
- 일반 preflight 실행 결과 `NowNote server preflight passed (190/190 checks)` 출력 확인.

## 2026-05-20 02:01 KST

### 다음 작업 시작

- 실패한 사용자 토큰 요청의 마지막 사용 시각 회귀 검증 보강.

### 구현 내용

- smoke test가 토큰 필수 모드에서 토큰 누락/잘못된 토큰 요청 후 `access_token_last_used_at`이 갱신되지 않는지 확인하도록 보강.
- preflight가 smoke test의 실패 토큰 마지막 사용 시각 확인 문구를 검사하도록 추가.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 실패 토큰 마지막 사용 시각 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient에서 토큰 누락/잘못된 토큰 요청 후 `access_token_last_used_at`이 `None`으로 유지되고, 정상 토큰 요청 후 값이 갱신되는 것 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (188/188 checks)` 출력 확인.

## 2026-05-20 01:49 KST

### 다음 작업 시작

- 사용자 API/export의 토큰 민감정보 노출 회귀 검증 보강.

### 구현 내용

- smoke test가 `/api/v1/admin/users?token=issued` 응답에 `access_token_hash`와 토큰 원문이 없는지 확인하도록 보강.
- smoke test가 `/api/v1/admin/export/users?token=issued` 응답에 `access_token_hash`와 토큰 원문이 없는지 확인하도록 추가.
- preflight가 사용자 목록/API export의 토큰 해시 노출 방지 확인 문구를 검사하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 사용자 목록/API export 토큰 해시 노출 방지 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 토큰 발급 후 `/api/v1/admin/users?token=issued`와 `/api/v1/admin/export/users?token=issued`에 `access_token_hash`와 토큰 원문이 없는 것 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (187/187 checks)` 출력 확인.

## 2026-05-20 01:36 KST

### 다음 작업 시작

- 사용자 토큰 필수 모드의 실패 사유 회귀 검증 보강.

### 구현 내용

- smoke test가 `/api/v1/server`의 `user_token_required` 값을 저장하도록 보강.
- smoke test에 특정 요청에서 사용자 토큰 헤더를 명시적으로 넣거나 빼는 helper 추가.
- `--issue-local-user-token`과 `NOW_USER_TOKEN_REQUIRED=true` 조합에서 토큰 없는 요청이 `user token required`로 차단되는지 확인.
- 같은 조건에서 잘못된 사용자 토큰 요청이 `invalid user token`으로 차단되는지 확인.
- preflight가 smoke test의 사용자 토큰 필수 모드 실패 사유 확인 문구를 검사하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 요청별 사용자 토큰 helper, `user_token_required`, 실패 사유 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient에서 `NOW_USER_TOKEN_REQUIRED=true` 기준:
  - 토큰 없는 메모 조회가 401 `user token required`를 반환.
  - 잘못된 토큰 메모 조회가 401 `invalid user token`을 반환.
  - 정상 발급 토큰 메모 조회가 200을 반환.
- 일반 preflight 실행 결과 `NowNote server preflight passed (185/185 checks)` 출력 확인.

## 2026-05-20 01:24 KST

### 다음 작업 시작

- 비활성 사용자 차단 사유 회귀 검증 보강.

### 구현 내용

- smoke test가 비활성 사용자의 동기화 요청을 403뿐 아니라 `user inactive` 사유로 차단하는지 확인하도록 보강.
- preflight가 smoke test의 비활성 사용자 차단 사유 확인 문구를 검사하도록 추가.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 smoke/preflight의 `user inactive` 차단 사유 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 비활성 사용자 동기화 요청이 403과 `user inactive` detail을 반환하는 것 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (182/182 checks)` 출력 확인.

## 2026-05-20 01:12 KST

### 다음 작업 시작

- 운영 점검의 공용 서버 인증 회귀 검증 보강.

### 구현 내용

- smoke test가 `/api/v1/admin/ops`의 `공용 서버 인증` 항목 존재를 확인하도록 보강.
- smoke test가 운영 점검 요약의 `users_without_token` 집계를 확인하도록 보강.
- smoke test가 공용 서버 인증 메시지에 `사용자별 토큰` 기준이 포함되는지 확인하도록 추가.
- preflight가 smoke test의 공용 서버 인증/토큰 집계 확인 문구를 검사하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 smoke/preflight의 공용 서버 인증/토큰 집계 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 `/api/v1/admin/ops`의 `공용 서버 인증` 메시지와 `users_without_token` 요약 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (181/181 checks)` 출력 확인.

## 2026-05-20 01:00 KST

### 다음 작업 시작

- 내보내기 요약 API 회귀 검증 보강.

### 구현 내용

- smoke test가 `/api/v1/admin/export/summary`의 `devices`와 `total_export_items` 존재 여부를 확인하도록 보강.
- smoke test가 `total_export_items`가 메모/녹음/사용자/기기/분석/동기화 이력 합계와 일치하는지 확인하도록 추가.
- preflight가 smoke test의 내보내기 요약 검증 문구와 README의 `total_export_items` 설명을 확인하도록 보강.
- README에 `total_export_items` 합계 기준 설명 추가.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 README, smoke, preflight의 `total_export_items`와 요약 검증 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 `/api/v1/admin/export/summary`의 `devices` 존재와 `total_export_items` 합계 일치 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (178/178 checks)` 출력 확인.

## 2026-05-20 00:47 KST

### 다음 작업 시작

- 전체 백업 검증의 기기 섹션 필수 확인 보강.

### 구현 내용

- 전체 백업 검증 API의 필수 항목 목록에 `devices` 추가.
- smoke test가 `devices` 섹션이 빠진 백업을 `bad`로 판정하고 누락 항목에 `devices`를 표시하는지 확인하도록 보강.
- preflight가 백업 검증의 `devices` 필수 항목과 smoke test의 누락 검증을 확인하도록 보강.

### 검증

- `uv run ... python -m py_compile`로 admin/smoke/preflight 문법 확인 통과.
- `rg`로 `devices` 필수 섹션, smoke 누락 검증, preflight 확인 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 `devices` 섹션이 빠진 백업이 `bad`가 되고 `백업 항목` check의 actual에 `devices`가 표시되는 것 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (174/174 checks)` 출력 확인.

## 2026-05-20 00:34 KST

### 다음 작업 시작

- 내보내기 관리 화면의 기기 export 정합성 보강.

### 구현 내용

- `/admin/export` 화면의 집계에 등록 기기 수 추가.
- `/admin/export` 화면의 내보내기 링크에 `/api/v1/admin/export/devices` 추가.
- 화면의 전체 export 건수 계산이 API의 전체 백업 집계처럼 기기 수를 포함하도록 정정.
- smoke test가 내보내기 화면의 기기 export 링크와 기기 집계를 확인하도록 보강.
- preflight가 monitor/smoke의 기기 export 정합성 문구를 검사하도록 보강.
- README의 `/admin/export` 설명에 기기 등록 상태 JSON 내보내기 포함.

### 검증

- `uv run ... python -m py_compile`로 monitor/smoke/preflight 문법 확인 통과.
- `rg`로 내보내기 화면, smoke, preflight, README의 기기 export 문구 연결 확인.
- 임시 SQLite DB와 FastAPI TestClient로 `/api/v1/admin/export/summary`의 `devices` 집계와 `/admin/export`의 기기 링크/집계 표시 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (171/171 checks)` 출력 확인.

## 2026-05-20 00:18 KST

### 다음 작업 시작

- 메모 관리 조건별 내보내기 추가.

### 구현 내용

- `/api/v1/admin/export/notes`에 owner/note_type/source/q/deleted 필터 추가.
- `/admin/notes`에 Owner ID, 메모 타입, 소스, 제목/내용 검색, 삭제 표시 필터 추가.
- `/admin/notes`에 현재 조건 JSON 링크 추가.
- smoke test가 메모 관리 필터 화면과 조건별 메모 내보내기를 확인하도록 보강.
- preflight가 메모 관리 필터/내보내기 확인 문구를 검사하도록 보강.
- README에 메모 관리 조건별 JSON 내보내기 안내 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 메모 관리 필터, 현재 조건 JSON, 조건별 export 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (167/167 checks)` 출력 확인.
- 임시 SQLite DB와 FastAPI TestClient로 owner/note_type/source/q 조건 export와 `/admin/notes` 화면 필터 확인.
- `git diff --check` 통과.

## 2026-05-20 00:00 KST

### 다음 작업 시작

- 분석 관리 조건별 내보내기 추가.

### 구현 내용

- `/api/v1/admin/export/analysis-jobs`가 owner/status/job_type 필터를 받도록 보강.
- `/admin/analysis`에 Owner ID, 상태, 작업 유형 필터 추가.
- `/admin/analysis`에 현재 조건 JSON 링크 추가.
- smoke test가 분석 관리 필터 화면과 조건별 분석 작업 내보내기를 확인하도록 보강.
- preflight가 smoke test의 분석 관리 내보내기/필터 확인 문구를 검사하도록 보강.
- README에 분석 작업 조건별 JSON 내보내기 안내 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 분석 export 필터와 현재 조건 JSON 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (161/161 checks)` 출력 확인.
- 임시 SQLite DB와 FastAPI TestClient로 owner/status/job_type 분석 작업 export 필터와 `/admin/analysis` 화면 필터 확인.

## 2026-05-19 03:12 KST

### 다음 작업 시작

- 사용자 관리 조건별 내보내기 추가.

### 구현 내용

- `/api/v1/admin/export/users`가 owner/group/status/token/q 필터를 받도록 보강.
- `/admin/users`에 현재 조건 JSON 링크 추가.
- smoke test가 사용자 관리의 현재 조건 JSON 링크와 검색 필터를 확인하도록 보강.
- smoke test가 조건별 사용자 JSON 내보내기를 확인하도록 추가.
- preflight가 smoke test의 사용자 내보내기/검색 확인 문구를 검사하도록 보강.
- README에 사용자 목록 조건별 JSON 내보내기 안내 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 사용자 export 필터와 현재 조건 JSON 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (159/159 checks)` 출력 확인.
- 임시 SQLite DB와 FastAPI TestClient로 group/q/status 사용자 export 필터와 `/admin/users` 화면 필터 확인.

## 2026-05-19 02:56 KST

### 다음 작업 시작

- 기기 관리 필터와 조건별 내보내기 추가.

### 구현 내용

- `/admin/devices`에 Owner ID, Device ID, 활성 상태 필터 추가.
- `/admin/devices`에 현재 조건 JSON 링크 추가.
- `/api/v1/admin/export/devices`가 owner/device/status 필터를 받도록 보강.
- smoke test가 기기 관리 필터 화면과 조건별 기기 내보내기를 확인하도록 보강.
- preflight가 smoke test의 기기 필터/내보내기 확인 문구를 검사하도록 보강.
- README에 기기 목록 필터와 현재 조건 JSON 내보내기 안내 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 기기 필터/조건별 내보내기 문구와 API/화면/smoke/preflight/README 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (157/157 checks)` 출력 확인.
- 임시 SQLite DB와 FastAPI TestClient로 active/inactive 기기 export 필터와 `/admin/devices` 화면 필터 확인.

## 2026-05-19 02:40 KST

### 다음 작업 시작

- 운영 점검의 비활성 기기 집계 추가.

### 구현 내용

- `/api/v1/admin/ops` 요약에 전체 등록 기기 수와 비활성 기기 수 추가.
- `/api/v1/admin/ops` 점검 항목에 `비활성 기기` 추가.
- `/admin/ops` 화면에도 `비활성 기기` 점검 항목 추가.
- smoke test가 운영 점검의 비활성 기기 항목과 summary 집계를 확인하도록 보강.
- preflight가 admin/monitor/smoke의 비활성 기기 점검 연결을 확인하도록 보강.
- README의 운영 점검 설명에 비활성 기기 항목 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 비활성 기기 집계 문구와 API/화면/smoke/preflight/README 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (155/155 checks)` 출력 확인.

## 2026-05-19 02:22 KST

### 다음 작업 시작

- 기기 비활성 차단 연결.

### 구현 내용

- `require_active_user_device()`와 `set_user_device_active()` 서비스를 추가.
- 동기화, 메모 저장, 메모 배치 저장, 녹음 업로드 API가 비활성 기기를 차단하도록 연결.
- `/api/v1/admin/devices/{owner_id}/{device_id}` PATCH API로 기기 활성/비활성 상태를 바꿀 수 있도록 추가.
- `/admin/devices` 화면에 기기 활성/비활성 변경 폼 추가.
- smoke test가 기기 비활성화, 비활성 기기 동기화 403 차단, 재활성화를 확인하도록 추가.
- 자동 생성 사용자/기기의 `is_active` 값을 명시해 DB flush 전 기본값 미반영으로 신규 요청이 비활성 처리되는 문제 수정.
- preflight가 자동 생성 사용자/기기 활성 기본값과 비활성 기기 차단 문구를 확인하도록 보강.
- README에 비활성 기기의 동기화/메모/녹음 차단 기준을 명시.

### 검증

- `uv run ... python -m py_compile`로 사용자/기기 서비스, API, smoke/preflight 문법 확인 통과.
- `rg`로 기기 비활성 차단 서비스/API/화면/smoke/preflight/README 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (151/151 checks)` 출력 확인.
- 임시 SQLite DB와 FastAPI TestClient로 기기 생성, 비활성화, 비활성 기기 동기화 403 차단, 재활성화 확인.

## 2026-05-19 02:03 KST

### 다음 작업 시작

- 서버 기기 레지스트리 기반 추가.

### 구현 내용

- `UserDevice` 모델과 `user_devices` 테이블 추가.
- 동기화, 단일 메모 저장, 메모 배치 저장, 녹음 업로드 시 owner/device 조합을 자동 기록하도록 추가.
- `/admin/devices`가 기기 레지스트리의 상태, 처음 확인, 마지막 확인 시각을 함께 표시하도록 보강.
- 전체 백업과 백업 검증 요약에 `devices` 항목을 포함.
- `/api/v1/admin/export/devices` 내보내기 API 추가.
- smoke test와 preflight가 기기 export와 백업의 devices 항목을 확인하도록 보강.
- README에 기기 레지스트리의 현재 범위와 공용 서버용 해제/차단 정책은 다음 단계임을 명시.

### 검증

- `uv run ... python -m py_compile`로 모델/DB/API/서비스/smoke/preflight 문법 확인 통과.
- `rg`로 `UserDevice`, `touch_user_device`, `export/devices`, README 기기 레지스트리 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (145/145 checks)` 출력 확인.
- 임시 SQLite DB에서 `create_tables()` 실행 후 `user_devices` 테이블 생성 확인.

## 2026-05-19 01:45 KST

### 다음 작업 시작

- 기기 관리 화면의 현재 역할 명확화.

### 구현 내용

- `/admin/devices`에 owner/device별 사용 흔적을 확인하는 읽기 전용 화면이라는 안내 추가.
- 공용 서버용 기기 등록/해제 기능은 아직 별도 구현 전이며 운영 점검 대상이라는 안내 추가.
- smoke test가 기기 관리 화면의 읽기 전용/등록 해제 미구현 안내를 확인하도록 추가.
- preflight가 smoke test의 기기 관리 안내 확인 문구를 검사하도록 추가.

### 검증

- `uv run ... python -m py_compile`로 monitor/smoke/preflight 문법 확인 통과.
- `rg`로 기기 관리 화면 안내와 smoke/preflight 확인 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (144/144 checks)` 출력 확인.

## 2026-05-19 01:31 KST

### 다음 작업 시작

- 도움말 화면의 공용 서버 미완성 항목 smoke 기준 보강.

### 구현 내용

- smoke test가 `/admin/help`에서 공용 서버 기기 등록과 데이터 격리 안내를 확인하도록 추가.
- preflight가 smoke test의 도움말 화면 기기 등록/데이터 격리 확인 문구를 검사하도록 추가.

### 검증

- `uv run ... python -m py_compile`로 smoke/preflight 문법 확인 통과.
- `rg`로 smoke/preflight의 도움말 기기 등록/데이터 격리 확인 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (142/142 checks)` 출력 확인.

## 2026-05-19 01:20 KST

### 다음 작업 시작

- 운영 점검 화면의 공용 서버 미완성 항목 표시 보강.

### 구현 내용

- `/api/v1/admin/ops` 공용 서버 준비 점검에 `공용 서버 기기 등록`, `공용 서버 데이터 격리` 항목 추가.
- `/admin/ops` HTML 운영 점검 화면에도 같은 항목이 표시되도록 추가.
- smoke test가 운영 점검 화면/API에서 두 항목을 확인하도록 보강.
- preflight가 admin/monitor/smoke 소스에 두 항목이 연결되어 있는지 확인하도록 보강.
- README/DEPLOY의 운영 점검 설명에 기기 등록과 데이터 격리 항목 추가.

### 검증

- `uv run ... python -m py_compile`로 admin/monitor/smoke/preflight 문법 확인 통과.
- `rg`로 운영 점검/문서/smoke/preflight의 기기 등록/데이터 격리 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (140/140 checks)` 출력 확인.
- 공용 서버 preflight 실행 결과 의도적으로 `Preflight failed (140/145 checks)` 출력 확인.

## 2026-05-19 01:08 KST

### 다음 작업 시작

- 공용 서버 preflight 실패 항목 보강.

### 구현 내용

- README의 공용 서버 오픈 전 실패 항목에 사용자별 기기 등록/해제와 사용자별 데이터 접근 격리 검증 추가.
- DEPLOY의 `--public-server` 의도적 실패 설명에 기기 등록/해제와 데이터 격리 항목 추가.
- preflight가 README/DEPLOY의 공용 서버 기기 등록/데이터 격리 안내 포함 여부를 확인하도록 보강.
- `--public-server` 실행 시 사용자별 기기 등록/해제, 사용자별 데이터 접근 격리 검증을 별도 실패 항목으로 표시하도록 추가.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `rg`로 README/DEPLOY/preflight의 기기 등록/데이터 격리 문구 연결 확인.
- 일반 preflight 실행 결과 `NowNote server preflight passed (134/134 checks)` 출력 확인.
- 공용 서버 preflight 실행 결과 의도적으로 `Preflight failed (134/139 checks)` 출력 확인.
- 공용 서버 실패 항목에 `Public server device registration`, `Public server data isolation` 포함 확인.

## 2026-05-19 00:58 KST

### 다음 작업 시작

- 서버 인증 기준 문서 preflight 보강.

### 구현 내용

- preflight가 `docs/SERVER_AUTH_POLICY.md` 존재 여부를 확인하도록 추가.
- 개인 Docker 서버/공용 NowNote 서버 인증 기준, 사용자별 토큰 필수 모드, 로그인/토큰 전달 UI, 실제 2단계 인증, 사용자별 데이터 격리, HTTPS/reverse proxy, `--public-server` 안내 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `rg`로 서버 인증 기준 문서와 preflight 확인 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (130/130 checks)` 출력 확인.

## 2026-05-19 00:49 KST

### 다음 작업 시작

- README smoke 옵션 문서화 preflight 보강.

### 구현 내용

- preflight가 README의 `--timeout`, `--ready-retries`, `--ready-delay` 안내 포함 여부를 확인하도록 보강.
- DEPLOY뿐 아니라 README 기준 smoke 옵션 문서화도 회귀 방지.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `rg`로 README와 preflight의 smoke 옵션 안내 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (121/121 checks)` 출력 확인.

## 2026-05-19 00:36 KST

### 다음 작업 시작

- smoke test 서버 준비 대기 옵션 추가.

### 구현 내용

- `server/scripts/smoke_test.py`에 `--ready-retries`, `--ready-delay` 옵션 추가.
- 본격 smoke test 실행 전 `/health/ready`를 지정 횟수만큼 확인하는 `wait_until_ready()` 추가.
- 기본값은 기존 흐름과 같게 1회 확인으로 유지.
- README와 DEPLOY 문서에 컨테이너 기동 중 준비 대기 옵션 안내 추가.
- preflight가 smoke test 준비 대기 옵션과 DEPLOY 안내 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `smoke_test.py --help`에서 `--ready-retries`, `--ready-delay` 옵션 표시 확인.
- `rg`로 smoke test, README, DEPLOY, preflight의 준비 대기 옵션 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (118/118 checks)` 출력 확인.

## 2026-05-19 00:22 KST

### 다음 작업 시작

- smoke test 요청 timeout 옵션 추가.

### 구현 내용

- `server/scripts/smoke_test.py`에 `--timeout` 옵션 추가.
- 기존 기본 대기 시간 10초는 유지하고, 모든 HTTP 요청이 공통 `REQUEST_TIMEOUT`을 사용하도록 변경.
- README와 DEPLOY 문서에 느린 환경에서 `--timeout`을 늘릴 수 있다는 안내 추가.
- preflight가 smoke test의 timeout 옵션과 DEPLOY 안내 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `smoke_test.py --help`에서 `--timeout` 옵션 표시 확인.
- `rg`로 smoke test, README, DEPLOY, preflight의 timeout 옵션 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (114/114 checks)` 출력 확인.

## 2026-05-19 00:13 KST

### 다음 작업 시작

- smoke test JSON 파싱 실패 메시지 개선.

### 구현 내용

- `server/scripts/smoke_test.py`에서 JSON 응답 파싱 실패 시 `SMOKE TEST JSON FAILED: 원인`을 먼저 출력하도록 보강.
- README와 DEPLOY 문서에 smoke test JSON 실패 메시지 기준 추가.
- preflight가 smoke test, README, DEPLOY의 JSON 실패 메시지 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `rg`로 smoke test, README, DEPLOY, preflight의 JSON 실패 메시지 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (111/111 checks)` 출력 확인.

## 2026-05-19 00:04 KST

### 다음 작업 시작

- smoke test HTTP 실패 메시지 개선.

### 구현 내용

- `server/scripts/smoke_test.py`에서 HTTP 오류 시 `SMOKE TEST HTTP FAILED: 상태코드 원인`을 먼저 출력하도록 변경.
- README와 DEPLOY 문서에 smoke test HTTP 실패 메시지 기준 추가.
- preflight가 smoke test, README, DEPLOY의 HTTP 실패 메시지 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `rg`로 smoke test, README, DEPLOY, preflight의 HTTP 실패 메시지 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (108/108 checks)` 출력 확인.

## 2026-05-18 22:51 KST

### 다음 작업 시작

- smoke test 연결 실패 메시지 개선.

### 구현 내용

- `server/scripts/smoke_test.py`에서 서버 미기동/포트 오류 같은 연결 실패 시 `SMOKE TEST CONNECTION FAILED: 원인`을 먼저 출력하도록 보강.
- README와 DEPLOY 문서에 smoke test 연결 실패 메시지 기준 추가.
- preflight가 smoke test, README, DEPLOY의 연결 실패 메시지 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `rg`로 smoke test, README, DEPLOY, preflight의 연결 실패 메시지 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (105/105 checks)` 출력 확인.

## 2026-05-18 22:43 KST

### 다음 작업 시작

- smoke test 검증 실패 메시지 개선.

### 구현 내용

- `server/scripts/smoke_test.py`에서 검증 조건 실패 시 `SMOKE TEST FAILED: 원인`을 먼저 출력하도록 보강.
- README와 DEPLOY 문서에 smoke test 실패 메시지 기준 추가.
- preflight가 smoke test, README, DEPLOY의 실패 메시지 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `rg`로 smoke test, README, DEPLOY, preflight의 실패 메시지 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (102/102 checks)` 출력 확인.

## 2026-05-18 22:35 KST

### 다음 작업 시작

- smoke test 최종 성공 메시지 추가.

### 구현 내용

- `server/scripts/smoke_test.py` 마지막에 `NowNote server smoke test passed` 출력 추가.
- README와 DEPLOY 문서에 smoke test 성공 메시지 기준 추가.
- preflight가 smoke test, README, DEPLOY의 성공 메시지 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `rg`로 smoke test, README, DEPLOY, preflight의 성공 메시지 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (99/99 checks)` 출력 확인.

## 2026-05-18 22:27 KST

### 다음 작업 시작

- README의 smoke test 범위 설명 보강.

### 구현 내용

- `server/README.md`의 smoke test 설명에 실제 확인 범위인 백업 내보내기/검증, 녹음 업로드, 분석 작업, 사용자별 접속 토큰, 비활성 사용자 차단 기준 추가.
- preflight가 README의 smoke test 주요 범위 설명 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `rg`로 README smoke test 범위 설명과 preflight 확인 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (96/96 checks)` 출력 확인.

## 2026-05-18 22:18 KST

### 다음 작업 시작

- README의 preflight 결과 해석 기준 보강.

### 구현 내용

- `server/README.md`에 preflight 성공/실패 메시지의 `통과/전체 checks` 형식 설명 추가.
- preflight가 README의 성공/실패 요약 설명 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `rg`로 README와 preflight의 성공/실패 요약 문구 연결 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (93/93 checks)` 출력 확인.

## 2026-05-18 22:10 KST

### 다음 작업 시작

- 운영 점검 화면 smoke 검증 강화.

### 구현 내용

- `server/scripts/smoke_test.py`가 `/admin/ops` HTML 화면의 핵심 운영 항목을 직접 확인하도록 보강.
- 백업/복구 절차, `status_counts.bad=0`, 공용 서버 로그인 화면, 공용 서버 2단계 인증, 공개 운영 환경 항목을 화면 기준으로 확인.
- preflight가 smoke test의 운영 점검 화면 검증 문구 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- TestClient로 `/admin/ops` 화면의 백업/복구 절차, `status_counts.bad=0`, 공용 서버 점검 항목 표시 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (91/91 checks)` 출력 확인.

## 2026-05-18 22:02 KST

### 다음 작업 시작

- smoke test의 도움말 화면 검증 누락 보완.

### 구현 내용

- `server/scripts/smoke_test.py`의 관리자 화면 확인 목록에 `/admin/help` 추가.
- 기존에 작성되어 있던 도움말 화면 검증 조건이 실제로 실행되도록 연결.
- preflight가 smoke test의 `/admin/help` 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- TestClient로 `/admin/help` 화면의 공용 서버 로그인 화면, 배포 링크, `bad/warn`, `/admin/ops` 안내 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (89/89 checks)` 출력 확인.

## 2026-05-19 01:55 KST

### 다음 작업 시작

- 배포 문서에 preflight 점검 수 출력 해석 기준 추가.

### 구현 내용

- `server/DEPLOY.md` 배포 전 점검 단계에 preflight 성공/실패 메시지 해석 기준 추가.
- 성공 메시지 `NowNote server preflight passed (통과/전체 checks)` 설명 추가.
- 실패 메시지 `Preflight failed (통과/전체 checks)`와 실패 항목 확인 설명 추가.
- preflight가 DEPLOY 문서의 성공/실패 요약 설명 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (88/88 checks)` 출력 확인.

## 2026-05-19 01:40 KST

### 다음 작업 시작

- preflight 실패 메시지에 통과/전체 점검 수 요약 추가.

### 구현 내용

- `check_summary()`를 추가해 성공/실패 메시지가 같은 통과/전체 점검 수 형식을 사용하도록 변경.
- preflight 실패 메시지를 `Preflight failed (통과/전체 checks)` 형식으로 변경.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (86/86 checks)` 출력 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example --public-server` 실행 결과 의도된 실패와 `Preflight failed (86/89 checks)` 출력 확인.

## 2026-05-19 01:25 KST

### 다음 작업 시작

- preflight 완료 메시지에 전체 점검 항목 수 표시 추가.

### 구현 내용

- `server/scripts/preflight.py`에 전체 점검 수와 통과 수 카운터 추가.
- preflight 성공 메시지를 `NowNote server preflight passed (통과/전체 checks)` 형식으로 변경.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 실행 결과 `NowNote server preflight passed (86/86 checks)` 출력 확인.

## 2026-05-19 01:10 KST

### 다음 작업 시작

- smoke test가 `/admin/deploy` 화면의 백업/복구 운영 점검 안내를 확인하도록 보강.

### 구현 내용

- smoke test가 `/admin/deploy` 화면의 `백업/복구 절차` 안내 포함 여부를 확인하도록 보강.
- smoke test가 `/admin/deploy` 화면의 `status_counts.bad=0`, `/admin/export`, `/admin/recovery` 안내 포함 여부를 확인하도록 보강.
- preflight가 smoke test의 배포 화면 백업/복구 안내 확인 문구 포함 여부를 점검하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- TestClient로 `/admin/deploy` 화면에 `백업/복구 절차`, `status_counts.bad=0`, `/admin/export`, `/admin/recovery`, `git pull origin main` 안내가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-19 00:55 KST

### 다음 작업 시작

- 배포 체크리스트에 `/admin/ops` 백업/복구 점검 항목 확인 기준 추가.

### 구현 내용

- `server/DEPLOY.md`의 운영 화면 확인 단계에 `/admin/ops`의 `백업/복구 절차` 항목 확인 기준 추가.
- 배포 체크리스트에 `/admin/export`, `status_counts.bad=0`, `/admin/recovery` 안내 확인 기준 명시.
- preflight가 DEPLOY 문서의 백업/복구 운영 점검 항목과 `status_counts.bad=0` 기준 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-19 00:40 KST

### 다음 작업 시작

- README 운영 점검 API 설명에 백업/복구 점검 항목 반영.

### 구현 내용

- `server/README.md`의 운영 점검 API 설명에 `백업/복구 절차 확인 상태` 포함.
- README에 `/admin/export`, `status_counts.bad=0`, `/admin/recovery` 확인 기준 설명 추가.
- preflight가 README의 백업/복구 운영 점검 설명 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-19 00:25 KST

### 다음 작업 시작

- 운영 점검 결과에 백업/복구 절차 확인 항목 추가.

### 구현 내용

- `/api/v1/admin/ops` 응답에 `백업/복구 절차` 점검 항목 추가.
- `/admin/ops` 화면에도 같은 `백업/복구 절차` 점검 항목 추가.
- 점검 메시지에 `/admin/export`, `status_counts.bad=0`, `/admin/recovery` 확인 기준 명시.
- smoke test가 운영 점검 응답의 `백업/복구 절차` 항목과 `status_counts.bad=0` 안내를 확인하도록 보강.
- preflight가 Admin API와 monitor 화면의 백업/복구 점검 항목 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `admin.py`, `monitor.py`, `smoke_test.py`, `preflight.py` 확인 통과.
- TestClient로 `/api/v1/admin/ops`, `/admin/ops`에 `백업/복구 절차`, `status_counts.bad=0` 안내가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-19 00:10 KST

### 다음 작업 시작

- preflight가 `/admin/export` 화면의 `status_counts.bad=0` 안내를 점검하도록 보강.

### 구현 내용

- preflight가 monitor/Admin export 화면의 `status_counts.bad=0` 안내 포함 여부를 확인하도록 보강.
- preflight가 monitor/Admin export 화면의 `NOW_STORAGE_DIR` 원본 녹음 파일 보존 안내 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 23:55 KST

### 다음 작업 시작

- preflight가 백업 검증 `status_counts` 응답 구조를 점검하도록 보강.

### 구현 내용

- preflight가 Admin API의 `status_counts` 응답 포함 여부를 확인하도록 보강.
- preflight가 `_check_status_counts`, `_verification_status` 존재 여부를 확인하도록 보강.
- preflight가 smoke test의 `status_counts` 검증 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 23:40 KST

### 다음 작업 시작

- `/admin/export` 화면에 `status_counts` 백업 검증 기준 안내 추가.

### 구현 내용

- `/admin/export` 화면의 백업 검증 안내에 `status_counts.bad=0` 기준 추가.
- smoke test가 `/admin/export` 화면의 `status_counts.bad=0` 안내를 확인하도록 보강.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py` 확인 통과.
- TestClient로 `/admin/export` 화면에 `status=ok`, `status_counts.bad=0`, `/admin/recovery`, `/admin/ops`, `NOW_STORAGE_DIR` 안내가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 23:25 KST

### 다음 작업 시작

- 백업 검증 API 응답에 검증 상태 집계 추가.

### 구현 내용

- `POST /api/v1/admin/export/verify` 응답에 `status_counts` 추가.
- 검증 결과 전체 상태를 `bad > warn > ok` 우선순위로 계산하는 `_verification_status()` 추가.
- smoke test가 정상 백업과 빈 백업 검증 응답의 `status_counts`를 확인하도록 보강.
- README와 RECOVERY 문서에 `status_counts` 기준을 추가.
- preflight가 README/RECOVERY의 `status_counts` 문서화 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py`, `preflight.py` 확인 통과.
- TestClient로 정상 백업 검증의 `status_counts.bad=0`, 빈 백업 검증의 `status_counts.bad>=1` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 23:10 KST

### 다음 작업 시작

- 도움말 화면의 배포/복구 운영 흐름 요약 보강.

### 구현 내용

- `/admin/help`의 배포 체크리스트 카드에 배포 직후 `/admin/export` 백업 확인 안내 추가.
- `/admin/help`의 복구 절차 카드에 `bad`, `warn`, `/admin/ops` 대응 기준 추가.
- smoke test가 도움말 화면의 배포 후 백업 확인 안내와 복구 검증 결과 대응 안내를 확인하도록 보강.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py` 확인 통과.
- TestClient로 `/admin/help` 화면에 배포 직후 백업 확인, `bad/warn`, `/admin/ops`, 배포/복구 링크가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 22:55 KST

### 다음 작업 시작

- 복구 절차 문서의 백업 검증 결과 판단 기준 보강.

### 구현 내용

- `server/RECOVERY.md`의 복구 전 확인 단계에 `warn` 처리 기준 추가.
- 복원 판단 기준에 `bad` 없음, `warn` 원인 확인, `/admin/ops` 확인 기준 추가.
- preflight가 RECOVERY 문서의 `bad`, `warn`, `/admin/ops` 대응 기준 포함 여부를 확인하도록 보강.
- smoke test가 `/admin/recovery` 화면의 `bad`, `warn`, 운영 점검 안내를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py`, `smoke_test.py` 확인 통과.
- TestClient로 `/admin/recovery` 화면에 `bad`, `warn`, `/admin/ops`, `content_sha256`, `backup_schema_version` 안내가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 22:40 KST

### 다음 작업 시작

- `/admin/export` 화면에 백업 검증 결과 판단 기준 추가.

### 구현 내용

- `/admin/export` 화면의 백업 검증 예시 아래에 결과 판단 기준 추가.
- `status=ok`, `warn/bad` 시 `/admin/recovery`, `/admin/ops` 확인 안내 추가.
- 원본 음성 파일은 백업 JSON에 포함되지 않고 `NOW_STORAGE_DIR`/Docker 볼륨 별도 보존이 필요하다는 안내 추가.
- smoke test가 `/admin/export` 화면의 검증 성공 기준, 복구 절차 링크, 원본 음성 파일 보존 안내를 확인하도록 보강.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py` 확인 통과.
- TestClient로 `/admin/export` 화면에 `status=ok`, `/admin/recovery`, `/admin/ops`, `NOW_STORAGE_DIR`, 검증 API 안내가 포함되는지 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 22:25 KST

### 다음 작업 시작

- 배포 체크리스트에 백업 내보내기/검증 확인 절차 추가.

### 구현 내용

- `server/DEPLOY.md`에 배포 직후 `/admin/export` 화면 기준 백업 내보내기/검증 확인 절차 추가.
- API 확인용 `GET /api/v1/admin/export/all`, `POST /api/v1/admin/export/verify` 예시 추가.
- 운영자가 직접 파이썬 조각을 실행하지 않도록 화면/API 중심으로 문서화.
- preflight가 배포 체크리스트의 백업 내보내기/검증 절차 포함 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `DEPLOY.md`에 임시 Python heredoc 예시가 남아 있지 않은 것 확인.

## 2026-05-18 22:10 KST

### 다음 작업 시작

- README와 preflight에 현재 API 버전 기준 문서화 확인 추가.

### 구현 내용

- `server/README.md`의 `/api/v1/server` 설명에 현재 `api_version=v1` 기준 명시.
- preflight가 README의 현재 API 버전 문서화 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 21:55 KST

### 다음 작업 시작

- 계층 메모 단계 제한과 지원 메모 타입 기준을 공통 상수로 정리.

### 구현 내용

- `server/app/core/capabilities.py`에 `MAX_TREE_NOTE_LEVEL`, `SUPPORTED_NOTE_TYPES` 상수 추가.
- `/api/v1/server` capability의 `max_tree_note_level`, `supported_note_types`가 공통 상수를 사용하도록 변경.
- smoke test가 `MAX_TREE_NOTE_LEVEL`, `SUPPORTED_NOTE_TYPES` 기준으로 capability를 확인하도록 변경.
- preflight가 capability 소스와 smoke test의 계층 단계/지원 타입 상수 사용 여부를 확인하도록 보강.

### 검증

- `py_compile`로 capability, smoke test, preflight 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/server`의 `max_tree_note_level=3`, `supported_note_types=daily/tree/record` 확인 통과.
- `server_capabilities()`가 `supported_note_types` list를 응답마다 복사하는 것 확인 통과.

## 2026-05-18 21:40 KST

### 다음 작업 시작

- 2단계 인증 구현 상태값 `planned`를 공통 상수로 정리.

### 구현 내용

- `server/app/core/capabilities.py`에 `TWO_FACTOR_AUTH_STATUS` 상수 추가.
- `/api/v1/server` capability의 `two_factor_auth`가 공통 상수를 사용하도록 변경.
- Admin API와 monitor 운영 화면의 공용 서버 2단계 인증 안내 문구가 같은 상수를 사용하도록 변경.
- smoke test가 `TWO_FACTOR_AUTH_STATUS` 기준으로 capability를 확인하도록 변경.
- preflight가 capability/Admin API/monitor/smoke test의 2단계 인증 상태 기준을 확인하도록 보강.

### 검증

- `py_compile`로 capability, Admin API, monitor, smoke test, preflight 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/server`, `/api/v1/admin/ops`, `/admin/ops`의 `planned` 상태 표시 확인 통과.

## 2026-05-18 21:25 KST

### 다음 작업 시작

- preflight가 백업 API 버전 기준의 공통 상수 사용 여부를 점검하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`에 Admin API 소스와 capability 소스 존재 확인 추가.
- `app.core.capabilities.API_VERSION` 정의 여부를 preflight에서 확인.
- 백업 export/verify가 공통 `API_VERSION`을 사용하는지 preflight에서 확인.
- smoke test가 API 버전 확인을 포함하는지 preflight에서 확인.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 21:10 KST

### 다음 작업 시작

- 백업 export/검증의 API 버전 기준을 공통 상수로 정리.

### 구현 내용

- `server/app/api/admin.py`의 전체 백업 `api_version` 값을 공통 `API_VERSION` 상수로 변경.
- 백업 검증 API의 기대 API 버전도 공통 `API_VERSION` 상수를 사용하도록 변경.
- smoke test가 `/api/v1/server` 응답과 전체 백업의 API 버전을 같은 기준값으로 확인하도록 보강.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/admin/export/all` 백업 생성 후 `/api/v1/admin/export/verify` 검증 통과.

## 2026-05-18 20:55 KST

### 다음 작업 시작

- 서버 capability 정의를 공통 상수로 분리.

### 구현 내용

- `server/app/core/capabilities.py` 신규 추가.
- `API_VERSION`, `SERVER_CAPABILITIES`, `server_capabilities()`를 공통 정의로 분리.
- `/api/v1/server` 응답이 공통 capability 정의를 사용하도록 변경.
- `supported_note_types`는 응답마다 새 list로 복사해 외부 수정 영향이 없도록 처리.

### 검증

- `py_compile`로 `capabilities.py`, `server.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/server`의 `api_version`, capability 응답이 공통 상수와 일치하는 것 확인.
- `server_capabilities()`가 `supported_note_types` list를 응답마다 복사하는 것 확인.

## 2026-05-18 20:40 KST

### 다음 작업 시작

- 서버 README에 `/api/v1/server` capability 키 목록 추가.

### 구현 내용

- `server/README.md`의 `GET /api/v1/server` 설명에 현재 capability 키 목록 추가.
- `max_tree_note_level=3`, `supported_note_types=daily/tree/record` 기준 명시.
- preflight가 README의 `supported_note_types`, `max_tree_note_level`, `user_access_tokens` 문서화 여부를 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- README capability 문서화 확인 항목 3개가 OK로 출력되는 것 확인.
- capability 키 문구 재검색 통과.

## 2026-05-18 20:25 KST

### 다음 작업 시작

- smoke test의 서버 capability 확인 범위 보강.

### 구현 내용

- `server/scripts/smoke_test.py`가 `sync`, `recordings`, `analysis_jobs`, `admin_ops` capability 확인.
- 사용자 계정/프로필/시간대/그룹/사용자별 토큰 capability 확인 범위 보강.
- `max_tree_note_level=3`, `supported_note_types=["daily", "tree", "record"]` 확인 추가.
- preflight가 smoke test의 주요 capability 확인 문구 포함 여부를 점검하도록 보강.

### 검증

- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- 새 capability smoke 포함 여부 체크가 OK로 출력되는 것 확인.
- TestClient로 `/api/v1/server` capability 전체 기준 확인 통과.

## 2026-05-18 20:10 KST

### 다음 작업 시작

- 관리자 도움말의 공용 서버 운영 점검 설명 보강.

### 구현 내용

- `/admin/help`의 공용 NowNote 서버 항목에 `/admin/ops`의 공용 서버 로그인 화면, 실제 2단계 인증, 공개 운영 환경 점검 설명 추가.
- smoke test가 `/admin/help` 안의 공용 서버 로그인 화면 점검 안내와 `/admin/deploy` 링크를 확인하도록 보강.
- preflight가 smoke test 안의 공용 운영 도움말 확인 여부를 점검하도록 보강.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py`, `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `Smoke covers public ops help` 항목이 OK로 출력되는 것 확인.
- TestClient로 `/admin/help`에 공용 서버 로그인 화면 점검 안내와 `/admin/deploy` 링크가 표시되는 것 확인.
- `git diff --check` 통과.

## 2026-05-18 19:55 KST

### 다음 작업 시작

- 서버 README의 운영 점검 API 설명을 현재 점검 항목 범위에 맞게 갱신.

### 구현 내용

- `server/README.md`의 운영 점검 API 설명에 사용자 상태 포함.
- 공용 서버 오픈 전 남은 로그인 화면, 실제 2단계 인증, 공개 운영 환경 항목도 정보성 점검으로 반환한다고 명시.

### 검증

- README와 진행 기록의 운영 점검 API 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 19:40 KST

### 다음 작업 시작

- preflight 문서/스크립트 내용 확인 로직을 공통 헬퍼로 정리.

### 구현 내용

- `check_text_contains()` 헬퍼 추가.
- `RECOVERY.md` 핵심 기준 확인을 헬퍼 기반으로 정리.
- `DEPLOY.md` 핵심 명령 확인을 헬퍼 기반으로 정리.
- smoke test 내용 확인을 헬퍼 기반으로 정리.
- 기존 점검 의미는 유지하되 capability 항목은 개별 체크로 더 명확히 분리.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- 문서/배포/smoke 핵심 항목이 기존처럼 OK로 출력되는 것 확인.
- 분리된 capability 체크 4개가 OK로 출력되는 것 확인.

## 2026-05-18 19:25 KST

### 다음 작업 시작

- preflight가 복구 절차 문서의 핵심 복구 기준 포함 여부를 확인하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`가 `RECOVERY.md` 안의 `/api/v1/admin/export/verify` 포함 여부 확인.
- `RECOVERY.md` 안의 `content_sha256` 포함 여부 확인.
- `RECOVERY.md` 안의 원본 녹음 파일 별도 보존 기준 포함 여부 확인.
- `RECOVERY.md` 안의 복원 전 DB/저장소 별도 백업 기준 포함 여부 확인.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- 복구 절차 핵심 기준 확인 항목 4개가 OK로 출력되는 것 확인.
- 핵심 복구 기준 문구 재검색 통과.

## 2026-05-18 19:10 KST

### 다음 작업 시작

- preflight가 배포 체크리스트의 핵심 명령 포함 여부를 확인하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`가 `DEPLOY.md` 안의 `git pull origin main` 포함 여부 확인.
- `DEPLOY.md` 안의 `python3 scripts/preflight.py` 포함 여부 확인.
- `DEPLOY.md` 안의 `docker compose up --build -d` 포함 여부 확인.
- `DEPLOY.md` 안의 `python3 scripts/smoke_test.py` 포함 여부 확인.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- 배포 체크리스트 핵심 명령 확인 항목 4개가 OK로 출력되는 것 확인.
- 핵심 명령 문구 재검색 통과.

## 2026-05-18 18:55 KST

### 다음 작업 시작

- 관리자 문서 화면의 중복 HTML 렌더링 정리.

### 구현 내용

- `_admin_markdown_doc_html()` 공통 렌더러 추가.
- `/admin/recovery`, `/admin/deploy` 화면이 공통 렌더러를 호출하도록 정리.
- 기존 문서 내용, 제목, 관리자 인증 흐름은 유지.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/admin/recovery`, `/admin/deploy` 관리자 인증 접근 확인 통과.
- 복구 화면에 `RECOVERY.md` 본문과 배포 링크가 표시되는 것 확인.
- 배포 화면에 `DEPLOY.md` 본문과 복구 링크가 표시되는 것 확인.
- `git diff --check` 통과.

## 2026-05-18 18:40 KST

### 다음 작업 시작

- 관리자 화면에서 WSL/Docker 배포 체크리스트를 직접 확인할 수 있게 연결.

### 구현 내용

- `/admin/deploy` 읽기 전용 화면 추가.
- `/admin/help`에 배포 체크리스트 카드와 `/admin/deploy` 링크 추가.
- smoke test가 `/admin/deploy` 화면과 핵심 배포 명령을 확인하도록 보강.
- preflight가 smoke test의 `/admin/deploy` 포함 여부를 확인하도록 보강.
- 서버 README의 운영 화면 목록과 설명에 `/admin/deploy` 추가.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py`, `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `Smoke covers deploy admin page` 항목이 OK로 출력되는 것 확인.
- TestClient로 `/admin/help`와 `/admin/deploy` 관리자 인증 접근 확인 통과.
- `/admin/deploy` 화면에 `DEPLOY.md` 본문과 `git pull origin main` 안내가 표시되는 것 확인.
- `git diff --check` 통과.

## 2026-05-18 18:25 KST

### 다음 작업 시작

- WSL/Docker 서버 배포 체크리스트 문서 추가.

### 구현 내용

- `server/DEPLOY.md` 신규 작성.
- WSL/Linux 기준 `git pull`, `.env` 확인, preflight, Docker Compose 시작, health 확인, smoke test, 운영 화면 확인 순서 정리.
- `server/README.md`에서 `DEPLOY.md` 링크 추가.
- preflight가 `DEPLOY.md` 존재 여부도 확인하도록 보강.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `Deploy checklist exists` 항목이 OK로 출력되는 것 확인.
- 배포 체크리스트 핵심 명령과 README 링크 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 18:10 KST

### 다음 작업 시작

- Web/모바일 도움말에 공용 서버 오픈 전 운영 점검 기준 반영.

### 구현 내용

- `web/help.html` 서버 연결 사용자 항목에 공용 서버 오픈 전 운영 점검 기준 추가.
- Web 도움말 영어 i18n에 public operations readiness 문구 추가.
- 모바일 `help_page.dart` 서버 연결 사용자 항목에 동일한 운영 점검 기준 추가.

### 검증

- 문구 재검색으로 Web/모바일 도움말 반영 확인.
- Python 표준 HTMLParser로 `web/help.html` 파싱 통과.
- `git diff --check` 통과.
- Dart 실행 파일이 PATH에 없어 모바일 도움말은 정적 검색으로 확인.

## 2026-05-18 17:55 KST

### 다음 작업 시작

- 운영 점검 화면/API에 공용 서버 오픈 전 남은 인증/운영 항목 표시.

### 구현 내용

- `/api/v1/admin/ops`에 공용 서버 로그인 화면, 공용 서버 2단계 인증, 공개 운영 환경 점검 항목 추가.
- `/admin/ops` 화면에도 같은 정보성 점검 항목 표시.
- smoke test가 운영 점검 API에 위 3개 항목이 있는지 확인하도록 보강.

### 검증

- `py_compile`로 `admin.py`, `monitor.py`, `smoke_test.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/admin/ops`와 `/admin/ops`에 공용 서버 오픈 대기 항목 3개가 표시되는 것 확인.
- `git diff --check` 통과.

## 2026-05-18 17:40 KST

### 다음 작업 시작

- 공용 서버 preflight 실패 의미를 사용자 문서에 명확히 반영.

### 구현 내용

- `server/README.md`에 공용 서버 preflight 명령과 현재 의도적 실패 항목 설명 추가.
- 서버 README 다음 단계에 현재 1차 서버의 public preflight 실패가 정상적인 미완료 표시임을 명시.
- 한국어/영어 도움말에 public preflight 실패의 의미를 추가.

### 검증

- 문구 재검색으로 README, 한국어 도움말, 영어 도움말 반영 확인.
- `git diff --check` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.

## 2026-05-18 17:25 KST

### 다음 작업 시작

- 서버 사용자 운영 capability 표시 정합성 보강.

### 구현 내용

- Web 서버 capability 표시 항목에 시간대, 사용자 그룹, 2단계 상태, 2단계 예정 추가.
- 모바일 서버 연결 성공 메시지에 시간대, 사용자 그룹, 2단계 예정 표시 추가.
- smoke test가 사용자 프로필, 시간대, 그룹, 2단계 상태, 2단계 인증 예정 capability를 확인하도록 보강.
- preflight가 smoke test의 사용자 운영 capability 확인 여부를 점검하도록 보강.

### 검증

- `node --check web/app.js` 통과.
- `py_compile`로 `smoke_test.py`, `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- TestClient로 `/api/v1/server`의 사용자 운영 capability 응답 확인 통과.
- 모바일 서버 연결 메시지 문구는 정적 검색으로 반영 확인.

## 2026-05-18 17:10 KST

### 다음 작업 시작

- preflight가 관리자 복구 화면까지 smoke test 범위에 포함되었는지 확인하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`가 smoke test 안의 `/admin/recovery` 확인.
- 배포 전 점검에서 복구 화면 smoke 누락을 실패로 감지.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `Smoke covers recovery admin page` 항목이 OK로 출력되는 것 확인.

## 2026-05-18 16:55 KST

### 다음 작업 시작

- 서버 복구 절차 문서를 관리자 화면에서 직접 확인할 수 있게 연결.

### 구현 내용

- `/admin/help`의 복구 절차 안내를 실제 관리자 화면 링크로 수정.
- `/admin/recovery` 읽기 전용 화면을 추가해 `server/RECOVERY.md` 내용을 표시.
- smoke test가 `/admin/recovery` 화면과 백업 검증 API 안내 문구를 확인하도록 보강.
- 서버 README의 관리 화면 목록에 `/admin/recovery` 추가.

### 검증

- `py_compile`로 `monitor.py`, `smoke_test.py` 확인 통과.
- TestClient로 `/admin/help`와 `/admin/recovery` 관리자 인증 접근 확인 통과.
- `/admin/recovery` 화면에 `RECOVERY.md` 본문과 백업 검증 API 안내가 표시되는 것 확인.
- `git diff --check` 통과.

## 2026-05-18 16:35 KST

### 다음 작업 시작

- preflight가 서버 복구 절차 문서 존재를 확인하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`에서 `RECOVERY.md` 경로 확인 추가.
- 배포 전 점검에서 복구 절차 문서 누락을 실패로 감지.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `Recovery procedure exists` 항목이 OK로 출력되는 것 확인.

## 2026-05-18 16:20 KST

### 다음 작업 시작

- 서버 장애 복구 절차 문서 추가.

### 구현 내용

- `server/RECOVERY.md` 신규 작성.
- 복구 전 백업 생성/검증 순서 정리.
- 전체 백업 JSON에 포함되는 항목과 포함되지 않는 항목 명시.
- Docker 서버 점검 순서, 복원 판단 기준, 공용 서버 주의사항 정리.
- 서버 README에서 `RECOVERY.md`를 연결.

### 검증

- `RECOVERY.md`, 백업 검증 API, `content_sha256`, 원본 녹음 파일, 사용자별 접속 토큰 관련 핵심 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 16:05 KST

### 다음 작업 시작

- 서버 preflight가 백업 내보내기/검증 smoke 범위를 확인하도록 보강.

### 구현 내용

- `server/scripts/preflight.py`가 smoke test 안의 `/api/v1/admin/export/all` 확인.
- smoke test 안의 `/api/v1/admin/export/verify` 확인.
- smoke test 안의 `backup_export`, `backup_verify` capability 확인.
- 공용 서버 preflight 메시지에서 이미 구현된 백업 표현은 빼고 복구 절차 확인으로 좁힘.
- 서버 README 다음 단계에서도 백업/복구를 복구 절차 점검으로 정리.

### 검증

- `py_compile`로 `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- 새 smoke 백업 범위 확인 체크 3개가 모두 OK로 출력되는 것 확인.

## 2026-05-18 15:50 KST

### 다음 작업 시작

- 모바일 앱 내부 도움말에 서버 백업 검증 설명 반영.

### 구현 내용

- `now_app/lib/features/settings/help_page.dart`의 서버 연결 사용자 항목에 서버 백업 검증 설명 추가.
- 스키마, 체크섬, 필수 항목, 토큰 민감정보 노출 여부를 확인한다고 안내.

### 검증

- 모바일 도움말의 서버 백업 검증 문구 재검색 통과.
- `git diff --check` 통과.
- Dart/Flutter 실행 환경이 PATH에 없어 컴파일 검증은 수행하지 못함.

## 2026-05-18 15:35 KST

### 다음 작업 시작

- Web 도움말 화면에 서버 백업 검증 설명 반영.

### 구현 내용

- `web/help.html` 서버 연결 사용자 항목에 백업 검증 설명 추가.
- 영어 i18n에도 schema, checksum, required sections, token-sensitive data exposure 설명 추가.

### 검증

- `server.point.backupVerify` 한국어/영어 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 15:20 KST

### 다음 작업 시작

- 한국어/영어 도움말에 서버 백업 검증 기능 반영.

### 구현 내용

- `docs/HELP.md` 서버 연결 사용자 기능 목록에 `서버 백업 검증` 추가.
- 서버 백업 검증이 스키마, 체크섬, 필수 항목, 토큰 민감정보 노출 여부를 확인한다고 설명.
- `docs/HELP.en.md`에도 동일한 영어 설명 추가.

### 검증

- 도움말 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 15:05 KST

### 다음 작업 시작

- 모바일 서버 연결 메시지에도 백업 capability 표시 반영.

### 구현 내용

- 모바일 서버 연결 성공 메시지에 `backup_export`가 true이면 `백업` 표시.
- `backup_verify`가 true이면 `백업 검증` 표시.
- capability가 없으면 각각 `백업 미확인`, `검증 미확인`으로 표시.

### 검증

- `backup_export`, `backup_verify`, `백업 미확인`, `검증 미확인` 문구 재검색 완료.
- `where.exe dart`, `where.exe flutter`는 PATH에서 실행 파일을 찾지 못해 Dart/Flutter 컴파일 검증은 수행하지 못함.

## 2026-05-18 14:50 KST

### 다음 작업 시작

- Web/설치형 설정 화면의 서버 capability 표시를 백업 기능까지 확장.

### 구현 내용

- Web i18n에 백업, 백업 검증 capability 라벨 추가.
- 서버 capability 렌더링에서 `backup_export`, `backup_verify` 표시.
- Web README에 서버 연결 테스트 후 백업 내보내기/검증 capability를 표시한다고 반영.

### 검증

- `node --check web/app.js` 통과.
- 백업 capability 라벨과 렌더링 조건 재검색 통과.

## 2026-05-18 14:30 KST

### 다음 작업 시작

- 서버 정보 API에 백업 기능 capability 표시 추가.

### 구현 내용

- `/api/v1/server`의 `capabilities`에 `backup_export`, `backup_verify` 추가.
- smoke test에서 두 capability가 `true`인지 확인.
- 서버 README의 server info 설명에 백업 내보내기/검증 지원 여부를 반영.

### 검증

- `py_compile`로 `server.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 `/api/v1/server`의 `backup_export=true`, `backup_verify=true` 확인 통과.

## 2026-05-18 14:15 KST

### 다음 작업 시작

- 백업 검증 API 응답 형식 문서 보완.

### 구현 내용

- 서버 README에 검증 응답의 `checks`가 항목별 `ok`/`bad`와 기대값/실제값을 반환한다고 명시.

### 검증

- 검증 응답 설명 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 14:00 KST

### 다음 작업 시작

- 백업 검증 API의 빈 요청 처리 회귀 방지 테스트 추가.

### 구현 내용

- smoke test에서 `POST /api/v1/admin/export/verify`에 빈 백업 `{}`을 보내는 검증 추가.
- 빈 백업은 `bad` 상태와 비어 있지 않은 checks를 반환해야 함.

### 검증

- `py_compile`로 `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 빈 백업 검증이 `bad`, 8개 checks, 요약 `notes=None`을 반환하는 것 확인.

## 2026-05-18 13:45 KST

### 다음 작업 시작

- smoke test에서 `/admin/export` 화면의 백업 검증 안내 회귀 방지.

### 구현 내용

- smoke test의 `/admin/export` HTML 검사에 백업 검증 API 경로 포함 여부 확인 추가.
- 백업 검증 요청 예시의 `YOUR_ADMIN_TOKEN` 문구 포함 여부 확인 추가.

### 검증

- `py_compile`로 `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 `/admin/export` HTML에 백업 검증 API 경로와 `YOUR_ADMIN_TOKEN` 예시가 포함되는 것 확인.

## 2026-05-18 13:30 KST

### 다음 작업 시작

- 백업 검증 API 응답에 운영자가 바로 볼 수 있는 항목별 요약 추가.

### 구현 내용

- `POST /api/v1/admin/export/verify` 응답에 `summary` 추가.
- 요약에는 메모, 녹음, 사용자, 분석 작업, 동기화 이력 건수와 `exported_at`, `content_sha256` 포함.
- smoke test에 검증 요약의 메모 건수 존재 확인 추가.
- 서버 README의 검증 API 설명을 요약 포함 기준으로 갱신.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 정상 백업/체크섬 오류 백업 모두 검증 요약을 반환하는 것 확인.

## 2026-05-18 13:10 KST

### 다음 작업 시작

- 운영자가 백업 검증 API를 바로 사용할 수 있도록 화면/문서에 요청 예시 추가.

### 구현 내용

- `/admin/export` 화면에 백업 검증 요청 예시 섹션 추가.
- 서버 README에 `curl` 기반 백업 검증 요청 형식 추가.
- 복원 기능은 추가하지 않고 검증 안내만 보강.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- FastAPI `TestClient`로 `/admin/export` 화면에 백업 검증 요청 예시가 포함되는 것 확인.

## 2026-05-18 12:55 KST

### 다음 작업 시작

- `/admin/export` 화면 안내에 백업 검증 API 사용 경로 추가.

### 구현 내용

- 내보내기 화면 안내문에 `POST /api/v1/admin/export/verify`를 백업 파일 검증 API로 표시.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- 백업 검증 API 안내 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 12:35 KST

### 다음 작업 시작

- 전체 백업 JSON 검증 API 추가.

### 구현 내용

- `POST /api/v1/admin/export/verify` 추가.
- 백업 이름, 스키마 버전, API 버전, 녹음 파일 포함 여부, 삭제 표시 메모 포함 여부 검증.
- 필수 백업 섹션 존재 여부 검증.
- `content_sha256` 재계산 검증.
- 사용자 항목에 원문 토큰 또는 토큰 해시가 포함됐는지 검증.
- smoke test에 전체 백업 생성 후 검증 API 호출 추가.
- 서버 README에 백업 검증 API 설명 추가.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 정상 백업 검증 `ok` 확인.
- 체크섬을 깨뜨린 백업 검증이 `bad`와 체크섬 실패를 반환하는 것 확인.

## 2026-05-18 12:15 KST

### 다음 작업 시작

- `/admin/export` 화면 안내에 전체 백업 체크섬 확인 기준 추가.

### 구현 내용

- 내보내기 화면 안내문에 `content_sha256`과 `X-Now-Backup-Sha256` 설명 추가.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- 체크섬 안내 문구 재검색 통과.
- `git diff --check` 통과.

## 2026-05-18 12:00 KST

### 다음 작업 시작

- smoke test에서 전체 백업 체크섬을 실제 본문 기준으로 재계산해 검증.

### 구현 내용

- smoke test에 SHA-256 재계산 로직 추가.
- `content_sha256`을 제외한 백업 본문을 정렬 JSON으로 직렬화해 서버 계산값과 비교.

### 검증

- `py_compile`로 `smoke_test.py` 확인 통과.
- FastAPI `TestClient` 응답을 기준으로 `content_sha256` 제외 본문 SHA-256 재계산 일치 확인 통과.

## 2026-05-18 11:40 KST

### 다음 작업 시작

- 전체 백업 JSON의 식별/무결성 확인용 체크섬 추가.

### 구현 내용

- 전체 백업 응답에 `content_sha256` 추가.
- 전체 백업 다운로드 응답 헤더에 `X-Now-Backup-Sha256` 추가.
- 체크섬은 백업 본문을 정렬된 JSON으로 직렬화한 뒤 SHA-256으로 계산.
- smoke test에 체크섬 형식 검증 추가.
- 서버 README에 체크섬 확인 기준 추가.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 `content_sha256` 형식과 `X-Now-Backup-Sha256` 헤더 일치 확인 통과.

## 2026-05-18 11:20 KST

### 다음 작업 시작

- 전체 백업이 삭제 표시 메모를 포함한다는 기준을 메타정보와 문서로 명시.

### 구현 내용

- 전체 백업 JSON에 `includes_deleted_notes: true` 추가.
- smoke test에 삭제 표시 메모 포함 기준 검증 추가.
- 서버 README에 전체 백업은 삭제 표시 메모도 포함한다고 명시.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 전체 백업의 `includes_deleted_notes=true`, `includes_recording_files=false` 확인 통과.

## 2026-05-18 11:05 KST

### 다음 작업 시작

- 운영 화면과 문서에 전체 백업 민감 정보 제외 기준 명시.

### 구현 내용

- `/admin/export` 안내문에 사용자별 접속 토큰 원문과 토큰 해시는 포함하지 않는다고 표시.
- 서버 README에 백업 JSON은 토큰 발급 여부만 표시한다는 설명 추가.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- 안내 문구 재검색으로 `/admin/export`와 서버 README 반영 확인.
- `git diff --check` 통과.

## 2026-05-18 10:50 KST

### 다음 작업 시작

- 전체 백업 JSON에 사용자 토큰 민감 정보가 포함되지 않는지 smoke test로 고정.

### 구현 내용

- smoke test에서 사용자별 토큰 발급 후 전체 백업을 다시 조회.
- 전체 백업의 사용자 항목에 `access_token_hash`가 없는지 확인.
- 발급 직후 원문 토큰이 전체 백업 사용자 JSON에 포함되지 않는지 확인.

### 검증

- `py_compile`로 `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 사용자 토큰 발급 후 전체 백업에 `access_token_hash`와 원문 토큰이 포함되지 않는 것 확인.

## 2026-05-18 10:35 KST

### 다음 작업 시작

- 전체 백업 JSON 식별 메타정보 보강.

### 구현 내용

- 전체 백업 응답에 `backup_schema_version`, `api_version`, `server`, `includes_recording_files` 추가.
- 백업 파일명 생성과 `exported_at` 기준 시각을 같은 값으로 맞춤.
- smoke test에 백업 스키마 버전, API 버전, 녹음 파일 포함 여부 검증 추가.
- 서버 README에 전체 백업 메타정보와 녹음 파일 미포함 기준 추가.

### 검증

- `py_compile`로 `admin.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 전체 백업 메타정보, 녹음 파일 미포함 값, 다운로드 파일명 헤더 확인 통과.

## 2026-05-18 10:15 KST

### 다음 작업 시작

- 전체 백업 JSON이 브라우저에서 파일 다운로드로 인식되도록 보완.

### 구현 내용

- `GET /api/v1/admin/export/all` 응답에 `Content-Disposition` 헤더 추가.
- 파일명은 `nownote-server-backup-YYYYMMDD-HHMMSS.json` 형식으로 생성.
- JSON 응답 변환은 FastAPI `jsonable_encoder`를 사용해 날짜 필드 직렬화 기준 유지.

### 검증

- `py_compile`로 `admin.py` 확인 통과.
- FastAPI `TestClient`로 `/api/v1/admin/export/all`의 JSON 구조와 `Content-Disposition` 헤더 확인 통과.

## 2026-05-18 09:55 KST

### 다음 작업 시작

- 운영 백업용 전체 JSON 내보내기 추가.

### 구현 내용

- `GET /api/v1/admin/export/all` 추가.
- 전체 백업에는 메모, 녹음 메타데이터, 사용자, 분석 작업, 동기화 이력을 함께 포함.
- `/admin/export` 화면에 `전체 백업` 링크 추가.
- 내보내기 요약에 전체 export 대상 건수 추가.
- smoke test에 전체 백업 API 검증 추가.

### 검증

- `py_compile`로 `admin.py`, `monitor.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 `/api/v1/admin/export/all`, `/api/v1/admin/export/summary`, `/admin/export` 링크 확인 통과.

## 2026-05-18 09:35 KST

### 다음 작업 시작

- 운영자가 서버 백업/내보내기 전에 항목별 건수를 화면과 API로 확인할 수 있게 보완.

### 구현 내용

- `GET /api/v1/admin/export/summary` 추가.
- `/admin/export` 화면에 전체 메모, 삭제 표시, 녹음 메타데이터, 사용자 건수 카드 추가.
- 내보내기 링크 표에 항목별 건수와 요약 JSON 링크 추가.
- smoke test에 내보내기 요약 API 검증 추가.
- 서버 README의 내보내기 화면 설명 갱신.

### 검증

- `py_compile`로 `admin.py`, `monitor.py`, `smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 `/api/v1/admin/export/summary`와 `/admin/export` 요약 표시 확인 통과.

## 2026-05-18 09:10 KST

### 다음 작업 시작

- 서버 README의 다음 단계가 서버 운영 작업과 앱 출시 검증 작업을 섞어 보여주는 부분 정리.

### 구현 내용

- `server/README.md`의 다음 단계를 `서버 운영`과 `앱/출시 연계`로 분리.
- 개인 서버, 공용 서버, 공개 운영 점검, Android 출시 검증 항목의 책임 범위를 구분.

### 검증

- 문서 변경 후 `git diff --check` 통과.

## 2026-05-18 08:30 KST

### 다음 작업 시작

- 사용자별 접속 토큰이 실제 사용됐는지 운영 화면에서 확인할 수 있도록 보완.

### 구현 내용

- `/admin/users` 사용자 목록에 `토큰 사용` 열 추가.
- 사용자 수정 화면의 토큰 발급 영역에 `마지막 사용` 시각 추가.
- 토큰이 아직 사용되지 않은 경우 기존 날짜 포맷 기준으로 `-` 표시.
- 서버 README의 사용자 관리 설명에 토큰 발급/사용 상태 확인을 반영.

### 검증

- `py_compile`로 `monitor.py` 확인 통과.
- FastAPI `TestClient`로 `/admin/users`의 `토큰 사용` 열과 사용자 수정 화면의 `마지막 사용` 표시 확인 통과.
- `git diff --check` 통과.

## 2026-05-18 08:45 KST

### 다음 작업 시작

- 사용자별 토큰을 사용하는 smoke test에서 마지막 사용 시각 갱신까지 확인.

### 구현 내용

- `USER_TOKEN`이 설정된 smoke test 실행에서는 `/api/v1/sync` 이후 `local_user`의 `access_token_last_used_at`이 갱신됐는지 확인.
- 갱신되지 않으면 smoke test가 실패하도록 처리.

### 검증

- `py_compile`로 `server/scripts/smoke_test.py` 확인 통과.
- FastAPI `TestClient`로 사용자별 토큰을 사용한 `/api/v1/sync` 후 `access_token_last_used_at` 갱신 확인.
- `git diff --check` 통과.

## 2026-05-18 07:20 KST

### 다음 작업 시작

- 사용자별 접속 토큰 운영 상태를 점검 화면에서 더 명확하게 보이도록 보완.

### 구현 내용

- `/api/v1/admin/ops`와 `/admin/ops`에서 사용자별 토큰 필수 여부와 토큰 없는 사용자 수를 표시.
- `NOW_USER_TOKEN_REQUIRED=true`인데 토큰 없는 사용자가 있으면 점검 상태를 `warn`으로 표시.
- 사용자 목록 표의 누락된 `토큰` 헤더 추가.

### 검증

- `py_compile`로 `admin.py`, `monitor.py` 확인 통과.
- FastAPI `TestClient`에서 `NOW_USER_TOKEN_REQUIRED=true`와 토큰 없는 사용자 기준 `/api/v1/admin/ops`가 `warn`을 반환하는 것 확인.
- 사용자 목록 표 헤더에 `토큰` 열이 있는지 재검색 완료.
- `git diff --check` 통과.

## 2026-05-18 07:40 KST

### 다음 작업 시작

- 공용 서버 모드에서 스모크 테스트가 사용자별 접속 토큰을 사용할 수 있도록 보완.

### 구현 내용

- `server/scripts/smoke_test.py`에 `--user-token` 옵션 추가.
- `server/scripts/smoke_test.py`에 `--issue-local-user-token` 옵션 추가.
- 스모크 테스트의 API 요청과 multipart 요청에 `X-Now-User-Token` 헤더 자동 포함.
- 서버 README와 서버 인증 기준 문서에 사용자별 토큰 필수 모드 스모크 테스트 방법 추가.

### 검증

- `py_compile`로 `server/scripts/smoke_test.py` 확인 통과.
- `server/scripts/smoke_test.py --help`에서 새 옵션 표시 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `git diff --check` 통과.

## 2026-05-18 08:00 KST

### 다음 작업 시작

- 사용자 관리에서 토큰 발급 상태별 필터 추가.

### 구현 내용

- 관리자 사용자 API `GET /api/v1/admin/users`에 `token=issued|missing` 필터 추가.
- 사용자 API 응답에 `token_issued`, `token_missing` 집계 추가.
- `/admin/users` 화면에 토큰 필터와 `토큰 없음` 집계 카드 추가.
- 서버 README의 사용자 관리 설명에 토큰 발급 여부 필터 반영.

### 검증

- `py_compile`로 `admin.py`, `monitor.py` 확인 통과.
- FastAPI `TestClient`로 `token=issued`, `token=missing` API 필터와 `/admin/users?token=missing` 화면 확인 통과.
- `git diff --check` 통과.

## 2026-05-18 08:15 KST

### 다음 작업 시작

- 사용자 토큰 필터가 배포 후 smoke test에서도 확인되도록 보강.

### 구현 내용

- smoke test의 관리자 화면 확인 목록에 `/admin/users?token=missing` 추가.
- smoke test에 `GET /api/v1/admin/users?token=missing` 집계 확인 추가.
- smoke test에서 사용자별 토큰 발급 후 `GET /api/v1/admin/users?token=issued` 집계 확인 추가.

### 검증

- `py_compile`로 `server/scripts/smoke_test.py` 확인 통과.
- `server/scripts/smoke_test.py --help` 확인 통과.
- 토큰 필터 smoke test 연결 지점 재검색 완료.
- `git diff --check` 통과.

## 2026-05-18 05:20 KST

### 다음 작업 시작

- 서버 인증/운영 기준을 개인 Docker 서버와 공용 NowNote 서버로 분리 정리.

### 확인 내용

- 현재 서버 API 인증은 `.env`의 단일 `NOW_API_TOKEN` 기준임.
- 사용자 프로필, 시간대, 사용자 그룹, 2단계 인증 사용 여부, 활성 상태 관리는 구현되어 있음.
- 2단계 인증은 실제 로그인 챌린지가 아니라 관리 상태값이며, `/api/v1/server`도 `two_factor_auth: planned`로 표시함.

### 구현 내용

- 서버 인증 기준 문서 `docs/SERVER_AUTH_POLICY.md` 추가.
- 서버 README, 공통 도움말, Web 도움말, 서버 관리 도움말에 개인 서버/공용 서버 인증 차이를 명확히 반영.
- `server/scripts/preflight.py`에 `--public-server` 점검 모드를 추가해, 공용 서버 오픈 전 남은 사용자별 인증/운영 항목을 의도적으로 실패로 표시하도록 함.

### 검증

- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example --public-server`는 사용자별 인증/HTTPS 준비 항목 때문에 의도적으로 실패하는 것 확인.
- `py_compile` 통과.
- `node --check web/app.js` 통과.
- `git diff --check` 통과.

## 2026-05-18 05:35 KST

### 다음 작업 시작

- 공용 서버 인증 준비 상태가 문서뿐 아니라 운영 점검 화면/API에도 보이도록 보완.

### 구현 내용

- `/api/v1/admin/ops` 점검 항목에 `공용 서버 인증` 정보 항목 추가.
- `/admin/ops` 화면의 점검 항목에도 동일한 기준을 표시.
- 상태는 `info`로 두어 개인 Docker 서버의 정상 운영 상태를 불필요하게 `warn`으로 낮추지 않음.

### 검증

- `py_compile`로 `admin.py`, `monitor.py`, `preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `git diff --check` 통과.

## 2026-05-18 05:55 KST

### 다음 작업 시작

- 공용 서버 준비를 위해 사용자별 접속 토큰 발급/저장 구조 추가.

### 구현 내용

- `user_accounts`에 사용자별 접속 토큰 해시, 발급 시각, 마지막 사용 시각 컬럼 추가.
- 기존 DB도 시작 시 누락 컬럼을 추가하도록 최소 스키마 마이그레이션 추가.
- 관리자 API `POST /api/v1/admin/users/{owner_id}/token` 추가.
- 사용자 수정 화면에서 사용자별 접속 토큰 발급/재발급 지원.
- 토큰 원문은 저장하지 않고 발급 직후 한 번만 표시.
- 사용자 export/API 응답에서는 토큰 해시를 숨기고 발급 여부만 표시.
- smoke test에 사용자별 토큰 발급 검증 추가.

### 남은 내용

- 발급된 사용자별 토큰을 실제 데이터 API 요청의 `owner_id`와 묶어 강제 검증하는 단계는 다음 작업으로 진행.

### 검증

- `py_compile`로 DB, 모델, 사용자 서비스, 관리자 API, 모니터 화면, smoke test 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `uv run --with-requirements server/requirements.txt` 환경에서 SQLite 임시 DB 토큰 발급 서비스 검증 통과.
- FastAPI `TestClient`로 관리자 사용자 생성과 사용자별 토큰 발급 API 검증 통과.
- `git diff --check` 통과.

## 2026-05-18 06:15 KST

### 다음 작업 시작

- 발급된 사용자별 접속 토큰을 실제 데이터 API 요청의 `owner_id`와 묶어 검증.

### 구현 내용

- 설정값 `NOW_USER_TOKEN_REQUIRED` 추가. 기본값은 개인 Docker 서버 호환을 위해 `false`.
- `NOW_USER_TOKEN_REQUIRED=true`일 때 데이터 API가 `X-Now-User-Token` 헤더를 요구하도록 추가.
- 메모, 통합 동기화, 녹음, 분석, 사용자 프로필 API에 사용자별 토큰 검증 연결.
- 사용자별 토큰 검증 성공 시 `access_token_last_used_at` 갱신.
- `/api/v1/server` 응답에 `user_token_required`, `user_access_tokens` capability 추가.
- 공용 서버 preflight에서 `NOW_USER_TOKEN_REQUIRED=true` 여부도 점검하도록 추가.

### 검증

- `py_compile`로 설정, 사용자 서비스, 데이터 API, preflight 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example --public-server`는 `NOW_USER_TOKEN_REQUIRED=false`, 실제 2단계 인증, HTTPS/reverse proxy 항목 때문에 의도적으로 실패하는 것 확인.
- FastAPI `TestClient`에서 `NOW_USER_TOKEN_REQUIRED=true` 기준:
  - 사용자 토큰 없음: 401 `user token required`
  - 잘못된 사용자 토큰: 401 `invalid user token`
  - 올바른 사용자 토큰: `/api/v1/sync` 200
- `git diff --check` 통과.

## 2026-05-18 06:35 KST

### 다음 작업 시작

- Web/설치형 서버 연결 설정이 사용자별 접속 토큰을 보낼 수 있도록 보완.

### 구현 내용

- 서버 연결 설정에 `사용자별 접속 토큰` 입력칸 추가.
- Web 설정 저장 구조에 `userToken` 추가.
- 서버 연결 테스트, 프로필, 분석, 동기화 요청에 `X-Now-User-Token` 헤더 추가.
- 서버 capability 표시에 사용자 토큰 지원/필요 상태 표시 추가.
- 공통 도움말과 Web 도움말에 사용자별 접속 토큰 입력 기준 추가.

### 검증

- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- `serverUserToken`, `userToken`, `X-Now-User-Token` 연결 지점 재검색 완료.

## 2026-05-18 06:50 KST

### 다음 작업 시작

- 모바일 앱 서버 설정에도 사용자별 접속 토큰 연결.

### 구현 내용

- 모바일 `ServerSettings`에 `userToken` 추가.
- 사용자별 접속 토큰을 `flutter_secure_storage`에 저장.
- 기존 SharedPreferences에 같은 키가 있으면 보안 저장소로 이전하는 공통 로더 사용.
- 모든 모바일 서버 요청에 `X-Now-User-Token` 헤더 추가.
- 모바일 서버 설정 화면에 `사용자별 접속 토큰` 입력칸 추가.
- 공통 도움말에 모바일 사용자별 접속 토큰 입력 기준 추가.

### 검증

- `ServerSettings(` 생성자 호출부 재검색으로 `userToken` 누락 없음 확인.
- `X-Now-User-Token` 모바일 헤더 연결 확인.
- `git diff --check` 통과.
- 현재 Windows 셸 PATH에서 `dart`, `flutter` 명령을 찾지 못해 모바일 정적 분석은 보류.

## 2026-05-18 07:05 KST

### 다음 작업 시작

- 사용자별 토큰 발급/검증 구현 후 공용 서버 preflight와 문서의 남은 항목 표현 정리.

### 구현 내용

- 공용 서버 preflight 실패 문구를 `사용자별 토큰 미구현`에서 `로그인 UI/실제 2단계 인증 미구현` 기준으로 수정.
- 서버 인증 기준 문서와 서버 README의 다음 단계를 현재 구현 상태에 맞게 정리.

### 검증

- `py_compile`로 `server/scripts/preflight.py` 확인 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example --public-server`가 사용자 토큰 필수 설정, 로그인 UI/실제 2단계 인증, HTTPS 운영 항목으로 의도적 실패하는 것 확인.
- 오래된 README 문구 재검색 완료.
- `git diff --check` 통과.

## 2026-05-17 22:35 KST

### 현재 기준점

- 최근 push: `99c413b docs: update server next steps`
- 작업 트리: 정리된 상태에서 다음 작업 시작
- 서버/Web 진행:
  - Docker 기반 서버, 운영 화면, 사용자 관리, 동기화, 녹음 업로드, 분석 작업 API 구현
  - Web/설치형 화면의 서버 연결, 수동 동기화, 서버 기능 표시, 분석 작업 생성/조회 구현
  - smoke test에 동기화, 사용자, 분석 작업, 녹음 업로드 검증 추가

### 이번 작업 목표

- 오류 대비를 위해 이후 진행 상황을 이 파일에 수시 기록
- 다음 구현 후보 확인:
  - 모바일 앱 서버 연결 UI와 Web/설치형 기준 맞추기
  - 모바일 앱 메모/녹음/분석 서버 연결 상태 점검

### 주의 사항

- 기존 기능을 암묵적으로 변경하지 않는다.
- 진행 중 판단이 바뀌면 이 파일에 사유를 기록한다.

## 2026-05-17 22:40 KST

### 확인 내용

- `now_app/lib/services/server_sync_service.dart`에 서버 설정, 연결 테스트, 사용자 프로필, 운영 점검, 메모 동기화 기능이 이미 있음.
- `now_app/lib/features/settings/server_settings_page.dart`에 서버 설정 UI, 프로필, 운영 점검, 메모 동기화 UI가 이미 있음.
- Web/설치형에는 서버 분석 작업 생성/조회가 추가됐지만 모바일 설정 화면에는 아직 없음.

### 다음 작업

- 모바일 서버 설정 화면에 서버 분석 작업 생성/조회 기능 추가.
- 서버 API 기준:
  - `POST /api/v1/analysis/jobs`
  - `GET /api/v1/analysis/jobs?owner_id=...`
- 1차 모바일 구현은 선택 메모 연동 전 단계로, 현재 사용자 기준 최근 분석 작업 조회와 간단한 점검용 분석 작업 등록을 지원한다.

## 2026-05-17 22:47 KST

### 구현 내용

- `ServerAnalysisJob` 모델 추가.
- 모바일 `ServerSyncService`에 분석 작업 조회/생성 메서드 추가.
- 모바일 `ServerSettingsPage`에 분석 작업 카드 추가:
  - 점검 작업 등록
  - 최근 작업 새로고침
  - 최근 5개 작업 상태 표시

### 검증 상태

- `dart format` 명령은 현재 환경에서 100초 타임아웃됨.
- `where dart`, `where flutter`도 PATH에서 SDK를 찾지 못함.
- 수동으로 긴 줄과 타입 추론 위험 지점을 정리함.
- `git diff --check` 통과.

## 2026-05-18 02:44 KST

### 다음 작업 시작

- Web/설치형과 모바일 백업 설명 분리.

### 확인 내용

- Web/설치형은 JSON 백업/복원이 맞음.
- 모바일 앱은 `.db` 백업/복원이 맞음.
- 공통 도움말에서는 단독 사용자의 백업을 JSON 중심으로만 설명해 모바일 사용자에게 혼동될 수 있음.

### 구현 내용

- 한국어/영어 도움말에서 백업 기준을 `Web/설치형 JSON`, `모바일 DB`로 분리.
- Web 도움말 페이지에도 모바일 DB 백업 설명을 추가.

### 검증

- 백업 문구 재검색 완료.
- `git diff --check` 통과.

## 2026-05-18 02:34 KST

### 다음 작업 시작

- 공개 개인정보 페이지 Docker 설정 점검.

### 확인 내용

- 공개 페이지 compose 파일이 `common_default`, `proxy-network` 외부 네트워크를 필수로 요구하고 있었음.
- 이 구조는 특정 서버 환경에는 맞지만, 공개 저장소 사용자나 새 서버에서는 네트워크가 없어 `docker compose up`이 실패할 수 있음.

### 구현 내용

- 기본 compose 파일에서 외부 네트워크 필수 설정 제거.
- README에 리버스 프록시가 Docker 네트워크로 직접 연결해야 하는 운영 환경에서는 외부 네트워크를 별도로 추가하라고 안내.

### 검증

- compose/README 재확인.
- `git diff --check` 통과.

## 2026-05-18 02:25 KST

### 다음 작업 시작

- Play 그래픽 파일 존재/규격 점검.

### 확인 내용

- 기능 그래픽과 4개 스크린샷은 모두 존재하고 규격도 맞음.
- 런처 아이콘 원본 `assets/icon/app_icon.png`는 1024x1024로, Play Console 앱 아이콘 규격 512x512와 다름.

### 구현 내용

- Play Console 업로드용 `app_icon_512.png` 생성.
- Play 이미지 생성 스크립트가 `app_icon_512.png`도 함께 재생성하도록 보완.
- Play 등록 문서와 이미지 README가 512 앱 아이콘 파일을 직접 가리키도록 수정.

### 검증

- 이미지 치수 재확인:
  - `app_icon_512.png`: 512 x 512
  - `feature_graphic_1024x500.png`: 1024 x 500
  - 스크린샷 4개: 1080 x 1920
- PowerShell 7 기준 이미지 생성 스크립트 파서 확인 통과.
- `git diff --check` 통과.
- Flutter/Dart SDK가 PATH에 없어 `flutter analyze`와 위젯 테스트는 실행하지 못함.

### 남은 후속

- 실제 메모 화면에서 선택한 계층 메모를 `memo_summary`로 보내는 연결은 별도 작업으로 진행.
- 모바일 녹음 파일 업로드 연결은 다음 큰 작업 후보.

## 2026-05-17 22:55 KST

### 다음 작업 시작

- 모바일 회의/대화/메모의 `record_then_transcribe` 녹음 파일을 서버 `/api/v1/recordings`로 업로드하는 흐름 추가.

### 확인 내용

- `MeetingProgressPage`는 녹음 후 변환 모드에서 `_fullRecordingPath`를 만들고, 리뷰 화면 `pendingMeetingMetaProvider`에 `audioFilePath`로 넘김.
- `ItemsReviewPage`는 완료 시 `audioFilePath`를 meeting summary에 `audio:...` 형태로 저장함.
- 로컬 저장을 먼저 완료하고, 서버 설정이 켜져 있고 파일이 존재할 때만 업로드하는 방식이 기존 동작에 가장 안전함.

### 구현 방침

- `ServerSyncService`에 multipart 녹음 업로드 메서드 추가.
- `ItemsReviewPage` 저장 완료 후 서버 설정이 enabled/configured이고 파일이 존재하면 업로드.
- 업로드 실패는 스낵바로 알리고 로컬 저장은 유지.

## 2026-05-17 23:05 KST

### 구현 완료

- 모바일 앱 `ServerSyncService`에 `/api/v1/recordings` multipart 업로드 메서드 추가.
- `ItemsReviewPage` 완료 저장 흐름에서 로컬 저장과 세그먼트 저장을 먼저 수행한 뒤, 서버 연결이 켜져 있으면 녹음 파일을 업로드하도록 연결.
- 업로드 실패 시 로컬 저장은 유지하고 스낵바 경고만 표시하도록 처리.

### 검증

- `git diff --check` 통과.

## 2026-05-18 00:58 KST

### 다음 작업 시작

- Google Play 제출 문서와 공개 개인정보 문구를 현재 앱 동작에 맞게 정리.

### 확인 내용

- 모바일 앱은 이제 선택형 서버 동기화, 서버 녹음 업로드, 서버 분석 작업을 제공함.
- `now_app/docs` 일부 문서와 공개 페이지에는 아직 "서버 동기화 미포함", "외부 서버로 전송하지 않음" 문구가 남아 있음.
- 이 문구는 실제 동작과 다르면 Google Play Data safety 및 개인정보처리방침에서 위험함.

### 구현 방침

- 기본 로컬 사용은 기기 내 처리로 설명.
- 사용자가 서버 연결을 켠 경우 메모, 녹음, 분석 입력이 지정 서버로 전송될 수 있음을 명시.
- 서버 저장 데이터 삭제는 앱 삭제만으로 끝나지 않을 수 있으므로 서버 운영자/관리자 요청 기준을 추가.

### 구현 완료

- 개인정보처리방침 초안과 공개 사이트 개인정보 문구를 선택형 서버 연결 기준으로 수정.
- Google Play 단계별/붙여넣기용/Data safety 문구를 서버 동기화/녹음/분석 포함 기준으로 수정.
- Play 이미지/공개 사이트 README의 출시 기준 메모를 현재 기능 범위에 맞게 수정.

### 검증

- 오래된 `서버 동기화 미포함`, `외부 서버로 전송하지 않음` 문구 재검색 후 잔여 항목 정리.

## 2026-05-18 01:10 KST

### 추가 보완

- Play Console 입력값과 스토어 등록 문구에 선택형 서버 연결 기능 추가.
- 공개 사이트 README의 개발자 이메일 교체 안내를 실제 상태 기준의 확인 항목으로 수정.

### 검증

- Google Play/개인정보 문서의 오래된 서버 미포함 문구 재검색 통과.
- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 01:55 KST

### 다음 작업 시작

- 서버 설정 화면과 도움말의 API 토큰 안내 보강.

### 확인 내용

- 서버 API 토큰은 보안 저장소에 저장되도록 변경됐지만 모바일 설정 입력칸에는 그 안내가 없었음.
- 서버 연결 메시지에서 인증이 필요 없는 서버를 `토큰 없음`으로 표시해, 사용자가 본인 토큰이 비어 있다는 뜻으로 오해할 수 있음.

### 구현 내용

- 모바일 서버 설정의 API 토큰 입력 도움말에 `기기 보안 저장소에 저장합니다` 추가.
- 서버 연결 메시지의 인증 불필요 상태를 `토큰 선택`으로 변경.
- 한국어/영어 도움말과 Web 도움말에 API 토큰 보안 저장소 저장 안내 추가.

### 검증

- 토큰 안내 문구 재검색 완료.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 02:05 KST

### 다음 작업 시작

- Android 키 생성/릴리스 빌드 스크립트의 공개 저장소 사용성 점검.

### 확인 내용

- `key.properties`, `upload-keystore.jks`, JVM 오류 로그는 로컬에 존재하지만 Git 추적 대상은 아니고 ignore 규칙에 걸려 있음.
- 키 생성 스크립트는 Android Studio JBR의 `keytool.exe` 고정 경로만 사용하고 있었음.
- 릴리스 빌드 스크립트는 특정 사용자 Flutter 경로와 Android Studio JBR 경로에 묶여 있었음.

### 구현 내용

- 키 생성 스크립트가 `NOWNOTE_KEYTOOL`, `JAVA_HOME`, PATH, Android Studio JBR 순서로 `keytool`을 찾도록 수정.
- 릴리스 빌드 스크립트가 `NOWNOTE_JAVA_HOME`, `JAVA_HOME`, Android Studio JBR 순서로 JDK를 찾도록 수정.
- 릴리스 빌드 스크립트가 `NOWNOTE_FLUTTER_BIN`, PATH, 사용자 홈의 Flutter 경로 순서로 Flutter를 찾도록 수정.
- 기본 빌드는 `flutter build appbundle --release`로 실행하고, `NOWNOTE_SKIP_PUB=1`일 때만 `--no-pub`를 붙이도록 변경.
- Play 등록 순서/체크리스트에 환경변수로 로컬 경로를 지정할 수 있음을 추가.

### 검증

- PowerShell `scriptblock` 파서로 `create_upload_key.ps1`, `build_release_aab.ps1` 문법 확인.
- 환경변수/경로 문구 재검색 완료.
- `git diff --check` 통과.
- 실제 키 생성과 릴리스 AAB 빌드는 로컬 민감 파일/빌드 산출물에 영향을 주므로 실행하지 않음.

## 2026-05-18 02:15 KST

### 다음 작업 시작

- 공개 저장소/출시 문서의 남은 상태 표현 점검.

### 확인 내용

- 민감 파일 `key.properties`, `upload-keystore.jks`, JVM 오류 로그는 Git 추적 대상이 아니고 ignore 규칙에 걸려 있음.
- 개인정보처리방침 초안에는 아직 `공개 예정 URL` 표현이 남아 있었음.
- Play Console 입력값 문서에는 개발자 이메일/개인정보 URL이 이미 정해졌는데 `아직 확정 필요` 항목처럼 보이는 표현이 남아 있었음.

### 구현 내용

- 개인정보처리방침 초안의 URL 표현을 `공개 URL`로 수정.
- 개인정보처리방침 하단 문구를 게시 필요가 아니라 앱 동작과의 최종 확인 기준으로 수정.
- Play Console 입력값 문서의 `아직 확정 필요`를 `최종 확인 필요`로 바꾸고 확인 항목을 구체화.

### 검증

- 오래된 상태 표현 재검색 완료.
- `git diff --check` 통과.

## 2026-05-18 01:47 KST

### 다음 작업 시작

- 보안 저장소 변경 후 앱 안내/개인정보 문구 재정합.

### 확인 내용

- 백업 공유 문구와 파일명이 아직 `Now App` / `now_backup` 기준으로 남아 있었음.
- 서버 API 토큰을 보안 저장소로 옮겼지만 개인정보처리방침에는 보안 저장소 저장 기준이 명시되지 않았음.
- 출시 체크리스트에도 서버 토큰 저장 방식 변경 사항이 빠져 있었음.

### 구현 내용

- 백업 파일명을 `nownote_backup_...db`로 변경.
- 백업 공유 제목/본문을 NowNote 기준으로 수정.
- 개인정보처리방침 초안과 공개 사이트에 서버 API 토큰/LLM API 키 보안 저장소 저장 기준 추가.
- 출시 체크리스트에 서버 API 토큰 보안 저장 적용과 기존 값 자동 이전 기준 추가.

### 검증

- 앱 코드와 출시 문서에서 `Now App`, `now_backup`, 서버 토큰 문구 재검색 완료.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 01:25 KST

### 다음 작업 시작

- 앱 내부 버전 표기와 출시 문서 버전 정합성 점검.

### 확인 내용

- `pubspec.yaml` 버전은 `1.0.0+1`.
- Google Play 출시 체크리스트도 `1.0.0+1` 기준.
- 모바일 설정 화면의 앱 정보에는 `2.0.0 (2차-A)`로 표시되어 첫 출시 기준과 불일치함.

### 구현 내용

- 모바일 설정 화면의 앱 정보 버전을 `1.0.0 (1차)`로 수정.

### 검증

- 버전 문자열 재검색 후 앱 설정, `pubspec.yaml`, 출시 체크리스트 기준 확인.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 01:31 KST

### 다음 작업 시작

- Android Manifest 권한 제거 규칙 재점검.

### 확인 내용

- 알림 아이콘 참조는 `ic_launcher`와 `launcher_icon` 리소스가 모두 있어 즉시 깨질 가능성은 낮음.
- `CAPTURE_AUDIO_OUTPUT` 제거 규칙이 `Manifest.permission.CAPTURE_AUDIO_OUTPUT`로 작성되어 있었음.
- Android 실제 권한명은 `android.permission.CAPTURE_AUDIO_OUTPUT`이므로 병합 Manifest 제거가 적용되지 않을 위험이 있음.

### 구현 내용

- 제거 규칙 권한명을 `android.permission.CAPTURE_AUDIO_OUTPUT`로 수정.
- 출시 체크리스트의 설명도 실제 Android 권한명 기준으로 수정.

### 검증

- 권한명 재검색 후 체크리스트의 오래된 `Manifest.permission.CAPTURE_AUDIO_OUTPUT` 표현까지 정리.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 릴리스 병합 Manifest 확인은 보류.

## 2026-05-18 01:38 KST

### 다음 작업 시작

- 모바일 서버 API 토큰 저장 방식 점검.

### 확인 내용

- `pubspec.yaml`에는 `flutter_secure_storage`가 있고 LLM API 키는 보안 저장소에 저장됨.
- 서버 API 토큰은 `SharedPreferences`에 저장되고 있었음.
- 서버 토큰은 인증 정보이므로 일반 설정 저장소보다 보안 저장소에 두는 것이 현재 개인정보/보안 설명과 더 맞음.

### 구현 내용

- 서버 토큰 로드/저장을 `FlutterSecureStorage`로 변경.
- 기존 `SharedPreferences`에 저장된 서버 토큰은 최초 로드 시 보안 저장소로 옮기고 기존 값을 제거하도록 마이그레이션 추가.

### 검증

- 서버 토큰 저장 코드 재검색 후 일반 설정 저장소 직접 저장 제거 확인.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 01:18 KST

### 다음 작업 시작

- 모바일 앱 내부 도움말과 설정 문구를 최근 개인정보/백업 정책에 맞춤.

### 확인 내용

- 모바일 도움말에는 `JSON 백업`이라고 되어 있었지만 현재 모바일 설정의 백업 기능은 `.db` 파일 내보내기/가져오기임.
- Android 자동 클라우드 백업 제외 기준은 개인정보 문서에는 반영됐지만 앱 내부 도움말에는 아직 없음.
- 권한 사용 목적도 Play 문서에는 정리됐지만 앱 내부에서는 한눈에 확인하기 어려움.

### 구현 내용

- 모바일 도움말의 백업 설명을 DB 백업 기준으로 수정.
- Android 자동 클라우드 백업에는 개인 기록과 서버 접속 정보를 포함하지 않는다는 안내 추가.
- 도움말에 권한과 개인정보 섹션을 추가해 마이크, 카메라/사진, 캘린더, Health Connect, 서버 전송 기준을 설명.
- 설정 화면 백업 카드의 보조 문구를 DB 백업/복원 동작에 맞게 구체화.

### 검증

- 모바일 앱 화면 코드에서 오래된 `JSON 백업` 문구 없음 확인.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 00:59 KST

### 추가 보완

- 브리핑 알림 예약 방식 점검.

### 확인 내용

- 기존 알림 예약은 `AndroidScheduleMode.exactAllowWhileIdle`를 사용하고 있었음.
- 이 방식은 Android 12 이상에서 정확한 알람 권한 검토와 Play 심사 부담이 커질 수 있음.
- NowNote의 브리핑 알림은 초 단위 정확성이 핵심이 아니라 매일 알림 제공이 핵심임.

### 구현 내용

- 브리핑 알림 예약을 `inexactAllowWhileIdle`로 변경해 정확한 알람 권한 없이 동작하는 방향으로 조정.
- 출시 체크리스트에 정확한 알람 권한을 피하는 현재 기준과 향후 검토 조건을 기록.

### 검증

- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 모바일 정적 분석은 보류.

## 2026-05-18 01:07 KST

### 다음 작업 시작

- Android 자동 백업 규칙과 개인정보 설명 정합성 점검.

### 확인 내용

- 기존 Android 백업 규칙은 DB, SharedPreferences, 앱 내부 파일을 Google Drive 자동 백업에 포함하고 있었음.
- SharedPreferences에는 서버 URL, API 토큰, owner/device ID가 저장됨.
- 기본 사용은 로컬 중심이라는 개인정보 설명과 자동 클라우드 백업 포함 정책이 충돌할 수 있음.

### 구현 내용

- Android 11 이하 `backup_rules.xml`에서 DB, SharedPreferences, 앱 내부 파일을 클라우드 자동 백업 제외로 변경.
- Android 12+ `data_extraction_rules.xml`에서 cloud-backup은 제외하고 device-transfer는 유지.
- 개인정보처리방침 초안과 공개 사이트에 Android 자동 클라우드 백업 제외 기준을 명시.
- 출시 체크리스트에 릴리스 병합 리소스 확인 항목 추가.

### 검증

- XML/문서 변경 확인.
- `git diff --check` 통과.
- 현재 환경에서는 Flutter SDK가 PATH에 없어 릴리스 병합 리소스 확인은 보류.

## 2026-05-18 00:45 KST

### 다음 작업 시작

- 영어 도움말과 Web 도움말의 모바일 서버 기능 설명을 최신 상태로 맞춤.

### 확인 내용

- 한국어 `docs/HELP.md`에는 서버 녹음 업로드 상태 확인, 서버 분석 작업 등록/결과 확인 내용을 추가함.
- `docs/HELP.en.md`와 `web/help.html`의 모바일 중요 기능 목록은 아직 `Server sync`, `Connection status` 수준에 머물러 있음.

### 구현 방침

- `docs/HELP.en.md` 모바일 중요 기능에 서버 녹음 상태 확인과 서버 분석 결과 확인 추가.
- `web/help.html` 한국어 기본 문구와 영어 번역 키를 동일하게 보강.

### 구현 완료

- `docs/HELP.en.md`의 Mobile App 중요 기능에 서버 녹음 업로드 상태 확인, 서버 분석 작업/결과 확인 추가.
- `web/help.html`의 한국어 기본 도움말과 영어 번역에 같은 항목 추가.

### 검증

- `git diff --check` 통과.

## 2026-05-18 00:35 KST

### 다음 작업 시작

- 모바일 설정 화면의 기능 상태 문구 정리.

### 확인 내용

- 녹음 업로드, 서버 분석 작업, 서버 작업 결과 확인은 이미 구현됨.
- 그런데 설정의 `고급 기능`에는 `서버 비동기 처리`가 아직 `3차 예정`으로 표시되어 실제 상태와 맞지 않음.

### 구현 방침

- `서버 비동기 처리` 준비 중 항목 제거.
- `NowNote 서버` 항목 설명을 `동기화/녹음/분석`으로 확장해 실제 제공 기능을 반영.

### 구현 완료

- 모바일 설정의 `NowNote 서버` 요약을 `동기화/녹음/분석`으로 변경.
- 고급 기능의 `서버 비동기 처리 · 3차 예정` 항목 제거.
- 모바일 도움말과 `docs/HELP.md`에 서버 녹음/분석 확인 가능 내용을 반영.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 00:20 KST

### 다음 작업 시작

- 모바일 서버 설정 화면의 분석 작업 목록에서 서버 분석 결과를 확인할 수 있도록 보완.

### 확인 내용

- 서버 `AnalysisJobOut`은 `result_json`, `input_text`, `error_message`를 내려줌.
- 모바일 `ServerAnalysisJob` 모델은 `error_message`만 받고 `result_json`을 아직 사용하지 않음.
- 사용자가 계층 메모에서 분석 작업을 등록한 뒤 결과 확인 경로가 약함.

### 구현 방침

- 모바일 `ServerAnalysisJob`에 결과/입력 요약 필드 추가.
- 분석 작업 목록에서 완료 결과 요약 또는 실패 사유를 표시.
- 분석 작업 항목을 누르면 상세 다이얼로그로 결과 원문을 확인할 수 있게 처리.

### 구현 완료

- 모바일 `ServerAnalysisJob`에 `inputText`, `resultJson`, `resultPreview` 추가.
- 분석 작업 목록에서 결과 요약/실패 사유/입력 요약을 표시.
- 분석 작업 항목을 누르면 상세 다이얼로그에서 작업 타입, 상태, 연결 메모, 결과 원문을 확인하도록 추가.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 00:12 KST

### 최신 상태 보완

- 서버 설정 화면의 분석 작업 설명을 현재 동작에 맞게 수정:
  - 계층 메모 화면에서 선택 메모 분석을 등록할 수 있음을 안내.
- 이번 작업 커밋 전 최종 검증 예정.

### 남은 점검

- 계층 메모 화면의 음성 입력은 임시 파일 삭제 흐름이 달라 별도 업로드 연결 작업 필요.

## 2026-05-17 23:15 KST

### 다음 작업 시작

- 계층 메모의 `녹음 후 변환` 파일도 서버 `/api/v1/recordings` 업로드 흐름에 연결.

### 확인 내용

- 계층 메모는 Whisper 변환 직후 녹음 파일을 삭제하고 있어, 서버 업로드 시점에는 파일이 사라질 수 있음.
- 새 계층 메모는 저장 버튼을 누를 때 `memoId`가 만들어지므로, 녹음 직후가 아니라 메모 저장 직후에 업로드해야 서버의 `note_local_id`를 안정적으로 지정할 수 있음.

### 구현 방침

- 변환 성공 시 녹음 파일 경로와 변환 텍스트를 다이얼로그 상태에 잠시 보관.
- 저장 시 로컬 DB 저장을 먼저 완료하고, 서버 연결이 켜져 있으면 녹음 파일 업로드.
- 업로드 성공/실패와 관계없이 기존 동작처럼 임시 녹음 파일은 정리.

## 2026-05-17 23:25 KST

### 구현 완료

- 계층 메모의 `녹음 후 변환`에서 Whisper 변환에 성공한 녹음 파일을 저장 시점까지 보관하도록 변경.
- 계층 메모 저장 후 확정된 `memoId`를 `note_local_id`로 사용해 서버 녹음 업로드를 시도하도록 연결.
- 업로드가 성공하거나 실패해도 기존 동작처럼 임시 녹음 파일을 정리하도록 처리.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 00:05 KST

### 다음 작업 시작

- 모바일 계층 메모에서 선택 메모를 서버 분석 작업으로 등록하는 기능 추가.

### 확인 내용

- 서버 분석 API는 `memo_summary`, `tree_note_index`, `daily_briefing`, `recording_summary`를 지원함.
- Web/설치형은 선택한 지식 메모를 `memo_summary` 작업으로 등록하고 있음.
- 모바일 설정 화면은 점검용 `daily_briefing` 작업만 등록하므로, 실제 메모 화면 연결이 아직 부족함.

### 구현 방침

- 계층 메모 카드에 분석 아이콘 추가.
- 선택한 계층 메모의 제목과 내용을 `memo_summary` 작업으로 서버에 등록.
- 서버 설정이 꺼져 있거나 주소가 없으면 스낵바로 안내하고 기존 메모 동작은 유지.

### 구현 완료

- 계층 메모 카드에 `서버 분석` 아이콘 추가.
- 선택 메모의 제목과 내용을 `memo_summary` 분석 작업으로 등록하도록 연결.
- 모바일 폭을 고려해 계층 메모 액션 아이콘의 크기를 36x36으로 고정.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-17 23:55 KST

### 다음 작업 시작

- 모바일 앱 안에서 단독 사용자/서버 연결 사용자 차이를 볼 수 있는 도움말 화면 추가.

### 확인 내용

- `docs/HELP.md`와 `web/help.html`에는 도움말이 있으나 모바일 앱 내부 진입점은 없음.
- 설정 화면에는 앱 정보/서버 설정이 있으므로, 같은 위치에 모바일용 요약 도움말을 두는 것이 자연스러움.

### 구현 방침

- `SettingsPage`에 `사용 안내` 항목 추가.
- `/settings/help` 라우트와 모바일 `HelpPage` 추가.
- 모바일 화면은 긴 문서 전체가 아니라 사용 방식, 플랫폼 기준, 서버 연결, 백업/가져오기, 암호화 예정 원칙만 간단히 정리.

### 구현 완료

- 모바일 `HelpPage` 신규 추가.
- 설정 화면에 `NowNote 사용 안내` 항목 추가.
- `/settings/help` 라우트 추가.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

### 다음 후보

- 모바일 서버 설정 화면에서 녹음 업로드 상태/최근 녹음 목록을 확인할 수 있는 운영성 보완.
- 또는 Web/설치형과 모바일 간 기능 설명/Help 문서 정리.

## 2026-05-17 23:35 KST

### 다음 작업 시작

- 모바일 서버 설정 화면에서 서버에 저장된 최근 녹음 목록을 확인할 수 있도록 보완.

### 확인 내용

- 서버는 `GET /api/v1/recordings?owner_id=...`로 사용자별 녹음 목록을 반환함.
- 모바일 앱은 녹음 업로드는 가능하지만, 업로드 후 서버 상태를 확인하는 화면이 아직 없음.

### 구현 방침

- 모바일 `ServerSyncService`에 `ServerRecording` 모델과 최근 녹음 조회 메서드 추가.
- `ServerSettingsPage`에 최근 서버 녹음 카드 추가.
- 목록은 최근 5개만 표시하고, 파일명/기기/연결 메모/전사 여부/시간을 간단히 보여준다.

## 2026-05-17 23:45 KST

### 구현 완료

- 모바일 `ServerSyncService`에 서버 녹음 목록 모델 `ServerRecording` 추가.
- `GET /api/v1/recordings` 호출 메서드 `loadRecordings` 추가.
- 모바일 `NowNote 서버` 설정 화면에 `서버 녹음` 카드 추가:
  - 최근 5개 서버 녹음 표시
  - 파일명, 기기 ID, 연결 메모, 갱신 시간 표시
  - 텍스트 있음/원본만 상태 표시

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 00:52 KST

### 다음 작업 시작

- Google Play 권한 설명과 Android Manifest의 실제 권한 선언 정합성 점검.

### 확인 내용

- Android Manifest에는 마이크, 카메라/이미지, 인터넷, 캘린더, Health Connect 권한이 선언되어 있음.
- 알림 서비스는 Android 알림 권한을 요청하지만 Manifest에 `POST_NOTIFICATIONS` 선언이 없었음.
- 메모에는 사진 첨부를 1차 범위에서 넣지 않기로 했는데, Play 문서에는 카메라 권한 목적이 `메모에 사진 첨부`로 남아 있었음.

### 구현 내용

- Android Manifest에 Android 13 이상 알림 권한 `POST_NOTIFICATIONS` 추가.
- Play 등록 문서의 카메라/사진 목적을 메모 첨부가 아니라 캡처, 식사, 패션, 여행 등 생활 기록 기준으로 수정.
- 개인정보처리방침 초안과 공개 사이트의 인터넷 권한 설명을 선택형 서버 연결까지 포함하도록 수정.

### 검증

- `메모에 사진`, `메모 또는 기록`, 오래된 인터넷 권한 설명 재검색 후 잔여 항목 없음.
- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 01:20 KST

### 다음 작업 시작

- 서버 배포 문서와 Docker Compose 설정이 현재 구현 상태와 맞는지 점검.

### 확인 내용

- 서버 README의 `다음 단계`에 모바일 서버 연결 UI, `/api/v1/sync`, `/api/v1/recordings` 업로드처럼 이미 구현된 항목이 남아 있었음.
- `.env.example`에는 서버 이름, 녹음 저장 경로, 워커 주기 설정이 있지만 `docker-compose.yml`은 일부 값을 고정값으로 사용하고 있었음.

### 구현 내용

- `docker-compose.yml`에서 `NOW_SERVER_NAME`, `NOW_STORAGE_DIR`, `NOW_WORKER_POLL_SECONDS`, `NOW_WORKER_BATCH_SIZE`를 `.env` 값으로 받을 수 있게 정리.
- 녹음 저장 볼륨도 `NOW_STORAGE_DIR` 경로에 붙도록 맞춤.
- 서버 README의 `.env` 예시와 다음 단계 목록을 현재 1차 마무리 기준으로 갱신.

### 검증

- `git diff --check` 통과.
- 현재 작업 환경에서 `docker` 명령을 찾을 수 없어 `docker compose config` 검증은 보류.

## 2026-05-18 01:35 KST

### 다음 작업 시작

- 모바일 설정 화면에 남아 있는 `3차 예정` 고급 기능 표시를 기능별 ON/OFF 설정 방향으로 정리.

### 확인 내용

- `SettingsPage`의 `고급 기능` 카드가 화자 분리, 음성 감정 분석을 `3차 예정` 배지로만 보여주고 있었음.
- 신산님이 이전에 요청한 방향은 예정 기능 홍보가 아니라 사용자가 기능을 켜고 끄는 설정 구조임.

### 구현 내용

- `고급 기능` 섹션을 `기능별 사용 설정`으로 변경.
- 화자 분리, 음성 감정 분석을 토글 UI로 변경.
- 토글 값은 `SharedPreferences`에 저장되도록 추가.

### 검증

- `SettingsPage`에서 `3차 예정`, `_ComingSoonTile` 잔여 코드 없음 확인.
- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 01:50 KST

### 다음 작업 시작

- 모바일 기능 토글이 저장만 되고 실제 분석 요청에 반영되지 않는 문제 예방.

### 구현 내용

- 기능별 사용 설정 저장/로드를 `FeatureSettingsService`로 분리.
- 회의/대화 LLM 추출 시 화자 분리, 음성 감정 분석 토글 값을 읽어 프롬프트 옵션으로 전달.
- 모든 LLM Repository의 `extractItems` 인터페이스에 선택 분석 옵션을 추가.
- 프롬프트 생성 시 켜진 옵션만 분석 규칙에 포함하도록 변경.

### 검증

- `extractItems`, `buildPrompt` 호출부 교차 검색으로 옵션 전달 누락 여부 확인.
- `git diff --check` 통과.
- 현재 작업 환경에서 `dart`/`flutter` 명령을 찾을 수 없어 모바일 정적 분석과 포맷 실행은 보류.

## 2026-05-18 02:10 KST

### 다음 작업 시작

- Web/설치형 서버 설정의 분석 작업 목록에서 서버 분석 결과를 바로 확인할 수 있도록 보완.

### 확인 내용

- 서버는 분석 작업 응답에 `result_json`, `input_text`, `error_message`를 이미 포함함.
- Web/설치형 화면은 작업 번호, 타입, 시간, 상태, 메모 ID만 표시하고 결과 요약은 표시하지 않았음.

### 구현 내용

- 분석 작업 항목에 완료 결과 요약, 실패 사유, 대기 중 입력 일부를 한 줄 미리보기로 표시.
- `result_json`이 JSON 문자열이면 `summary`, `keywords` 우선으로 표시하고, 그 외에는 compact JSON/문자열로 표시.
- 한 줄 말줄임 스타일을 추가해 설정 패널 높이가 과하게 늘어나지 않도록 처리.

### 검증

- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- 한국어/영어 번역 키 추가 확인.
- Codex 브라우저의 file URL 접근이 보안 정책으로 차단되어 화면 직접 확인은 보류.

## 2026-05-18 02:25 KST

### 다음 작업 시작

- 서버 분석 결과 미리보기 추가 후 사용자 도움말/README 문구를 실제 기능 기준으로 맞춤.

### 구현 내용

- Web README의 서버 분석 설명을 상태 조회에서 결과 요약 조회까지 포함하도록 수정.
- 공통 도움말의 Web/설치형 중요 기능에 서버 분석 결과 요약 확인 추가.
- 서버 README의 다음 단계는 결과 조회가 아니라 결과를 메모 본문/보조 패널에 적용하는 편집 흐름 확정으로 좁힘.

### 검증

- 관련 문구 재검색으로 README/HELP 반영 확인.
- `git diff --check` 통과.

## 2026-05-18 02:45 KST

### 다음 작업 시작

- Web/설치형에서 서버 분석 결과를 단순 조회가 아니라 메모 본문에 활용하는 흐름 추가.

### 구현 내용

- 완료된 분석 작업에 `메모에 추가` 버튼 표시.
- 버튼을 누르면 연결된 지식 메모 본문 맨 아래에 `서버 분석 결과` 섹션으로 결과를 추가.
- 기존 본문은 덮어쓰지 않고 누적하며, 추가 후 해당 메모를 선택하고 변경 상태를 `pending`으로 표시.

### 검증

- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- 버튼 이벤트, 번역 키, CSS 클래스 재검색으로 연결 확인.

## 2026-05-18 03:05 KST

### 다음 작업 시작

- 서버 분석 결과를 메모 본문에 추가하는 기능 구현 후 남은 문서/다음 단계 문구 정합성 점검.

### 구현 내용

- 서버 README의 다음 단계에서 이미 완료된 `분석 결과를 메모 본문에 적용` 항목 제거.
- Web README, 공통 도움말 한국어/영어, Web 도움말 화면에 서버 분석 결과를 메모 본문에 추가할 수 있음을 반영.

### 검증

- `node --check web/app.js` 통과.
- `git diff --check` 통과.
- 관련 문구 재검색으로 서버 README의 완료된 다음 단계 제거와 도움말 반영 확인.

## 2026-05-18 03:20 KST

### 다음 작업 시작

- Google Play Console 입력값 문서의 그래픽 자료 항목이 실제 준비된 파일과 맞는지 정리.

### 확인 내용

- `now_app/docs/play_assets`에 앱 아이콘, 기능 그래픽, 스크린샷 4장이 이미 준비되어 있음.
- Play Console 입력값 문서는 기능 그래픽/스크린샷을 막연한 확인 항목으로만 남겨 두고 있었음.

### 구현 내용

- Play Console 입력값 문서에 기능 그래픽과 스크린샷 4장 전체 경로를 명시.
- 최종 확인 항목은 이미지 존재 여부가 아니라 임시 초안 사용 여부와 실제 기기 캡처 교체 여부 결정으로 정리.

### 검증

- `git diff --check` 통과.
- Play 이미지 6개 파일 존재 확인.

## 2026-05-18 03:40 KST

### 다음 작업 시작

- Play 등록 전 수동 확인 항목 중 빌드 없이 자동 점검할 수 있는 항목을 스크립트화.

### 확인 내용

- 로컬에 `android/upload-keystore.jks`, `android/key.properties`가 존재함.
- 두 파일은 `.gitignore`로 Git 추적에서 제외되고 있음.
- 릴리스 체크리스트는 아직 업로드 키/`key.properties`를 미완료로 표시하고 있었음.

### 구현 내용

- `android/check_play_release_inputs.ps1` 추가:
  - 업로드 키와 `key.properties` 존재 확인
  - 두 민감 파일의 Git ignore 확인
  - Manifest의 `POST_NOTIFICATIONS`와 `CAPTURE_AUDIO_OUTPUT` 제거 규칙 확인
  - 백업 제외 규칙 리소스 연결과 exclude 존재 확인
  - Play 이미지 6개 파일 존재 확인
- Play 출시 체크리스트에 사전 점검 스크립트 실행 절차 추가.
- 로컬 업로드 키/`key.properties` 존재 확인 항목을 완료로 반영하되, 파일 내용은 기록하지 않음.

### 검증

- `powershell -ExecutionPolicy Bypass -File .\check_play_release_inputs.ps1` 통과.
- `git diff --check` 통과.

## 2026-05-18 04:10 KST

### 다음 작업 시작

- AAB 빌드 후 Play 사전 점검을 별도로 실행해야 하는 실수 가능성 제거.

### 구현 내용

- `build_release_aab.ps1`이 AAB 생성 후 `check_play_release_inputs.ps1`을 자동 실행하도록 변경.
- Play 출시 체크리스트와 단계별 문서에 빌드 후 자동 점검 흐름을 반영.

### 검증

- PowerShell 파서로 `build_release_aab.ps1`, `check_play_release_inputs.ps1` 문법 확인.
- `powershell -ExecutionPolicy Bypass -File .\check_play_release_inputs.ps1` 통과.
- `git diff --check` 통과.
- 실제 AAB 재빌드는 현재 Flutter 실행 환경과 산출물 영향 때문에 실행하지 않음.

## 2026-05-18 04:15 KST

### 다음 작업 시작

- 릴리스 Manifest의 위험 권한 제거 상태와 최신 AAB 여부를 구분해 정리.

### 확인 내용

- 현재 남아 있는 릴리스 병합 Manifest와 bundle Manifest에는 `android.permission.CAPTURE_AUDIO_OUTPUT`이 없음.
- `POST_NOTIFICATIONS`와 targetSdkVersion 36은 릴리스 병합 Manifest에서 확인됨.
- 현재 AAB 파일은 최신 수정 이후 재빌드됐는지 아직 확정할 수 없음.

### 구현 내용

- Play 사전 점검 스크립트가 릴리스 병합 Manifest와 bundle Manifest의 `CAPTURE_AUDIO_OUTPUT` 제거 상태도 확인하도록 확장.
- Play 출시 체크리스트에서 위험 권한 제거 확인은 완료로 표시하고, 최신 AAB 재빌드 확인은 별도 미완료 항목으로 유지.

### 검증

- `powershell -ExecutionPolicy Bypass -File .\check_play_release_inputs.ps1` 통과.
- `git diff --check` 통과.

## 2026-05-18 04:25 KST

### 다음 작업 시작

- Play 등록 가능 판정 기준 중 이미 준비된 권한 문구와 릴리스 패키징 리소스 확인 항목을 분리.

### 확인 내용

- 권한 사용 목적 문구는 `google_play_paste_ready_ko.md`, `google_play_step_by_step_ko.md`에 준비되어 있음.
- 빌드 산출물의 릴리스 packaged resource에는 `backup_rules.xml`, `data_extraction_rules.xml`이 존재함.
- 하지만 현재 남아 있는 오래된 릴리스 packaged resource의 `backup_rules.xml`에는 과거 include 규칙이 남아 있어, 최신 AAB 재빌드 전에는 완료로 볼 수 없음.

### 구현 내용

- Play 사전 점검 스크립트가 릴리스 packaged resource의 백업 제외 규칙도 확인하도록 확장.
- 출시 체크리스트에서 위험 권한 목적 문구 준비만 완료로 표시.
- Android 자동 클라우드 백업 제외 규칙 반영은 최신 릴리스 빌드 후 확인 항목으로 유지.

### 검증

- `check_play_release_inputs.ps1` 실행 결과, 오래된 릴리스 packaged resource의 백업 규칙 때문에 실패하는 것을 확인.
- 실패가 맞는 상태이므로 체크리스트의 백업 제외 릴리스 반영 항목은 미완료로 유지.
- `git diff --check` 통과.

## 2026-05-18 04:45 KST

### 다음 작업 시작

- 공개 서버 배포자가 `.env` 예시값을 그대로 쓰거나 Docker Compose 설정을 놓치는 실수 방지.

### 구현 내용

- `server/scripts/preflight.py` 추가.
- 실제 배포용 기본 실행은 `.env` 파일 존재, API 토큰/DB 비밀번호 변경, 워커 설정, Docker Compose 포트/볼륨/재시작 정책, 스모크 테스트 파일 존재를 확인.
- 저장소 검증용으로 `.env.example --allow-example` 구조 점검 모드 제공.
- 서버 README에 배포 전 점검과 스모크 테스트의 역할 차이를 추가.

### 검증

- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과.
- `py_compile` 통과.
- `git diff --check` 통과.
- 기본 `python`/`py` 실행은 이 셸에서 경로 문제로 실패해, 확인 가능한 Python 전체 경로로 검증.

## 2026-05-18 05:05 KST

### 다음 작업 시작

- 서버 README의 실행 순서가 예시값 그대로 `docker compose up`을 먼저 실행하게 보이는 문제 정리.

### 구현 내용

- 실행 흐름을 `.env` 복사/수정 → 배포 전 점검 → `docker compose up --build` 순서로 변경.
- PowerShell/WSL 준비 명령에서는 서버 시작 명령을 분리해 예시값 변경 전 실행하지 않도록 안내.
