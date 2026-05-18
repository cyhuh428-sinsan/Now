# NowNote 작업 진행 기록

이 파일은 작업 중 오류나 대화 중단에 대비해 현재 진행 상태를 남기는 기록입니다.
새 기능을 시작하거나, 중간 판단이 바뀌거나, 검증/커밋이 끝날 때 갱신합니다.

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
