# NowNote 설치 매뉴얼

이 문서는 NowNote를 처음 사용하는 사람이 어떤 방식으로 설치하고 접속해야 하는지 설명합니다.

NowNote의 실제 사용 방식은 세 가지입니다.

```text
1. 설치형 프로그램: 집 PC에서 사용하는 Windows 프로그램
2. 모바일 앱: 휴대폰에서 사용하는 Android 앱
3. Web 프로그램: 외부 PC에서 브라우저로 접속하는 프로그램
```

설치형 프로그램과 모바일 앱은 서버에 연결하면 사용자가 공유로 선택한 문서와 일자별 메모를 동기화합니다.
서버에 연결하지 않으면 각 기기 안에만 저장합니다.
Web 프로그램은 서버에 부속된 화면이므로 단독 로컬 저장용으로 쓰지 않고, 서버에 공유된 내 문서만 조회/편집합니다.

개발자가 화면을 확인할 때 쓰는 `web/index.html`은 사용자용 Web 프로그램이 아닙니다.
사용자용 Web 프로그램은 서버 주소 자체에서 열립니다.
`/app/`은 이전 안내와 호환하기 위해 남겨두는 보조 주소입니다.

```text
공용 Web 프로그램: https://nownote.sinsan.kr
공용 개인정보처리방침: https://nownote.sinsan.kr/privacy

개인 서버 Web 프로그램: https://내도메인
개인 서버 개인정보처리방침: https://내도메인/privacy
```

## 1. 사용 방식 선택

처음에는 아래 중 하나를 선택합니다.

### 설치형 프로그램 단독 사용

집 PC에서만 쓸 때 선택합니다.

- Windows `.exe` 설치 파일을 설치합니다.
- 서버 연결 설정은 비워둡니다.
- 메모는 현재 PC에만 저장됩니다.
- 휴대폰 앱이나 외부 PC Web과 자동 동기화되지 않습니다.

### 모바일 앱 단독 사용

휴대폰에서만 쓸 때 선택합니다.

- Android 앱을 설치합니다.
- 서버 연결 설정은 비워둡니다.
- 메모는 현재 휴대폰에만 저장됩니다.
- 설치형 프로그램이나 Web과 자동 동기화되지 않습니다.

### 공용 서버 사용

서버를 직접 설치하지 않고 NowNote 공용 서버를 사용할 때 선택합니다.

```text
서버 주소: https://nownote.sinsan.kr
Web 프로그램: https://nownote.sinsan.kr
개인정보처리방침: https://nownote.sinsan.kr/privacy
```

- 집 PC 설치형 프로그램과 휴대폰 앱은 공유 문서를 같은 서버와 동기화합니다.
- 외부 PC Web 프로그램은 서버에 공유된 내 문서만 보여줍니다.
- 사용자는 서버를 설치하지 않습니다.
- Web에서 사용자가 직접 가입한 뒤 사용자 ID와 비밀번호로 로그인합니다.
- 설치형 프로그램과 모바일 앱은 Web에서 발급한 앱/설치형 연결 토큰을 입력합니다.
- 비밀번호를 잊으면 등록 이메일로 재설정 코드를 받아 다시 설정합니다.

### 개인 서버 설치

자기 서버를 직접 운영하고 싶을 때 선택합니다.

- Linux 서버에 Docker 기반 NowNote 서버를 설치합니다.
- 집 PC 설치형 프로그램과 휴대폰 앱은 자기 서버와 공유 문서를 동기화합니다.
- 자기 서버의 Web 프로그램은 서버에 공유된 내 문서만 조회/편집합니다.
- 서버 백업, 업데이트, 도메인, HTTPS 설정을 사용자가 직접 관리합니다.

WSL에 서버를 설치하는 것은 실제 사용 목적이 아니라 개발/테스트 목적입니다.
사용자 설치 매뉴얼에서는 WSL 설치를 다루지 않습니다.

## 2. 설치형 프로그램 사용

Windows PC에서는 설치형 프로그램을 사용합니다.

정식 배포 후에는 제공된 설치 파일을 실행합니다.

```text
NowNote-Setup-0.1.0-x64.exe 실행 -> 설치 위치 선택 -> 설치
```

설치 후 사용 방식:

```text
서버 연결을 비움 -> 현재 PC 단독 사용
공용 서버 입력 -> nownote.sinsan.kr과 동기화
개인 서버 입력 -> 자기 서버와 동기화
```

공개 저장소에서 직접 설치 파일을 만들 때는 아래 명령을 사용합니다.

```bash
cd desktop
npm install
npm run dist:win
```

생성 결과:

```text
desktop/dist/NowNote-Setup-0.1.0-x64.exe
```

## 3. 모바일 앱 사용

Android 휴대폰에서는 모바일 앱을 사용합니다.

정식 배포 후:

```text
Google Play 스토어 -> NowNote 검색 -> 설치
```

내부 테스트 기간:

```text
운영자가 제공한 Google Play 내부 테스트 링크 접속 -> 테스터 참여 -> 설치
```

앱 설치 후 사용 방식:

```text
서버 연결을 비움 -> 현재 휴대폰 단독 사용
공용 서버 입력 -> nownote.sinsan.kr과 동기화
개인 서버 입력 -> 자기 서버와 동기화
```

## 4. Web 프로그램 사용

외부 PC에서는 설치 파일 없이 브라우저로 Web 프로그램에 접속합니다.

공용 서버를 사용할 때:

```text
https://nownote.sinsan.kr
```

개인 서버를 사용할 때:

```text
https://내도메인
```

도메인이 없는 개인 서버에서 임시로 직접 접속할 때:

```text
http://서버IP:8750
```

Web 프로그램은 로컬 파일을 여는 방식이 아닙니다.
`D:\Project\Now\web\index.html`은 개발/검증용 원본 파일입니다.

처음 접속하면 서버 주소는 현재 도메인 기준으로 자동 설정됩니다.
처음 접속하면 Web 로그인 화면이 열립니다.
처음 사용하는 사람은 Web에서 직접 가입하고, 기존 사용자는 사용자 ID와 비밀번호를 입력하면 서버에 공유된 내 문서를 불러옵니다.
Web은 외부 PC 사용을 고려하므로 사용자별 접속 토큰을 직접 붙여넣는 방식으로 쓰지 않습니다.
앱/설치형 연결 토큰은 로그인 후 Web의 서버 연결 설정에서 발급하고 다시 확인할 수 있습니다.

## 5. 공용 서버 nownote.sinsan.kr에 연결

공용 서버를 사용하는 사람은 서버를 설치하지 않습니다.

사용자가 준비하는 값:

```text
서버 주소: https://nownote.sinsan.kr
사용자 ID: Web에서 직접 가입
Web 비밀번호: Web에서 직접 설정
등록 이메일: 비밀번호 재설정에 사용
앱/설치형 연결 토큰: Web 로그인 후 직접 발급
2단계 인증 코드: 필요한 경우
```

입력 위치:

```text
설치형 프로그램: 화면 설정 -> 서버 연결
모바일 앱: 설정 -> 서버 연결
Web 프로그램: https://nownote.sinsan.kr -> 로그인 화면
```

연결 후에는 공유된 문서가 같은 서버를 기준으로 유지됩니다.

```text
집 PC 설치형 프로그램: PC 로컬 문서 + 공유 문서
휴대폰 앱: 휴대폰 로컬 문서 + 공유 문서
외부 PC Web 프로그램: 공유 문서만
```

## 6. 개인 서버 설치 준비

개인 서버를 직접 운영할 사람만 진행합니다.
공용 서버 `nownote.sinsan.kr`를 사용할 사람은 이 단계를 진행하지 않습니다.

필요한 것:

- Linux 서버
- Git
- Docker
- Docker Compose 또는 `docker-compose`
- 8750 포트
- 외부 접속을 원하면 도메인과 HTTPS reverse proxy

설치 확인:

```bash
git --version
docker --version
docker compose version
```

`docker compose version`이 동작하지 않으면 아래 명령을 확인합니다.

```bash
docker-compose --version
```

## 7. 개인 서버 소스 받기

권장 설치 위치:

```text
~/deploy/Now
```

명령:

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

## 8. 개인 서버 환경 파일 만들기

실제 운영값은 `server/.env`에 둡니다.
이 파일은 Git에 올리지 않습니다.

```bash
cp .env.example .env
nano .env
```

반드시 바꿀 값:

```env
NOW_API_TOKEN=change-this-api-token
NOW_POSTGRES_PASSWORD=change-this-postgres-password
```

긴 랜덤 값을 만듭니다.

```bash
openssl rand -hex 32
openssl rand -hex 32
```

개인 서버를 내부 또는 혼자 사용할 때는 아래처럼 시작할 수 있습니다.

```env
NOW_USER_TOKEN_REQUIRED=false
NOW_PUBLIC_BASE_URL=
NOW_BEHIND_REVERSE_PROXY=false
NOW_LLM_PROVIDER=local
```

외부 도메인으로 공개할 때는 아래처럼 바꿉니다.

```env
NOW_PUBLIC_BASE_URL=https://내도메인
NOW_BEHIND_REVERSE_PROXY=true
NOW_USER_TOKEN_REQUIRED=true
```

주의:

- `NOW_API_TOKEN`은 운영 화면과 서버 API를 보호하는 관리자용 비밀값입니다.
- `NOW_POSTGRES_PASSWORD`는 처음 `docker compose up` 전에 확정하는 것이 좋습니다.
- DB 볼륨이 만들어진 뒤 DB 비밀번호만 바꾸면 기존 DB와 설정이 맞지 않을 수 있습니다.

## 9. 개인 서버 실행

아래 명령 하나로 사전 점검, Docker 빌드, 컨테이너 시작, ready 확인, smoke test를 순서대로 실행합니다.

```bash
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

성공하면 아래 문구가 나옵니다.

```text
NowNote server smoke test passed
== 완료 ==
운영 화면: http://localhost:8750/admin
모니터: http://localhost:8750/monitor
```

Linux 서버 안에서 확인:

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
curl http://localhost:8750/api/v1/server
```

다른 PC나 휴대폰에서 접속할 때는 `localhost`를 쓰지 않습니다.
서버 IP나 도메인을 사용합니다.

```text
http://서버IP:8750
https://내도메인
```

컨테이너 상태:

```bash
docker compose ps
docker compose logs now-api --tail=80
docker compose logs now-worker --tail=80
```

구버전 환경에서 `docker-compose`만 쓸 수 있으면 아래처럼 확인합니다.

```bash
docker-compose ps
docker-compose logs now-api --tail=80
docker-compose logs now-worker --tail=80
```

## 10. 개인 서버를 프로그램에 연결

설치형 프로그램과 모바일 앱의 서버 연결 항목에 아래 값을 넣습니다.

```text
서버 주소: http://서버주소:8750 또는 https://내도메인
API 토큰: .env의 NOW_API_TOKEN
사용자 ID: local_user 또는 Web에서 가입한 사용자 ID
기기 ID: 앱 또는 프로그램에서 자동 생성한 값
사용자별 접속 토큰: 개인 서버 기본값에서는 비워둠
```

개인 서버도 사용자별 접속 토큰을 강제하려면 Web에서 앱/설치형 연결 토큰을 발급하거나 관리자 화면에서 운영자용으로 토큰을 발급한 뒤 `NOW_USER_TOKEN_REQUIRED=true`를 사용합니다.
Web은 서버 주소로 접속한 뒤 사용자 ID와 비밀번호로 로그인합니다.

## 11. 도메인과 Nginx Proxy Manager 연결

외부에서 개인 서버를 쓰려면 `8750` 포트를 직접 쓰기보다 HTTPS reverse proxy를 앞에 둡니다.

Nginx Proxy Manager와 NowNote API가 같은 Docker 네트워크에서 `now-api` 이름을 해석할 수 있으면:

```text
Domain Names: 내도메인
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

현재 공용 서버 AMD 서버 예시는 아래와 같습니다.

```text
Domain Names: nownote.sinsan.kr
Scheme: http
Forward Hostname / IP: 140.245.68.207
Forward Port: 8750
Access List: Publicly Accessible
SSL: Let's Encrypt 인증서
Force SSL: 켬
```

기존 값이 `nownote-site` / `80`이면 아래처럼 바꿉니다.

```text
nownote-site -> 140.245.68.207
80           -> 8750
```

확인:

```bash
curl https://nownote.sinsan.kr/health
curl https://nownote.sinsan.kr/health/ready
curl https://nownote.sinsan.kr/api/v1/server
```

확인 기준:

```text
https://nownote.sinsan.kr/               -> NowNote Web 프로그램
https://nownote.sinsan.kr/privacy        -> 개인정보처리방침
https://nownote.sinsan.kr/app/           -> NowNote Web 프로그램 호환 주소
https://nownote.sinsan.kr/admin          -> 서버 관리 화면
https://nownote.sinsan.kr/monitor        -> 서버 모니터
https://nownote.sinsan.kr/health/ready   -> {"status":"ready"}
https://nownote.sinsan.kr/api/v1/server  -> 서버 JSON
```

## 12. 사용자 만들기

공용 서버나 사용자별 토큰을 강제하는 개인 서버에서는 일반 사용자에게 관리자용 `NOW_API_TOKEN`을 직접 주지 않습니다.
공용 서버의 일반 사용자는 Web에서 직접 가입하고, 로그인 후 설치형 프로그램/모바일 앱용 연결 토큰을 직접 발급합니다.
운영자는 사용자 그룹, 활성 상태, 2단계 인증 사용 여부, 이상 접속 상태를 모니터링합니다.

사용자 흐름:

```text
https://도메인 -> 회원가입 -> 로그인 -> 화면 설정 -> 서버 연결 -> 앱/설치형 연결 토큰 발급
```

순서:

1. Web 프로그램에서 사용자 ID, 비밀번호, 이메일로 가입합니다.
2. Web 사용자는 서버 주소에서 사용자 ID와 비밀번호로 로그인합니다.
3. 로그인 후 화면 설정의 서버 연결 영역에서 앱/설치형 연결 토큰을 발급합니다.
4. 발급된 토큰은 같은 화면에서 다시 확인할 수 있고, 노출됐다고 판단하면 새로 발급합니다.
5. 설치형 프로그램과 모바일 앱 사용자는 서버 주소, 사용자 ID, 앱/설치형 연결 토큰을 입력합니다.
6. 2단계 인증을 쓰는 사용자는 로그인 또는 토큰 확인 때 6자리 코드를 입력합니다.
7. 비밀번호를 잊으면 등록 이메일로 재설정 코드를 받아 새 비밀번호를 설정합니다.

관리자 화면 `/admin/users/new`는 운영자 계정 선등록, 테스트 계정 생성, 비활성 사용자 조치 같은 운영 보조 용도입니다.

## 13. 백업 확인

서버 설치가 끝나면 백업 화면을 확인합니다.

```text
https://도메인/admin/export
```

운영 점검 화면도 확인합니다.

```text
https://도메인/admin/ops
```

`bad` 항목이 있으면 정식 사용 전에 먼저 해결합니다.

## 14. 업데이트

개인 서버 업데이트:

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

도메인까지 연결된 서버 업데이트:

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url https://내도메인 --public-server --issue-local-user-token
```

이 명령은 내부에서 `git pull origin main`, 사전 점검, 컨테이너 재시작, smoke test를 순서대로 실행합니다.

## 15. 자주 막히는 부분

### `https://nownote.sinsan.kr/`에서 개인정보처리방침이 나옴

정상 상태가 아닙니다.
루트 `/`는 NowNote Web 프로그램이어야 합니다.
개인정보처리방침은 `/privacy`에서 열려야 합니다.

```text
https://nownote.sinsan.kr
https://nownote.sinsan.kr/privacy
```

이 현상이 보이면 Nginx Proxy Manager가 아직 예전 정적 개인정보처리방침 사이트로 연결된 상태입니다.
Proxy Host의 Forward 대상을 NowNote 서버로 바꿉니다.

### `https://nownote.sinsan.kr/api/v1/server`에서 HTML이 나옴

reverse proxy가 아직 NowNote API가 아니라 정적 사이트로 연결된 상태입니다.
Nginx Proxy Manager의 Forward Hostname/IP와 Forward Port를 확인합니다.

### `/admin`에서 로그인을 요구함

정상입니다.

```text
사용자 이름: admin
비밀번호: .env의 NOW_API_TOKEN
```

### smoke test에서 `admin token required`가 나옴

관리자 토큰이 전달되지 않은 상태입니다.
처음 설치자는 직접 smoke test를 실행하기보다 `deploy_local.sh`를 쓰는 것을 권장합니다.
배포 도우미는 `.env`의 `NOW_API_TOKEN`을 읽어 자동으로 전달합니다.

### DB 비밀번호를 바꿨더니 DB 연결이 안 됨

DB 볼륨이 이미 만들어진 뒤 `NOW_POSTGRES_PASSWORD`만 바꾸면 기존 PostgreSQL 비밀번호와 설정이 어긋날 수 있습니다.
운영 데이터가 있으면 볼륨을 삭제하지 말고 먼저 백업과 복구 절차를 확인합니다.

관련 문서:

- `server/RECOVERY.md`
- `server/DEPLOY.md`

## 16. 문서 위치

처음 설치는 이 문서를 기준으로 진행합니다.

- 전체 소개: `README.md`
- 사용자 도움말: `docs/HELP.md`
- 설치형 프로그램: `desktop/README.md`
- 모바일 앱: `now_app/README.md`
- Web 원본/개발 문서: `web/README.md`
- 서버 상세 설명: `server/README.md`
- 배포와 갱신: `server/DEPLOY.md`
- 공용 서버 오픈: `server/PUBLIC_SERVER.md`
- 복구 절차: `server/RECOVERY.md`
