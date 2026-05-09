# NowNote Server

NowNote 1차 서버는 개인 Docker 서버 또는 공용 운영 서버에서 메모와 녹음 파일을 동기화하기 위한 기본 API입니다.

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
docker compose up --build
```

Linux/WSL에서는 아래처럼 준비합니다.

```bash
cd ~/deploy/Now/server
cp .env.example .env
nano .env
docker compose up --build
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

`.env` 예시:

```env
NOW_API_TOKEN=여기에-긴-랜덤-토큰
NOW_POSTGRES_PASSWORD=여기에-긴-랜덤-DB-비밀번호
```

기존 DB 볼륨이 이미 만들어진 뒤 `NOW_POSTGRES_PASSWORD`를 바꾸면 PostgreSQL 저장 비밀번호와 설정이 달라질 수 있으므로, 운영 시작 전에 먼저 확정합니다.
DB 비밀번호는 연결 URL에도 들어가므로 처음에는 영문/숫자 중심의 긴 값으로 설정합니다.

자체 서버 사용자는 앱 설정 화면에 다음 값을 입력합니다.

- 서버 주소: `http://서버주소:8750`
- API 토큰: `.env`의 `NOW_API_TOKEN`

신산님이 운영하는 공용 NowNote 서버도 같은 서버 프로그램을 사용합니다.
다만 공용 서버에서는 사용자가 직접 `.env`를 만지지 않고, 서버 운영자가 사용자/기기별 접속 토큰을 발급하는 방식으로 운영합니다.

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
http://localhost:8750/admin/analysis
```

`/monitor`는 서버/DB 상태와 집계 중심의 모니터링 화면입니다.
`/admin`은 운영 설정, 메모 타입별 저장 현황, 최근 분석 작업을 확인하는 읽기 전용 관리 화면입니다.
`/admin/notes`는 메모 타입/소스/사용자별 집계와 최근 변경 메모를 확인하는 읽기 전용 화면입니다.
`/admin/recordings`는 원본 음성 파일 저장 현황과 최근 녹음 파일을 확인하는 읽기 전용 화면입니다.
`/admin/users`는 시간대, 2단계 인증 사용 여부, 사용자 그룹, 활성 상태, 최근 접속 시간을 확인하는 읽기 전용 화면입니다.
`/admin/devices`는 owner/device별 메모, 녹음, 마지막 동기화 흔적을 확인하는 읽기 전용 화면입니다.
`/admin/sync`는 앱과 서버 사이의 동기화 호출 이력을 확인하는 읽기 전용 화면입니다.
`/admin/ops`는 토큰, DB, 분석 작업, 삭제 표시 메모 등 운영 점검 항목을 확인하는 읽기 전용 화면입니다.
`/admin/export`는 메모, 녹음 메타데이터, 분석 작업, 동기화 이력을 JSON으로 내려받는 읽기 전용 화면입니다.
`/admin/analysis`는 분석 작업 큐의 상태별/유형별 집계와 최근 작업 상세를 확인하는 읽기 전용 화면입니다.
`NOW_API_TOKEN`이 설정된 경우 운영 화면은 브라우저 로그인 창에서 비밀번호로 API 토큰을 입력해야 열립니다.

운영 점검 API:

```powershell
Invoke-WebRequest http://localhost:8750/api/v1/admin/ops
```

`NOW_API_TOKEN`이 설정된 경우 `Authorization: Bearer 긴-랜덤-토큰` 헤더가 필요합니다.
이 API는 `/admin/ops` 화면과 같은 기준으로 DB, 녹음 저장소, 토큰, DB 기본 비밀번호, 분석 작업 상태를 JSON으로 반환합니다.

스모크 테스트:

```powershell
python .\scripts\smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

스모크 테스트는 health/API/sync와 운영 화면 응답을 함께 확인합니다.

## 1차 API

### Health

`GET /health`

서버 상태 확인.

`GET /health/ready`

DB 연결까지 포함한 준비 상태 확인.

`GET /api/v1/server`

서버 이름, API 버전, 인증 필요 여부를 확인합니다.
앱은 이 응답의 `capabilities` 값으로 동기화, 녹음 업로드, 분석 작업, 사용자 계정, 운영 점검 API 지원 여부와 계층 메모 최대 깊이를 확인할 수 있습니다.

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

- 앱에 서버 주소 설정 화면 추가
- 앱 로컬 DB 변경분을 `/api/v1/sync`로 전송
- 녹음 후 변환 모드의 원본 파일을 `/api/v1/recordings`로 업로드
- 서버 인증 토큰을 앱 설정과 연결
- 서버 측 분석 결과를 앱 화면과 연결
- 앱에서 분석 작업 생성/상태 조회 연결
