# NowNote 서버 배포 체크리스트

이 문서는 WSL 또는 Linux 서버에서 NowNote 서버를 갱신하고 다시 확인하는 최소 절차입니다.
자세한 기능 설명은 `README.md`, 장애 복구 절차는 `RECOVERY.md`를 기준으로 합니다.

## 1. 소스 갱신

```bash
cd ~/deploy/Now
git pull origin main
cd server
```

## 2. 환경 파일 확인

실제 운영 서버에서는 `.env.example`이 아니라 `.env`를 사용합니다.

```bash
test -f .env
nano .env
```

반드시 확인할 값:

- `NOW_API_TOKEN`
- `NOW_POSTGRES_PASSWORD`
- `NOW_USER_TOKEN_REQUIRED`
- `NOW_STORAGE_DIR`
- `NOW_LLM_PROVIDER`

개인 Docker 서버는 `NOW_USER_TOKEN_REQUIRED=false`로 시작할 수 있습니다.
공용 서버로 열기 전에는 사용자별 접속 토큰을 발급하고 `NOW_USER_TOKEN_REQUIRED=true`를 사용합니다.

## 3. 배포 전 점검

```bash
python3 scripts/preflight.py
```

성공하면 `NowNote server preflight passed (통과/전체 checks)` 형식으로 점검 수가 표시됩니다.
실패하면 `Preflight failed (통과/전체 checks)`와 실패 항목 목록을 먼저 확인합니다.

공용 서버 오픈 전 점검:

```bash
python3 scripts/preflight.py --public-server
```

현재 1차 서버에서 `--public-server`는 `NOW_USER_TOKEN_REQUIRED=true`, `NOW_PUBLIC_BASE_URL=https://도메인`, `NOW_BEHIND_REVERSE_PROXY=true` 설정이 없으면 공용 서버 오픈 전 항목 때문에 실패하는 것이 정상입니다. 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 기기 조회/해제 API, 사용자별 데이터 격리 자동 검증은 준비 완료 항목으로 확인합니다.

## 4. 컨테이너 시작

```bash
docker compose up --build -d
```

WSL 환경에서 `docker compose` 옵션이 맞지 않으면 아래 명령을 사용합니다.

```bash
docker-compose up --build -d
```

## 5. 상태 확인

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
curl http://localhost:8750/api/v1/server
```

컨테이너 상태와 로그:

```bash
docker-compose ps
docker-compose logs now-api --tail=80
docker-compose logs now-worker --tail=80
```

## 6. 스모크 테스트

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

컨테이너가 느리게 응답하는 환경에서는 `--timeout 30`처럼 요청 대기 시간을 늘릴 수 있습니다.
컨테이너가 올라오는 중이면 `--ready-retries 10 --ready-delay 3`처럼 `/health/ready` 준비 대기를 늘릴 수 있습니다.

성공하면 마지막에 `NowNote server smoke test passed`가 표시됩니다.
검증 조건이 실패하면 `SMOKE TEST FAILED: 원인` 형식으로 실패 이유가 먼저 표시됩니다.
`/api/v1/server` 응답에 최신 capability나 `public_server_readiness`가 없다는 메시지가 나오면 현재 컨테이너가 오래된 배포본일 수 있으므로 `git pull origin main`과 compose 재기동을 다시 확인합니다.

Windows 작업 환경에서 현재 WSL/Docker/실행 서버 상태를 빠르게 확인하려면 저장소 루트에서 다음 명령을 실행합니다.

```powershell
python scripts\local_environment_status.py --base-url http://localhost:8750
```
서버가 오류 응답을 반환하면 `SMOKE TEST HTTP FAILED: 상태코드 원인` 형식으로 HTTP 실패 이유가 먼저 표시됩니다.
서버가 떠 있지 않거나 포트가 맞지 않으면 `SMOKE TEST CONNECTION FAILED: 원인` 형식으로 연결 실패 이유가 먼저 표시됩니다.
JSON 응답을 해석하지 못하면 `SMOKE TEST JSON FAILED: 원인` 형식으로 응답 파싱 실패 이유가 먼저 표시됩니다.

사용자별 접속 토큰 필수 모드에서는 아래 중 하나를 사용합니다.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --issue-local-user-token
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --user-token 사용자별-접속-토큰
```

## 7. 운영 화면 확인

- `http://localhost:8750/monitor`
- `http://localhost:8750/admin/ops`
- `http://localhost:8750/admin/export`
- `http://localhost:8750/admin/recovery`
- `http://localhost:8750/admin/help`

`/admin/ops`에서 `백업/복구 절차` 항목이 보이고, `/admin/export`, `status_counts.bad=0`, `/admin/recovery` 기준을 안내하는지 확인합니다.
`고아 녹음 파일` 항목이 보이면 `/admin/recordings`의 `고아 녹음 파일 JSON` 또는 `/api/v1/admin/export/recording-orphans`로 목록을 내려받아 저장소 정리 전에 보관합니다.
`누락 녹음 파일` 항목이 `bad`이면 `/api/v1/admin/export/recording-missing-files`로 목록을 내려받고, 배포 전 저장소 볼륨 백업에서 원본 파일을 확인합니다.
공개 운영 환경 항목은 `NOW_PUBLIC_BASE_URL`과 `NOW_BEHIND_REVERSE_PROXY` 설정으로 판정합니다. 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 기기 조회/해제 API, 사용자별 데이터 격리 자동 검증은 준비 완료 항목으로 표시되는지 확인합니다.

## 8. 백업 내보내기와 검증 확인

배포 직후 `/admin/export` 화면에서 전체 백업 JSON을 내려받고, 같은 화면의 백업 검증 안내를 기준으로 확인합니다.

API로 확인할 때는 전체 백업 JSON을 `backup` 필드에 넣어 `POST /api/v1/admin/export/verify`로 보냅니다.

```bash
curl -H "Authorization: Bearer 긴-랜덤-토큰" \
  http://localhost:8750/api/v1/admin/export/all \
  -o now-backup.json
```

```bash
curl -X POST http://localhost:8750/api/v1/admin/export/verify \
  -H "Authorization: Bearer 긴-랜덤-토큰" \
  -H "Content-Type: application/json" \
  -d '{"backup": { ... 전체 백업 JSON ... }}'
```

검증 결과의 `status`가 `ok`인지 확인합니다. `warn` 또는 `bad`가 있으면 `/admin/export`, `/admin/recovery`, `/admin/ops`를 먼저 확인합니다.
