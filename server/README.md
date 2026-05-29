# NowNote Server

NowNote 1차 서버는 개인 Docker 서버에서 메모와 녹음 파일을 동기화하기 위한 기본 API입니다.
공용 운영 서버에도 같은 프로그램을 사용할 예정입니다. 사용자별 토큰 확인 화면/API와 2단계 코드 검증 절차는 준비되어 있으며, 공용 오픈 전에는 HTTPS/reverse proxy 구성을 별도로 완성해야 합니다.

단독 사용자와 서버 연결 사용자의 차이는 [NowNote 도움말](../docs/HELP.md)을 기준으로 안내합니다.
서버 인증 기준은 [NowNote 서버 인증 기준](../docs/SERVER_AUTH_POLICY.md)에 따로 정리합니다.
WSL/Docker 배포 순서는 [DEPLOY.md](DEPLOY.md)를 기준으로 빠르게 확인할 수 있습니다.
공용 서버 오픈 절차와 reverse proxy 예시는 [PUBLIC_SERVER.md](PUBLIC_SERVER.md)를 기준으로 확인합니다.

## 표기 기준

사용자와 운영자가 보는 문구는 한국어를 기본으로 합니다.
다만 API, DB, LLM, JSON, Docker, token처럼 한국 사용자에게 이미 자연스러운 기술 용어는 억지로 바꾸지 않습니다.

## 구성

- `now-api`: FastAPI 서버
- `now-worker`: LLM/분석 작업 큐 처리 워커
- `now-postgres`: PostgreSQL 16
- `now_recording_data`: 원본 음성 파일 저장 볼륨
- `now_postgres_data`: DB 저장 볼륨

## 실행

공개 GitHub 배포 기준에서는 실제 `.env`를 저장소에 올리지 않습니다.
설치자는 예시 파일을 복사한 뒤 자기 서버용 비밀값을 직접 넣습니다.

```powershell
cd D:\Project\Now\server
Copy-Item .env.example .env
notepad .env
```

Linux/WSL에서는 아래처럼 준비합니다.

```bash
cd ~/deploy/Now/server
cp .env.example .env
nano .env
```

API 토큰과 DB 비밀번호는 반드시 예시값에서 바꿉니다.
PowerShell에서는 다음 명령으로 긴 랜덤 토큰을 만들 수 있습니다.

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Linux/WSL에서는 다음 명령을 사용할 수 있습니다.

```bash
openssl rand -hex 32
```

배포 전 점검:

```bash
python3 scripts/preflight.py
```

점검이 통과하면 서버를 시작합니다.

```bash
docker compose up --build
```

WSL/Linux 서버에서 소스 갱신부터 smoke test까지 한 번에 확인하려면 아래 도우미를 사용할 수 있습니다.
도우미는 `.env`의 `NOW_API_TOKEN`을 읽어 smoke test에 전달하므로 토큰을 화면에 다시 입력하지 않아도 됩니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

저장소의 예시 파일 구조만 확인할 때는 아래처럼 실행합니다.

```bash
python3 scripts/preflight.py --env-file .env.example --allow-example
```

공용 서버 오픈 전 점검은 아래 명령을 사용합니다.

```bash
python3 scripts/preflight.py --public-server
```

현재 1차 서버에서 이 명령은 일부 항목이 의도적으로 실패합니다.
실패 항목은 공용 서버 오픈 전에 남은 작업을 보여주는 안전장치입니다.

- `NOW_USER_TOKEN_REQUIRED=true` 설정
- 공개 도메인, HTTPS, reverse proxy, 복구 절차 최종 확인

사용자별 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 데이터 격리 자동 검증은 smoke test 기준으로 준비 완료 항목에 포함됩니다.
공개 도메인과 HTTPS reverse proxy 설정 예시는 [PUBLIC_SERVER.md](PUBLIC_SERVER.md)와 `reverse_proxy` 폴더를 기준으로 확인합니다.

`.env` 예시:

```env
NOW_SERVER_NAME=NowNote Local Server
NOW_API_TOKEN=여기에-긴-랜덤-토큰
NOW_USER_TOKEN_REQUIRED=false
NOW_POSTGRES_PASSWORD=여기에-긴-랜덤-DB-비밀번호
NOW_STORAGE_DIR=/data/recordings
NOW_WORKER_POLL_SECONDS=5
NOW_WORKER_BATCH_SIZE=5
NOW_PUBLIC_BASE_URL=
NOW_BEHIND_REVERSE_PROXY=false
```

기존 DB 볼륨이 이미 만들어진 뒤 `NOW_POSTGRES_PASSWORD`를 바꾸면 PostgreSQL 저장 비밀번호와 설정이 달라질 수 있으므로, 운영 시작 전에 먼저 확정합니다.
DB 비밀번호는 연결 URL에도 들어가므로 처음에는 영문/숫자 중심의 긴 값으로 설정합니다.
Docker Compose 실행에서는 `NOW_POSTGRES_PASSWORD`로 DB 연결 URL을 자동 구성하고, `NOW_DATABASE_URL`은 서버를 Docker Compose 밖에서 직접 실행할 때만 별도로 사용합니다.
`NOW_STORAGE_DIR`은 컨테이너 내부의 녹음 저장 경로이며, Docker Compose의 `now_recording_data` 볼륨도 같은 경로에 붙습니다.
`NOW_USER_TOKEN_REQUIRED=false`는 개인 Docker 서버 기본값입니다.
공용 서버 오픈 전에는 사용자별 접속 토큰을 발급한 뒤 `NOW_USER_TOKEN_REQUIRED=true`로 바꿔 데이터 API에서 `X-Now-User-Token`을 요구하게 합니다.
공용 서버로 공개할 때는 `NOW_PUBLIC_BASE_URL=https://도메인`과 `NOW_BEHIND_REVERSE_PROXY=true`를 설정합니다.
개인 로컬 서버나 내부망 테스트 서버는 비워두거나 `false`로 둘 수 있습니다.

자체 서버 사용자는 앱 설정 화면에 다음 값을 입력합니다.

- 서버 주소: `http://서버주소:8750`
- API 토큰: `.env`의 `NOW_API_TOKEN`
- 사용자 ID: 단독 사용자는 기본 `local_user`, 여러 사용자를 구분할 때는 운영자가 정한 owner ID

모바일 앱과 Web/설치형 프로그램은 서버 설정 화면에서 사용자 프로필을 불러오고 이메일, 표시 이름, 시간대를 저장할 수 있습니다.
사용자 그룹, 2단계 인증 사용 여부, 활성 상태는 서버 관리 화면에서 운영자가 관리합니다.
비활성 사용자는 프로필 조회 외의 동기화, 메모, 녹음, 분석 API 사용이 차단됩니다.

Web/설치형 프로그램도 같은 값을 화면 설정의 서버 연결 항목에 저장한 뒤 연결 테스트를 실행합니다.
서버 API는 브라우저 기반 클라이언트가 호출할 수 있도록 CORS를 허용하며, 공개 운영 시에는 `NOW_API_TOKEN`을 반드시 설정합니다.
초기 Web 동기화는 화면 설정에서 수동으로 실행하며, 일자별 메모와 지식 메모를 `/api/v1/sync`로 전송합니다.
첫 동기화 뒤에는 마지막 동기화 시각과 로컬 변경 상태를 기준으로 변경된 메모만 전송합니다.
서버에서 내려온 메모는 Web 로컬 데이터에 병합하되, 아직 저장 대기 중인 로컬 변경은 덮어쓰지 않습니다.

신산님이 운영하는 공용 NowNote 서버도 같은 서버 프로그램을 사용합니다.
다만 현재 구현은 단일 `NOW_API_TOKEN`, 선택형 사용자별 접속 토큰, 토큰 기반 2단계 코드 검증 절차를 기준으로 합니다.
관리 화면의 사용자 그룹, 2단계 인증 사용 여부, 활성 상태와 사용자 토큰 확인 화면/API는 공용 운영을 위한 준비 기능입니다.

LLM 워커를 외부 LLM에 연결하려면 `.env` 또는 환경변수에 아래 값을 설정합니다.

```powershell
$env:NOW_LLM_PROVIDER="openai"
$env:NOW_OPENAI_API_KEY="sk-..."
$env:NOW_OPENAI_MODEL="gpt-4o-mini"
docker compose up --build
```

`NOW_LLM_PROVIDER=local`이면 외부 API 없이 기본 로컬 요약/키워드 처리만 수행합니다.

서버 확인:

```powershell
Invoke-WebRequest http://localhost:8750/health
Invoke-WebRequest http://localhost:8750/health/ready
docker compose ps
```

WSL 환경에서 `docker compose`가 일부 옵션을 인식하지 못하면 `docker-compose` 명령을 사용합니다.

```bash
docker-compose ps
docker-compose logs now-api --tail=80
docker-compose logs now-worker --tail=80
```

`now-api`는 `/health/ready` 기준 Docker healthcheck를 사용하며, 주요 컨테이너는 `restart: unless-stopped`로 재시작됩니다.

운영 화면:

```powershell
http://localhost:8750/monitor
http://localhost:8750/admin
http://localhost:8750/admin/notes
http://localhost:8750/admin/recordings
http://localhost:8750/admin/users
http://localhost:8750/admin/devices
http://localhost:8750/admin/sync
http://localhost:8750/admin/ops
http://localhost:8750/admin/export
http://localhost:8750/admin/recovery
http://localhost:8750/admin/deploy
http://localhost:8750/admin/analysis
http://localhost:8750/admin/public
http://localhost:8750/admin/release
http://localhost:8750/admin/evidence
http://localhost:8750/admin/mobile
http://localhost:8750/admin/play
http://localhost:8750/admin/open-source
http://localhost:8750/admin/help
```

`/monitor`는 서버/DB 상태와 집계 중심의 모니터링 화면입니다.
`/admin`은 운영 설정, 메모 타입별 저장 현황, 최근 분석 작업을 확인하는 읽기 전용 관리 화면입니다.
`/admin/notes`는 메모 타입/소스/사용자별 집계와 최근 변경 메모를 확인하는 읽기 전용 화면입니다.
Owner, 메모 타입, 소스, 제목/내용 검색어, 삭제 표시 여부로 메모를 필터링하고 현재 조건으로 JSON을 내려받을 수 있습니다.
`/admin/recordings`는 원본 음성 파일 저장 현황과 최근 녹음 파일을 확인하는 읽기 전용 화면입니다.
Owner, 기기 ID, 텍스트 변환 여부로 녹음 파일을 필터링하고 현재 조건으로 JSON을 내려받을 수 있습니다.
DB 메타데이터 없이 저장소에 남은 고아 녹음 파일은 `/api/v1/admin/export/recording-orphans` 또는 `/admin/recordings`의 `고아 녹음 파일 JSON` 링크에서 확인합니다.
고아 녹음 파일은 자동 삭제하지 않으며, 백업 확인 후 운영자가 수동 정리합니다.
DB에는 녹음 메타데이터가 있지만 저장소에서 원본 파일을 찾을 수 없는 누락 녹음 파일은 `/api/v1/admin/export/recording-missing-files`에서 확인합니다.
누락 녹음 파일은 데이터 손실 가능성이 있으므로 `/admin/ops`에서 `bad` 상태로 표시됩니다.
`/admin/users`는 시간대, 2단계 인증 사용 여부, 사용자 그룹, 활성 상태, 토큰 발급/사용 상태, 최근 접속 시간을 확인하고 사용자 정보를 수정하는 관리 화면입니다.
상태, 그룹, 토큰 발급 여부, 검색어로 사용자 목록을 필터링할 수 있습니다.
선택한 사용자를 한 번에 활성 또는 비활성으로 바꿀 수 있습니다.
현재 필터 조건 그대로 사용자 목록을 JSON으로 내려받을 수 있습니다.
운영자는 `/admin/users/new`에서 공용 서버 접속 전 사용자 ID를 미리 만들 수 있습니다.
사용자 수정 화면에서 사용자별 접속 토큰을 발급할 수 있으며, 토큰 원문은 발급 직후 한 번만 표시됩니다.
`/admin/devices`는 owner/device별 메모, 녹음, 마지막 동기화 흔적과 기기 활성 상태를 확인하는 화면입니다.
동기화, 메모 저장, 녹음 업로드 API를 사용한 owner/device 조합은 서버의 기기 레지스트리에 자동 기록됩니다.
운영자가 기기를 비활성으로 바꾸면 해당 기기의 동기화, 메모 저장, 녹음 업로드가 차단됩니다.
앱과 설치형 프로그램은 사용자별 기기 조회/해제 API로 자기 기기 목록을 확인하고 활성 상태를 바꿀 수 있습니다.
Owner, 기기 ID, 활성 상태로 기기 목록을 필터링하고 현재 조건으로 JSON을 내려받을 수 있습니다.
`/admin/sync`는 앱과 서버 사이의 동기화 호출 이력을 확인하는 읽기 전용 화면입니다.
Owner, 기기 ID, 삭제 포함 여부로 이력을 필터링할 수 있습니다.
현재 필터 조건 그대로 동기화 이력을 JSON으로 내려받을 수 있습니다.
`/admin/ops`는 토큰, DB, 분석 작업, 삭제 표시 메모, 사용자 상태, 비활성 기기 등 운영 점검 항목을 확인하는 읽기 전용 화면입니다.
`/admin/analysis`는 Owner, 상태, 작업 유형으로 분석 작업을 필터링하고 현재 조건으로 JSON을 내려받을 수 있습니다.
`/admin/public`은 공용 서버 오픈 전 사용자별 토큰, 토큰 확인 화면/API, 2단계 코드 검증 절차, 기기 등록/해제, 데이터 격리 기준을 확인하는 읽기 전용 화면입니다.
이 화면은 `NOW_PUBLIC_BASE_URL` 기준으로 `/health/ready`와 `/api/v1/server`가 실제 NowNote JSON을 반환하는지도 함께 확인합니다.
같은 결과는 `/api/v1/admin/public-route`에서 JSON으로 볼 수 있습니다.
`/admin/release`는 1차 마무리 체크리스트의 완료/남은 항목, 외부 조건별 보류 사유, 다음 행동을 확인하는 읽기 전용 화면입니다.
`/admin/evidence`는 실제 기기, 공용 서버, Play Console, GitHub Actions, 라이선스처럼 사람이 확인해야 하는 남은 항목의 필요 증빙과 다음 행동을 확인하는 읽기 전용 화면입니다.
`/admin/mobile`은 실제 Android 기기, 음성 실시간 변환, 녹음 후 변환, 녹음 업로드 확인 절차를 확인하는 읽기 전용 화면입니다.
`/admin/play`는 Google Play 등록 문서, 이미지 초안, Play Console 수동 확인 항목을 확인하는 읽기 전용 화면입니다.
`/admin/open-source`는 공개 저장소 문서, 이슈/PR 템플릿, GitHub Actions preflight, 라이선스 수동 확인 항목을 확인하는 읽기 전용 화면입니다.
`/admin/export`는 백업 전 항목별 건수를 확인하고 전체 백업 또는 메모, 녹음 메타데이터, 사용자, 기기 등록 상태, 분석 작업, 동기화 이력을 JSON으로 내려받는 읽기 전용 화면입니다.
전체 백업은 `nownote-server-backup-YYYYMMDD-HHMMSS.json` 파일명으로 내려받습니다.
전체 백업 JSON에는 `backup_schema_version`, `api_version`, `server`, `includes_recording_files`, `includes_deleted_notes` 메타정보가 포함됩니다.
백업 JSON의 `content_sha256`과 응답 헤더 `X-Now-Backup-Sha256`로 내려받은 백업 내용의 식별값을 확인할 수 있습니다.
현재 전체 백업에는 원본 녹음 파일 자체가 아니라 녹음 메타데이터만 포함됩니다.
전체 백업에는 삭제 표시 메모도 포함합니다.
사용자별 접속 토큰 원문과 토큰 해시는 백업 JSON에 포함하지 않고, 토큰 발급 여부만 표시합니다.
`POST /api/v1/admin/export/verify`에 백업 JSON을 보내면 스키마, 체크섬, 필수 항목, 토큰 민감정보 노출 여부와 항목별 건수 요약을 확인할 수 있습니다.
`GET /api/v1/admin/export/summary`의 `total_export_items`는 메모, 녹음 메타데이터, 사용자, 기기, 분석 작업, 동기화 이력의 합계입니다.
`recording_orphan_files`와 `recording_orphan_bytes`는 백업 JSON에 포함되지 않는 고아 녹음 파일의 운영 지표입니다.
`recording_missing_files`는 백업 JSON에는 메타데이터가 포함되지만 저장소 원본 파일이 없는 녹음 메타데이터 수입니다.
검증 응답의 `checks`는 각 항목별 `ok` 또는 `bad` 상태와 기대값/실제값을 함께 반환합니다.
검증 응답의 `status_counts`는 `ok`, `warn`, `bad` 개수를 반환해 복구 판단에 사용할 수 있습니다.
장애 복구 절차는 [RECOVERY.md](RECOVERY.md)를 기준으로 진행합니다.
`/admin/recovery`는 같은 복구 절차를 관리자 화면에서 읽기 전용으로 확인하는 화면입니다.
WSL/Docker 배포 갱신 절차는 [DEPLOY.md](DEPLOY.md)를 기준으로 확인합니다.
`/admin/deploy`는 같은 배포 체크리스트를 관리자 화면에서 읽기 전용으로 확인하는 화면입니다.
검증 요청 형식:

```bash
curl -X POST http://localhost:8750/api/v1/admin/export/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"backup": { ... 전체 백업 JSON ... }}'
```

`/admin/analysis`는 분석 작업 큐의 상태별/유형별 집계와 최근 작업 상세를 확인하는 읽기 전용 화면입니다.
`/admin/help`는 단독 사용자, 서버 연결 사용자, 개인 Docker 서버, 공용 NowNote 서버 운영 기준을 확인하는 도움말 화면입니다.
`NOW_API_TOKEN`이 설정된 경우 운영 화면은 브라우저 로그인 창에서 비밀번호로 API 토큰을 입력해야 열립니다.

운영 점검 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/ops
```

`NOW_API_TOKEN`이 설정된 경우 `Authorization: Bearer 긴-랜덤-토큰` 헤더가 필요합니다.
이 API는 `/admin/ops` 화면과 같은 기준으로 DB, 녹음 저장소, 고아 녹음 파일, 누락 녹음 파일, 토큰, DB 기본 비밀번호, 사용자 상태, 비활성 기기, 분석 작업 상태, 백업/복구 절차 확인 상태를 JSON으로 반환합니다.
백업/복구 절차 항목은 `/admin/export` 전체 백업, `status_counts.bad=0` 검증 기준, `/admin/recovery` 복구 기준 확인을 안내합니다.
공용 서버 오픈 전 `NOW_PUBLIC_BASE_URL`과 `NOW_BEHIND_REVERSE_PROXY` 설정이 부족하면 공개 운영 환경이 정보성 점검으로 함께 반환됩니다. 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 기기 조회/해제 API, 사용자별 데이터 격리 자동 검증은 준비 완료 항목으로 표시됩니다.

1차 릴리스 준비 상태 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/release-readiness
```

이 API는 `/admin/release` 화면과 같은 기준으로 전체 체크리스트 완료 수, 영역별 진행률, 실제 기기/공용 서버/Play Console/라이선스처럼 외부 확인이 필요한 남은 항목 유형과 다음 행동을 JSON으로 반환합니다.
`/admin/evidence`에서 같은 항목의 최신 수동 증빙 기록을 `완료`로 저장하면 `summary.evidence_done`에 집계되고 완료 수에도 반영됩니다.

1차 수동 증빙 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/release-evidence
```

이 API는 `/admin/evidence` 화면과 같은 기준으로 남은 수동 확인 항목별 필요 증빙, 다음 행동, 참고 화면과 스크립트를 JSON으로 반환합니다.

1차 수동 증빙 기록 템플릿 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/release-evidence-template
```

이 API는 `/admin/evidence` 화면의 증빙 기록 템플릿과 같은 내용으로 확인일, 확인자, 결과, 증빙 위치, 실제 확인 내용을 적을 수 있는 텍스트를 JSON으로 반환합니다.

1차 수동 증빙 기록 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/release-evidence-records
```

이 API는 `/admin/evidence` 화면에서 저장한 수동 증빙 기록을 JSON으로 반환합니다. 같은 경로에 `POST` 요청을 보내면 `group_name`, `section`, `label`, `result`, `checked_by`, `evidence_location`, `actual_note`, `memo` 값을 저장할 수 있습니다.

Google Play 등록 준비 상태 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/play-release
```

이 API는 `/admin/play` 화면과 같은 기준으로 Play 등록 문서, 이미지 초안, 개인정보처리방침/권한 설명 문구, Play Console 수동 확인 항목을 JSON으로 반환합니다.
서명 키와 AAB 같은 로컬 릴리스 파일은 서버 이미지에 포함하지 않으므로 `scripts/play_release_status.py`에서 별도로 확인합니다.

공개 저장소 준비 상태 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/open-source-release
```

이 API는 `/admin/open-source` 화면과 같은 기준으로 공개 문서, GitHub 템플릿, Actions preflight, 라이선스 수동 확인 항목을 JSON으로 반환합니다.
실제 라이선스 선택과 Actions 통과 확인은 사람이 최종 결정하거나 GitHub 화면에서 확인합니다.

스모크 테스트:

```powershell
python .\scripts\smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

요청 대기 시간이 더 필요하면 `--timeout 초`를 추가합니다.
컨테이너가 올라오는 중이면 `--ready-retries 횟수 --ready-delay 초`로 `/health/ready` 준비 대기를 늘릴 수 있습니다.

`NOW_USER_TOKEN_REQUIRED=true`로 공용 서버 모드를 점검할 때는 사용자별 접속 토큰을 함께 넣습니다.
관리자 토큰으로 테스트용 `local_user` 토큰을 새로 발급해 바로 점검하려면 아래처럼 실행합니다.

```powershell
python .\scripts\smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --issue-local-user-token
```

이미 발급된 사용자별 접속 토큰을 사용할 때:

```powershell
python .\scripts\smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --user-token 사용자별-접속-토큰
```

배포 전 점검은 `.env`의 토큰/DB 비밀번호 변경 여부, Docker Compose 포트/볼륨/재시작 정책, 스모크 테스트 파일 존재를 확인합니다.
성공하면 `NowNote server preflight passed (통과/전체 checks)` 형식으로 점검 수가 표시됩니다.
실패하면 `Preflight failed (통과/전체 checks)`와 실패 항목 목록을 먼저 확인합니다.
스모크 테스트는 서버를 띄운 뒤 health/API/sync, 운영 화면 응답, 사용자 프로필 조회/수정을 함께 확인합니다.
또한 백업 내보내기/검증, 녹음 업로드, 분석 작업, 사용자별 접속 토큰, 비활성 사용자 차단 기준을 확인합니다.
사용자별 접속 토큰 필수 모드에서는 다른 사용자 토큰으로 데이터 API에 접근하는 요청이 `invalid user token`으로 차단되는지도 확인합니다.
메모 목록, 검색, 동기화 pull, 녹음 목록, 분석 작업 목록에서는 다른 사용자의 데이터가 섞이지 않는지도 함께 확인합니다.
성공하면 마지막에 `NowNote server smoke test passed`가 표시됩니다.
검증 조건이 실패하면 `SMOKE TEST FAILED: 원인` 형식으로 실패 이유가 먼저 표시됩니다.
`/api/v1/server` 응답에 최신 capability나 `public_server_readiness`가 없으면 현재 실행 중인 컨테이너가 오래된 배포본일 수 있습니다.
이때는 배포 경로에서 `git pull origin main` 후 `docker compose up --build -d` 또는 `docker-compose up --build -d`를 다시 실행합니다.
서버가 오류 응답을 반환하면 `SMOKE TEST HTTP FAILED: 상태코드 원인` 형식으로 HTTP 실패 이유가 먼저 표시됩니다.
서버가 떠 있지 않거나 포트가 맞지 않으면 `SMOKE TEST CONNECTION FAILED: 원인` 형식으로 연결 실패 이유가 먼저 표시됩니다.
JSON 응답을 해석하지 못하면 `SMOKE TEST JSON FAILED: 원인` 형식으로 응답 파싱 실패 이유가 먼저 표시됩니다.

## 1차 API

### Health

`GET /health`

서버 상태 확인.

`GET /health/ready`

DB 연결까지 포함한 준비 상태 확인.

`GET /api/v1/server`

서버 이름, API 버전, 인증 필요 여부를 확인합니다.
앱은 이 응답의 `capabilities` 값으로 동기화, 녹음 업로드, 분석 작업, 사용자 계정, 사용자 프로필, 2단계 인증 상태 관리, 운영 점검 API, 백업 내보내기, 백업 검증 지원 여부와 계층 메모 최대 깊이를 확인할 수 있습니다.
`public_server_readiness`는 공용 서버 오픈 전 준비 상태를 알려줍니다. `ready`에는 이미 서버가 지원하는 사용자별 접속 토큰, 사용자 프로필 관리, 기기 레지스트리, 사용자별 기기 조회/해제 API, 백업/복구 점검, 사용자별 데이터 격리 자동 검증, 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차 항목이 들어갑니다. `NOW_PUBLIC_BASE_URL=https://...`와 `NOW_BEHIND_REVERSE_PROXY=true`가 설정되면 공개 HTTPS/reverse proxy 항목도 `ready`가 되고, 부족하면 `remaining`에 남습니다. `items`는 운영 화면과 같은 기준의 상세 목록입니다.

현재 `api_version` 값은 `v1`입니다.

현재 capability 키:

- `sync`
- `recordings`
- `analysis_jobs`
- `admin_ops`
- `backup_export`
- `backup_verify`
- `user_accounts`
- `user_profile`
- `user_timezone`
- `two_factor_status`
- `two_factor_auth`
- `user_groups`
- `user_access_tokens`
- `max_tree_note_level`
- `supported_note_types`

`user_token_required`가 `true`이면 데이터 API 요청에 사용자별 접속 토큰 헤더 `X-Now-User-Token`이 필요합니다.
`two_factor_status`는 관리자 화면에서 사용 여부를 관리할 수 있다는 뜻이고, `two_factor_auth`는 실제 로그인 2단계 인증 기능의 구현 상태를 나타냅니다.
현재 `two_factor_auth` 값은 `token_code`입니다.
현재 `max_tree_note_level` 값은 `3`, `supported_note_types` 값은 `daily`, `tree`, `record`입니다.

### Auth

`GET /auth/token`

사용자가 관리자에게 받은 사용자별 접속 토큰을 브라우저에서 확인하는 화면입니다.
API 토큰 없이 열 수 있으며, 사용자 ID와 사용자별 접속 토큰을 입력하면 현재 서버에서 유효한지 확인합니다.

`POST /api/v1/auth/token-login`

앱과 설치형 프로그램이 사용자별 접속 토큰을 확인합니다.
요청 본문은 `owner_id`, `access_token`을 사용합니다.
성공하면 사용자 프로필과 마지막 로그인 시각을 갱신한 결과를 반환하고, 실패하면 `invalid user token`, `user token not issued`, `user inactive` 같은 사유를 반환합니다.
사용자의 2단계 인증이 켜져 있으면 `two_factor_code` 6자리 코드도 함께 보내야 하며, 코드가 없거나 틀리면 `two factor code required`, `invalid two factor code`로 차단됩니다.

### Users

`GET /api/v1/users/{owner_id}`

앱과 설치형 프로그램이 현재 사용자 프로필을 조회합니다.
사용자가 아직 없으면 기본 시간대 `Asia/Seoul`로 자동 생성합니다.

`PATCH /api/v1/users/{owner_id}`

앱과 설치형 프로그램이 자기 프로필의 이메일, 표시 이름, 시간대를 수정합니다.
사용자 그룹, 2단계 인증 사용 여부, 활성 상태는 관리자 화면에서 관리합니다.

`GET /api/v1/users/{owner_id}/devices`

앱과 설치형 프로그램이 자기 기기 목록을 조회합니다.
기기 ID, 활성 상태, 처음 확인 시각, 마지막 확인 시각을 반환합니다.

`PATCH /api/v1/users/{owner_id}/devices/{device_id}`

앱과 설치형 프로그램이 이미 등록된 자기 기기의 활성 상태를 변경합니다.
존재하지 않는 기기는 새로 만들지 않고 `404 device not found`로 응답합니다.
비활성 기기는 이후 동기화, 메모 저장, 녹음 업로드가 차단됩니다.

`POST /api/v1/admin/users/{owner_id}/token`

관리자가 공용 서버 준비용 사용자별 접속 토큰을 발급합니다.
서버는 토큰 원문을 저장하지 않고 해시와 발급 시각만 저장합니다.
발급된 토큰은 응답에서 한 번만 확인할 수 있습니다.
`NOW_USER_TOKEN_REQUIRED=true`이면 데이터 API에서 이 토큰을 `X-Now-User-Token` 헤더로 검증합니다.

### Notes

`GET /api/v1/notes?owner_id=local_user`

서버에 저장된 메모 목록을 조회합니다.

`GET /api/v1/notes/search?owner_id=local_user&q=검색어`

제목과 본문에서 메모를 검색합니다.

`DELETE /api/v1/notes/{local_id}?owner_id=local_user&device_id=phone`

메모를 서버에서 소프트 삭제합니다. 삭제된 메모는 `include_deleted=true`로 조회할 수 있습니다.

`GET /api/v1/notes?owner_id=local_user&updated_after=2026-05-05T00:00:00`

특정 시점 이후 변경된 메모만 조회합니다.

`POST /api/v1/notes`

단일 메모를 생성하거나 갱신합니다. `owner_id + device_id + local_id` 조합으로 중복을 판단합니다.

`POST /api/v1/notes/sync`

앱에서 여러 메모를 한 번에 올리는 동기화 API입니다.

`POST /api/v1/sync`

앱에서 변경된 메모를 올리고, 서버에서 변경된 메모를 한 번에 내려받는 통합 동기화 API입니다.

요청 예시:

```json
{
  "owner_id": "local_user",
  "device_id": "android_001",
  "updated_after": "2026-05-06T00:00:00",
  "include_deleted": true,
  "notes": []
}
```

응답:

- `pushed_notes`: 앱에서 올려 서버에 반영된 메모
- `pulled_notes`: 서버에서 앱으로 내려받을 변경 메모
- `server_time`: 다음 동기화 기준 시각

지원 메모 타입 예시:

- `daily`: 일자 중심 간단 메모
- `tree`: 계층형 지식 메모
- `record`: 회의/대화/음성 메모

계층형 메모는 `level` 값을 `1..3`으로 제한합니다.

동기화 충돌 규칙:

- 같은 `owner_id + device_id + local_id`는 같은 메모로 처리합니다.
- `client_updated_at`이 서버에 저장된 값보다 오래된 요청이면 서버 값을 유지합니다.
- 삭제도 `deleted_at`이 포함된 메모 업데이트로 동기화할 수 있습니다.

### Recordings

`POST /api/v1/recordings`

원본 음성 파일과 선택적 텍스트 변환 결과를 업로드합니다.

폼 필드:

- `owner_id`
- `device_id`
- `local_id`
- `note_local_id`
- `transcript`
- `file`

### Analysis Jobs

`POST /api/v1/analysis/jobs`

서버 측 LLM 분석 작업을 큐에 등록합니다.

지원 작업 타입:

- `memo_summary`
- `daily_briefing`
- `tree_note_index`
- `recording_summary`

`GET /api/v1/analysis/jobs?owner_id=local_user`

분석 작업 목록을 조회합니다.

`GET /api/v1/analysis/jobs/{job_id}`

분석 작업 상태를 조회합니다.

`PATCH /api/v1/analysis/jobs/{job_id}`

작업 상태와 결과를 갱신합니다. 실제 LLM 워커를 붙이기 전까지는 운영자/워커 프로세스가 이 API로 상태를 갱신하는 구조입니다.

현재 `now-worker`는 외부 LLM 연결 전에도 동작하는 기본 로컬 처리기를 사용합니다.

- `queued` 작업 조회
- `running`으로 상태 변경
- LLM 설정이 있으면 외부 LLM 호출
- LLM 설정이 없으면 작업 타입별 기본 요약/키워드 JSON 생성
- 성공 시 `done`, 실패 시 `failed` 저장

워커 단독 실행:

```powershell
python -m app.worker
```

## 다음 단계

### 서버 운영

- 개인 서버는 `.env`에 `NOW_API_TOKEN`을 설정한 뒤 필요하면 `NOW_USER_TOKEN_REQUIRED=true`로 사용자별 접속 토큰을 강제합니다.
- 공용 서버는 사용자 토큰 확인 화면/API와 2단계 코드 검증 절차를 제공하며, `NOW_PUBLIC_BASE_URL=https://도메인`, `NOW_BEHIND_REVERSE_PROXY=true` 구성을 확정한 뒤 오픈합니다.
- 공개 운영 도메인, HTTPS, reverse proxy, 복구 절차를 최종 점검합니다.
- 공용 서버 오픈 전 `python3 scripts/preflight.py --public-server` 실패 항목을 모두 해소합니다. 현재 1차 서버에서는 이 실패가 정상적인 미완료 표시입니다.

### 앱/출시 연계

- 릴리스 AAB를 재빌드한 뒤 실제 Android 기기에서 서버 연결, 동기화, 녹음 업로드를 검증합니다.
- 릴리스 병합 Manifest에서 불필요한 음성 출력 캡처 권한이 포함되지 않는지 재확인합니다.
