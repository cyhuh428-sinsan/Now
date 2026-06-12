# NowNote 2.3 인증/서버 연결 서버 작업 기록

작성일: 2026-06-12
담당: 어울
범위: 서버/API

## 현재 판정

이 문서는 서버/API 2.3 작업의 완료 보고서가 아니다.

현재 상태는 **서버 구현/로컬 검증 기록 + 운영 서버 최종 확인 대기**다. 서버 코드와 로컬 검증은 상당 부분 진행되었지만, 운영 서버에서 최신 `main`을 pull하고 실제 계정/토큰으로 성공 케이스를 확인하기 전까지 서버/API 완료로 판정하지 않는다.

남은 서버 확인:

- 운영 서버에서 최신 `main` pull
- `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr` 실행
- 운영 서버에서 `/api/v1/messenger/policy`의 `allowed_mime_types` 재확인
- 실제 사용자로 Web login 성공 케이스 확인
- 실제 Web session 확인
- 실제 앱/설치형 접속 토큰으로 `/api/v1/auth/token-login` 성공 케이스 확인

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

## 통합 작업지시 서버/API 반영

작성일: 2026-06-12

- 기준 문서: `docs/NOW_2_3_INTEGRATED_WORK_ORDER.md`
- 기준 서버: `https://nownote.sinsan.kr`

### 운영 서버 확인

- `GET https://nownote.sinsan.kr/health` 응답 확인
  - 결과: `{"status":"ok","server":"NowNote Local Server"}`
- `GET https://nownote.sinsan.kr/health/ready` 응답 확인
  - 결과: `{"status":"ready"}`
- `GET https://nownote.sinsan.kr/api/v1/server` 응답 확인
  - `user_token_required=true`
  - `public_server_readiness.status=ready`
  - `web_login_auth`, `web_session_auth`, `app_installed_token_auth`, `legacy_api_token_auth` 확인
  - `messenger_rooms=true`, `messenger_attachments=true` 확인
- `POST https://nownote.sinsan.kr/api/v1/auth/web-login` 누락 사용자 실패 응답 확인
  - 결과: `{"detail":"user not found"}`
- `POST https://nownote.sinsan.kr/api/v1/auth/token-login` 누락 사용자 실패 응답 확인
  - 결과: `{"detail":"user not found"}`
- `GET https://nownote.sinsan.kr/api/v1/messenger/policy` 응답 확인
  - 현재 운영 서버는 아직 이번 MIME 정책 커밋 배포 전이라 `allowed_mime_types`는 배포 후 재확인 대상

### 메신저/첨부 보강

- 메신저 첨부 정책에 허용 MIME 목록을 추가했다.
- 첨부 업로드 시 확장자와 MIME을 함께 검증하도록 했다.
- 메신저 첨부 저장소 설정을 추가했다.
  - `NOW_MESSENGER_STORAGE_DIR`
  - `NOW_MESSENGER_MAX_UPLOAD_MB`
  - `NOW_MESSENGER_ALLOWED_EXTENSIONS`
  - `NOW_MESSENGER_ALLOWED_MIME_TYPES`
- Docker Compose에 `now_messenger_data` 볼륨을 추가했다.
- 운영 점검 API와 `/admin/ops` 화면에 아래 항목을 추가했다.
  - 메신저 첨부 저장소 상태
  - 메신저 첨부 용량
  - 누락 메신저 첨부

### 검증

- `C:\Users\cyhuh\anaconda3\python.exe -m compileall server\app server\scripts\preflight.py` 통과
- `C:\Users\cyhuh\anaconda3\python.exe scripts\preflight.py --env-file .env.example --allow-example` 통과
  - 결과: `NowNote server preflight passed (1208/1208 checks)`
- `C:\Users\cyhuh\anaconda3\python.exe server\scripts\messenger_smoke_test.py` 통과
  - 결과: `NowNote 2.3 messenger smoke test passed`

### 남은 운영 확인

- 운영 서버에서 `git pull origin main` 후 `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr` 실행은 서버 쉘에서 수행해야 한다.
- 운영 토큰과 실제 사용자/앱 토큰이 필요한 Web 로그인, Web 세션, token-login 성공 케이스는 운영 서버에서 별도 확인해야 한다.

## 완료 판정 전 보강

작성일: 2026-06-12

판정 기준:

1. 운영 서버 `.env` 메신저 설정 추가
2. `application/octet-stream` 기본 허용 여부 재검토
3. messenger smoke test에 실패/권한 케이스 추가

### 반영 내용

- `server/DEPLOY.md`, `server/PUBLIC_SERVER.md`, `server/.env.example`, `server/.env.public.example`에 운영 서버 `.env` 메신저 설정 기준을 명시했다.
  - `NOW_MESSENGER_STORAGE_DIR=/data/messenger`
  - `NOW_MESSENGER_MAX_UPLOAD_MB=10`
  - `NOW_MESSENGER_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip`
  - `NOW_MESSENGER_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip`
- 기본 허용 MIME에서 `application/octet-stream`을 제거했다.
  - 실제 파일 형식을 확인할 수 없는 업로드는 기본 정책에서 거부한다.
  - `server/scripts/preflight.py`가 기본 `.env`의 `application/octet-stream` 허용을 실패로 판정하도록 보강했다.
- `server/scripts/messenger_smoke_test.py`에 실패/권한 케이스를 추가했다.
  - Web 세션 누락: `web session required`
  - 비참여 사용자 방 메시지 조회: `room member required`
  - 비참여 사용자 첨부 다운로드: `room member required`
  - 차단 확장자 업로드: `file extension not allowed`
  - 차단 MIME 업로드: `file mime type not allowed`
  - `application/octet-stream` 업로드: `file mime type not allowed`

### 추가 검증

- `C:\Users\cyhuh\anaconda3\python.exe -m compileall server\app server\scripts\preflight.py` 통과
- `C:\Users\cyhuh\anaconda3\python.exe scripts\preflight.py --env-file .env.example --allow-example` 통과
  - 결과: `NowNote server preflight passed (1214/1214 checks)`
- `C:\Users\cyhuh\anaconda3\python.exe server\scripts\messenger_smoke_test.py` 통과
  - 결과: `NowNote 2.3 messenger smoke test passed`

### 남은 운영 확인

- 운영 서버 실제 `.env`에 위 메신저 설정 4개가 반영되어야 한다.
- 운영 서버에서 최신 `main` pull 후 `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr`를 실행해야 한다.
- 배포 후 `/api/v1/messenger/policy`의 `allowed_mime_types`에 `application/octet-stream`이 없는지 재확인해야 한다.

## 2026-06-12 운영 URL 직접 확인

Windows 작업 환경에서 운영 서버 쉘의 `~/deploy/Now` 경로는 직접 접근되지 않았다.

- 시도: `wsl --cd ~/deploy/Now pwd`
- 결과: `WSL/ERROR_FILE_NOT_FOUND`
- 판단: 이 환경에서는 운영 서버 pull/deploy 명령을 직접 실행하지 못했다.

대신 운영 URL API 응답을 직접 확인했다.

- `GET https://nownote.sinsan.kr/health`
  - 결과: `{"status":"ok","server":"NowNote Local Server"}`
- `GET https://nownote.sinsan.kr/health/ready`
  - 결과: `{"status":"ready"}`
- `GET https://nownote.sinsan.kr/api/v1/server`
  - 결과: `user_token_required=true`
  - 결과: `messenger_rooms=true`
  - 결과: `messenger_attachments=true`
  - 결과: `public_server_readiness.status=ready`
- `GET https://nownote.sinsan.kr/api/v1/messenger/policy`
  - 결과: `max_size_bytes=10485760`
  - 결과: `allowed_extensions`와 `image_extensions`는 표시됨
  - 확인 필요: `allowed_mime_types`가 아직 응답에 표시되지 않음

판정:

- 운영 서버 health/ready와 capability는 정상이다.
- 운영 서버 메신저 policy 응답은 최신 MIME 정책 확인 기준을 아직 만족하지 않는다.
- 운영 서버에서 최신 `main` pull 및 배포 후 `/api/v1/messenger/policy`를 다시 확인해야 한다.

## NOW_2_3_WORK_ORDER_SERVER_API 반영

작성일: 2026-06-12

기준 문서:

- `docs/NOW_2_3_WORK_ORDER_SERVER_API.md`

### 반영 내용

- 메신저 unread count 경량 API를 추가했다.
  - `GET /api/v1/messenger/rooms/unread?owner_id=...`
  - Web 세션 사용자 기준으로 채팅방별 `unread_count`와 전체 `total_unread_count`를 반환한다.
  - 메시지 본문과 첨부 목록을 내려받지 않아 닫힌 메신저 상태의 unread 갱신에 사용할 수 있다.
- 기존 전체 그룹 채팅방 유지 기준은 그대로 둔다.
  - unread API에서도 `_ensure_group_room`, `_migrate_group_messages`를 거쳐 기존 그룹 방과 기존 메시지 마이그레이션 기준을 유지한다.
- 일부 그룹원 채팅방 권한 검증은 기존 `room member required` 기준을 유지했다.
- `server/scripts/messenger_smoke_test.py`에 경량 unread API 검증을 추가했다.
  - `member` 사용자의 Web 세션으로 `/api/v1/messenger/rooms/unread`를 호출한다.
  - 일부 그룹원 채팅방의 unread count가 증가하는지 확인한다.
- `server/scripts/preflight.py`가 경량 unread API와 smoke test 검증 문자열을 확인하도록 보강했다.
- `server/README.md`에 2.3 Messenger API 계약을 추가했다.
  - rooms
  - rooms/unread
  - room create
  - messages
  - attachments
  - read
  - policy
- `docs/NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md` 서버 검증 항목에 `경량 unread API 검증 통과`를 추가했다.

### 운영 URL 재확인

- `GET https://nownote.sinsan.kr/health`
  - 결과: `{"status":"ok","server":"NowNote Local Server"}`
- `GET https://nownote.sinsan.kr/health/ready`
  - 결과: `{"status":"ready"}`
- `GET https://nownote.sinsan.kr/api/v1/server`
  - 결과: `user_token_required=true`
  - 결과: `messenger_rooms=true`
  - 결과: `messenger_attachments=true`
  - 결과: `public_server_readiness.status=ready`
- `GET https://nownote.sinsan.kr/api/v1/messenger/policy`
  - 결과: `max_size_bytes=10485760`
  - 결과: `allowed_extensions`와 `image_extensions`는 표시됨
  - 미충족: `allowed_mime_types`가 아직 응답에 표시되지 않음

### 운영 서버 접근 확인

- 시도: `wsl --cd ~/deploy/Now pwd`
- 결과: `Wsl/ERROR_FILE_NOT_FOUND`
- 판단: 현재 Windows 작업 환경에서는 운영 서버 `~/deploy/Now` 경로에 직접 접근되지 않아 `git pull origin main`과 `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr`를 직접 실행하지 못했다.

### 검증

- `C:\Users\cyhuh\anaconda3\python.exe -m compileall server\app server\scripts\preflight.py` 통과
- `C:\Users\cyhuh\anaconda3\python.exe scripts\preflight.py --env-file .env.example --allow-example` 통과
  - 결과: `NowNote server preflight passed (1218/1218 checks)`
- `C:\Users\cyhuh\anaconda3\python.exe server\scripts\messenger_smoke_test.py` 통과
  - 결과: `NowNote 2.3 messenger smoke test passed`

### 완료 판정

- 로컬 서버/API 구현과 검증은 작업지시서 기준으로 보강 완료.
- 운영 서버 완료 판정은 아직 보류.
- 보류 사유:
  - 운영 서버 pull/deploy를 이 환경에서 직접 실행하지 못함
  - 운영 `/api/v1/messenger/policy`에 `allowed_mime_types`가 아직 없음
  - 실제 사용자 Web login, Web session, token-login 성공 케이스는 실제 계정/토큰이 필요해 미확인

## 다음 서버 작업자 인수인계

작성일: 2026-06-12

### 판정

서버/API는 **로컬 구현 완료, 운영 확인 대기** 상태다. 운영 서버 배포 확인과 실제 성공 케이스 확인 전까지 서버/API 완료로 판정하지 않는다.

현재 운영 URL 확인 결과:

- `/health` 정상
- `/health/ready` 정상
- `/api/v1/server` 정상
- `/api/v1/messenger/policy`는 `allowed_extensions`, `image_extensions`만 표시
- `/api/v1/messenger/policy`에 `allowed_mime_types`가 아직 표시되지 않음

### 다음 작업

운영 서버에서 아래 순서로 확인한다.

1. `~/deploy/Now`에서 `git pull origin main`
2. `server/.env`에 메신저 설정 4개 반영
   - `NOW_MESSENGER_STORAGE_DIR=/data/messenger`
   - `NOW_MESSENGER_MAX_UPLOAD_MB=10`
   - `NOW_MESSENGER_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip`
   - `NOW_MESSENGER_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip`
3. `server`에서 `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr` 실행
4. 운영 서버 `/api/v1/messenger/policy` 재확인
5. `allowed_mime_types`가 표시되는지 확인
6. `allowed_mime_types`에 `application/octet-stream`이 없는지 확인
7. 실제 사용자 기준 Web login 성공 확인
8. 실제 사용자 기준 Web session 성공 확인
9. 실제 앱/설치형 접속 토큰 기준 `/api/v1/auth/token-login` 성공 확인

### 주의

현재 작업트리에 서버와 무관한 앱 문서 변경이 남아 있다. 서버 검토나 서버 커밋과 섞지 않는다.

- `now_app/README.md`
- `now_app/docs/mobile_runtime_checklist_ko.md`
- `docs/NOW_2_3_WORK_ORDER_APP_RESULT.md`

## 운영 서버 최종 확인

작성일: 2026-06-13

### 운영 배포

- 실제 운영 서버: `AMD-server` (`140.245.68.207`)
- 운영 배포 경로: `~/deploy/Now`
- 기존 운영 배포 branch가 `codex/desktop-client-1.1`이라 `main`으로 전환했다.
- `git fetch origin main`, `git checkout main`, `git pull origin main` 완료
  - 결과: `5a25ae4`까지 fast-forward 반영
- `server/.env`에 메신저 설정 4개 반영
  - `NOW_MESSENGER_STORAGE_DIR=/data/messenger`
  - `NOW_MESSENGER_MAX_UPLOAD_MB=10`
  - `NOW_MESSENGER_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip`
  - `NOW_MESSENGER_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip`
- `sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr` 실행 완료
  - preflight 통과: `NowNote server preflight passed (1218/1218 checks)`
  - server smoke test 통과: `NowNote server smoke test passed`

### 운영 URL 확인

- `GET https://nownote.sinsan.kr/health`
  - 결과: `{"status":"ok","server":"NowNote Local Server"}`
- `GET https://nownote.sinsan.kr/health/ready`
  - 결과: `{"status":"ready"}`
- `GET https://nownote.sinsan.kr/api/v1/server`
  - 결과: `user_token_required=true`
  - 결과: `messenger_rooms=true`
  - 결과: `messenger_attachments=true`
  - 결과: `public_server_readiness.status=ready`
- `GET https://nownote.sinsan.kr/api/v1/messenger/policy`
  - 결과: `allowed_mime_types` 표시 확인
  - 결과: `application/octet-stream` 미포함 확인
  - 결과: 허용 MIME 11개

### 실제 사용자 성공 케이스 확인

검증용 실제 사용자 `ops_verify_1781289735`를 Web 가입 API로 생성한 뒤 성공 케이스를 확인했다.

- Web login 성공
  - `POST /api/v1/auth/web-login`
  - 결과: `status=ok`
- Web session 성공
  - `GET /api/v1/auth/web-session`
  - 결과: `status=ok`
- 앱/설치형 접속 토큰 token-login 성공
  - `POST /api/v1/auth/token-login`
  - 결과: `status=ok`
  - 결과: `owner_id=ops_verify_1781289735`

### 최종 판정

- 서버/API 운영 배포 확인 완료
- 메신저 MIME 정책 운영 반영 확인 완료
- 실제 사용자 Web login, Web session, token-login 성공 확인 완료
- 서버/API는 운영 확인 대기 상태를 해소했다.
