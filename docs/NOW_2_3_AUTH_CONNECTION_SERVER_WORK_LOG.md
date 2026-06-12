# NowNote 2.3 인증/서버 연결 서버 작업 기록

작성일: 2026-06-12
담당: 어울
범위: 서버/API

## 기준 문서

- `docs/NOW_2_3_AUTH_CONNECTION_WORK_ORDER.md`
- `docs/NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md`

## 작업 범위

- Web 로그인, Web 세션, Web 로그아웃 API 유지 확인
- 앱/설치형 접속 토큰 확인 API 유지 및 응답 명확화
- 데이터 API의 `X-Now-User-Token` 검증 유지
- `NOW_API_TOKEN` 기반 `Authorization: Bearer ...` 처리는 구형 개인 서버 호환/운영 보호용으로 유지
- 서버 문서의 인증 역할 설명 정리

## 변경 내용

### API 응답

- `/api/v1/auth/token-login` 성공 응답에 `token` 객체를 추가했다.
- 기존 `status`, `user` 응답은 유지했다.
- `token` 객체에는 아래 값을 포함한다.
  - `auth_method`
  - `label`
  - `owner_id`
  - `group_name`
  - `is_active`
  - `device_id`
  - `device_name`
  - `device_active`
  - `issued_at`
  - `last_used_at`

### 인증 실패 사유

- 사용자 토큰 필수 모드에서 토큰이 없으면 기존처럼 `user token required`를 반환한다.
- 사용자 토큰 필수 모드에서 사용자 ID가 없으면 `user not found`를 반환한다.
- 사용자 토큰이 사용자와 맞지 않으면 기존처럼 `invalid user token`을 반환한다.
- 동기화/저장 요청에서 `device_id`가 비어 있으면 `device_id required`를 반환한다.
- 비활성 기기는 기존처럼 `device inactive`를 반환한다.

### Capability

- `/api/v1/server` capability에 인증 역할 분리 값을 추가했다.
  - `web_login_auth`
  - `web_session_auth`
  - `app_installed_token_auth`
  - `legacy_api_token_auth`

### 문서

- `docs/SERVER_AUTH_POLICY.md`에 2.3 인증 역할 기준을 추가했다.
- `server/README.md`에 Web 로그인, 앱/설치형 접속 토큰, 구형 개인 서버 API 토큰의 역할을 분리해 설명했다.
- 공용 서버 일반 사용자는 `NOW_API_TOKEN`을 입력하지 않는다는 점을 명확히 했다.

## 유지한 내용

- `/api/v1/auth/web-login`
- `/api/v1/auth/web-session`
- `/api/v1/auth/web-logout`
- `/api/v1/auth/token-login`
- `/api/v1/auth/client-login`
- `/api/v1/auth/device-token`
- `X-Now-User-Token` 기반 데이터 API 검증
- `NOW_API_TOKEN` 기반 구형 개인 서버 호환/운영 보호 흐름
- Web 세션 전용 그룹 공유 문서 pull 범위

## 서버 외 범위

아래 항목은 이번 서버 담당 작업에서 수정하지 않았다.

- Web 화면 문구
- 설치형 프로그램 화면/동작
- 모바일 앱 화면/정적 검증
- Flutter 테스트

## 검증 기록

- `C:\Users\cyhuh\anaconda3\python.exe -m compileall server\app` 통과
- `C:\Users\cyhuh\anaconda3\python.exe scripts\preflight.py --env-file .env.example --allow-example` 통과
  - 결과: `NowNote server preflight passed (1191/1191 checks)`
- 대상 확인 명령 통과
  - `server_capabilities()`에 `web_login_auth`, `app_installed_token_auth` 포함 확인

## 남은 확인

- 실제 서버 인스턴스 대상 smoke test는 이번 작업에서 실행하지 않았다.
- Web, 설치형 프로그램, 모바일 앱 화면/동작 검증은 서버 담당 범위 밖이라 수행하지 않았다.

## 추가 정리

작성일: 2026-06-12

- `server/README.md`에서 공용 서버 일반 사용자가 `NOW_API_TOKEN`을 입력하지 않는다는 설명과 공개 운영 시 서버 환경값으로 `NOW_API_TOKEN`을 설정한다는 설명을 분리했다.
- `server/app/api/monitor.py`의 서버 연결 사용자 안내를 2.3 기준에 맞춰 서버 주소, 사용자 ID, 앱/설치형 접속 토큰 기준으로 바꿨다.
- `server/app/api/monitor.py`의 2단계 인증 설명을 저장하지 않고 연결 확인 또는 로그인 확인 때만 입력하는 기준으로 바꿨다.
- `server/app/services/user_accounts.py`에서 사용자 토큰 필수 모드의 `owner_id` 조회와 기기 토큰 조회가 같은 `strip()` 값으로 동작하도록 정규화 기준을 맞췄다.
- `server/scripts/preflight.py`의 도움말/표면 문구 기대값은 서버 단독 커밋에서 변경하지 않았다. Web/모바일 도움말 문구 정리는 각 담당 영역 변경과 함께 맞춰야 한다.

## 추가 검증 기록

- `C:\Users\cyhuh\anaconda3\python.exe -m compileall server\app` 통과
- `C:\Users\cyhuh\anaconda3\python.exe scripts\preflight.py --env-file .env.example --allow-example` 실행 결과:
  - 결과: `Preflight failed (1190/1192 checks)`
  - 남은 실패:
    - `Mobile help documents server connection values`
    - `Mobile help documents legacy API token`
  - 원인: 로컬 작업트리에 Web/모바일 담당 변경이 섞여 있어 서버 preflight의 전역 도움말 기대값과 일부 파일 문구가 일시적으로 불일치함
  - 판단: 모바일 앱 화면 파일은 서버 담당 범위 밖이므로 수정하지 않음
