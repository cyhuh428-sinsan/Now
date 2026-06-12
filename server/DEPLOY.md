# NowNote 서버 배포 체크리스트

이 문서는 개인 Linux 서버 또는 공용 Linux 서버에서 NowNote 서버를 갱신하고 다시 확인하는 최소 절차입니다.
자세한 기능 설명은 `README.md`, 장애 복구 절차는 `RECOVERY.md`를 기준으로 합니다.
공용 서버 오픈 절차와 reverse proxy 예시는 `PUBLIC_SERVER.md`를 기준으로 합니다.

WSL 설치와 실행은 개발/테스트용입니다.
실제 사용자는 공용 서버 `nownote.sinsan.kr`를 쓰거나, 별도 Linux 서버에 개인 서버를 설치합니다.

## 빠른 갱신

아래 명령은 소스 갱신, preflight, 컨테이너 재시작, ready 확인, smoke test를 순서대로 실행합니다.
`.env`의 `NOW_API_TOKEN`을 읽어 smoke test에 자동으로 전달합니다.

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

공용 서버 오픈 전 기준까지 함께 확인하려면 `--public-server`를 추가합니다.
`NOW_USER_TOKEN_REQUIRED=true` 상태에서 빠른 갱신 명령을 쓰면 smoke test가 테스트용 `local_user` 토큰을 자동 발급해 검증합니다.
이미 발급한 사용자별 접속 토큰으로 검증하려면 `--user-token 사용자별-접속-토큰`을 사용합니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750 --public-server
```

이미 소스를 직접 갱신한 상태라면 `--skip-pull`로 `git pull origin main`을 생략할 수 있습니다.
공개 도메인과 HTTPS reverse proxy를 설정할 때는 `reverse_proxy/nginx.nownote.sinsan.kr.conf.example`, `reverse_proxy/nginx.nownote.conf.example` 또는 `reverse_proxy/Caddyfile.example`을 실제 환경에 맞게 수정합니다.
Nginx Proxy Manager를 사용하면 같은 Docker 네트워크에서는 `Scheme=http`, `Forward Hostname/IP=now-api`, `Forward Port=8080`으로 연결합니다.
다른 네트워크나 별도 서버 NPM이면 `Forward Hostname/IP=서버 IP`, `Forward Port=8750`을 사용합니다.
AMD 서버 `140.245.68.207` 기준으로는 기존 `nownote-site:80` 값을 `140.245.68.207:8750`으로 바꾸면 됩니다.
NowNote Web 프로그램을 루트 주소에서 열기 위해 도메인 전체를 NowNote 서버로 연결합니다.
저장 후 `https://nownote.sinsan.kr/`가 Web 프로그램을 반환하고, `https://nownote.sinsan.kr/privacy`가 개인정보처리방침을 반환해야 합니다.
`https://nownote.sinsan.kr/health`, `https://nownote.sinsan.kr/health/ready`, `https://nownote.sinsan.kr/api/v1/server`는 JSON을 반환해야 합니다.
공용 서버 예시 환경값은 `server/.env.public.example`을 기준으로 확인합니다.

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
- `NOW_MESSENGER_STORAGE_DIR`
- `NOW_MESSENGER_MAX_UPLOAD_MB`
- `NOW_MESSENGER_ALLOWED_EXTENSIONS`
- `NOW_MESSENGER_ALLOWED_MIME_TYPES`
- `NOW_LLM_PROVIDER`
- 공용 서버: `NOW_SELF_REGISTRATION_ENABLED`, `NOW_SMTP_HOST`, `NOW_SMTP_FROM`

개인 Docker 서버는 `NOW_USER_TOKEN_REQUIRED=false`로 시작할 수 있습니다.
공용 서버로 열기 전에는 사용자가 Web에서 직접 가입하고 앱/설치형 연결 토큰을 발급할 수 있도록 `NOW_SELF_REGISTRATION_ENABLED=true`, `NOW_USER_TOKEN_REQUIRED=true`를 사용합니다.
비밀번호 재설정을 제공하려면 SMTP 설정도 완료합니다.
2.3 메신저 첨부를 운영하려면 운영 서버 `.env`에도 아래 값을 추가합니다. 기본 허용 MIME에는 `application/octet-stream`을 넣지 않습니다.

```env
NOW_MESSENGER_STORAGE_DIR=/data/messenger
NOW_MESSENGER_MAX_UPLOAD_MB=10
NOW_MESSENGER_ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,gif,pdf,txt,md,docx,xlsx,pptx,zip
NOW_MESSENGER_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip
```

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

현재 1차 서버에서 `--public-server`는 `NOW_USER_TOKEN_REQUIRED=true`, `NOW_PUBLIC_BASE_URL=https://도메인`, `NOW_BEHIND_REVERSE_PROXY=true`, `NOW_SMTP_HOST`, `NOW_SMTP_FROM` 설정이 없으면 공용 서버 오픈 전 항목 때문에 실패하는 것이 정상입니다. 사용자 직접 가입, 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 기기 조회/해제 API, 사용자별 데이터 격리 자동 검증은 준비 완료 항목으로 확인합니다.

## 4. 컨테이너 시작

```bash
docker compose up --build -d
```

구버전 Docker Compose 환경에서 `docker compose` 옵션이 맞지 않으면 아래 명령을 사용합니다.

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
docker compose ps
docker compose logs now-api --tail=80
docker compose logs now-worker --tail=80
```

환경에 따라 `docker compose`가 없고 `docker-compose`만 있을 수 있습니다.
반대로 최신 Ubuntu 서버처럼 `docker-compose` 명령이 없으면 `docker compose`를 사용합니다.

구버전 환경에서 `docker-compose`만 쓸 수 있으면 아래처럼 확인합니다.

```bash
docker-compose ps
docker-compose logs now-api --tail=80
docker-compose logs now-worker --tail=80
```

Linux 서버 자체에서 점검할 때 `localhost:8750`은 서버 자신을 뜻합니다.
다른 PC나 휴대폰에서 접속할 때는 `localhost`가 아니라 `http://서버IP:8750` 또는 공용 도메인을 사용합니다.

## 6. 스모크 테스트

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

2.3 메신저의 채팅방, 메시지, 읽음 처리, 첨부 업로드/다운로드만 운영 DB를 건드리지 않는 임시 DB로 확인할 때는 아래 명령을 추가로 실행합니다.

```bash
python3 scripts/messenger_smoke_test.py
```

스모크 테스트의 기본 요청 대기 시간은 30초입니다. 컨테이너가 느리게 응답하는 환경에서는 `--timeout 60`처럼 요청 대기 시간을 늘릴 수 있습니다.
컨테이너가 올라오는 중이면 기본적으로 최대 60회, 2초 간격으로 `/health/ready`를 기다립니다. 더 느린 서버에서는 `--ready-retries 120 --ready-delay 2`처럼 준비 대기를 늘릴 수 있습니다.

성공하면 마지막에 `NowNote server smoke test passed`가 표시됩니다.
메신저 단독 검증이 성공하면 마지막에 `NowNote 2.3 messenger smoke test passed`가 표시됩니다.
검증 조건이 실패하면 `SMOKE TEST FAILED: 원인` 형식으로 실패 이유가 먼저 표시됩니다.
`/api/v1/server` 응답에 최신 capability나 `public_server_readiness`가 없다는 메시지가 나오면 현재 컨테이너가 오래된 배포본일 수 있으므로 `git pull origin main`과 compose 재기동을 다시 확인합니다.

Windows 개발 작업 환경에서 현재 로컬 Docker/실행 서버 상태를 빠르게 확인하려면 저장소 루트에서 다음 명령을 실행합니다.

```powershell
python scripts\local_environment_status.py --base-url http://localhost:8750
```
서버가 오류 응답을 반환하면 `SMOKE TEST HTTP FAILED: 상태코드 원인` 형식으로 HTTP 실패 이유가 먼저 표시됩니다.
서버가 떠 있지 않거나 포트가 맞지 않으면 `SMOKE TEST CONNECTION FAILED: 원인` 형식으로 연결 실패 이유가 먼저 표시됩니다.
요청이 너무 오래 걸리면 `SMOKE TEST TIMEOUT FAILED: 요청 URL timed out after 초s` 형식으로 어느 요청에서 멈췄는지 표시됩니다.
JSON 응답을 해석하지 못하면 `SMOKE TEST JSON FAILED: 원인` 형식으로 응답 파싱 실패 이유가 먼저 표시됩니다.

사용자별 접속 토큰 필수 모드에서는 아래 중 하나를 사용합니다.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --user-token 사용자별-접속-토큰
```

`NOW_USER_TOKEN_REQUIRED=true`인 공용 서버에서는 `--user-token`을 생략하면 smoke test가 관리자 토큰으로 검증용 `local_user` 토큰을 자동 발급합니다.

배포 도우미를 사용할 때도 같은 기준을 적용합니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750 --public-server
sh scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --user-token 사용자별-접속-토큰
```

## 7. 운영 화면 확인

- `http://localhost:8750/app/`
- `http://localhost:8750/privacy`
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
