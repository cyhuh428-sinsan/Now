# NowNote 처음 설치하기

이 문서는 GitHub 저장소를 처음 받은 사람이 NowNote를 서버 없이 사용하거나, 개인 서버를 설치하거나, 공용 서버로 여는 절차를 한 번에 따라 할 수 있도록 정리한 문서입니다.

기준 저장소:

```text
https://github.com/cyhuh428-sinsan/Now.git
```

## 1. 먼저 결정할 것

처음 사용할 때는 아래 세 방식 중 하나를 고릅니다.

### 서버 없이 사용

서버 설치가 필요 없는 가장 가벼운 방식입니다.

- 모바일 앱: 현재 휴대폰 안에만 저장
- Web 화면: 브라우저 localStorage에 저장
- 설치형 프로그램: 현재 1차 기준에서는 Web 화면을 PWA로 설치해서 독립 창처럼 사용
- 자동 동기화 없음
- 서버 백업 없음

서버 없이 사용하는 사람은 기본적으로 사용자 도움말 `docs/HELP.md`를 보면 됩니다.
Web/설치형 프로그램은 `web/help.html`에서도 같은 도움말을 볼 수 있습니다.

설치형 기준:

- Windows 설치형 프로그램은 `desktop` 폴더에서 `.exe` 설치 파일로 만들 수 있습니다.
- PWA 설치도 함께 지원합니다.
- `.msi`, macOS, Linux 설치 파일은 별도 빌드 도구를 붙이는 다음 단계에서 확장합니다.

### 개인 서버로 사용

여러 기기에서 같은 메모를 쓰고 싶을 때 권장하는 방식입니다.

- 서버 주소 예: `http://서버주소:8750`
- 사용자별 접속 토큰 강제: 끔
- 공개 도메인/HTTPS: 나중에 설정 가능
- 본인 기기에서 먼저 테스트하기 좋음

### 공용 서버로 공개

여러 사용자가 접속하는 서버입니다.

- 서버 주소 예: `https://nownote.sinsan.kr`
- 사용자별 접속 토큰 강제: 켬
- HTTPS/reverse proxy 필수
- 사용자 발급, 기기 관리, 운영 점검까지 확인해야 함

공용 서버를 열 계획이 있더라도 처음에는 개인 서버로 정상 동작을 확인한 뒤, 공용 서버 설정으로 넘어가는 순서를 권장합니다.

## 2. 서버 없이 사용하는 경우

서버 없이 사용하는 사람은 서버 설치 단계를 진행하지 않아도 됩니다.

먼저 볼 경로:

```text
사용자 도움말: docs/HELP.md
모바일 앱 안내: now_app/README.md
Web 실행 파일: web/index.html
Web 화면 도움말: web/help.html
Web/설치형 안내: web/README.md
```

### 모바일 앱만 사용하는 경우

일반 사용자는 Android 휴대폰에서 Google Play를 통해 설치합니다.

정식 배포 후:

```text
Google Play 스토어 -> NowNote 검색 -> 설치
```

내부 테스트 기간:

```text
운영자가 제공한 Google Play 내부 테스트 링크 접속 -> 테스터 참여 -> 설치
```

현재 공개 저장소에서 개발자나 검증자가 직접 확인하는 경우:

```text
docs/HELP.md
now_app/README.md
now_app/docs/google_play_step_by_step_ko.md
```

서버 연결 설정은 비워두면 됩니다.
이 경우 메모는 현재 기기 안에 저장됩니다.
서버를 설치하지 않아도 앱은 단독으로 사용할 수 있습니다.
공용 서버에 연결하려면 앱 설치 후 설정 화면의 서버 연결 항목에 운영자가 제공한 접속값을 입력합니다.

### Web 화면만 사용하는 경우

저장소를 받은 뒤 아래 파일을 브라우저에서 엽니다.

```text
web/index.html
```

Windows 예시:

```text
D:\Project\Now\web\index.html
```

서버 연결 설정은 비워두면 됩니다.
이 경우 메모는 브라우저 localStorage에 저장됩니다.
브라우저를 바꾸거나 저장소를 지우면 메모가 사라질 수 있으므로 JSON 백업이나 Markdown 내보내기를 주기적으로 사용합니다.

Web도 서버를 직접 설치하지 않고 공용 서버에 접속할 수 있습니다.
이 경우 `web/index.html`을 열고 화면 설정의 서버 연결 항목에 운영자가 제공한 서버 주소와 접속값을 입력합니다.

### 설치형 프로그램처럼 사용하는 경우

Windows 사용자는 `.exe` 설치 파일을 받아 설치하는 방식이 기본입니다.

정식 배포 후:

```text
NowNote-Setup-0.1.0-x64.exe 실행 -> 설치 위치 선택 -> 설치
```

공개 저장소에서 직접 설치 파일을 만들 때:

```bash
cd desktop
npm install
npm run dist:win
```

생성 결과:

```text
desktop/dist/NowNote-Setup-0.1.0-x64.exe
```

설치 후 서버 연결 설정을 비워두면 현재 PC에만 저장하는 단독 프로그램으로 사용할 수 있습니다.
공용 서버에 접속하려면 화면 설정의 서버 연결 항목에 운영자가 제공한 접속값을 입력합니다.

PWA 방식도 사용할 수 있습니다.
PWA는 `web/index.html`과 같은 Web 화면을 `localhost`, `127.0.0.1`, 또는 HTTPS 주소에서 열고 브라우저의 설치 기능으로 독립 창처럼 사용하는 방식입니다.

개발/배포용 PWA 묶음은 아래 명령으로 만들 수 있습니다.

```bash
cd web
python scripts/package_web.py
```

생성 결과는 아래 위치입니다.

```text
web/dist/nownote-web-pwa/
web/dist/nownote-web-pwa.zip
```

일반 사용자는 `.exe` 설치 파일이 제공되면 그 파일을 사용하면 됩니다.
공개 저장소에서 직접 확인하는 경우에는 `web/index.html`을 먼저 열어 사용 흐름을 확인하는 것이 가장 단순합니다.

### 서버를 직접 설치하지 않고 공용 서버에 접속하는 경우

사용자는 서버를 설치하지 않아도 운영자가 제공한 공용 NowNote 서버에 접속할 수 있습니다.

먼저 볼 경로:

```text
사용자 도움말: docs/HELP.md
모바일 앱 안내: now_app/README.md
Web/설치형 안내: web/README.md
Web 화면 도움말: web/help.html
```

운영자에게 받아야 하는 값:

```text
서버 주소: 예) https://nownote.sinsan.kr
API 토큰: 운영자가 제공한 서버 연결용 토큰
사용자 ID: 운영자가 만든 사용자 ID
사용자별 접속 토큰: 운영자가 발급한 사용자 토큰
2단계 인증 코드: 2단계 인증을 사용하는 경우 6자리 코드
기기 ID: 앱 또는 Web/설치형 프로그램에서 자동 생성
```

입력 위치:

```text
모바일 앱: 설정 화면의 서버 연결 항목
Web/설치형: 화면 설정의 서버 연결 항목
```

사용자는 서버의 `.env` 파일을 알 필요가 없습니다.
공용 서버 접속값은 운영자가 별도로 알려준 값만 입력합니다.

## 3. 서버 설치 준비물

서버에 아래 항목이 필요합니다.

- Linux 서버 또는 WSL2 Ubuntu
- Git
- Docker
- Docker Compose 또는 `docker-compose`
- 8750 포트 사용 가능 여부
- 공용 서버로 열 경우 도메인과 HTTPS reverse proxy

설치가 되어 있는지 확인합니다.

```bash
git --version
docker --version
docker compose version
```

`docker compose version`이 동작하지 않으면 아래 명령을 확인합니다.

```bash
docker-compose --version
```

## 4. 서버 소스 받기

권장 설치 위치는 `~/deploy/Now`입니다.

```bash
mkdir -p ~/deploy
cd ~/deploy
git clone https://github.com/cyhuh428-sinsan/Now.git
cd Now/server
```

이미 받은 적이 있으면 아래처럼 갱신합니다.

```bash
cd ~/deploy/Now
git pull origin main
cd server
```

## 5. 환경 파일 만들기

실제 운영값은 `server/.env`에 둡니다.
이 파일은 Git에 올리지 않습니다.

```bash
cp .env.example .env
nano .env
```

반드시 바꿀 값은 두 개입니다.

```env
NOW_API_TOKEN=change-this-api-token
NOW_POSTGRES_PASSWORD=change-this-postgres-password
```

긴 랜덤 값을 만듭니다.

```bash
openssl rand -hex 32
openssl rand -hex 32
```

첫 번째 값은 `NOW_API_TOKEN`에 넣고, 두 번째 값은 `NOW_POSTGRES_PASSWORD`에 넣습니다.

개인 서버로 먼저 시작할 때는 아래처럼 둡니다.

```env
NOW_USER_TOKEN_REQUIRED=false
NOW_PUBLIC_BASE_URL=
NOW_BEHIND_REVERSE_PROXY=false
NOW_LLM_PROVIDER=local
```

주의:

- `NOW_API_TOKEN`은 운영 화면과 서버 API를 보호하는 관리자용 비밀값입니다.
- `NOW_POSTGRES_PASSWORD`는 처음 `docker compose up` 전에 확정하는 것이 좋습니다.
- DB 볼륨이 만들어진 뒤 DB 비밀번호만 바꾸면 기존 DB와 설정이 맞지 않을 수 있습니다.
- `NOW_LLM_PROVIDER=local`이면 외부 LLM API 없이 기본 로컬 처리로 동작합니다.

## 6. 개인 서버로 처음 실행

아래 명령 하나로 사전 점검, Docker 빌드, 컨테이너 시작, ready 확인, smoke test를 순서대로 실행합니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

성공하면 마지막에 아래 문구가 나옵니다.

```text
NowNote server smoke test passed
== 완료 ==
운영 화면: http://localhost:8750/admin
모니터: http://localhost:8750/monitor
```

브라우저에서 확인합니다.

```text
http://localhost:8750/monitor
http://localhost:8750/admin
```

`/admin` 화면에서 로그인 창이 뜨면:

```text
사용자 이름: admin
비밀번호: .env의 NOW_API_TOKEN
```

사용자 이름은 관례적으로 `admin`을 넣고, 실제 검증은 비밀번호의 `NOW_API_TOKEN`으로 합니다.

## 7. 서버 상태 확인

서버가 떠 있는지 확인합니다.
아래 명령은 NowNote 서버에 SSH로 접속한 그 서버 안에서 실행할 때 기준입니다.
이때 `localhost`는 내 PC가 아니라 Linux 서버 자신을 뜻합니다.

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
curl http://localhost:8750/api/v1/server
```

다른 PC, 휴대폰, 외부 브라우저에서 접속할 때는 `localhost`를 쓰면 안 됩니다.
그 경우에는 서버 IP나 도메인을 사용합니다.

```text
http://서버IP:8750
https://도메인
```

정상 예시는 아래와 비슷합니다.

```json
{"status":"ok","server":"NowNote Local Server"}
```

```json
{"status":"ready"}
```

컨테이너 상태를 확인합니다.

```bash
docker compose ps
docker compose logs now-api --tail=80
docker compose logs now-worker --tail=80
```

최신 Ubuntu 서버처럼 `docker-compose` 명령이 없으면 위처럼 `docker compose`를 사용합니다.
오래된 환경에서 `docker compose`가 없고 `docker-compose`만 있으면 `docker-compose ps` 형식으로 바꿔 실행합니다.

## 8. 앱과 Web/설치형 프로그램을 서버에 연결

개인 서버 기준으로 앱 또는 Web/설치형 설정 화면에 아래 값을 넣습니다.

```text
서버 주소: http://서버주소:8750
API 토큰: .env의 NOW_API_TOKEN
사용자 ID: local_user
기기 ID: 앱 또는 프로그램에서 자동 생성한 값
사용자별 접속 토큰: 개인 서버 기본값에서는 비워둠
```

같은 PC에서 Web/설치형 화면을 테스트하면 서버 주소는 보통 아래처럼 둡니다.

```text
http://localhost:8750
```

Android 에뮬레이터에서 PC의 서버에 연결할 때는 보통 아래 주소를 사용합니다.

```text
http://10.0.2.2:8750
```

실제 휴대폰에서 연결하려면 휴대폰이 서버와 같은 네트워크에 있어야 하고, 서버 PC의 내부 IP를 사용합니다.

```text
http://192.168.x.x:8750
```

연결 뒤에는 앱 또는 Web/설치형의 서버 연결 테스트를 실행합니다.

## 9. 공용 서버로 열기

개인 서버 확인이 끝난 뒤 공용 도메인으로 열 때 진행합니다.

`server/.env`를 수정합니다.

```env
NOW_PUBLIC_BASE_URL=https://nownote.sinsan.kr
NOW_BEHIND_REVERSE_PROXY=true
NOW_USER_TOKEN_REQUIRED=true
```

다시 배포합니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token
```

이 명령은 로컬 서버 기준으로 공용 서버 설정값과 사용자 토큰 필수 모드를 함께 점검합니다.

## 10. Nginx Proxy Manager 연결

공용 도메인을 사용할 경우 외부 사용자는 `8750` 포트가 아니라 HTTPS 주소로 접속하게 합니다.

### 방식 A. 도메인 전체를 NowNote 서버로 연결

Nginx Proxy Manager와 NowNote API가 같은 Docker 네트워크에서 `now-api` 이름을 해석할 수 있으면:

```text
Domain Names: nownote.sinsan.kr
Scheme: http
Forward Hostname / IP: now-api
Forward Port: 8080
SSL: Let's Encrypt 인증서
Force SSL: 켬
```

`now-api` 이름을 해석하지 못하면 서버 IP와 호스트 포트를 사용합니다.

```text
Scheme: http
Forward Hostname / IP: 서버 IP 또는 호스트명
Forward Port: 8750
```

현재 AMD 서버처럼 NowNote API가 `140.245.68.207:8750`에서 정상 동작하고, Nginx Proxy Manager 화면에 기존 값이 `nownote-site` / `80`으로 되어 있으면 아래처럼 바꿉니다.

```text
Domain Names: nownote.sinsan.kr
Scheme: http
Forward Hostname / IP: 140.245.68.207
Forward Port: 8750
Access List: Publicly Accessible
SSL: Let's Encrypt 인증서
Force SSL: 켬
```

즉, 화면에서 아래 두 값을 바꾸는 작업입니다.

```text
nownote-site -> 140.245.68.207
80           -> 8750
```

이 방식은 NowNote 서버가 `/`와 `/privacy`에서 개인정보처리방침도 함께 제공합니다.

### 방식 B. 기존 개인정보처리방침 사이트를 유지하고 API 경로만 연결

이미 `nownote-site:80` 같은 정적 개인정보처리방침 사이트를 루트 도메인에 쓰고 있다면, Nginx Proxy Manager의 `Custom locations`에서 아래 경로만 NowNote API로 보냅니다.

```text
/api          -> http://now-api:8080
/health       -> http://now-api:8080
/admin        -> http://now-api:8080
/monitor      -> http://now-api:8080
/auth         -> http://now-api:8080
/docs         -> http://now-api:8080
/openapi.json -> http://now-api:8080
```

`now-api` 이름을 해석하지 못하면 각 경로의 Forward Hostname/IP를 `서버 IP 또는 호스트명`, Forward Port를 `8750`으로 설정합니다.

저장 후 외부에서 확인합니다.

```bash
curl https://nownote.sinsan.kr/health
curl https://nownote.sinsan.kr/api/v1/server
curl https://nownote.sinsan.kr/health/ready
```

정상이라면 JSON이 반환됩니다.
개인정보처리방침 HTML이 반환되면 아직 정적 사이트로 연결된 상태입니다.

확인 기준:

```text
https://nownote.sinsan.kr/health       -> {"status":"ok", ...}
https://nownote.sinsan.kr/health/ready -> {"status":"ready"}
https://nownote.sinsan.kr/api/v1/server -> {"status":"ok", ...}
```

공용 URL로 최종 점검합니다.

```bash
sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr --public-server --issue-local-user-token
```

## 11. 사용자 만들기

공용 서버에서는 일반 사용자에게 `NOW_API_TOKEN`을 주지 않습니다.
운영자는 관리자 화면에서 사용자별 접속 토큰을 발급합니다.

브라우저에서 접속합니다.

```text
https://nownote.sinsan.kr/admin/users/new
```

또는 로컬 테스트 중이면:

```text
http://localhost:8750/admin/users/new
```

순서:

1. 사용자 계정을 만듭니다.
2. `/admin/users`에서 사용자별 접속 토큰을 발급합니다.
3. 발급된 토큰 원문은 한 번만 보이므로 안전하게 전달합니다.
4. 사용자는 앱 또는 Web/설치형 설정에 서버 주소, 사용자 ID, 사용자별 접속 토큰을 입력합니다.
5. 2단계 인증을 쓰는 사용자는 로그인 또는 토큰 확인 때 6자리 코드를 입력합니다.

## 12. 백업 확인

서버 설치가 끝나면 백업 화면을 확인합니다.

```text
http://localhost:8750/admin/export
```

공용 서버라면:

```text
https://nownote.sinsan.kr/admin/export
```

전체 백업 JSON을 내려받고, 같은 화면의 백업 검증 안내를 확인합니다.

운영 점검 화면도 확인합니다.

```text
http://localhost:8750/admin/ops
```

`bad` 항목이 있으면 정식 사용 전에 먼저 해결합니다.

## 13. 업데이트 방법

이후 새 버전으로 갱신할 때는 아래 명령을 사용합니다.

개인 서버:

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

공용 서버:

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr --public-server --issue-local-user-token
```

이 명령은 내부에서 `git pull origin main`, 사전 점검, 컨테이너 재시작, smoke test를 순서대로 실행합니다.

이미 직접 `git pull`을 한 상태라면 아래처럼 생략할 수 있습니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull
```

## 14. 자주 막히는 부분

### `curl http://localhost:8750/health`가 실패함

확인할 것:

- 컨테이너가 떠 있는지
- 8750 포트를 다른 프로그램이 쓰고 있지 않은지
- `docker-compose ps`
- `docker-compose logs now-api --tail=80`

### `/admin`에서 로그인을 요구함

정상입니다.

```text
사용자 이름: admin
비밀번호: .env의 NOW_API_TOKEN
```

### smoke test에서 `admin token required`가 나옴

관리자 토큰이 전달되지 않은 상태입니다.
직접 실행할 때는 아래처럼 `--token`을 넣습니다.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token .env의-NOW_API_TOKEN
```

처음 설치자는 직접 smoke test를 실행하기보다 `deploy_local.sh`를 쓰는 것을 권장합니다.
배포 도우미는 `.env`의 `NOW_API_TOKEN`을 읽어 자동으로 전달합니다.

### 공용 도메인에서 HTML이 반환됨

아래 명령이 JSON이 아니라 개인정보처리방침 HTML을 반환하면 reverse proxy가 아직 NowNote API로 연결되지 않은 상태입니다.

```bash
curl https://nownote.sinsan.kr/api/v1/server
```

Nginx Proxy Manager에서 전체 도메인을 NowNote API로 연결하거나, `Custom locations`에서 `/api`, `/health`, `/admin`, `/monitor`, `/auth`, `/docs`, `/openapi.json`을 NowNote API로 연결합니다.

### DB 비밀번호를 바꿨더니 DB 연결이 안 됨

DB 볼륨이 이미 만들어진 뒤 `NOW_POSTGRES_PASSWORD`만 바꾸면 기존 PostgreSQL 비밀번호와 설정이 어긋날 수 있습니다.
운영 데이터가 있으면 볼륨을 삭제하지 말고 먼저 백업과 복구 절차를 확인합니다.

관련 문서:

- `server/RECOVERY.md`
- `server/DEPLOY.md`

## 15. 다음에 볼 문서

처음 설치는 이 문서를 기준으로 진행합니다.
상세 문서는 아래 순서로 보면 됩니다.

- 전체 소개: `README.md`
- 서버 상세 설명: `server/README.md`
- 배포와 갱신: `server/DEPLOY.md`
- 공용 서버 오픈: `server/PUBLIC_SERVER.md`
- 사용자 도움말: `docs/HELP.md`
- 복구 절차: `server/RECOVERY.md`
