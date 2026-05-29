# NowNote 작업 진행 기록

이 파일은 작업 중 오류나 대화 중단에 대비해 현재 진행 상태를 남기는 기록입니다.
새 기능을 시작하거나, 중간 판단이 바뀌거나, 검증/커밋이 끝날 때 갱신합니다.

## 2026-05-30 00:45 KST

### Web 프로그램 루트 주소 전환

- 신산님 판단에 따라 공용 서버와 개인 설치 서버 모두 `서버 주소 자체`를 Web 프로그램 주소로 쓰는 구조로 전환.
- 공용 서버 기준은 `https://nownote.sinsan.kr/`가 NowNote Web 프로그램, `https://nownote.sinsan.kr/privacy`가 개인정보처리방침, `/app/`은 이전 안내 호환용 보조 주소.
- 개인 서버 기준은 `https://내도메인/` 또는 `http://서버IP:8750/`가 NowNote Web 프로그램, `/privacy`가 개인정보처리방침.
- FastAPI 서버에서 Web 정적 파일을 루트 `/`와 호환 주소 `/app/`에 mount하도록 변경하고, 개인정보처리방침 루트 라우트는 제거.
- Web 클라이언트가 서버 루트, `/index.html`, `/app/`에서 실행될 때 현재 origin을 서버 주소 기본값으로 잡도록 보완.
- 설치 매뉴얼, 사용자 도움말, Web README, 서버 배포/공용 서버 문서, Google Play 개인정보처리방침 URL 문서를 루트 Web + `/privacy` 기준으로 수정.
- smoke test와 preflight도 루트 Web, `/privacy`, `/app/` 호환 주소를 점검하도록 갱신 중.

## 2026-05-30 00:12 KST

### 처음 설치 가이드 문서 추가

- 아무것도 모르는 설치자가 GitHub 저장소를 받은 뒤 그대로 따라 할 수 있도록 루트 `INSTALL.md` 작성 시작.
- 개인 Docker 서버 설치, `.env` 작성, 배포 도우미 실행, 앱/Web 연결, 공용 서버 전환, Nginx Proxy Manager 연결, 사용자 토큰 발급, 백업 확인, 업데이트, 자주 막히는 부분을 한 문서로 정리.
- 루트 README의 시작 위치에 `INSTALL.md` 링크를 추가.
- 서버 없이 사용하는 사람을 위해 모바일 앱, Web 화면, PWA 설치형 사용 기준을 `INSTALL.md` 앞부분에 추가.
- 현재 1차의 설치형 프로그램은 별도 `.exe/.msi`가 아니라 Web 화면을 PWA로 설치해 독립 창처럼 쓰는 방식이라고 명확히 설명.
- 서버를 직접 설치하지 않는 사용자를 위해 앱/Web/PWA 확인 경로와 공용 서버 접속값 입력 위치를 `INSTALL.md`와 `docs/HELP.md`에 추가.
- Android 모바일 앱 설치 경로를 Google Play 정식 배포, Google Play 내부 테스트, 개발/검증용 직접 실행으로 구분해 `INSTALL.md`와 `docs/HELP.md`에 반영.
- Web과 PWA 설치형도 서버를 직접 설치하지 않고 로컬 단독 사용 또는 공용 서버 접속이 가능하다는 설명을 `INSTALL.md`, `docs/HELP.md`, `web/README.md`에 반영.
- 영어 도움말 `docs/HELP.en.md`와 Web 도움말 화면 `web/help.html`에도 서버 미설치 사용자, Google Play 설치, 공용 서버 접속 기준을 반영.
- Windows 설치형 프로그램을 위해 `desktop` Electron 패키지를 추가. Web 정적 파일을 복사해 Electron 앱으로 실행하고 NSIS 기반 `.exe` 설치 파일을 생성하는 구조.
- `desktop/README.md`, 루트 README, `web/README.md`, `INSTALL.md`, 사용자 도움말에 Windows `.exe` 설치형 기준과 PWA 병행 기준을 반영.
- Electron 의존성을 `electron@42.3.0`, `electron-builder@26.8.1`로 갱신하고 `npm audit --audit-level=high` 기준 취약점 0건을 확인.
- NowNote 설치 아이콘을 Windows 설치형 빌드 설정에 연결해 기본 Electron 아이콘으로 보이지 않도록 보완.
- `npm run dist:win`으로 Windows 설치 파일 `desktop/dist/NowNote-Setup-0.1.0-x64.exe` 생성을 확인. 배포 산출물은 Git 추적에서 제외하고, 저장소에는 빌드 방법과 설정 파일만 포함.
- AMD Linux 서버 첫 기동 로그에서 `now-api`와 `now-worker`가 동시에 DB 테이블 생성을 시도해 PostgreSQL `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`가 1회 발생한 것을 확인.
- `create_tables()`에 PostgreSQL `pg_advisory_xact_lock` 기반 스키마 생성 잠금을 추가해 API/worker 동시 기동 시 테이블 생성 충돌을 방지.
- `INSTALL.md`와 `server/DEPLOY.md`에 Linux 서버에서의 `localhost` 의미, 외부 PC/휴대폰에서는 서버 IP 또는 도메인을 써야 한다는 기준, 최신 Ubuntu의 `docker compose` 명령 기준을 반영.
- Nginx Proxy Manager 화면에서 기존 `Forward Hostname/IP=nownote-site`, `Forward Port=80`으로 되어 있던 값을 AMD 서버 기준 `140.245.68.207`, `8750`으로 바꾸는 절차를 `INSTALL.md`, `server/PUBLIC_SERVER.md`, `server/DEPLOY.md`에 반영.
- 기존 서버 실행 코드나 운영 기능은 변경하지 않음.
- 검증: 서버 preflight 1053/1053 통과, 공개 저장소 안전 점검 8/8 통과, Web 표면 검증 167/167 통과, `npm audit --audit-level=high` 취약점 0건, Windows 설치 파일 빌드 통과, `git diff --check` 통과.

### 릴리스 증빙 화면 문서 정합성 정리

- `/admin/release`와 `/admin/evidence`가 더 이상 단순 읽기 전용 화면이 아니므로 서버 README와 프로젝트 상태 문서를 실제 운영 흐름에 맞게 수정 시작.
- 서버 기능과 데이터 구조는 변경하지 않고, 릴리스 화면에서 바로 완료 증빙을 저장할 수 있다는 설명과 수동 증빙 기록 화면의 역할만 문서에 반영.
- 현재 1차 체크리스트는 54/57 완료이며 남은 항목은 `reverse proxy 적용.`, `내부 테스트 트랙 업로드.`, `GitHub Actions preflight 통과 확인.` 3개입니다.
- 검증: 서버 preflight 1033/1033 통과, 공개 저장소 안전 점검 8/8 통과, release readiness 54/57 완료 및 남은 3개 확인, `git diff --check` 통과.
- 커밋 `docs: align release evidence screens`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1039/1039.
- 배포 후 smoke test 통과. `/admin/release`와 `/admin/evidence`는 200으로 응답.
- 실행 중 서버의 `/api/v1/admin/public-route`는 아직 `bad`이므로 실제 Nginx Proxy Manager의 외부 reverse proxy 적용은 남은 항목으로 유지.
- WSL 배포 폴더에서 `server/.env.bak.public-deploy-20260529` 미추적 로컬 백업 파일을 확인. 삭제하지 않고, 같은 유형의 비밀 백업 파일이 추적되지 않도록 `.gitignore`와 preflight 기준에 `server/.env.bak*`를 추가.
- GitHub 커넥터로 최신 커밋 `e6cec32`의 combined status와 workflow run을 확인했지만 둘 다 비어 있어 `GitHub Actions preflight 통과 확인`은 완료 처리하지 않음.
- 로컬 PC에는 `gh` CLI가 설치되어 있지 않아 GitHub Actions 수동 실행은 GitHub 화면 또는 토큰 기반 스크립트 실행이 필요.
- 외부에서 `https://nownote.sinsan.kr/api/v1/server`와 `https://nownote.sinsan.kr/health/ready`를 확인했지만 둘 다 `Content-Type: text/html`의 개인정보처리방침 HTML을 반환. 따라서 `reverse proxy 적용.`은 아직 미완료.

### 남은 외부 작업 바로가기 보강

- `/admin/release`에 `외부 작업 바로가기` 섹션을 추가.
- 공용 서버 항목은 Nginx Proxy Manager 입력값 `Scheme=http`, `Forward Hostname/IP=now-api`, `Forward Port=8080`, 확인 URL `https://nownote.sinsan.kr/api/v1/server`를 직접 표시.
- Play Console 항목은 내부 테스트 업로드용 AAB 경로와 출시 노트 문서 위치를 표시.
- GitHub Actions 항목은 Actions 화면 링크와 `dispatch_github_actions.py`, `check_github_actions_status.py` 실행 명령을 표시.
- smoke test와 preflight가 새 외부 작업 바로가기, NPM 입력값, Play AAB 경로, Actions 실행 명령을 확인하도록 보강.
- 검증: Python 문법 확인 통과, 서버 preflight 1042/1042 통과, 공개 저장소 안전 점검 8/8 통과, `git diff --check` 통과.
- 커밋 `feat: add release external action shortcuts`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1048/1048.
- 배포 후 smoke test 통과. `/admin/release`는 200으로 응답하고 새 외부 작업 바로가기 섹션을 포함.

### 공용 도메인 경로별 프록시 안내 보강

- 기존 개인정보처리방침 정적 사이트를 루트 도메인에 유지하면서 NowNote API만 붙일 수 있도록 Nginx Proxy Manager `Custom locations` 방식을 공식 안내에 추가.
- `server/PUBLIC_SERVER.md`, `server/DEPLOY.md`, `/admin/public`, `/admin/release`, 릴리스 readiness/evidence 안내에 `/api`, `/health`, `/admin`, `/monitor`, `/auth`, `/docs`, `/openapi.json` 경로별 API 연결 기준을 반영.
- 전체 도메인을 NowNote API로 연결하는 방식 A와 기존 개인정보처리방침 사이트를 유지하는 방식 B를 분리.
- smoke test와 preflight가 공용 서버 화면, 릴리스 화면, 배포 문서, 공용 서버 문서의 경로별 프록시 안내를 확인하도록 보강.
- 검증: Python 문법 확인 통과, 서버 preflight 1051/1051 통과, 공개 저장소 안전 점검 8/8 통과, release readiness 54/57 완료 및 남은 3개 확인, `git diff --check` 통과.
- 커밋 `docs: add public route proxy options`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1057/1057.
- 배포 후 smoke test 통과. `/admin/public`과 `/admin/release`는 경로별 프록시 안내를 포함.
- 실행 중 서버의 `/api/v1/admin/public-route`는 아직 `bad`이므로 실제 Nginx Proxy Manager의 외부 reverse proxy 적용은 남은 항목으로 유지.
- 외부에서 `https://nownote.sinsan.kr/api/v1/server`를 다시 확인했지만 아직 `Content-Type: text/html`을 반환하므로 실제 경로별 proxy 적용은 미완료.
- GitHub 커넥터로 최신 커밋 `23899dc`의 combined status와 workflow run을 확인했지만 둘 다 비어 있어 `GitHub Actions preflight 통과 확인`은 완료 처리하지 않음.

## 2026-05-29 22:17 KST

### 릴리스 준비 화면에서 바로 완료 증빙 저장

- `/admin/release`에서 남은 항목을 확인한 뒤 `/admin/evidence`로 이동해야만 완료 증빙을 저장할 수 있던 흐름을 보강.
- `/admin/release`에 `바로 완료 증빙 기록` 섹션을 추가해 남은 항목별 증빙 위치, 실제 확인 내용을 입력하고 곧바로 `완료` 기록을 저장할 수 있게 함.
- 증빙 저장 라우트가 `return_to=/admin/release`를 지원하도록 수정해 저장 후 릴리스 준비 화면으로 돌아오게 함.
- 기존 `/admin/evidence`의 일반 증빙 저장 흐름은 유지.
- smoke test와 preflight가 릴리스 화면의 바로 완료 증빙 기록 섹션과 되돌아오기 값을 확인하도록 보강.
- 검증: Python 문법 확인 통과, 서버 preflight 1033/1033 통과, `git diff --check` 통과.
- FastAPI TestClient로 `/admin/release` 화면 표시, 바로 완료 증빙 저장 후 `/admin/release?saved=1` 리다이렉트, `summary.evidence_done=1` 반영 확인.
- 커밋 `feat: add quick release evidence recording`을 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1039/1039.
- 배포 후 smoke test 통과. `/admin/release`는 200으로 응답하고 바로 완료 증빙 기록 섹션 포함을 확인.

## 2026-05-29 20:48 KST

### 수동 증빙 완료의 릴리스 준비 반영

- `/admin/evidence`에서 외부 확인 항목을 `완료`로 저장해도 `/admin/release`의 완료 수는 체크리스트 파일만 기준으로 계산하던 구조를 보강.
- `server/app/services/release_readiness.py`가 최신 수동 증빙 기록을 읽어, 체크리스트 미완료 항목이라도 같은 유형/영역/항목의 최신 기록이 `완료`이면 완료 수에 반영하도록 수정.
- `/admin/release` 완료 카드에 `수동 증빙 반영 N건`을 표시하고, 영역별 진행 기준을 `체크리스트와 완료 증빙 기준`으로 명확히 표시.
- API 응답 `/api/v1/admin/release-readiness`의 `summary.evidence_done`으로 수동 증빙 반영 건수를 확인할 수 있게 함.
- smoke test와 preflight가 수동 증빙 반영 표시, `evidence_done`, `checked_source` 기준을 확인하도록 보강.
- 검증: Python 문법 확인 통과, 임시 SQLite DB에서 `reverse proxy 적용.` 완료 증빙 1건 저장 시 54/57에서 55/57로 반영되는 것 확인, 서버 preflight 1030/1030 통과, `git diff --check` 통과.
- 커밋 `feat: count completed release evidence`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1036/1036.
- 배포 후 smoke test 통과. `/api/v1/admin/release-readiness`는 현재 실제 완료 증빙이 없어 54/57, `evidence_done=0`을 반환.
- `server/README.md`에도 수동 증빙 `완료` 기록이 `summary.evidence_done`과 완료 수에 반영된다는 설명 추가. 서버 preflight 1031/1031 통과.
- README 설명 변경까지 포함해 WSL 배포를 한 번 더 실행했고, WSL 공용 서버 preflight 1037/1037 및 smoke test 통과.

## 2026-05-29 19:59 KST

### Nginx Proxy Manager 입력값 화면 고정

- 실제 공개 NPM 화면에서 `nownote.sinsan.kr`이 정적 개인정보처리방침 페이지로 연결되는 혼선을 줄이기 위해 `/admin/public`에 Nginx Proxy Manager 입력값을 직접 표시하도록 보강.
- 같은 Docker 네트워크 기준 입력값은 `Scheme=http`, `Forward Hostname/IP=now-api`, `Forward Port=8080`으로 안내.
- NPM이 다른 네트워크 또는 별도 서버에 있을 때의 대체 입력값은 `서버 IP 또는 호스트명:8750`으로 안내.
- `server/PUBLIC_SERVER.md`, `server/DEPLOY.md`에도 같은 기준을 추가해 화면과 문서의 안내가 어긋나지 않도록 정리.
- smoke test와 preflight가 `/admin/public` 화면 및 문서에 위 값이 있는지 확인하도록 보강.
- 검증: Python 문법 확인 통과, 서버 preflight 1026/1026 통과, release readiness 54/57 완료 및 남은 3개 확인, 공개 저장소 안전 점검 8/8 통과, `git diff --check` 통과.
- 커밋 `docs: show NPM reverse proxy settings`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- WSL 공용 서버 preflight 통과: 1032/1032.
- 배포 후 smoke test 통과. `/admin/public` 화면은 200으로 응답하고 NPM 입력값 안내를 포함.
- 외부 확인 `https://nownote.sinsan.kr/api/v1/server`는 아직 `Content-Type: text/html` 개인정보처리방침 HTML을 반환.
- 남은 reverse proxy 항목은 실제 Nginx Proxy Manager 화면에서 Proxy Host 저장 후 `https://nownote.sinsan.kr/api/v1/server`가 JSON을 반환해야 완료 처리 가능.

## 2026-05-29 19:05 KST

### 남은 1차 항목 안내 문구 정정

- 공용 서버 환경값, 사용자 토큰 필수 모드, 공용 preflight, 사용자별 데이터 격리 smoke test는 이미 완료됐으므로 남은 항목 분류를 `공용 서버 운영 결정`에서 `공용 서버 운영 적용`으로 정정.
- `/admin/release`, `/api/v1/admin/release-readiness`, `scripts/release_readiness.py --show-blockers`가 실제 남은 작업을 reverse proxy 적용으로 안내하도록 수정.
- 수동 증빙 안내도 Nginx Proxy Manager에서 `nownote.sinsan.kr` Proxy Host를 NowNote API 서버로 연결하는 기준으로 보강.
- 검증: release readiness 출력 54/57 완료, 남은 3개 확인. Python 문법 확인 통과, 서버 preflight 1017/1017 통과, `git diff --check` 통과.
- 커밋 `docs: clarify remaining public route work`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- 배포 후 `/api/v1/admin/release-readiness`는 54/57 완료, 남은 3개를 반환하고 smoke test 통과.
- GitHub App 기준 최신 커밋 `49d337c6f3cc83d2b6235cd54ac518b465c9f76c`의 workflow run은 아직 0개.
- 토큰 없는 GitHub API 상태 확인은 비공개 저장소라 HTTP 404를 반환. GitHub Actions 항목은 Actions 화면에서 `NowNote Preflight`를 수동 실행하거나 Actions 권한 토큰을 환경변수로 제공해야 완료 가능.

## 2026-05-29 17:49 KST

### 공용 Docker reverse proxy 배포 설정 보강

- 실제 공개 도메인 `https://nownote.sinsan.kr/api/v1/server`가 아직 NowNote API JSON이 아니라 개인정보처리방침 HTML을 반환하는 상태를 확인.
- Nginx Proxy Manager의 현재 Proxy Host가 `nownote-site:80` 정적 페이지로 연결되어 있어, 실제 API 서버로 연결하려면 Forward Hostname/IP를 `now-api`, Forward Port를 `8080`으로 변경해야 함.
- Nginx Proxy Manager 컨테이너 `npm`을 NowNote 서버 compose 네트워크 `server_default`에 연결했고, `npm` 컨테이너 내부에서 `http://now-api:8080/health/ready` 접근이 성공함을 확인.
- WSL 배포 경로의 `server/.env`에는 공용 모드 기준으로 `NOW_USER_TOKEN_REQUIRED=true`, `NOW_PUBLIC_BASE_URL=https://nownote.sinsan.kr`, `NOW_BEHIND_REVERSE_PROXY=true`를 적용.
- 공용 서버 preflight는 WSL 배포 경로 기준 1015/1015 통과.
- Docker Compose가 위 공용 모드 환경값을 `now-api`, `now-worker` 컨테이너에 전달하지 않아 실행 중 API에서 `user_token_required=false`로 보이는 문제를 확인.
- `server/docker-compose.yml`에 `NOW_USER_TOKEN_REQUIRED`, `NOW_PUBLIC_BASE_URL`, `NOW_BEHIND_REVERSE_PROXY` 전달을 추가.
- `server/scripts/deploy_local.sh`는 공용 토큰 필수 모드에서 smoke test가 실패하지 않도록 `--user-token`, `--issue-local-user-token` 옵션을 지원하도록 보강.
- `server/DEPLOY.md`와 `server/scripts/preflight.py`에 공용 모드 배포 도우미 기준을 반영.
- 검증: `server/scripts/preflight.py` Python 문법 확인 통과, 서버 preflight 1017/1017 통과, 공개 저장소 안전 점검 8/8 통과, `git diff --check` 통과.
- 커밋 `fix: pass public server env to compose`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- WSL에서 `sh -n server/scripts/deploy_local.sh` 문법 검사 통과.
- WSL 공용 서버 preflight 통과: 1023/1023.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --public-server --issue-local-user-token --skip-pull`로 Docker 서버 재배포.
- 배포 후 `/api/v1/server`는 `auth_required=true`, `user_token_required=true`, `public_server_readiness.status=ready`를 반환.
- 배포 후 smoke test 통과. 사용자 토큰 필수 모드, 사용자별 데이터 격리, 녹음 업로드, 분석 작업, 백업 검증까지 통과.
- 외부 확인 기준 `https://nownote.sinsan.kr/api/v1/server`는 아직 NowNote API JSON이 아니라 개인정보처리방침 HTML을 반환하므로, 실제 공개 Nginx Proxy Manager에서 Proxy Host 대상을 `now-api:8080`으로 변경해야 함.
- 현재 접근 가능한 로컬/WSL Nginx Proxy Manager에는 `nownote.sinsan.kr` Proxy Host 항목이 없으므로, 신산님이 화면으로 보여준 별도 실제 서버 NPM에서 변경해야 하는 상태로 판단.
- 1차 체크리스트는 공용 모드 환경값, 사용자별 토큰, 공용 preflight, 데이터 격리 smoke 완료를 반영해 54/57 완료, 3개 남음으로 갱신. 남은 핵심 공용 서버 항목은 실제 reverse proxy 적용.

## 2026-05-29 17:30 KST

### 운영 점검의 공개 도메인 연결 표시 보강

- 남은 공용 서버 오픈 항목을 운영자가 한 화면에서 판단할 수 있도록 `/admin/ops`와 `/api/v1/admin/ops`에 `공개 도메인 연결` 점검 항목 추가.
- 점검 기준은 `/api/v1/admin/public-route`와 같은 서비스 로직을 사용하되, 운영 점검 화면이 오래 멈추지 않도록 항목 단위 timeout은 2초로 제한.
- `NOW_PUBLIC_BASE_URL` 미설정은 `info`, 공개 URL/reverse proxy 경고는 `warn`, 공개 API가 HTML을 반환하거나 연결 실패하면 `bad`로 표시.
- smoke test와 preflight가 운영 점검 화면/API의 공개 도메인 실제 연결 항목을 확인하도록 보강.
- 검증: Python 문법 확인 통과, `git diff --check` 통과, 서버 preflight 1009/1009 통과, 공개 저장소 안전 점검 8/8 통과.
- 1차 릴리스 상태는 `scripts/release_readiness.py --show-blockers` 기준 48/57 완료, 9개 남음 유지.
- 커밋 `feat: show public route status in ops`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull`로 Docker 서버 재배포.
- 배포 전 서버 preflight 통과: 1009/1009.
- 배포 후 smoke test 통과. 실행 중인 서버의 `/api/v1/admin/ops`는 26개 점검 항목을 반환하고 `공개 도메인 연결` 항목 포함을 확인.

## 2026-05-29 16:52 KST

### 공용 도메인 연결 진단 보강

- 공용 서버 준비 화면에서 실제 공개 URL이 NowNote API로 연결되는지 확인하도록 보강.
- 신규 API 추가: `/api/v1/admin/public-route`.
- 확인 기준: `NOW_PUBLIC_BASE_URL` 기준 `/health/ready`, `/api/v1/server`가 JSON으로 응답하고 기대 필드를 반환해야 함.
- HTML이 반환되면 정적 페이지 또는 reverse proxy 오연결 가능으로 표시.
- `/admin/public` 상단에 공개 연결 상태, 공개 URL, 확인 항목 수를 표시.
- 서버 README, 공용 서버 문서, smoke test, preflight, GitHub Actions 문법 검증 목록에 신규 진단 기준 반영.
- 검증: Python 문법 확인 통과, `server/scripts/preflight.py --env-file .env.example --allow-example` 1003/1003 통과, 공개 저장소 안전 점검 8/8 통과.
- 커밋 `feat: add public route readiness check`를 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750`로 Docker 서버 재배포.
- 배포 전 서버 preflight 통과: 1003/1003.
- 배포 후 smoke test 통과.
- 배포된 서버에서 `/api/v1/admin/public-route`가 200으로 응답하고 현재 로컬 `.env` 기준 `status=planned`, `checks=1`을 반환함을 확인.
- 수동 증빙 기준도 `/api/v1/admin/public-route`를 공용 서버 URL/reverse proxy 확인 증빙으로 사용하도록 보강.
- 검증: `release_evidence.py`, `preflight.py` 문법 확인 통과, 서버 preflight 1004/1004 통과.

## 2026-05-29 16:38 KST

### 라이선스/공개 결정 반영본 배포와 공용 도메인 확인

- `chore: finalize phase one release decisions` 커밋을 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 최신 커밋을 fast-forward pull.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750`로 Docker 서버 재배포.
- 배포 전 서버 preflight 통과: 989/989.
- 배포 후 smoke test 통과.
- 실행 중인 서버의 `/api/v1/admin/release-readiness`가 48/57 완료, 9개 남음을 반환함을 확인.
- 실행 중인 서버의 `/api/v1/admin/play-release`는 자동 22/22 OK, 수동 1개 남음.
- 실행 중인 서버의 `/api/v1/admin/open-source-release`는 자동 21/21 OK, 수동 1개 남음.
- `https://nownote.sinsan.kr/`는 HTTPS 200, `http://nownote.sinsan.kr/`는 HTTPS로 301 리다이렉트 확인.
- 단, `https://nownote.sinsan.kr/health`와 `/api/v1/server`도 개인정보처리방침 HTML을 반환하므로 현재 공용 도메인은 NowNote API reverse proxy가 아니라 정적 개인정보 페이지로 연결된 상태임.

## 2026-05-29 16:28 KST

### 라이선스와 공개/Play 결정 항목 반영

- Apache License 2.0을 NowNote 저장소 라이선스로 확정 반영하고 루트 `LICENSE` 파일 추가.
- README, CONTRIBUTING, 공개 저장소 점검 문서, 라이선스 결정 문서, 1차 체크리스트에 Apache 2.0 기준 반영.
- 공용 서버 도메인 `nownote.sinsan.kr`, Nginx reverse proxy 기준, `server/.env.public.example`, 실제 도메인용 Nginx 예시 파일 추가.
- Google Play 문구/권한/Data safety/스크린샷/개인정보처리방침 URL은 현재 문서 기준 최종 확인 완료로 반영하고, 내부 테스트 트랙 업로드만 남김.
- 1차 체크리스트 상태: 48/57 완료, 9개 남음.
- 검증: 서버 preflight 989/989 통과, 공개 저장소 안전 점검 8/8 통과, Open Source/Play 서버 요약은 각각 수동 1개만 남음.

## 2026-05-29 16:04 KST

### 개인정보처리방침 서버 페이지 전환 진행

- 신산님이 현재 `https://nownote.sinsan.kr/`에 보이는 개인정보처리방침을 NowNote 서버의 단일 Page로 만들 것을 요청.
- 서버 공개 라우트로 `/`와 `/privacy`, `/privacy-policy`를 추가하는 방향으로 결정.
- 기존 `/monitor`, `/admin` 운영 화면은 유지하고, Play Console 개인정보처리방침 URL은 `https://nownote.sinsan.kr/`를 그대로 사용할 수 있게 구성.
- 서버 라우트 확인 완료: `/`, `/privacy`, `/privacy-policy`, `/monitor`가 함께 등록됨.
- FastAPI TestClient 기준 `/`와 `/privacy`가 200으로 개인정보처리방침 HTML을 반환함을 확인.
- 서버 preflight 통과: 959/959.

## 2026-05-29 13:53 KST

### Play release 설치 점검 반영본 배포

- `docs: record Play release install check` 커밋으로 release 설치 점검 결과를 정리하고 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 `git pull origin main`으로 최신 커밋 반영.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750`로 WSL/Docker 서버 재배포.
- 배포 전 서버 preflight 통과: 945/945.
- 배포 후 smoke test 통과.
- 실행 중인 서버의 `/api/v1/admin/release-readiness`가 40/57 완료, 17개 남음을 반환함을 확인.

### 남은 항목 판단

- 공용 서버 8개 항목은 실제 공개 도메인/HTTPS/reverse proxy 운영값이 필요해 보류.
- Google Play 6개 항목은 Play Console 실제 화면 저장과 내부 테스트 트랙 업로드가 필요해 보류.
- GitHub Actions 1개 항목은 비공개 저장소 Actions 조회/실행 권한 또는 GitHub 화면 확인이 필요해 보류.
- 라이선스 2개 항목은 법적 선택이므로 사용자 확정 전 보류.

## 2026-05-29 13:48 KST

### Google Play 실제 기기 설치 테스트 완료

- 최신 소스로 release AAB 재빌드 성공: `build\app\outputs\bundle\release\app-release.aab`.
- AAB 빌드 직후 Play release preflight 통과.
- 같은 release 서명 설정으로 release APK 빌드 성공: `build\app\outputs\flutter-apk\app-release.apk`.
- 실제 Android 기기 `SM-N981N(R3CN90A1WZF)`에 기존 debug 서명 앱이 있어 `adb install -r`은 서명 불일치로 실패함을 확인.
- release 설치 테스트를 위해 기존 debug 앱을 삭제한 뒤 release APK 설치와 실행 점검을 진행.
- `now_app\scripts\check_android_launch.py --serial R3CN90A1WZF --require-physical --apk ...\app-release.apk --timeout 120` 통과.
- 확인 내용: APK ABI 호환성, 저장공간, 설치 성공, 패키지 설치 확인, 앱 실행, 현재 화면 패키지, 실행 직후 crash buffer, ActivityManager crashing 상태.
- 실행 중인 서버의 `/api/v1/admin/release-evidence-records`에 실제 기기 설치 테스트 증빙 기록 저장. 기록 ID는 13.

### 현재 상태

- `docs\PHASE1_RELEASE_CHECKLIST.md`에서 `실제 기기 설치 테스트.` 항목을 완료 처리.
- 전체 1차 체크리스트는 40/57 완료, 남은 항목 17개.
- Google Play 등록 전 점검은 4/10 완료.

## 2026-05-29 12:56 KST

### 남은 1차 항목 재점검

- `scripts\verify_public_repo_safety.py` 통과: 8/8.
- `scripts\play_release_status.py --show-manual` 통과: 자동 확인 27/27 OK, 경고 0.
- GitHub Actions 상태 확인은 저장소가 비공개이고 현재 셸에 `GITHUB_TOKEN`/`GH_TOKEN`이 없어 `scripts\check_github_actions_status.py`가 HTTP 404 안내를 반환함. 완료 처리하지 않음.
- GitHub 커넥터 기준 저장소 `cyhuh428-sinsan/Now`는 private이고 현재 사용자 권한은 admin/push 가능 상태임을 확인.

### 현재 보류 판단

- 공용 서버 8개 항목은 실제 도메인, HTTPS reverse proxy, 공용 운영 토큰 정책 확정 전에는 완료 처리하지 않음.
- Google Play 수동 7개 항목은 Play Console 화면 확인과 내부 테스트 트랙 업로드가 필요해 완료 처리하지 않음.
- Play 실제 기기 설치 테스트는 현재 실기기에 설치된 debug 앱과 release 서명 앱의 서명이 달라질 수 있어, 강제 진행 시 앱 데이터 삭제가 필요할 수 있으므로 사용자 승인 전에는 진행하지 않음.
- 라이선스 2개 항목은 법적 선택이므로 사용자 확정 전에는 완료 처리하지 않음.

## 2026-05-29 12:52 KST

### 모바일 음성 점검 반영본 배포

- 실제 Android 기기 음성 점검 완료 내역을 `test: verify mobile voice flows` 커밋으로 정리하고 원격 `main`에 push.
- WSL 배포 경로 `/home/daon/deploy/Now`에서 `git pull origin main`으로 최신 커밋 반영.
- `server/scripts/deploy_local.sh --base-url http://localhost:8750`로 WSL/Docker 서버 재배포.
- 배포 전 서버 preflight 통과: 945/945.
- 배포 후 smoke test 통과.
- 실행 중인 서버의 `/api/v1/admin/release-readiness`가 39/57 완료, 18개 남음을 반환함을 확인.

### 현재 상태

- 모바일 앱 실제 점검은 12/12 완료.
- Web/설치형 점검은 12/12 완료.
- 서버 재배포 점검은 9/9 완료.
- 남은 18개는 공용 서버 운영 결정, Google Play Console 수동 확인, GitHub Actions 통과 확인, 라이선스 선택/파일 추가 항목.

## 2026-05-29 12:45 KST

### 실제 Android 녹음 후 변환과 업로드 확인

- 테스트용 로컬 STT 응답 서버 `scripts\dev_transcribe_stub.py` 추가.
- ADB reverse `tcp:8751 -> tcp:8751`을 열고 실제 Android 기기에서 로컬 Whisper 서버 URL을 `http://127.0.0.1:8751`로 설정.
- `녹음 후 변환` 모드에서 녹음 종료 후 `POST /transcribe` 200 응답을 받고, 반환 텍스트가 메모 내용으로 반영되는 것을 확인.
- 실제 기기 NowNote 서버 설정에 `http://127.0.0.1:8750`과 API 토큰을 저장.
- 토큰 미설정 상태에서는 서버 로그에 `POST /api/v1/recordings` 401이 남는 것을 확인했고, 토큰 저장 후 같은 흐름에서 `POST /api/v1/recordings` 200을 확인.
- 서버 운영 요약의 `recordings` 값이 49에서 50으로 증가하는 것을 확인.
- 실행 중인 서버의 `/api/v1/admin/release-evidence-records`에 녹음 후 변환 증빙 기록 저장. 기록 ID는 10.
- 실행 중인 서버의 `/api/v1/admin/release-evidence-records`에 녹음 업로드 증빙 기록 저장. 기록 ID는 11.

### 현재 상태

- `docs\PHASE1_RELEASE_CHECKLIST.md`에서 `음성 녹음 후 변환 흐름 확인.`, `녹음 업로드 상태 확인.` 항목을 완료 처리.
- 모바일 앱 실제 점검은 12/12 완료.
- 전체 1차 체크리스트는 39/57 완료, 남은 항목 18개.

## 2026-05-29 12:06 KST

### 실제 Android 음성 메모 실시간 변환 확인

- 실제 Android 기기 `SM-N981N(R3CN90A1WZF)`에서 NowNote가 전면 실행 중임을 확인.
- ADB reverse `tcp:8750 -> tcp:8750` 유지 상태를 확인해 휴대폰에서 로컬 서버 접근 경로가 살아 있음을 확인.
- 메모 음성 입력 화면에서 마이크 버튼을 눌렀을 때 파란 `듣는 중...` 상태와 부분 인식 텍스트가 표시되는 것을 확인.
- 실행 중인 서버의 `/api/v1/admin/release-evidence-records`에 실시간 변환 증빙 기록 저장. 기록 ID는 9.

### 현재 상태

- `docs\PHASE1_RELEASE_CHECKLIST.md`에서 `음성 메모 실시간 변환 확인.` 항목을 완료 처리.
- 모바일 앱 실제 점검은 10/12 완료.
- 전체 1차 체크리스트는 37/57 완료, 남은 항목 20개.

### 보류

- PC TTS를 휴대폰 마이크로 들려준 제한 환경이라 음성 인식 품질 평가는 제외하고, 실시간 STT UI/권한/동작 여부만 완료 처리.
- 남은 모바일 항목은 `음성 녹음 후 변환 흐름 확인.`, `녹음 업로드 상태 확인.` 2개.

## 2026-05-29 11:04 KST

### 실제 Android 기기 점검

- 신산님이 실제 Android 휴대폰에서 개발자 옵션과 USB 디버깅을 켜고 PC에 연결.
- ADB 기준 `SM-N981N(R3CN90A1WZF)`이 `device` 상태로 인식됨.
- `now_app\scripts\check_android_runtime.py --require-physical --timeout 15` 통과.
- `now_app\scripts\check_android_launch.py --serial R3CN90A1WZF --require-physical --timeout 90` 통과.
- APK 설치, `com.sinsan.nownote` 실행, foreground package 확인까지 완료.

### 반영 내용

- `docs\PHASE1_RELEASE_CHECKLIST.md`에서 `실제 Android 기기에서 앱 실행.` 항목을 완료 처리.
- 실행 중인 서버의 `/api/v1/admin/release-evidence-records`에 실제 기기 실행 증빙 기록 저장. 기록 ID는 5.

### 현재 상태

- `uv run python scripts\release_readiness.py --show-blockers` 기준 36/57 완료, 남은 항목 21개.
- 모바일 앱 실제 점검은 9/12 완료.

### 보류

- 실제 Android 기기에서 음성 메모 실시간 변환, 음성 녹음 후 변환, 녹음 업로드 상태는 아직 앱 화면 조작과 마이크 권한/서버 연결 확인이 필요해 완료 처리하지 않음.

### 추가 확인 및 보강

- 최초 설치된 APK가 에뮬레이터용 `x86_64` native library만 포함해 실제 `arm64-v8a` 기기에서 `libflutter.so`를 찾지 못하고 크래시 나는 문제를 확인.
- 샌드박스 밖에서 `flutter build apk --debug --target-platform android-arm64`를 실행해 최신 `app-debug.apk`를 재빌드.
- 재빌드된 APK는 `lib/arm64-v8a/libflutter.so`를 포함하며, 실제 기기 `R3CN90A1WZF`에 설치 후 실행 직후 crash buffer와 ActivityManager crashing 상태가 모두 정상임을 확인.
- `now_app\scripts\check_android_launch.py`가 APK ABI 호환성, 실행 직후 crash buffer, ActivityManager crashing 상태까지 확인하도록 보강.
- 모바일 README와 실제 실행 점검서에 ABI/크래시 확인 기준 추가.
- `uv run python now_app\scripts\check_android_launch.py --serial R3CN90A1WZF --require-physical --timeout 90` 재실행 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 945/945.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 128/128.

## 2026-05-29 10:22 KST

### 다음 작업 시작

- 남은 22개 항목 중 실제 외부 증빙 없이 닫을 수 없는 항목은 완료 처리하지 않고, 운영자가 화면에서 어떤 항목이 기록됐는지 바로 볼 수 있게 보강.
- Android 에뮬레이터 점검 중 새 APK 재설치는 저장공간 부족으로 실패했지만 기존 설치 앱 실행은 가능한 상황을 확인.

### 구현 내용

- `now_app/scripts/check_android_emulator.py`가 `INSTALL_FAILED_INSUFFICIENT_STORAGE` 발생 시 패키지 설치와 현재 화면 패키지가 확인되면 `--skip-install` 실행 확인을 자동 재시도하도록 보강.
- `/admin/evidence`에 증빙 완료 기록, 기록 있음, 미기록 집계 카드 추가.
- `/admin/evidence`의 수동 증빙 기준 표에 항목별 최신 기록 상태를 표시.
- smoke test와 preflight가 수동 증빙 진행 집계를 확인하도록 보강.
- `docs/PROJECT_STATUS.md`의 preflight 수치와 수동 증빙 운영 설명 갱신.

### 검증

- `uv run python -m py_compile now_app\scripts\check_android_emulator.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 128/128.
- `uv run python now_app\scripts\check_android_emulator.py --launch-app --timeout 60 --interval 5` 통과. 에뮬레이터 저장공간 부족으로 재설치는 경고 처리, 기존 설치 앱 실행은 통과.
- FastAPI TestClient로 `/admin/evidence` 200 응답과 `증빙 완료 기록`, `미기록`, `수동 증빙 기준` 표시 확인.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 942/942.
- WSL/Docker 실제 재배포 최종 통과. `scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull` 기준 preflight 942/942, `/admin/evidence` 증빙 진행 집계 표시, smoke test 모두 통과.
- `uv run python scripts\release_readiness.py --show-blockers` 결과는 35/57 완료, 남은 항목 22개 유지.

### 보류

- 실제 Android 기기 음성 흐름, 공용 도메인/HTTPS, Play Console 입력/업로드, GitHub Actions run, 오픈소스 라이선스 선택은 실제 외부 증빙 또는 신산님 결정이 필요해 완료 처리하지 않음.

## 2026-05-29 09:53 KST

### 다음 작업 시작

- 남은 1차 마무리 항목은 실제 확인 증빙이 있어야 닫을 수 있으므로, 수동 증빙을 화면에서 저장/조회할 수 있게 보강.
- 기존 메모/녹음/동기화 데이터 구조는 변경하지 않고, 별도 운영 테이블로 증빙 기록만 추가.

### 구현 내용

- `release_evidence_records` 테이블 모델 추가.
- `GET /api/v1/admin/release-evidence-records`, `POST /api/v1/admin/release-evidence-records` 추가.
- `/admin/evidence` 화면에 증빙 기록 저장 폼과 최근 증빙 기록 목록 추가.
- smoke test, preflight, GitHub Actions 문법 검사 대상, `server/README.md`, `docs/PROJECT_STATUS.md`에 수동 증빙 기록 기준 반영.

### 검증

- `uv run python -m py_compile server\app\models\note.py server\app\db.py server\app\api\admin.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- FastAPI TestClient로 `/admin/evidence` 화면, `POST /api/v1/admin/release-evidence-records`, `GET /api/v1/admin/release-evidence-records`, `/api/v1/admin/export/all`, `/api/v1/admin/export/verify` 확인.
- TestClient 기준 `release_evidence_records` 백업 포함과 백업 검증 `status: ok` 확인.
- WSL/Docker 실제 재배포 1차 smoke에서 `release_evidence_records`가 백업에 포함되며 export summary total 검증 누락을 확인했고, smoke total 기준에 증빙 기록 수를 반영.
- WSL/Docker 실제 재배포 2차 smoke에서 저장된 증빙 기록이 있는 `/admin/evidence` 렌더링 중 `_truncate` 누락을 확인했고, 화면 렌더링 보조 함수와 저장 후 화면 확인 smoke를 추가.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 935/935.
- WSL/Docker 실제 재배포 최종 통과. `scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull` 기준 preflight 935/935, `/admin/evidence` 저장 기록 표시, 증빙 기록 API, 전체 백업, 백업 검증, smoke test 모두 통과.
- `uv run python scripts\release_readiness.py --show-blockers` 결과는 35/57 완료, 남은 항목 22개 유지.

## 2026-05-29 09:21 KST

### 다음 작업 시작

- 남은 1차 마무리 22개는 실제 기기, 공용 서버, Play Console, GitHub Actions, 라이선스처럼 외부 확인이 필요하므로 임의 완료 처리하지 않음.
- 대신 `/admin/evidence`에서 확인한 증빙 기준을 그대로 작업 기록에 남길 수 있는 수동 증빙 기록 템플릿을 추가.

### 구현 내용

- `server/app/services/release_evidence.py`에 `release_evidence_template()` 추가.
- `GET /api/v1/admin/release-evidence-template` 추가.
- `/admin/evidence` 화면에 증빙 기록 템플릿과 템플릿 API 링크 추가.
- smoke test, preflight, `server/README.md`, `docs/PROJECT_STATUS.md`에 새 템플릿 화면/API 기준 반영.

### 검증

- `uv run python -m py_compile server\app\services\release_evidence.py server\app\api\admin.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- FastAPI TestClient로 `/admin/evidence`, `/api/v1/admin/release-evidence`, `/api/v1/admin/release-evidence-template` 200 응답 확인.
- 템플릿 API 요약은 기존과 동일하게 `remaining: 22`, `groups: 5`.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 908/908.
- `uv run python scripts\release_readiness.py --show-blockers` 결과는 35/57 완료, 남은 항목 22개 유지.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과.
- `/admin/evidence` 200 응답, `/api/v1/admin/release-evidence-template` 200 응답, 템플릿 payload `phase_one_manual_evidence_template`, content 길이 8090 확인.

## 2026-05-29 08:58 KST

### 다음 작업 시작

- `/admin/evidence`의 수동 증빙 기준은 준비됐지만 공용 서버/Play Console 일부 항목은 유형별 기본 안내로 묶여 있어 실제 완료 판단에 필요한 증빙이 덜 구체적이었음.
- 남은 22개를 임의 완료 처리하지 않고, 공용 서버와 Play Console 항목별 증빙 기준을 더 세분화.

### 구현 내용

- `server/app/services/release_evidence.py`의 항목별 증빙 기준을 확장.
- 공용 서버 항목은 도메인, `NOW_PUBLIC_BASE_URL`, reverse proxy, `NOW_BEHIND_REVERSE_PROXY`, 사용자별 접속 토큰, `NOW_USER_TOKEN_REQUIRED` 각각의 필요 증빙과 참고 경로를 분리.
- Google Play 항목은 개인정보처리방침 URL, 앱 설명, 권한 설명, Data safety, 스크린샷/기능 그래픽, 내부 테스트 트랙 업로드 기준을 분리.

### 검증

- `uv run python -m py_compile server\app\services\release_evidence.py server\app\api\admin.py server\app\api\monitor.py server\scripts\preflight.py` 통과.
- FastAPI TestClient로 `/api/v1/admin/release-evidence` 200 응답, 요약 `remaining: 22`, `groups: 5` 유지, 공용 서버/Play Console 항목별 증빙 문구 반영 확인.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 896/896.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/evidence` 200 응답, `/api/v1/admin/release-evidence` 요약 `remaining: 22`, `groups: 5` 확인.

## 2026-05-29 08:47 KST

### 다음 작업 시작

- 남은 1차 마무리 22개 중 실제 Android 기기, 실제 공용 도메인/HTTPS, Play Console, GitHub Actions, 라이선스는 외부 확인 또는 신산님 결정이 필요해 임의 완료 처리하지 않음.
- 대신 남은 수동 항목을 닫을 때 필요한 증빙을 화면/API로 바로 확인할 수 있게 보강.

### 구현 내용

- `server/app/services/release_evidence.py` 추가. `release_readiness_summary()`의 남은 항목을 기준으로 항목별 필요 증빙, 다음 행동, 참고 화면/스크립트를 생성.
- `GET /api/v1/admin/release-evidence` 추가.
- `/admin/evidence` 화면 추가. 실제 기기, 공용 서버, Play Console, GitHub Actions, 라이선스 남은 항목의 증빙 기준을 읽기 전용으로 표시.
- `/admin`, `/admin/release`, `/admin/play`, `/admin/open-source`에서 수동 증빙 화면으로 이동할 수 있게 링크 추가.
- GitHub Actions preflight 문법 검사 대상, smoke test, preflight, `server/README.md`, `docs/PROJECT_STATUS.md`에 새 화면/API 반영.

### 검증

- `uv run python -m py_compile server\app\services\release_evidence.py server\app\api\admin.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- FastAPI TestClient로 `/admin/evidence` 200 응답과 `/api/v1/admin/release-evidence` 200 응답 확인. API 요약은 남은 증빙 22개, 유형 5개.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 896/896.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/evidence` 200 응답, `/api/v1/admin/release-evidence` 요약 `remaining: 22`, `groups: 5` 확인.

## 2026-05-29 07:39 KST

### 다음 작업 시작

- 남은 공개 저장소 항목 중 GitHub Actions preflight 통과 확인은 아직 실제 workflow run/status가 없어 완료 처리하지 않음.
- 다만 상태 확인 스크립트만 있고 실행 요청 스크립트가 없어, 토큰이 있는 환경에서 Actions를 화면 대신 API로 실행 요청할 수 있도록 보강.

### 구현 내용

- `scripts/dispatch_github_actions.py` 추가. `GITHUB_TOKEN` 또는 `GH_TOKEN`이 있으면 `workflow_dispatch` API로 `preflight.yml` 실행 요청 가능.
- `--dry-run` 옵션으로 실제 GitHub API 호출 없이 요청 대상과 workflow URL을 확인할 수 있게 함.
- `.github/workflows/preflight.yml`의 Python 문법 검사 대상에 새 스크립트 추가.
- `docs/OPEN_SOURCE_RELEASE.md`에 Actions 실행 요청 명령과 dry-run 명령 추가.
- `server/scripts/preflight.py`가 새 스크립트와 문서 반영 여부를 확인하도록 보강.
- `/admin/release`와 `scripts/release_readiness.py --show-blockers`의 GitHub Actions 다음 행동 문구에 실행 요청 스크립트를 반영.

### 검증

- `uv run python -m py_compile scripts\dispatch_github_actions.py server\scripts\preflight.py` 통과.
- `uv run python scripts\dispatch_github_actions.py --dry-run` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 876/876.
- `uv run python scripts\release_readiness.py --show-blockers` 기준 35/57 완료, 22개 남음 유지. GitHub Actions 다음 행동 문구 갱신 확인.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/release`의 GitHub Actions 다음 행동 갱신이 서버 화면에 반영됨.
- 최신 커밋 `60b516c` 기준 GitHub Actions workflow run/status는 아직 없음. 이 항목은 토큰 또는 GitHub Actions 화면 실행 후 다시 확인 필요.

## 2026-05-28 22:22 KST

### 다음 작업 시작

- 최신 커밋 기준 GitHub Actions 상태를 다시 확인했지만 workflow run/status는 아직 조회되지 않음.
- 공개 저장소 안전 점검, Play 등록 자동 점검, 로컬/WSL/서버 환경 점검처럼 지금 자동으로 확인 가능한 항목을 재점검.
- `local_environment_status.py`가 실제 WSL/Docker/서버는 정상인데 PowerShell 현재 경로를 WSL이 직접 번역하지 못한다는 이유로 경고를 띄우는 것을 확인.

### 구현 내용

- WSL 명령 실행 시 PowerShell의 현재 작업 경로를 그대로 물려주지 않고, WSL이 번역 가능한 안전한 Windows 경로에서 실행하도록 보정.
- 현재 Windows 작업 경로가 WSL에서 직접 보이지 않아도 WSL shell 자체가 정상 실행되면 경고가 아니라 안내가 붙은 OK 상태로 표시하도록 변경.

### 검증

- `uv run python -m py_compile scripts\local_environment_status.py` 통과.
- `uv run python scripts\local_environment_status.py --base-url http://localhost:8750`에서 WSL, Docker, 서버 health/ready/capability 확인. 커밋 전 작업트리 변경만 WARN으로 표시됨.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python scripts\play_release_status.py --show-manual` 기준 자동 확인 27/27 OK, 수동 확인 9개 유지.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 867/867.

## 2026-05-28 18:15 KST

### 다음 작업 시작

- 남은 1차 항목 중 실제 Android 기기, 음성 메모, 녹음 후 변환, 녹음 업로드는 아직 사람이 실제 기기에서 확인해야 하므로 완료 처리하지 않음.
- 다만 점검 순서가 문서에만 있으면 운영 화면 기준에서 빠지므로 서버 관리자 화면에 모바일 실제 실행 점검 화면을 추가하는 방향으로 진행.

### 구현 내용

- `/admin/mobile` 화면 추가. `now_app/docs/mobile_runtime_checklist_ko.md`를 서버 운영 화면에서 읽기 전용으로 확인할 수 있게 함.
- `/admin/release`의 모바일 남은 항목 다음 행동이 `/admin/mobile`을 안내하도록 갱신.
- Docker 이미지에 모바일 런타임 점검 문서를 포함하도록 `server/Dockerfile`, `.dockerignore` 갱신.
- `server/README.md`, `server/scripts/smoke_test.py`, `server/scripts/preflight.py`, `docs/PROJECT_STATUS.md`에 새 화면 기준 반영.

### 검증

- `uv run python -m py_compile scripts\release_readiness.py server\app\services\release_readiness.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 867/867.
- FastAPI TestClient로 `/admin/mobile` 200 응답, 모바일 점검 핵심 문구, `/admin/release`의 `/admin/mobile` 링크, release readiness API의 다음 행동 문구 확인.
- `uv run python scripts\release_readiness.py --show-blockers` 기준 35/57 완료, 22개 남음 유지.

### 추가 확인

- WSL Docker 재배포 중 새 `/now_app/docs` 경로가 모바일 점검 문서만 가진 상태로 먼저 선택되어 Play 등록 준비 API가 `/play_docs`를 보지 못하는 문제 확인.
- `play_release_summary()`가 필수 Play 문서가 모두 있는 경로를 우선 선택하도록 수정.
- 관리자 Basic 인증 실패 시 한글 realm 헤더 때문에 401 대신 500이 날 수 있는 문제를 피하려고 realm 값을 ASCII로 변경.
- FastAPI TestClient로 API 토큰이 설정된 상태의 `/monitor` 미인증 접근이 401로 응답하는지 확인.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/mobile` 200 응답, `/api/v1/admin/play-release` 자동 확인 22/22, `/api/v1/admin/open-source-release` 자동 확인 16/16 확인.

## 2026-05-28 17:58 KST

### 다음 작업 시작

- 남은 1차 항목 중 공개 저장소 오픈 전 점검은 `/admin/release`에 묶여 있지만, 라이선스와 GitHub Actions를 따로 보기에는 운영 화면이 부족함.
- 실제 라이선스 선택이나 Actions 통과 확인은 사람이 해야 하므로 완료 처리하지 않고, 화면/API에서 확인 부담을 줄이는 방향으로 진행.

### 구현 내용

- `server/app/services/open_source_release.py` 추가. 공개 문서, README/SECURITY/CONTRIBUTING, 이슈/PR 템플릿, GitHub Actions preflight, 라이선스 보류 상태를 요약.
- `GET /api/v1/admin/open-source-release` 추가.
- `/admin/open-source` 화면 추가. 자동 확인 항목과 공개 전 수동 확인 항목을 분리해서 표시.
- Docker 이미지에 공개 저장소 준비 화면이 필요한 문서와 GitHub 템플릿을 포함하도록 `server/Dockerfile`, `.dockerignore` 갱신.
- `server/README.md`, `server/scripts/smoke_test.py`, `server/scripts/preflight.py`, `docs/PROJECT_STATUS.md`에 새 화면/API 기준 반영.

### 검증

- `uv run python -m py_compile server\app\services\open_source_release.py server\app\api\admin.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 857/857.
- FastAPI TestClient로 `/admin/open-source` 200 응답과 `/api/v1/admin/open-source-release` 200 응답 확인. API 요약은 자동 확인 16/16, 경고 0, 수동 확인 3.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python scripts\release_readiness.py --show-blockers` 기준 35/57 완료, 22개 남음 유지.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/open-source` 200 응답, `/api/v1/admin/open-source-release` 200 응답, API 요약 자동 확인 16/16, 경고 0, 수동 확인 3 확인.

## 2026-05-28 17:46 KST

### 다음 작업 시작

- 남은 1차 항목 중 자동으로 더 확인할 수 있는 후보로 GitHub Actions preflight 연결 상태를 재점검.
- 최신 커밋 `563c745` 기준 GitHub workflow run/status는 아직 비어 있어 `GitHub Actions preflight 통과 확인` 항목은 완료 처리하지 않음.

### 구현 내용

- `.github/workflows/preflight.yml`의 Python 문법 검사 대상에 `scripts/release_readiness.py` 추가.
- 같은 문법 검사 대상에 Android 실제 실행 점검 스크립트 `check_android_runtime.py`, `check_android_emulator.py`, `check_android_launch.py` 추가.
- `server/scripts/preflight.py`가 GitHub Actions workflow에 위 스크립트 문법 검사 대상이 포함됐는지 확인하도록 보강.
- `docs/PROJECT_STATUS.md`의 서버 preflight 최신 통과 수치를 827/827로 갱신.

### 검증

- `uv run python -m py_compile server\scripts\preflight.py scripts\release_readiness.py now_app\scripts\check_android_runtime.py now_app\scripts\check_android_emulator.py now_app\scripts\check_android_launch.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 827/827.
- GitHub 커넥터 기준 최신 커밋 `563c74574e1201cf523d1790fc9aedf47598be4b`의 workflow run/status가 아직 없음을 확인.

## 2026-05-28 08:05 KST

### 다음 작업 시작

- 1차 마무리 남은 항목은 대부분 외부 확인 또는 사용자 결정이 필요하므로 완료 처리하지 않음.
- 대신 `/admin/release`, `/api/v1/admin/release-readiness`, `scripts/release_readiness.py --show-blockers`에서 보류 사유뿐 아니라 다음 행동까지 보이도록 보강.

### 구현 내용

- `server/app/services/release_readiness.py`에 남은 항목 유형별 `NEXT_ACTIONS` 추가.
- `/api/v1/admin/release-readiness`의 각 blocker에 `next_action` 필드 추가.
- `/admin/release`의 남은 항목 유형 표에 `다음 행동` 열 추가.
- 루트 `scripts/release_readiness.py --show-blockers` 출력에도 `다음 행동` 추가.
- `server/README.md`, `docs/PROJECT_STATUS.md`, `server/scripts/smoke_test.py`, `server/scripts/preflight.py`에 새 기준 반영.

### 검증

- `uv run python -m py_compile scripts\release_readiness.py server\app\services\release_readiness.py server\app\api\monitor.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `uv run python scripts\release_readiness.py --show-blockers`에서 유형별 `다음 행동` 출력 확인.
- FastAPI TestClient로 `/admin/release` 200 응답과 `다음 행동` 표시 확인.
- FastAPI TestClient로 `/api/v1/admin/release-readiness` 200 응답과 모든 blocker의 `next_action` 필드 확인.
- `git diff --check` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 823/823.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/release` 200 응답, `/api/v1/admin/release-readiness` 200 응답, blocker별 `next_action` 검증 통과 확인.

## 2026-05-28 07:40 KST

### 다음 작업 시작

- Android 에뮬레이터에서 새 APK 재설치가 실패한 원인을 좁히고, 같은 문제가 다시 나왔을 때 점검 스크립트가 바로 원인과 우회 방법을 안내하도록 보강.

### 확인 내용

- `adb shell df -h /data` 기준 에뮬레이터 `emulator-5554`의 `/data` 여유 공간은 약 494MB, 사용률은 92%.
- 설치된 NowNote 패키지는 `com.sinsan.nownote`, `versionName=1.0.0`, `versionCode=1`, `lastUpdateTime=2026-05-25 12:54:28`.
- 일반 설치 점검은 `INSTALL_FAILED_INSUFFICIENT_STORAGE`로 실패하지만, 패키지 확인/앱 실행/프로세스/현재 화면 패키지는 정상 확인.
- `--skip-install` 실행 점검은 통과.

### 구현 내용

- `now_app/scripts/check_android_launch.py`가 APK 설치 전 `df -k /data`를 읽어 Android 저장공간을 표시하도록 보강.
- 설치 실패 메시지에 `INSTALL_FAILED_INSUFFICIENT_STORAGE`가 있으면 AVD 저장공간 정리 또는 `--skip-install` 실행 확인 안내를 함께 출력.
- `now_app/README.md`, `now_app/docs/mobile_runtime_checklist_ko.md`, `server/scripts/preflight.py`에 저장공간 부족 대응 기준 반영.

### 검증

- `uv run python -m py_compile now_app\scripts\check_android_launch.py server\scripts\preflight.py` 통과.
- `uv run python now_app\scripts\check_android_launch.py --serial emulator-5554 --timeout 90` 실행 결과 저장공간 494MB와 `INSTALL_FAILED_INSUFFICIENT_STORAGE` 안내 출력 확인.
- `uv run python now_app\scripts\check_android_launch.py --serial emulator-5554 --skip-install --timeout 90` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 816/816.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.

## 2026-05-28 07:15 KST

### 다음 작업 시작

- 남은 1차 항목 중 실제로 확인 가능한 GitHub Actions 상태와 Android 에뮬레이터 실행 상태를 재점검.
- 실제 기기, 음성 입력, Play Console, 공용 도메인, 라이선스처럼 사람이 최종 확인해야 하는 항목은 완료 처리하지 않음.

### 확인 내용

- `scripts/check_github_actions_status.py --commit e912596` 실행 결과 토큰 없는 GitHub API는 404를 반환. 연결된 GitHub 도구에서도 최신 커밋 `e912596639d5288081a47b32210293a0f39043a3`의 workflow run/status가 아직 없음.
- `now_app/scripts/check_android_runtime.py --server-url http://127.0.0.1:8750 --timeout 12` 실행 결과 Flutter CLI, ADB, AVD 목록, 로컬 서버 health/ready는 정상. 실행 중인 Android 기기는 없어서 실패 1건.
- `now_app/scripts/check_android_emulator.py --start --launch-app --timeout 300 --interval 5`로 `Medium_Phone_API_36.1` 에뮬레이터 부팅 확인. APK 재설치는 저장공간 부족으로 실패했지만 기존 설치 앱은 현재 화면 패키지 `com.sinsan.nownote`로 확인.
- `now_app/scripts/check_android_launch.py --serial emulator-5554 --skip-install --timeout 90` 실행 통과. 설치된 앱 실행, 프로세스, 현재 화면 패키지 확인.
- ADB UI 덤프로 홈 화면의 `좋은 아침이에요`, `LLM 브리핑`, `오늘 일정`, `오늘 메모`, 하단 탭 `홈/일상/살림/여행/기록` 표시 확인.

### 구현 내용

- `now_app/scripts/check_android_emulator.py`에 `--skip-install` 옵션 추가. 이미 설치된 앱을 기준으로 실행 상태만 확인할 수 있게 함.
- `now_app/README.md`, `now_app/docs/mobile_runtime_checklist_ko.md`, `server/scripts/preflight.py`에 새 옵션 안내와 점검 기준 반영.

### 검증

- `uv run python -m py_compile now_app\scripts\check_android_emulator.py server\scripts\preflight.py` 통과.
- `uv run python now_app\scripts\check_android_emulator.py --launch-app --skip-install --timeout 120` 통과.
- `git diff --check` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 812/812.

## 2026-05-28 05:55 KST

### 다음 작업 시작

- Google Play 등록 준비 상태를 CLI뿐 아니라 서버 관리자 화면과 API에서 확인할 수 있도록 운영 표면 보강.
- 서명 키와 AAB 같은 로컬 비밀/빌드 산출물은 서버 이미지에 포함하지 않고, 문서/이미지 초안과 수동 확인 항목만 서버 화면에서 확인하는 방향으로 진행.

### 구현 내용

- `server/app/services/play_release.py` 추가. Play 등록 문서, 이미지 초안 크기, 개인정보처리방침/권한 설명 문구, 1차 체크리스트의 Play Console 수동 확인 항목을 요약.
- `GET /api/v1/admin/play-release` 추가. 관리자 API로 Google Play 등록 준비 상태를 JSON 반환.
- `/admin/play` 화면 추가. 자동 확인 항목과 Play Console 수동 확인 항목을 읽기 전용으로 표시.
- 서버 Docker 이미지가 Play 등록 문서와 이미지 초안을 포함하도록 `server/Dockerfile`과 `.dockerignore` 보강.
- `server/README.md`, `docs/PROJECT_STATUS.md`, `server/scripts/smoke_test.py`, `server/scripts/preflight.py`에 새 화면/API 기준 반영.

### 검증

- `uv run python -m py_compile server\app\api\admin.py server\app\api\monitor.py server\app\services\play_release.py server\app\services\release_readiness.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `git diff --check` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 809/809.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- FastAPI TestClient로 `/admin/play` 200 응답과 `/api/v1/admin/play-release` 200 응답 확인. API 요약은 자동 확인 22/22, 경고 0, 수동 확인 7.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드 중 `COPY now_app/docs/...`와 `COPY now_app/docs/play_assets/*.png` 단계가 실행되는 것 확인.
- 실제 Docker 재기동 후 smoke test 통과. `/admin/play` 200 응답, `/api/v1/admin/play-release` 200 응답, API 요약 자동 확인 22/22, 경고 0, 수동 확인 7 확인.

## 2026-05-28 05:15 KST

### 다음 작업 시작

- 남은 1차 마무리 항목을 CLI가 아니라 서버 화면/API에서 확인할 수 있도록 운영 표면 보강.
- 실제 기기, Play Console, 공용 도메인, 라이선스처럼 외부 확인이 필요한 항목은 완료 처리하지 않고 보류 사유를 화면에 드러내는 방향으로 진행.

### 구현 내용

- `server/app/services/release_readiness.py` 추가. `docs/PHASE1_RELEASE_CHECKLIST.md`를 읽어 전체 완료 수, 영역별 진행률, 남은 항목 유형을 계산.
- `GET /api/v1/admin/release-readiness` 추가. 관리자 API로 1차 릴리스 준비 상태를 JSON 반환.
- `/admin/release` 화면 추가. 완료/남은 항목, 영역별 진행, 실제 Android 기기/공용 서버/Play Console/GitHub Actions/라이선스 보류 유형을 화면에서 확인.
- 서버 Docker 이미지가 `docs/PHASE1_RELEASE_CHECKLIST.md`를 포함하도록 `server/Dockerfile`과 `.dockerignore` 보강.
- `server/README.md`, `docs/PROJECT_STATUS.md`, `server/scripts/smoke_test.py`, `server/scripts/preflight.py`에 새 화면/API 기준 반영.

### 검증

- `uv run python -m py_compile server\app\api\admin.py server\app\api\monitor.py server\app\services\release_readiness.py server\scripts\smoke_test.py server\scripts\preflight.py` 통과.
- `git diff --check` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 788/788.
- FastAPI TestClient로 `/admin/release` 200 응답과 `/api/v1/admin/release-readiness` 200 응답 확인. API 요약은 35/57 완료, 22개 남음.

### 추가 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `sh scripts/deploy_local.sh --base-url http://localhost:8750 --skip-pull --timeout 30 --ready-retries 20 --ready-delay 3` 실행 통과.
- 실제 Docker 재빌드/재기동 후 smoke test 통과. `/admin/release` 200 응답, `/api/v1/admin/release-readiness` 200 응답, API 요약 35/57 완료, 22개 남음 확인.

## 2026-05-28 04:45 KST

### 다음 작업 시작

- 남은 1차 마무리 항목 중 공용 서버 오픈 준비에서 로컬 문서와 reverse proxy 예시로 닫을 수 있는 부분을 보강.
- 실제 도메인/HTTPS 적용은 외부 운영 결정이 필요하므로 완료 처리하지 않고, 적용 절차와 점검 기준을 먼저 고정.

### 구현 내용

- `server/PUBLIC_SERVER.md` 추가. 공용 서버 오픈 전 환경값, HTTPS/reverse proxy, 사용자 토큰 필수화, 데이터 격리 smoke test, 운영 화면 확인 순서를 문서화.
- `server/reverse_proxy/nginx.nownote.conf.example` 추가. HTTPS 리다이렉트, 인증서 경로 예시, 업로드 크기, 프록시 헤더, timeout 기준을 포함.
- `server/reverse_proxy/Caddyfile.example` 추가. Caddy 기준 HTTPS reverse proxy와 업로드 크기 제한 예시를 포함.
- `server/README.md`, `server/DEPLOY.md`, `docs/SERVER_AUTH_POLICY.md`에서 공용 서버 오픈 문서와 reverse proxy 예시 위치를 연결.
- `server/scripts/preflight.py`가 공용 서버 문서와 Nginx/Caddy 예시의 핵심 문구를 점검하도록 보강.

### 검증

- `uv run python -m py_compile server\scripts\preflight.py` 통과.
- `git diff --check` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 767/767.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.

### 보류

- 실제 공용 도메인, HTTPS 인증서, reverse proxy 적용, `NOW_USER_TOKEN_REQUIRED=true` 운영값 적용은 실제 운영 서버에서 확인해야 하므로 완료 처리하지 않음.

## 2026-05-28 04:05 KST

### 다음 작업 시작

- 남은 1차 마무리 항목 중 로컬에서 추가로 확인 가능한 모바일/Play/릴리스 상태 재점검.
- 실제 Android 기기/에뮬레이터가 연결됐을 때 설치와 실행 확인을 빠르게 닫을 수 있도록 자동 점검 도구 보강.

### 확인 내용

- 모바일 정적 표면 점검은 `now_app/scripts/verify_mobile_surface.py` 기준 110/110 통과.
- Android 런타임 점검은 Flutter CLI, ADB, AVD 목록, 로컬 서버 health/ready까지 확인.
- 현재 `adb devices -l` 기준 실행 중인 에뮬레이터나 USB 실기기가 없어 실제 음성 메모, 녹음 후 변환, 녹음 업로드, 실기기 설치 테스트는 완료 처리하지 않음.
- Google Play 준비 상태는 `scripts/play_release_status.py --show-manual` 기준 자동 확인 27/27 OK, 경고 0개, Play Console/실기기 수동 확인 9개 남음.
- 1차 릴리스 상태는 `scripts/release_readiness.py --show-blockers` 기준 35/57 완료, 22개 남음으로 유지.
- 서버 preflight는 `server/scripts/preflight.py --env-file .env.example --allow-example` 기준 720/720 통과.
- 공개 저장소 안전 점검은 `scripts/verify_public_repo_safety.py` 기준 8/8 통과.
- `flutter analyze`, `dart analyze`, `flutter --version`, `dart --version`은 현재 PowerShell 세션에서 장시간 응답하지 않아 시간 초과. 분석 프로세스 잔류는 확인되지 않음.
- GitHub Actions 상태 점검은 토큰 없는 GitHub API 조회에서 404가 반환되어, Actions 화면에서 `NowNote Preflight` 수동 실행 또는 Actions 읽기 권한 토큰이 필요함을 확인.
- `now_app/scripts/check_android_launch.py` 추가. 연결된 Android 기기에 APK 설치, 런처 실행, 패키지 설치 확인, 프로세스 확인을 수행.
- `now_app/README.md`와 `now_app/docs/mobile_runtime_checklist_ko.md`에 설치/실행 자동 확인 명령을 추가.
- `now_app/scripts/verify_mobile_surface.py`와 `server/scripts/preflight.py`가 새 Android 설치/실행 점검 도구를 확인하도록 보강.
- 새 기준 검증 결과: 모바일 표면 점검 119/119 통과, 서버 preflight 730/730 통과.
- 현재 연결된 Android device 상태 기기가 없어 `check_android_launch.py`는 ADB와 APK 파일은 확인하고, 설치/실행 대상 없음으로 정상적으로 실패 사유를 출력.
- `now_app/scripts/check_android_emulator.py` 추가. ADB, emulator CLI, AVD 목록을 확인하고, 필요하면 `--start`로 에뮬레이터를 시작한 뒤 부팅 완료(`sys.boot_completed`)까지 대기할 수 있게 함.
- `--launch-app` 옵션으로 에뮬레이터 부팅 후 `check_android_launch.py`까지 이어 실행할 수 있게 구성.
- `check_android_runtime.py`가 연결된 기기가 없을 때 `check_android_emulator.py` 실행 명령을 안내하도록 보강.
- 새 기준 검증 결과: 모바일 표면 점검 128/128 통과, 서버 preflight 740/740 통과.
- `check_android_emulator.py --timeout 20` 실행 결과 ADB, emulator CLI, AVD `Medium_Phone_API_36.1`을 확인했고, 현재 실행 중인 에뮬레이터가 없어 `--start` 안내를 표시.
- `check_android_runtime.py --require-server --timeout 15` 실행 결과 Flutter CLI, ADB, AVD, 서버 health/ready는 확인됐고, 연결된 Android device 상태 기기 없음 1개만 실패.

### 보류

- 실제 Android 기기/에뮬레이터가 연결되지 않은 상태에서는 모바일 음성/녹음 흐름을 완료 처리하지 않음.
- Play Console 화면 입력, 공용 도메인/HTTPS 운영값, GitHub Actions 실행 기록, 라이선스 선택은 외부 결정 또는 외부 화면 확인이 필요하므로 완료 처리하지 않음.

## 2026-05-28 03:40 KST

### 다음 작업 시작

- 1차 마무리 남은 항목 중 WSL/Docker 서버 재배포 점검 9개를 실제 환경에서 완료 처리.

### 구현 내용

- WSL 배포 저장소의 HTTPS remote가 인증 대기로 멈추는 문제를 확인하고, 이미 인증된 SSH remote(`git@github.com:cyhuh428-sinsan/Now.git`)로 전환.
- WSL `server/.env`를 로컬 비밀 파일로 생성하고, API 토큰과 PostgreSQL 비밀번호를 난수로 설정. 실제 비밀값은 출력하거나 커밋하지 않음.
- PostgreSQL 사용자 비밀번호를 `.env`의 새 비밀번호와 맞게 갱신.
- Docker 이미지가 `/admin/recovery`, `/admin/deploy`, `/admin/public`에서 필요한 운영 문서를 포함하도록 루트 build context와 `.dockerignore`, `server/Dockerfile`, `server/docker-compose.yml`을 정리.
- smoke test가 사용자 관리 추가 화면, 한글 URL 쿼리, 운영 점검 readiness 라벨, 반복 실행 시 `local_user` 활성 상태 복구를 안전하게 처리하도록 보강.
- admin API가 사용자/기기의 활성 상태와 2단계 사용 여부를 `true/false`로 반환하도록 정규화.

### 검증

- WSL 배포 경로 `/home/daon/deploy/Now/server`에서 `server/scripts/deploy_local.sh --base-url http://localhost:8750 --timeout 30 --ready-retries 20 --ready-delay 3` 최종 통과.
- 최종 deploy helper 실행 결과: preflight 720/720 통과, Docker Compose 재빌드/기동, `/health`, `/health/ready`, `/api/v1/server`, `/monitor`, `/admin` 확인, 전체 smoke test 통과.
- smoke test에서 백업 검증, 사용자별 토큰, 2단계 코드 검증, 사용자별 데이터 격리, 녹음 업로드/교체, 비활성 사용자 차단과 복구 확인.

### 완료 처리

- `docs/PHASE1_RELEASE_CHECKLIST.md`의 서버 재배포 점검 9개 항목을 완료 처리.
- `docs/PROJECT_STATUS.md`를 35/57 완료, 22개 남음으로 갱신.

## 2026-05-28 01:42 KST

### 다음 작업 시작

- 로컬 환경 점검에서 현재 실행 중인 서버가 오래된 배포본일 때 다음 조치를 더 명확히 보이도록 보강.

### 구현 내용

- `scripts\local_environment_status.py`의 서버 capability 경고에 WSL/Linux 배포 경로에서 `git pull origin main` 후 `server/scripts/deploy_local.sh` 또는 `server/DEPLOY.md` 기준으로 재배포하라는 안내를 추가.
- `server\scripts\preflight.py`가 로컬 환경 점검 스크립트의 재배포 안내와 배포 도우미 연결 문구를 확인하도록 보강.
- `docs\PROJECT_STATUS.md`의 preflight 통과 수치를 699/699로 갱신.

### 검증

- `uv run python -m py_compile scripts\local_environment_status.py server\scripts\preflight.py` 통과.
- `uv run python scripts\local_environment_status.py --base-url http://localhost:8750` 실행: WSL/Docker 경고와 서버 capability 경고는 남지만, 재배포 안내가 함께 표시됨.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 699/699.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python scripts\release_readiness.py --show-blockers` 통과: 26/57 완료, 31개 남음.
- `git diff --check` 통과.

### 보류

- 실제 WSL/Docker 서버 재배포는 WSL/Linux 배포 경로에서 pull, compose 재기동, smoke test까지 확인해야 하므로 완료 처리하지 않음.

## 2026-05-24 00:30 KST

### 다음 작업 시작

- `/admin/deploy` 화면을 단순 문서 표시에서 배포 후 운영 확인 화면에 가깝게 보강.

### 구현 내용

- `/admin/deploy` 상단에 현재 서버 이름, API 토큰 상태, 사용자별 접속 토큰 요구 여부, 공개 URL, reverse proxy, 녹음 저장소 요약 추가.
- `/health`, `/health/ready`, `/api/v1/server`, `/admin/ops`, `/admin/export`, `/admin/recovery` 확인 링크 추가.
- smoke test가 배포 화면의 현재 서버 요약과 확인 링크를 검증하도록 보강.
- preflight가 smoke test의 배포 화면 검증 기준을 확인하도록 보강.

### 완료 처리

- 실제 WSL/Docker 재배포는 이 Windows 작업 환경에서 수행하지 못하므로 체크리스트 완료 처리하지 않음.

## 2026-05-24 00:10 KST

### 다음 작업 시작

- GitHub Actions preflight가 Web import/export 런타임 점검 스크립트의 문법도 확인하도록 보강.

### 구현 내용

- `.github/workflows/preflight.yml`에 Node 22 설정과 `node --check web/scripts/check_import_export.mjs` 단계 추가.
- `server/scripts/preflight.py`가 GitHub Actions의 Node 버전 고정과 Web 런타임 스크립트 문법 점검 단계를 확인하도록 보강.

### 확인 내용

- GitHub 커넥터 기준 현재 최신 커밋 `5f2712c`에는 연결된 workflow run이 조회되지 않아 `GitHub Actions preflight 통과 확인` 항목은 완료 처리하지 않음.

## 2026-05-23 21:40 KST

### 다음 작업 시작

- Web/설치형 점검 중 Markdown 가져오기/내보내기와 JSON 백업/복원 실제 확인.

### 구현 내용

- `web/scripts/check_import_export.mjs` 추가.
- Chrome 또는 Edge를 headless로 실행해 실제 Web 화면에서 Markdown 파일 입력, Markdown 다운로드, JSON 다운로드, JSON 복원을 확인하도록 구성.
- `web/README.md`와 `web/runtime_checklist_ko.md`에 실행 명령 추가.
- `web/scripts/verify_web_surface.py`와 `server/scripts/preflight.py`가 import/export 실제 점검 스크립트 존재와 핵심 검증 기준을 확인하도록 보강.

### 검증

- `NOWNOTE_BROWSER_PATH`로 Edge를 지정한 `node scripts/check_import_export.mjs` 흐름으로 Markdown 가져오기/내보내기, JSON 내보내기, JSON 가져오기 전 자동 백업, JSON 복원 결과 확인.

### 완료 처리

- Web/설치형 점검의 Markdown 가져오기와 내보내기 확인 완료.
- Web/설치형 점검의 JSON 백업과 복원 확인 완료.

## 2026-05-23 18:55 KST

### 다음 작업 시작

- Web/설치형 점검 중 PWA 배포 파일 생성과 실행 확인.

### 구현 내용

- `web/scripts/package_web.py` 추가.
- `web/README.md`에 PWA 배포 묶음 생성 명령과 산출물 위치 추가.
- `web/scripts/verify_web_surface.py`가 PWA 패키징 스크립트와 포함 파일 기준을 확인하도록 보강.
- `web/dist/`를 Git 추적 제외에 추가.
- `server/scripts/preflight.py`가 Web PWA 패키징 스크립트와 Git 추적 제외 기준을 확인하도록 보강.

### 검증

- `web/scripts/package_web.py` 실행으로 `web/dist/nownote-web-pwa/`와 `web/dist/nownote-web-pwa.zip` 생성 확인.
- `web/dist/nownote-web-pwa/`를 `http://127.0.0.1:8762/index.html`로 실행해 NowNote Web 화면 표시 확인.
- `manifest.webmanifest`와 `sw.js`가 배포 폴더에서 HTTP 200으로 응답하는지 확인.
- `web/scripts/verify_web_surface.py` 130/130 통과.

### 완료 처리

- Web/설치형 점검의 설치형 배포 파일 생성과 실행 확인 완료.

## 2026-05-23 18:35 KST

### 다음 작업 시작

- 1차 마무리 진행 상태를 현재 기준으로 정리.

### 확인 내용

- `scripts/release_readiness.py` 기준 현재 57개 중 17개 완료, 40개 남음.
- 남은 항목은 코드 작성보다 실제 Android 기기/에뮬레이터, WSL/Docker, 공용 도메인/HTTPS, Play Console, 라이선스 선택처럼 환경 또는 결정이 필요한 항목이 대부분.

### 구현 내용

- `docs/PROJECT_STATUS.md` 기준일을 2026-05-23으로 갱신.
- 현재 완료/남은 수치를 문서 상단에 추가.
- 남은 1차 마무리를 실제 실행 환경 필요, 운영 결정 필요, 등록 화면 확인 필요, 도구 한계로 보류 항목으로 재정리.

## 2026-05-23 18:22 KST

### 다음 작업 시작

- Google Play 등록 전 점검 중 로컬에서 확인 가능한 릴리스 빌드 항목 재점검.

### 확인 내용

- `adb.exe`는 `C:\Users\cyhuh\AppData\Local\Android\Sdk\platform-tools\adb.exe`에 있으나 연결된 에뮬레이터/기기는 없음.
- `android/upload-keystore.jks`와 `android/key.properties`는 로컬에 존재하며 Git 제외 상태.
- 기존 Play 사전 점검은 오래된 packaged release backup/data extraction 리소스 때문에 2개 실패.
- `android/hs_err_pid51984.log`에서 Gradle JVM `-Xmx8G`, `MaxMetaspaceSize=4G` 설정으로 네이티브 메모리 할당 실패 기록 확인.

### 구현 내용

- `now_app/android/gradle.properties`의 Gradle JVM 메모리를 `-Xmx2G`, `MaxMetaspaceSize=1G`, `ReservedCodeCacheSize=256m`로 낮춤.
- `org.gradle.workers.max=2`를 추가해 릴리스 빌드 중 동시 작업 수를 제한.
- `now_app/scripts/verify_mobile_surface.py`가 Gradle JVM 힙과 worker 제한 설정을 확인하도록 보강.

### 검증

- `NOWNOTE_SKIP_PUB=1` 상태에서 `android/build_release_aab.ps1` 실행 성공.
- 최신 `build/app/outputs/bundle/release/app-release.aab` 생성 성공.
- `android/check_play_release_inputs.ps1` 자동 실행 결과 Play release preflight 통과.
- 최신 릴리스 패키징 리소스에서 Android 자동 클라우드 백업 제외 규칙 반영 확인.

### 완료 처리

- Google Play 등록 전 점검의 실제 Android 서명 키 준비, 로컬 `key.properties` 준비, 서명된 AAB 빌드 완료.
- Google Play 세부 체크리스트의 최신 AAB 재빌드, 릴리스 AAB 빌드 성공, 최신 릴리스 패키징 리소스 백업 제외 반영 완료.

## 2026-05-23 18:03 KST

### 다음 작업 시작

- 남은 1차 마무리 항목 중 실제로 닫을 수 있는 항목 계속 점검.

### 확인 내용

- 정적 Web 서버 `http://127.0.0.1:8761/index.html` 응답 200 확인.
- 기존 Docker/WSL 서버로 보이는 `http://localhost:8750`은 health/API 응답은 정상이나, 브라우저 Origin 요청에 CORS 헤더가 없어 Web 화면의 연결 테스트가 `Failed to fetch`로 실패.
- 현재 소스 기준 서버를 `http://127.0.0.1:8751`에 로컬 실행하면 `Access-Control-Allow-Origin: *` 헤더가 붙고 Web 화면의 연결 테스트가 성공.
- 따라서 `8750` Docker/WSL 서버는 최신 소스로 재배포가 필요하며, 서버 재배포 체크리스트는 아직 완료 처리하지 않음.

### 완료 처리

- Web/설치형 점검의 `서버 연결 테스트 확인` 완료.

### 보류

- Markdown/JSON 실제 다운로드·가져오기는 Codex 내장 브라우저가 다운로드 이벤트와 파일 선택을 지원하지 않아 완료 처리하지 않음.
- WSL/Docker 재배포는 현재 Windows 작업 환경에서 `docker` 명령이 없고 WSL 배포판도 인식되지 않아 완료 처리하지 않음.

## 2026-05-22 12:51 KST

### 다음 작업 시작

- 1차 마무리 남은 항목을 명령 하나로 확인하는 상태 요약 보강.

### 확인 내용

- 남은 1차 항목 대부분은 실제 Android 기기, WSL/Docker 재배포, 도메인/HTTPS, Play Console, 라이선스처럼 사람이 직접 확인해야 하는 항목.
- 자동으로 완료 처리하지 않고, 체크리스트의 현재 상태를 요약 출력하는 방식이 안전함.

### 구현 내용

- `scripts/release_readiness.py` 추가.
- `README.md`에 1차 마무리 상태 요약 명령 추가.
- `server/scripts/preflight.py`가 release readiness 스크립트 존재와 README 안내를 확인하도록 보강.
- 루트 자동점검 스크립트 실행 시 생기는 `scripts/**/__pycache__/`도 Git 추적에서 제외하도록 `.gitignore`와 preflight 확인 항목 보강.

### 검증

- `scripts/release_readiness.py` 실행으로 1차 마무리 체크리스트 57개 중 13개 완료, 44개 남음 확인.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 616/616 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.
- `web/scripts/verify_web_surface.py` 124/124 통과.
- `now_app/scripts/verify_mobile_surface.py` 95/95 통과.
- `git diff --check` 통과.

## 2026-05-22 15:10 KST

### 다음 작업 시작

- GitHub Actions preflight 확인 가능성 보강.

### 확인 내용

- 최신 커밋 기준 GitHub status와 workflow run이 조회되지 않아 Actions 통과 항목은 완료 처리하지 않음.
- 자동 push/pull_request 실행은 유지하고, GitHub 화면에서 직접 실행할 수 있도록 수동 실행 트리거를 추가.

### 구현 내용

- `.github/workflows/preflight.yml`에 `workflow_dispatch` 추가.
- `docs/OPEN_SOURCE_RELEASE.md`에 자동 실행 결과가 보이지 않을 때 수동 실행하는 기준 추가.
- `server/scripts/preflight.py`가 GitHub Actions 수동 실행 트리거도 확인하도록 보강.

### 검증

- `server/scripts/preflight.py --env-file .env.example --allow-example` 613/613 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.
- `git diff --check` 통과.

## 2026-05-22 14:50 KST

### 다음 작업 시작

- 공개 저장소 오픈 전 라이선스 선택 준비 보강.

### 확인 내용

- GitHub 최신 커밋 `c74986e3d31aeb57622c6ba82fcaf393c8082d3e` 기준 status와 workflow run이 아직 조회되지 않아 GitHub Actions 통과 항목은 완료 처리하지 않음.
- 라이선스 자체는 법적 선택이므로 임의 선택하지 않고, 판단 기준만 문서화.

### 구현 내용

- `docs/LICENSE_DECISION.md` 추가.
- `README.md`와 `docs/OPEN_SOURCE_RELEASE.md`에 라이선스 선택 가이드 링크 추가.
- `server/scripts/preflight.py`에 라이선스 선택 가이드 존재와 핵심 판단 항목 확인 추가.
- `docs/PHASE1_RELEASE_CHECKLIST.md`에 라이선스 선택 가이드 준비 항목 완료 표시.

### 검증

- `server/scripts/preflight.py --env-file .env.example --allow-example` 612/612 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.
- `git diff --check` 통과.

## 2026-05-22 14:25 KST

### 다음 작업 시작

- Web/설치형 실제 실행 점검 준비 항목 보강.

### 확인 내용

- 실제 PWA 설치와 독립 창 실행은 브라우저 설치 상태가 필요하므로 자동 완료 처리하지 않음.
- 대신 1차 설치형 기준인 PWA 실행 점검 순서를 문서화하고, README와 자동 점검 스크립트에서 해당 문서가 빠지지 않도록 연결.

### 구현 내용

- `web/runtime_checklist_ko.md` 추가.
- `web/README.md`에 실제 실행 점검서 링크 추가.
- `web/scripts/verify_web_surface.py`에 Web/설치형 실제 실행 점검서 존재와 핵심 항목 확인 추가.
- `server/scripts/preflight.py`에 Web/설치형 실제 실행 점검서 확인 추가.
- `docs/PHASE1_RELEASE_CHECKLIST.md`에 Web/설치형 실제 실행 점검서 준비 항목 완료 표시.

### 검증

- `web/scripts/verify_web_surface.py` 124/124 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 602/602 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.

## 2026-05-22 14:05 KST

### 다음 작업 시작

- 모바일 앱 실제 실행 점검 준비 항목 보강.

### 확인 내용

- 실제 Android 에뮬레이터/실기기 실행은 화면과 기기 상태가 필요하므로 자동 완료 처리하지 않음.
- 대신 모바일 실제 점검 순서를 문서화하고, README와 자동 점검 스크립트에서 해당 문서가 빠지지 않도록 연결.

### 구현 내용

- `now_app/docs/mobile_runtime_checklist_ko.md` 추가.
- `now_app/README.md`에 실제 실행 점검서 링크 추가.
- `now_app/scripts/verify_mobile_surface.py`에 실제 실행 점검서 존재와 핵심 항목 확인 추가.
- `server/scripts/preflight.py`에 모바일 실제 실행 점검서 확인 추가.
- `docs/PHASE1_RELEASE_CHECKLIST.md`에 모바일 실제 실행 점검서 준비 항목 완료 표시.

### 검증

- `now_app/scripts/verify_mobile_surface.py` 95/95 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 589/589 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.

## 2026-05-22 13:40 KST

### 다음 작업 시작

- Web Markdown 가져오기/내보내기와 JSON 백업/복원 점검 항목 보강.

### 확인 내용

- 내장 브라우저 자동 조작은 파일 선택/입력 단계에서 현재 환경 제약이 있어 실제 완료 체크로 처리하지 않음.
- 대신 Web 표면 검증 스크립트가 Markdown/JSON 흐름의 핵심 코드 경로를 더 촘촘히 확인하도록 보강.

### 구현 내용

- `web/scripts/verify_web_surface.py`에 Markdown 내보내기, NowNote Markdown 가져오기, 일반 Markdown 주제 생성, 일자별 메모 병합, JSON 백업 다운로드, JSON 복원 전 사전 백업, 설정 복원, 성공 알림 확인 항목 추가.

### 검증

- `web/scripts/verify_web_surface.py` 109/109 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 576/576 통과.
- `scripts/verify_public_repo_safety.py` 8/8 통과.
- `git diff --check` 통과.

## 2026-05-22 13:10 KST

### 다음 작업 시작

- Web/설치형 서버 연결 테스트 확인 시도.

### 확인 내용

- 로컬 `http://localhost:8750/health`와 `/api/v1/server`는 PowerShell에서 정상 응답.
- Web 화면에서 `http://localhost:8750`, `http://127.0.0.1:8750` 모두 `Failed to fetch`로 실패.
- 현재 실행 중인 서버는 브라우저 fetch 기준 연결이 막혀 있어 체크리스트의 Web 서버 연결 테스트 항목은 완료 처리하지 않음.

### 구현 내용

- `web/README.md`에 `curl`은 성공하지만 Web 연결 테스트가 `Failed to fetch`인 경우의 점검 기준 추가.

### 검증

- `web/scripts/verify_web_surface.py` 89/89 통과.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 576/576 통과.
- `git diff --check` 통과.
- 단, 브라우저 기준 서버 연결 테스트는 현재 실행 중인 8750 서버 배포 상태에서 `Failed to fetch`가 재현되어 완료 처리하지 않음.

## 2026-05-22 12:32 KST

### 다음 작업 시작

- Web/설치형 실제 브라우저 흐름 점검.

### 확인 내용

- 내부 확인창이 `hidden` 상태여도 CSS 순서 때문에 계속 화면을 막는 문제 확인.
- 서비스 워커가 이전 CSS를 캐시하고 있어 Web 배포 시 캐시 버전 갱신이 필요함을 확인.
- 일자별 메모 입력은 저장되지만 사이드바의 오늘 메모 상태가 즉시 갱신되지 않는 문제 확인.

### 구현 내용

- `.confirm-backdrop.hidden` 스타일을 추가해 내부 확인창이 기본 상태에서 실제로 숨겨지도록 수정.
- `web/sw.js` 캐시 버전을 `nownote-web-v2`로 갱신.
- 일자별 메모 저장 시 `renderTodayMemoState()`를 호출해 오늘 메모 상태가 즉시 바뀌도록 수정.
- Web 정적 점검과 서버 preflight가 확인창 숨김 상태와 오늘 메모 상태 갱신 함수를 확인하도록 보강.
- 1차 마무리 체크리스트에서 Web 계층 메모, 일자별 메모, 검색/본문 찾기, 탭/단축키 흐름을 완료 표시.
- 확인 스크린샷 저장: `docs/screenshots/web-runtime-check-2026-05-22.png`.

### 검증

- 브라우저 실제 점검 통과: 주제 / 분류 / 메모 3단계 작성, 3단계 추가 제한, 본문 찾기, 통합 검색, 탭 고정, 삭제 보관함, 일자별 메모 입력, 설정/단축키 표시.
- `uv run python scripts\verify_web_surface.py` 통과: 89/89.
- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과: 576/576.
- `uv run python -m py_compile ...` 통과.
- `git diff --check` 통과.

## 2026-05-22 12:10 KST

### 다음 작업 시작

- 공개 저장소 오픈 전 문서/템플릿 확인 항목 마무리.

### 확인 내용

- 실제 GitHub Actions 실행 결과, 라이선스 선택, 실제 서명 키, 실제 도메인은 외부 환경 또는 신산님 결정이 필요해 임의 완료 처리하지 않음.
- README, SECURITY, CONTRIBUTING, 이슈/PR 템플릿은 현재 preflight가 존재와 핵심 문구를 확인하고 있어 완료 처리 가능함.

### 구현 내용

- `docs/OPEN_SOURCE_RELEASE.md` 추가.
- 루트 README 시작 위치에 공개 저장소 오픈 점검 문서 링크 추가.
- 1차 마무리 체크리스트에서 README/SECURITY/CONTRIBUTING/이슈/PR 템플릿 확인 항목을 완료 표시.
- 서버 preflight가 공개 저장소 오픈 점검 문서와 GitHub Actions의 공개 안전 검사 실행 여부를 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과: 573/573.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python -m py_compile ...` 통과.
- `git diff --check` 통과.

## 2026-05-22 11:45 KST

### 다음 작업 시작

- 공개 저장소 오픈 전 비밀값 포함 여부 자동 점검.

### 확인 내용

- Git 추적 목록 기준으로 `server/.env`, `now_app/android/key.properties`, `now_app/android/upload-keystore.jks` 같은 로컬 비밀 파일이 포함됐는지 확인할 수 있음.
- 텍스트 파일의 주요 토큰/비밀번호 할당값과 개인 키/API 키 패턴을 검사해 placeholder가 아닌 값이 들어오는 것을 막는 것이 안전함.

### 구현 내용

- `scripts/verify_public_repo_safety.py` 추가.
- GitHub Actions preflight에서 공개 저장소 안전 점검을 실행하도록 추가.
- 서버 preflight가 공개 저장소 안전 점검 스크립트와 핵심 검사 기준을 확인하도록 보강.
- 루트 README에 공개 전 비밀값 점검 명령 추가.
- 1차 마무리 체크리스트에서 실제 비밀값 Git 포함 여부 확인 항목을 완료 표시.

### 검증

- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python scripts\verify_web_surface.py` 통과: 87/87.
- `uv run python scripts\verify_mobile_surface.py` 통과: 83/83.
- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과: 560/560.
- `uv run python -m py_compile ...` 통과.
- `git diff --check` 통과.

## 2026-05-22 11:18 KST

### 다음 작업 시작

- Web 계층 메모 작성/삭제 보관함 브라우저 흐름 확인.

### 확인 내용

- 별도 포트 `http://127.0.0.1:8762/index.html`에서 주제 / 분류 / 메모 3단계 작성과 3단계 추가 제한은 DOM 기준 확인.
- 삭제 버튼 확인 과정에서 브라우저 기본 `confirm()` 창이 자동화 세션을 막는 문제 확인.
- NowNote Web은 이미 브라우저 기본 경고창 대신 앱 내부 안내를 쓰는 방향이므로, 삭제/복원/가져오기 확인 흐름도 앱 내부 확인창으로 통일하는 것이 맞음.

### 구현 내용

- `web/index.html`에 앱 내부 확인 모달 추가.
- `web/styles.css`에 확인 모달 스타일 추가.
- `web/app.js`의 모든 native `confirm()` 호출을 `confirmAction()` 기반 앱 내부 확인창으로 교체.
- Web 정적 점검과 서버 preflight가 native `confirm()` 재도입을 막도록 보강.

### 검증

- `web/scripts/verify_web_surface.py` 통과: 87/87.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과: 552/552.
- `py_compile` 통과.
- `git diff --check` 통과.
- 계층 메모 실제 삭제 보관함 완료 표시는 새 브라우저 세션에서 재확인 후 처리.

## 2026-05-22 10:42 KST

### 다음 작업 시작

- PWA 설치 골격 추가 후 실제 브라우저 실행 확인.

### 확인 내용

- Web 화면을 `http://127.0.0.1:8761/index.html`에서 실행.
- 브라우저 DOM에서 `manifest.webmanifest`, 설치 아이콘, 지식 메모 목록, 작성 영역, 일자별 메모 팝업, 설정 화면, 토스트 영역 로드 확인.
- `index.html`, `manifest.webmanifest`, `sw.js`, `icons/nownote-icon.svg`가 로컬 HTTP 서버에서 200 응답을 반환하는지 확인.
- 확인 스크린샷 저장: `docs/screenshots/web-pwa-runtime-2026-05-22.png`.

### 구현 내용

- 1차 마무리 체크리스트에서 Web 화면 브라우저 실행 항목을 완료 표시.

### 검증

- 브라우저 DOM 확인 통과.
- PWA 관련 파일 HTTP 200 확인.

## 2026-05-22 10:15 KST

### 다음 작업 시작

- Web/설치형 1차 마무리 중 설치형 포장 방식 확정.

### 확인 내용

- 실제 Windows/macOS/Linux 설치 파일 생성은 별도 빌드 도구 선택과 검증이 필요하므로 임의 완료 처리하지 않음.
- 1차 기준에서는 현재 Web 화면을 유지하면서 브라우저 설치가 가능한 PWA 구조를 먼저 확정하는 것이 안전함.

### 구현 내용

- `web/manifest.webmanifest` 추가.
- `web/sw.js` 추가.
- `web/icons/nownote-icon.svg` 추가.
- `web/index.html`에 manifest, icon, service worker 등록 추가.
- `web/README.md`에 1차 설치형 포장 기준을 PWA 설치로 명시.
- Web 정적 점검과 서버 preflight가 PWA 설치 골격을 확인하도록 보강.
- 1차 마무리 체크리스트에서 설치형 포장 방식 확정 항목을 완료 표시.

### 검증

- `web/scripts/verify_web_surface.py` 통과: 83/83.
- `now_app/scripts/verify_mobile_surface.py` 통과: 83/83.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과: 548/548.
- `py_compile` 통과.
- `git diff --check` 통과.

## 2026-05-21 16:43 KST

### 다음 작업 시작

- 모바일 1차 마무리 항목 중 자동 점검 가능한 화면/서비스/권한 검증 추가.

### 확인 내용

- 실제 Android 에뮬레이터와 기기 테스트 전에 모바일 앱의 핵심 진입점, 일자별 메모, 계층 메모, 음성 입력, 서버 연결, 권한/패키지명 누락을 정적으로 확인할 수 있음.
- 실제 기기 실행과 권한 허용 흐름은 사람이 확인해야 하지만, 기본 소스 누락은 CI에서 먼저 잡는 것이 안전함.

### 구현 내용

- `now_app/scripts/verify_mobile_surface.py` 추가.
- GitHub Actions preflight에서 mobile surface verification을 실행하도록 추가.
- `now_app/README.md`에 모바일 정적 점검 명령 추가.
- `.gitignore`에 모바일 Python cache 산출물 무시 규칙 추가.
- 1차 마무리 체크리스트에서 모바일 핵심 화면/서비스/권한 정적 점검 스크립트 준비 항목을 완료 표시.

### 검증

- `now_app/scripts/verify_mobile_surface.py` 통과: 83/83.
- `web/scripts/verify_web_surface.py` 통과: 61/61.
- `server/scripts/preflight.py --env-file .env.example --allow-example` 통과: 536/536.
- `py_compile` 통과.
- `git diff --check` 통과.

## 2026-05-21 16:22 KST

### 다음 작업 시작

- Web/설치형 1차 마무리 항목 중 자동 점검 가능한 화면 요소 검증 추가.

### 확인 내용

- Web/설치형 체크리스트에는 실제 브라우저 실행과 설치형 포장처럼 사람이 확인해야 하는 항목이 있음.
- 그 전에 핵심 HTML 요소, JS 기능, CSS 스타일, README 설명이 빠졌는지 자동으로 확인하는 정적 점검은 바로 추가 가능함.

### 구현 내용

- `web/scripts/verify_web_surface.py` 추가.
- GitHub Actions preflight에서 Web surface verification을 실행하도록 추가.
- `web/README.md`에 Web/설치형 화면 정적 점검 명령 추가.
- Web 정적 점검 실행 중 생기는 Python cache 산출물이 Git에 잡히지 않도록 `.gitignore` 보강.
- 1차 마무리 체크리스트에서 Web/설치형 핵심 화면 요소 정적 점검 스크립트 준비 항목을 완료 표시.

### 검증

- `uv run python scripts\verify_web_surface.py` 통과. 61/61 checks.
- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 525/525 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py ..\web\scripts\verify_web_surface.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 16:03 KST

### 다음 작업 시작

- 남은 1차 마무리 항목을 실제 확인용 체크리스트로 분리.

### 확인 내용

- 남은 항목에는 실제 Android 기기, 실제 WSL/Docker 서버, 실제 도메인, 실제 서명 키, Play Console 값, 라이선스 선택처럼 임의로 완료 처리하면 안 되는 항목이 포함됨.
- 누락을 막으려면 현재 상태 문서보다 더 구체적인 완료 체크리스트가 필요함.

### 구현 내용

- `docs/PHASE1_RELEASE_CHECKLIST.md` 추가.
- 루트 README와 `docs/PROJECT_STATUS.md`에서 1차 마무리 체크리스트를 연결.
- preflight가 체크리스트의 모바일, Web/설치형, 서버 재배포, 공용 서버, Google Play, 공개 저장소, 라이선스, 서명 키, smoke test 항목을 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 514/514 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

## 2026-05-21 15:47 KST

### 다음 작업 시작

- 설계 대비 현재 상태를 빠르게 확인할 수 있는 현황 문서 추가.

### 확인 내용

- `docs/WORK_PROGRESS.md`는 전체 작업 이력을 담고 있어 현재 상태만 빠르게 보기에는 길어졌음.
- 공개 저장소 첫 방문자와 작업 재개 시점에는 1차 목표 대비 완료/남은 항목을 짧게 보는 문서가 필요함.

### 구현 내용

- `docs/PROJECT_STATUS.md` 추가.
- 루트 README의 시작 위치 목록에 현재 진행 상태 문서 링크 추가.
- preflight가 프로젝트 현황 문서의 핵심 항목과 README 연결을 확인하도록 보강.

### 검증

- `uv run python scripts\preflight.py --env-file .env.example --allow-example` 통과. 501/501 checks.
- `uv run python -m py_compile scripts\preflight.py scripts\smoke_test.py` 통과.
- `git diff --check` 통과.

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

## 2026-05-25 00:00 KST

### 다음 작업 시작

- 모바일 실제 점검 항목을 완료 처리하기 전에 에뮬레이터/실기기/서버 준비 상태를 자동으로 확인하는 보조 도구 추가.

### 구현 내용

- `now_app/scripts/check_android_runtime.py` 추가.
- Flutter CLI, ADB, 연결된 Android 기기, 에뮬레이터/AVD, 로컬 서버 health/ready 응답을 한 번에 확인하도록 구성.
- 에뮬레이터 서버 주소 `http://10.0.2.2:8750`, 실제 기기 서버 주소 기준, `flutter run -d` 실행 대상을 출력하도록 구성.
- 모바일 README와 실제 실행 점검서에 실행 전 환경 점검 명령을 추가.
- 모바일 정적 점검과 서버 preflight가 새 런타임 점검 스크립트 존재와 문구를 확인하도록 확장.

### 보류

- 현재 연결된 Android 에뮬레이터/실기기가 없으면 실제 실행 완료 처리는 하지 않는다.

### 검증

- `uv run python -m py_compile now_app\scripts\check_android_runtime.py now_app\scripts\verify_mobile_surface.py server\scripts\preflight.py` 통과.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 108/108.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 636/636.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python now_app\scripts\check_android_runtime.py --timeout 5` 실행 결과, Flutter/ADB/AVD/로컬 서버는 확인됐고 연결된 Android device 상태 기기가 없어 실제 모바일 점검 완료 처리는 보류.

## 2026-05-25 00:20 KST

### 다음 작업 시작

- 공개 저장소 체크리스트의 GitHub Actions preflight 통과 확인을 실제 결과 기준으로 분리.

### 확인 내용

- GitHub 커넥터 기준 최신 커밋 `911fae8`에는 status와 workflow run이 아직 조회되지 않음.
- 따라서 `GitHub Actions preflight 통과 확인` 항목은 완료 처리하지 않음.

### 구현 내용

- `scripts/check_github_actions_status.py` 추가.
- 공개 저장소 또는 `GITHUB_TOKEN`이 설정된 비공개 저장소에서 `preflight.yml` 최신 실행 상태와 성공 결론을 확인하도록 구성.
- 공개 저장소 오픈 점검 문서에 GitHub Actions 상태 확인 명령을 추가.
- GitHub Actions preflight가 새 상태 확인 스크립트의 문법도 확인하도록 보강.
- 서버 preflight가 새 스크립트와 문서 연결을 확인하도록 확장.

## 2026-05-25 00:55 KST

### 다음 작업 시작

- Android 에뮬레이터에서 모바일 1차 주요 흐름을 실제 화면 기준으로 확인.

### 확인 내용

- 에뮬레이터 `Medium_Phone_API_36.1`에서 `com.sinsan.nownote` 실행 확인.
- 홈 화면의 `오늘 메모 남기기`로 일자별 메모를 작성하고, 홈 `오늘 메모` 카드에 반영되는 흐름 확인.
- 같은 날짜 메모에 추가 작성 시 하나의 일자별 메모장에 이어서 저장되는 흐름 확인.
- 계층 메모 화면에서 부모메모, 자식메모, 손자메모 3단계 작성 확인.
- 하위 메모가 있는 부모/자식 메모는 삭제 버튼이 `하위 메모가 있어 삭제 불가` 상태로 비활성화됨을 확인.
- 기존 구현에서 3단계 손자메모에도 추가 버튼이 보이는 것을 확인하고, 3단계에서는 추가 버튼을 숨기도록 수정.
- 수정 후 에뮬레이터에 재설치하여 손자메모에는 `서버 분석`과 `삭제`만 보이는 것을 확인.

### 구현 내용

- `now_app/lib/features/meeting/memo_tree_page.dart`: 계층 메모 추가 버튼을 1, 2단계에서만 렌더링하도록 제한.
- `now_app/scripts/verify_mobile_surface.py`: 계층 메모 3단계 제한 검사를 새 기준에 맞게 조정.
- `now_app/test/llm/base_llm_repository_test.dart`: 기존 테스트 더미의 `extractItems` 시그니처를 현재 인터페이스와 일치시킴.

### 검증

- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 108/108.
- `dart analyze lib\features\meeting\memo_tree_page.dart test\llm\base_llm_repository_test.dart` 통과. 기존 `use_build_context_synchronously` info 1건은 남아 있음.
- `flutter test test\llm\base_llm_repository_test.dart` 통과.
- 수정 앱을 에뮬레이터에 재설치하고 계층 메모 3단계 버튼 미노출 확인.

### 보류

- 에뮬레이터 `/data`가 92% 사용 중이라 Flutter 설치 마지막 단계에서 저장공간 부족 경고가 다시 표시됨. 앱 설치와 실행은 확인됐지만, 에뮬레이터 정리는 별도 작업으로 남김.
- 실제 Android 기기, 음성 실시간 변환, 녹음 후 변환, 서버 동기화, 녹음 업로드는 아직 완료 처리하지 않음.

## 2026-05-25 10:55 KST

### 다음 작업 시작

- Android 에뮬레이터에서 모바일 서버 연결 테스트와 메모 동기화 흐름을 실제 화면 기준으로 확인.

### 확인 내용

- 로컬 서버 `http://127.0.0.1:8750/health` 응답 정상 확인.
- 에뮬레이터 앱 설정의 서버 주소는 Android 에뮬레이터 호스트 접근 주소 `http://10.0.2.2:8750` 기준으로 확인.
- 앱의 `연결 테스트` 버튼 실행 후 `NowNote Local Server 연결됨` 결과와 서버 capability/운영 점검 정보 표시 확인.
- 앱의 `메모 동기화` 버튼 실행 후 마지막 동기화 시각 `2026-05-25 10:50:13` 표시 확인.
- 서버 `/api/v1/admin/export/notes` 기준 메모 14건 노출 확인.

### 문서 반영

- 모바일 실제 점검 체크리스트의 `서버 연결 테스트 확인`, `서버 동기화 확인` 완료 처리.
- 설계 대비 현재 상태를 57개 중 26개 완료, 31개 남음으로 갱신.

### 보류

- 실제 Android 기기, 음성 실시간 변환, 음성 녹음 후 변환, 녹음 업로드 상태 확인은 아직 완료 처리하지 않음.

## 2026-05-25 11:05 KST

### 다음 작업 시작

- 남은 1차 항목 중 자동으로 더 닫을 수 있는 항목과 실제 환경이 필요한 항목을 재확인.

### 확인 내용

- `uv run python scripts\release_readiness.py` 기준 현재 57개 중 26개 완료, 31개 남음.
- 최신 커밋 기준 GitHub status와 workflow run은 GitHub 커넥터에서 아직 조회되지 않음.
- `scripts\check_github_actions_status.py --repo cyhuh428-sinsan/Now --branch main`은 GitHub API workflow run 조회에서 404를 반환해 완료 처리하지 않음.
- Windows 현재 환경에서는 WSL 배포판이 인식되지 않고 `docker` 명령도 없어 서버 재배포 점검 완료 처리는 보류.

### 검증

- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 108/108.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.

### 보류

- 실제 Android 기기, 음성 실시간 변환, 음성 녹음 후 변환, 녹음 업로드 상태 확인은 실제 입력/기기 조건이 필요해 완료 처리하지 않음.
- 공용 서버 도메인/HTTPS/reverse proxy, Play Console 최종값, 오픈소스 라이선스 선택은 신산님 결정 또는 외부 운영 환경 확정이 필요함.

## 2026-05-25 11:15 KST

### 다음 작업 시작

- Google Play 등록용 이미지 자산과 릴리스 입력 점검 상태 재확인.

### 확인 내용

- `now_app\android\check_play_release_inputs.ps1` 실행 결과 Play release preflight 통과.
- 업로드 키/`key.properties` Git 제외, 알림 권한, `CAPTURE_AUDIO_OUTPUT` 제거, 백업 제외 규칙, Play 이미지 파일 존재 확인이 모두 통과.
- `now_app\docs\play_assets`에는 앱 아이콘, 기능 그래픽, 휴대전화 스크린샷 4장이 존재함.
- 이미지 README에는 현재 파일을 임시 등록용 초안으로 보고 최종 제출 전 실기기 캡처 이미지로 교체하는 것을 권장한다고 명시되어 있음.

### 보류

- `스크린샷과 기능 그래픽 최종 확인`은 파일 존재 확인만으로 닫지 않음.
- 실제 Play Console 제출 이미지로 사용할지, 실기기 캡처로 교체할지는 최종 판단이 필요함.

## 2026-05-25 11:25 KST

### 다음 작업 시작

- GitHub Actions 통과 확인이 보류되는 상황의 안내 메시지와 공개 저장소 문서 보완.

### 구현 내용

- `scripts\check_github_actions_status.py`에서 GitHub API 404 응답을 원문 JSON 대신 운영자가 이해하기 쉬운 안내로 표시하도록 수정.
- `docs\OPEN_SOURCE_RELEASE.md`에 404가 발생할 때 확인할 항목과 수동 실행 기준을 추가.

### 검증

- `uv run python -m py_compile scripts\check_github_actions_status.py` 통과.
- `uv run python scripts\check_github_actions_status.py --repo cyhuh428-sinsan/Now --branch main` 실행 시 Actions 미확인 상태를 친절한 404 안내로 표시.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.

### 보류

- 최신 커밋 기준 GitHub status와 workflow run은 여전히 조회되지 않아 `GitHub Actions preflight 통과 확인`은 완료 처리하지 않음.

## 2026-05-25 12:55 KST

### 다음 작업 시작

- Android 에뮬레이터에서 메모 음성 입력 화면의 진입/종료 흐름을 점검.

### 확인 내용

- 홈의 `오늘 메모 남기기`에서 메모 입력 화면 진입 확인.
- 메모 입력 화면에서 `실시간 변환`, `녹음 후 변환`, `음성으로 간단 메모 시작` 노출 확인.
- 실시간 변환으로 메모 기록 세션에 진입하고 타이머가 올라가는 흐름 확인.
- 실제 음성 입력이 없어 텍스트 변환 결과는 확인하지 못했으므로 `음성 메모 실시간 변환 확인`은 완료 처리하지 않음.
- 종료 확인 창에서 메모인데 `총 0개의 발언이 기록되었습니다`라고 표시되는 회의 용어 잔여 문제 발견.

### 구현 내용

- 메모 기록 종료 확인 창의 요약 문구를 `메모 내용` 기준으로 변경.
- 메모 분석 중 로딩 문구를 `메모 분석 중`, `메모 내용 분석 중`으로 변경.
- 메모 기록 화면 나가기 확인 문구를 `메모를 나가시겠습니까?`로 변경.
- 메모 기록 입력창 hint를 `메모 내용을 입력하세요`로 변경.
- 모바일 표면 검증에 메모 종료 문구와 메모 입력 hint 회귀 방지 체크 추가.

### 검증

- `dart format lib\features\meeting\meeting_progress_page.dart` 실행 후 포맷 변경이 과도하게 섞인 것을 확인.
- 앱 파일은 원복 후 메모 용어 수정만 최소 범위로 재적용.
- `uv run python -m py_compile now_app\scripts\verify_mobile_surface.py` 통과.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- 최소 diff 재적용 후 `uv run python now_app\scripts\verify_mobile_surface.py` 재통과: 110/110.
- 최소 diff 재적용 후 `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 재통과: 643/643.
- 최소 diff 재적용 후 `git diff --check` 통과.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `dart analyze lib\features\meeting\meeting_progress_page.dart`는 기존 경고/정보 28건으로 종료코드 1. 이번 변경의 `use_build_context_synchronously` 정보는 `mounted` 확인 추가로 제거.

### 보류

- 새 앱 빌드/실행 명령은 5분 제한에 걸려 중단됐고, 남은 Dart development-service 프로세스는 정리함.
- 앱을 force-stop 후 재시작해 에뮬레이터 UI 자동화가 다시 정상 덤프되는 것까지 확인.
- 실제 음성 인식 결과와 녹음 후 변환, 녹음 업로드 상태는 실제 음성/STT 조건이 필요해 완료 처리하지 않음.

## 2026-05-25 22:17 KST

### 다음 작업 시작

- 로컬에서 접근 가능한 8750 서버의 최신 배포 여부와 smoke 실패 원인 확인.

### 확인 내용

- Windows 현재 환경에서 `docker`와 `docker-compose` 명령은 찾지 못함.
- `wsl.exe`는 존재하지만 배포판 목록이 정상적으로 확인되지 않아 WSL 배포 경로에서 재배포 명령을 직접 완료하지 못함.
- `curl http://localhost:8750/health`, `/health/ready`, `/api/v1/server`, `/admin` 응답은 확인됨.
- 현재 떠 있는 8750 서버의 `/api/v1/server` 응답에는 최신 소스의 `public_server_readiness`, `backup_export`, `backup_verify`, `user_accounts` 등 capability가 없어 오래된 배포본으로 판단.

### 구현 내용

- `server\scripts\smoke_test.py`에서 `/api/v1/server` 응답에 `public_server_readiness`가 없을 때 오래된 배포본 가능성과 재배포 명령을 함께 안내하도록 보강.
- `server\README.md`와 `server\DEPLOY.md`에 최신 capability 누락 시 `git pull origin main`과 compose 재기동을 확인하라는 안내 추가.

### 검증

- `uv run python -m py_compile server\scripts\smoke_test.py` 통과.
- `uv run python server\scripts\smoke_test.py --base-url http://localhost:8750` 실행 시 오래된 서버 배포본 가능성과 현재 capability 목록을 명확히 표시하는 실패 메시지 확인.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- 실제 WSL/Linux 배포 경로에서 `git pull origin main`, compose 재기동, smoke 통과는 이 세션에서 WSL 배포판이 정상 인식되지 않아 완료 처리하지 않음.

## 2026-05-25 22:25 KST

### 다음 작업 시작

- 최신 push 후 GitHub Actions preflight 상태 재확인.

### 확인 내용

- 최신 커밋: `ad6e30d fix: clarify stale server smoke failure`.
- `.github\workflows\preflight.yml`에는 `NowNote Preflight` workflow와 `push`, `pull_request`, `workflow_dispatch` 트리거가 존재함.
- `uv run python scripts\check_github_actions_status.py --repo cyhuh428-sinsan/Now --branch main`은 여전히 GitHub API 404 안내를 반환.
- GitHub 연결 도구로 최신 커밋 workflow run과 combined status를 확인했지만 둘 다 비어 있음.

### 보류

- GitHub Actions 자체가 아직 실행되지 않았거나 저장소 Actions 설정/권한 문제로 run이 생성되지 않은 상태로 판단.
- `GitHub Actions preflight 통과 확인`은 완료 처리하지 않음.

## 2026-05-25 22:35 KST

### 다음 작업 시작

- 최근 확인된 메모 음성 기록 화면의 Dart analyzer 경고/정보 정리.

### 구현 내용

- `now_app\lib\features\meeting\meeting_progress_page.dart`의 사용되지 않는 `_lastSpeechTime` 필드와 대입 제거.
- Whisper 임시 파일 삭제 실패 무시 처리를 `catchError`에서 `try/catch`로 변경.
- 문자열 결합, 지역 변수명, 색상 alpha 표현을 analyzer 권장 형태로 정리.
- `speech_to_text` 호출을 `SpeechListenOptions` 기반으로 변경.
- 공유 호출을 `Share.share`에서 `SharePlus.instance.share(ShareParams(...))`로 변경.

### 검증

- `dart analyze lib\features\meeting\meeting_progress_page.dart` 통과: No issues found.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 영향 범위

- 메모/회의 기록 화면 내부의 정적 경고 정리이며, 녹음 저장 구조나 서버 동기화 API는 변경하지 않음.

## 2026-05-25 22:43 KST

### 다음 작업 시작

- Android 런타임 점검 가능 상태 재확인.

### 확인 내용

- `uv run python now_app\scripts\check_android_runtime.py --timeout 5 --require-server` 통과.
- ADB에서 `emulator-5554`가 `device` 상태로 확인됨.
- 로컬 서버 `http://127.0.0.1:8750`의 health/ready는 HTTP 200.
- 실제 Android 기기는 연결되지 않아 실기기 항목은 여전히 보류.

### 보류

- 현재 8750 서버는 실행 중이지만 최신 capability가 빠진 오래된 배포본이므로 서버 재배포 체크리스트는 완료 처리하지 않음.

## 2026-05-25 22:44 KST

### 다음 작업 시작

- 모바일 앱 전체 Dart analyzer warning 정리.

### 구현 내용

- 사용되지 않는 import, 중복 import, 사용되지 않는 지역 변수/필드/메서드를 제거.
- capture STT 호출을 `SpeechListenOptions` 기반으로 변경.
- null이 아닌 값에 붙은 불필요한 `!` 제거.
- 일부 문자열 결합과 `withOpacity` 사용을 analyzer 권장 형태로 정리.

### 검증

- `dart analyze` 실행 결과 warning/error는 모두 제거됐고, info 92건만 남음.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- 남은 info는 deprecation, `withOpacity`, async context, print, const 권장 등 넓은 코드 정리 항목이므로 기능별로 나누어 계속 처리 예정.

## 2026-05-25 22:48 KST

### 다음 작업 시작

- 모바일 앱 전체 Dart analyzer info 중 동작 변경 위험이 낮은 정적 정리 항목 추가 처리.

### 범위

- 색상 alpha 표현, 문자열 interpolation, `const` 권장, 한 줄 제어문 중괄호처럼 화면 동작과 저장 구조를 바꾸지 않는 항목만 우선 처리.

### 구현 내용

- 모바일 앱 전체의 `withOpacity` 사용을 `withValues(alpha: ...)`로 정리.
- 단순 문자열 interpolation, `const` 생성자, 한 줄 제어문 중괄호를 analyzer 권장 형태로 정리.
- `Switch` 계열에서만 안전한 `activeThumbColor` 변경을 적용하고, `RadioListTile` 계열은 현재 Flutter API와 맞지 않아 기존 `activeColor` 유지.

### 검증

- `dart analyze` 실행 결과 warning/error는 없고, info 33건만 남음.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- 남은 info는 async context, RadioGroup API 전환, print 로깅 정리처럼 동작 영향 검토가 필요한 항목이라 별도 단위로 처리 예정.

## 2026-05-25 23:03 KST

### 다음 작업 시작

- 모바일 앱 Dart analyzer info 중 `avoid_print` 항목 정리.

### 범위

- 디버그 출력만 로깅 호출로 교체하고, 동기화/LLM 처리 흐름은 변경하지 않음.

### 구현 내용

- LLM 설정 화면의 모델 목록 로드 실패 출력은 `debugPrint`로 변경.
- Ollama 연결/모델 조회 실패 출력은 Dart 표준 `developer.log`로 변경.
- 로컬 캘린더 동기화 진행 출력은 `developer.log`로 변경.

### 검증

- `dart analyze` 실행 결과 warning/error는 없고, info 16건만 남음.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- 남은 info는 async context와 Flutter RadioGroup/FormField deprecation 항목이라 별도 검토 후 처리 예정.

## 2026-05-25 23:09 KST

### 다음 작업 시작

- 모바일 앱 Dart analyzer info 중 `use_build_context_synchronously` 항목 정리.

### 범위

- `await` 이후 `BuildContext`를 사용하는 위치에 `mounted`/`context.mounted` 가드를 추가.
- 저장 순서, 동기화 API, 화면 이동 경로 자체는 변경하지 않음.

### 구현 내용

- 건강/패션/날씨/식사 LLM 분석 화면에서 LLM repository 로드 이후 `mounted` 가드 추가.
- 일정 편집 저장 후 dialog context와 State mounted 상태를 확인한 뒤 닫기/갱신하도록 보강.
- 회의 추출 저장과 계층 메모 저장 흐름에서 업로드/화면 이동 전 context mounted 가드 추가.
- Flutter 신규 RadioGroup API로 LLM/STT 라디오 선택 UI를 전환.
- Dropdown 초기값 deprecation 항목을 `initialValue`로 전환.

### 검증

- `dart analyze` 실행 결과 `No issues found!`.
- `uv run python now_app\scripts\verify_mobile_surface.py` 통과: 110/110.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 643/643.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- release readiness 남은 항목은 실기기 테스트, WSL/Docker 실제 재배포, 공용 도메인/HTTPS, Play Console, 라이선스 선택처럼 외부 실행 또는 사용자 결정이 필요한 항목임.

## 2026-05-25 23:52 KST

### 다음 작업 시작

- 1차 마무리 잔여 항목 중 WSL/Docker/실행 서버 상태 확인 보조 도구 추가.

### 구현 내용

- `scripts\local_environment_status.py` 추가.
- Git 작업트리, WSL 실행 가능 여부, Docker CLI, `/health`, `/health/ready`, `/api/v1/server` capability를 한 번에 점검하도록 구성.
- 현재 실행 중인 서버가 최신 capability를 갖추지 못한 경우 오래된 배포본 가능성과 누락 capability를 표시하도록 구성.
- 루트 `README.md`, `docs\PROJECT_STATUS.md`, `server\DEPLOY.md`에 환경 점검 도구 사용 위치를 기록.

### 확인 내용

- 현재 Codex 세션 기준 `docker` 명령은 찾을 수 없음.
- `http://localhost:8750`의 health/ready는 정상이지만 `backup_export`, `backup_verify`, `user_accounts`, `public_server_readiness` 등 최신 capability가 없어 오래된 배포본으로 판단.
- `uv run python -m py_compile scripts\local_environment_status.py` 통과.

### 보류

- 실제 WSL 배포 경로에서 `git pull origin main`, compose 재기동, smoke test 통과 여부는 사용자의 WSL/Docker 환경에서 직접 확인되어야 하므로 체크리스트 완료 처리하지 않음.

## 2026-05-26 00:14 KST

### 다음 작업 시작

- 로컬 환경 점검 스크립트를 CI와 서버 프리플라이트 범위에 연결.

### 범위

- 새 기능 동작은 변경하지 않고, 공개/배포 전 누락을 잡는 검증 경로만 보강.
- 실제 WSL/Docker 재배포 완료 처리는 하지 않음.

### 구현 내용

- GitHub Actions preflight의 Python syntax check 대상에 `scripts\local_environment_status.py` 추가.
- `server\scripts\preflight.py`에서 로컬 환경 점검 스크립트 존재 여부, README/PROJECT_STATUS 문서화, workflow 연결 여부를 확인하도록 추가.

### 검증

- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 647/647.
- `uv run python -m py_compile server\scripts\preflight.py scripts\local_environment_status.py` 통과.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- GitHub Actions 실제 통과 여부는 GitHub 쪽 workflow run이 잡힌 뒤 확인해야 함.
- WSL/Docker 서버 재배포는 사용자 환경에서 최신 코드를 받은 뒤 별도 확인 필요.

## 2026-05-26 00:27 KST

### 다음 작업 시작

- 설계 대비 현황판의 최신 검증 수치와 로컬 환경 상태 갱신.

### 구현 내용

- `docs\PROJECT_STATUS.md` 기준일을 2026-05-26으로 갱신.
- 서버 프리플라이트 통과 수치를 647/647로 갱신.
- GitHub Actions workflow run/status가 아직 잡히지 않은 상태를 명시.
- WSL은 Ubuntu 실행 가능하지만 현재 Windows 세션에는 `docker` 명령이 없어 서버 재배포 완료 처리는 보류한다고 정정.

### 확인 내용

- GitHub 커넥터 기준 최신 커밋의 workflow run 목록은 비어 있음.
- GitHub commit status 목록도 비어 있음.

## 2026-05-26 00:42 KST

### 다음 작업 시작

- WSL/Linux 서버 재배포 점검을 사람이 여러 명령으로 나누어 실행하지 않아도 되도록 배포 도우미 추가.

### 범위

- 기존 API, DB, 동기화, 모바일/Web 동작은 변경하지 않음.
- 서버 갱신 절차를 보조하는 shell script와 문서/프리플라이트 점검 기준만 추가.

### 구현 내용

- `server\scripts\deploy_local.sh` 추가.
- 소스 갱신, `.env` 존재 확인, preflight, 선택형 public preflight, Docker Compose 재기동, `/health/ready` 대기, smoke test를 순서대로 실행하도록 구성.
- `.env`의 `NOW_API_TOKEN`을 읽어 smoke test에 자동 전달하도록 구성.
- `--base-url`, `--public-server`, `--skip-pull`, `--timeout`, `--ready-retries`, `--ready-delay` 옵션 추가.
- 루트 `README.md`, `server\README.md`, `server\DEPLOY.md`에 빠른 갱신 명령 추가.
- `server\scripts\preflight.py`가 배포 도우미 존재와 핵심 동작 문구를 확인하도록 보강.
- GitHub Actions preflight에 `sh -n server/scripts/deploy_local.sh` 문법 점검 단계 추가.

### 검증

- WSL `sh -n` 문법 점검 통과. 단, 현재 WSL은 작업 디렉터리 `D:\Project\Now` 변환 경고가 있어 파일 경로 직접 실행 대신 stdin 방식으로 점검함.
- WSL `sh` 도움말 실행 통과.
- `uv run python -m py_compile server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 664/664.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `git diff --check` 통과.

### 보류

- 실제 `sh scripts/deploy_local.sh` 실행은 Docker가 있는 WSL/Linux 배포 환경에서 확인해야 하므로 체크리스트 완료 처리는 하지 않음.

## 2026-05-26 01:03 KST

### 다음 작업 시작

- 로컬 환경 점검 스크립트가 WSL/Docker 상태를 더 정확히 구분하도록 보강.

### 구현 내용

- `scripts\local_environment_status.py`가 WSL shell 실행 여부와 현재 Windows 작업 경로의 `/mnt/...` 접근 가능 여부를 따로 확인하도록 수정.
- Windows Docker가 없어도 WSL 내부 `docker` 또는 `docker-compose`를 확인하도록 수정.

### 검증

- `uv run python scripts\local_environment_status.py --base-url http://localhost:8750` 실행 결과 WSL shell은 가능하지만 `/mnt/d/Project/Now` 경로 확인 경고가 표시됨.
- 같은 실행에서 WSL Docker `29.1.3` 확인.
- 실행 중인 `http://localhost:8750` 서버는 health/ready 정상이지만 최신 capability 누락으로 오래된 배포본 가능성 경고 유지.
- `uv run python -m py_compile scripts\local_environment_status.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 664/664.
- `git diff --check` 통과.

## 2026-05-26 01:20 KST

### 다음 작업 시작

- Google Play 등록 전 남은 항목을 자동 확인과 Play Console 수동 확인으로 분리해 볼 수 있는 상태 요약 도구 추가.

### 범위

- 앱 코드와 Play Console 값 자체는 변경하지 않음.
- 등록 자료, 이미지, 로컬 릴리스 파일, 민감 파일 Git 제외 여부를 읽기 전용으로 확인.

### 구현 내용

- `scripts\play_release_status.py` 추가.
- Play 등록 문서, 개인정보처리방침 초안/공개 페이지, Play 이미지, 로컬 릴리스 파일, `key.properties`/업로드 키 Git 제외 여부를 점검.
- `docs\PHASE1_RELEASE_CHECKLIST.md`의 Google Play 섹션을 읽어 수동으로 남은 항목을 표시.
- 루트 `README.md`에 실행 명령 추가.
- GitHub Actions Python 문법 검사 대상에 `play_release_status.py` 추가.
- 서버 preflight가 Play 상태 요약 스크립트와 핵심 점검 기준을 확인하도록 보강.

### 검증

- `uv run python scripts\play_release_status.py --show-manual` 통과: 자동 확인 21/21 OK, 경고 0, 수동 확인 9개.
- `uv run python -m py_compile scripts\play_release_status.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 675/675.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `git diff --check` 통과.

## 2026-05-26 11:29 KST

### 다음 작업 시작

- 남은 31개 항목 중 현재 환경에서 실제로 닫을 수 있는 항목을 재점검.

### 확인 내용

- `uv run python scripts\release_readiness.py` 기준 26/57 완료, 31개 남음 유지.
- `uv run python now_app\scripts\check_android_runtime.py` 기준 에뮬레이터는 보이나 실제 USB Android 기기는 연결되지 않음.
- `wsl.exe -l -v` 기준 사용할 수 있는 WSL 배포판을 정상 확인하지 못함.
- Windows `docker`, `docker-compose`, `gh` 명령은 현재 PATH에서 확인되지 않음.
- `http://localhost:8750` 서버는 health/ready는 정상이지만 최신 capability가 빠진 오래된 배포본 가능성 유지.

### 구현 내용

- `scripts\local_environment_status.py`가 WSL 경고가 섞인 Docker 출력은 정상 OK가 아니라 경고로 표시하도록 보강.

### 검증

- `uv run python scripts\local_environment_status.py --base-url http://localhost:8750` 실행: WSL 경로 경고, Docker WSL 경고, 오래된 서버 capability 경고 확인.
- `uv run python -m py_compile scripts\local_environment_status.py` 통과.

### 보류

- 실제 Android 기기 실행/음성/녹음 업로드 점검은 물리 기기 연결이 필요함.
- WSL/Linux Docker 재배포 점검은 정상 WSL 배포판 또는 Docker CLI 접근이 필요함.
- GitHub Actions 통과 확인은 Actions 실행 기록 또는 `gh`/토큰 기반 접근이 필요함.
- 공용 서버/Play Console/라이선스 항목은 운영 결정 또는 외부 화면 확인이 필요하므로 완료 처리하지 않음.

## 2026-05-26 11:45 KST

### 다음 작업 시작

- 실제 Android 기기 점검 전 실행되는 모바일 런타임 점검 출력이 Windows에서 깨지지 않도록 보강.

### 구현 내용

- `now_app\scripts\check_android_runtime.py`의 표준 출력/오류 출력을 UTF-8로 고정.
- `server\scripts\preflight.py`가 모바일 런타임 점검 스크립트의 UTF-8 출력 설정을 확인하도록 보강.
- `docs\PROJECT_STATUS.md`의 preflight 최신 통과 수치를 갱신.

### 검증

- `uv run python now_app\scripts\check_android_runtime.py` 실행 결과 한글 출력 정상.
- 같은 실행에서 에뮬레이터 `emulator-5554`, 서버 `http://127.0.0.1:8750` health/ready 정상 확인.
- 실제 Android 기기는 연결되지 않아 경고 유지.
- `uv run python -m py_compile now_app\scripts\check_android_runtime.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 680/680.

### 보류

- 실제 Android 기기 실행, 음성 메모 실시간 변환, 녹음 후 변환, 녹음 업로드 상태 확인은 물리 기기 또는 실제 앱 화면 점검이 필요하므로 완료 처리하지 않음.

## 2026-05-26 20:18 KST

### 다음 작업 시작

- 남은 31개 항목을 단순 목록이 아니라 외부 조건별로 분류해 다음 행동을 더 명확히 볼 수 있도록 보강.

### 구현 내용

- `scripts\release_readiness.py`에 `--show-blockers` 옵션 추가.
- 남은 항목을 실제 Android 기기/모바일 화면, WSL/Docker 서버 재배포, 공용 서버 운영 결정, Google Play Console, GitHub Actions, 오픈소스 라이선스 결정으로 분류.
- 루트 `README.md`에 `python3 scripts/release_readiness.py --show-blockers` 명령 추가.
- `server\scripts\preflight.py`가 release readiness 분류 기능과 README 안내를 확인하도록 보강.
- `docs\PROJECT_STATUS.md`에 남은 항목 외부 조건별 확인 원칙 추가.

### 검증

- `uv run python scripts\release_readiness.py --show-blockers` 통과: 26/57 완료, 31개 남음.
- 남은 31개 분류: 실제 Android 기기/모바일 화면 5개, WSL/Docker 서버 재배포 9개, 공용 서버 운영 결정 8개, Google Play Console 6개, GitHub Actions 1개, 오픈소스 라이선스 결정 2개.
- `uv run python -m py_compile scripts\release_readiness.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 688/688.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `git diff --check` 통과.

### 보류

- 분류 결과상 남은 항목은 외부 기기, 실제 서버, Play Console, GitHub Actions, 라이선스 결정이 필요하므로 완료 처리하지 않음.

## 2026-05-26 20:52 KST

### 다음 작업 시작

- GitHub Actions 확인이 404로 실패할 때 다음 행동을 더 명확하게 알 수 있도록 상태 확인 스크립트 보강.

### 구현 내용

- `scripts\check_github_actions_status.py`가 `GITHUB_TOKEN`뿐 아니라 `GH_TOKEN`도 자동 후보로 읽도록 수정.
- 확인 결과 헤더에 토큰 사용 여부, Actions 화면 URL, 워크플로우 화면 URL을 출력하도록 보강.
- 404, 401, 403 응답별로 운영자가 확인할 내용을 분리해 표시.
- `docs\OPEN_SOURCE_RELEASE.md`의 토큰 안내를 `GITHUB_TOKEN`/`GH_TOKEN` 기준으로 갱신.
- `server\scripts\preflight.py`가 GH_TOKEN 안내와 workflow page 출력 기준을 확인하도록 보강.
- `docs\PROJECT_STATUS.md`의 preflight 통과 수치를 691/691로 갱신.

### 검증

- `uv run python -m py_compile scripts\check_github_actions_status.py server\scripts\preflight.py` 통과.
- `uv run python scripts\check_github_actions_status.py --repo cyhuh428-sinsan/Now --branch main` 실행: 현재는 GitHub API 404가 맞으며, 토큰 없음과 확인 URL을 포함해 안내됨.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 691/691.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.

### 보류

- GitHub Actions workflow run 자체는 아직 확인되지 않아 `GitHub Actions preflight 통과 확인`은 완료 처리하지 않음.

## 2026-05-27 00:20 KST

### 다음 작업 시작

- 모바일 실제 실행 점검 전 도구가 Flutter CLI의 느린 종료를 실제 미설치 오류처럼 표시하지 않도록 보정.

### 확인 내용

- `uv run python now_app\scripts\check_android_runtime.py --timeout 5` 실행 초기에 `Flutter CLI`가 버전 첫 줄은 출력했지만 제한 시간 안에 종료되지 않아 `FAIL`로 표시되는 상태를 확인.
- 직접 `flutter --version`은 120초 안에 종료되지 않는 경우가 있어, 설치 확인과 명령 종료 지연을 구분할 필요가 있음.
- 현재 연결된 Android device 상태 기기는 없어 실제 모바일 점검 항목은 여전히 닫을 수 없음.

### 구현 내용

- `now_app\scripts\check_android_runtime.py`에 `flutter_status`를 추가해 Flutter 버전 출력이 확인되면 종료 지연은 `WARN`으로 분리.
- 모바일 실제 실행 점검서에 Flutter CLI가 버전은 출력하지만 종료가 늦는 경우의 판단 기준 추가.
- `server\scripts\preflight.py`가 Flutter CLI 지연 판단 기준과 점검서 안내를 확인하도록 보강.
- `docs\PROJECT_STATUS.md`의 preflight 통과 수치를 694/694로 갱신.

### 검증

- `uv run python now_app\scripts\check_android_runtime.py --timeout 5` 실행 결과 Flutter CLI, ADB, AVD, 서버는 OK이고, 연결된 Android 기기 없음 1개만 FAIL.
- `uv run python -m py_compile now_app\scripts\check_android_runtime.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 694/694.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `uv run python scripts\release_readiness.py --show-blockers` 통과: 26/57 완료, 31개 남음.
- `git diff --check` 통과.

### 보류

- 실제 Android 기기와 에뮬레이터가 현재 연결되어 있지 않아 모바일 실제 점검 항목은 완료 처리하지 않음.

## 2026-05-27 22:37 KST

### 다음 작업 시작

- 로컬 환경 점검에서 WSL/Windows 명령 출력이 UTF-16 또는 한국어 코드페이지로 깨져 보일 수 있는 문제를 보강.

### 확인 내용

- 직접 WSL 호출은 현재 환경에서 안정적으로 실행되지 않으며, 일부 오류 출력은 NUL 문자가 섞인 UTF-16 계열로 표시됨.
- `scripts\local_environment_status.py`는 WSL/Docker 재배포 완료를 대신 판단하지 않고, 현재 경고 상태를 보여주는 보조 도구로 유지.

### 구현 내용

- `scripts\local_environment_status.py`에 `decode_command_output` 추가.
- 명령 출력 디코딩을 `utf-8`, 시스템 파일 인코딩, `cp949`뿐 아니라 NUL 포함 출력의 `utf-16`/`utf-16-le` 후보까지 시도하도록 수정.
- `server\scripts\preflight.py`가 로컬 환경 점검 스크립트의 UTF-16/한국어 코드페이지 처리 기준을 확인하도록 보강.
- `docs\PROJECT_STATUS.md`의 preflight 통과 수치를 697/697로 갱신.

### 검증

- `uv run python -m py_compile scripts\local_environment_status.py server\scripts\preflight.py` 통과.
- `uv run python scripts\local_environment_status.py --base-url http://localhost:8750` 실행: WSL/Docker/서버 capability 경고는 남지만 출력 확인 가능.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 697/697.
- `git diff --check` 통과.

### 보류

- WSL/Docker 재배포 체크리스트는 실제 WSL/Linux 배포 경로에서 최신 코드 pull, compose 재기동, smoke test까지 확인해야 하므로 완료 처리하지 않음.

### 보류

- Play Console 최종 입력, 개인정보처리방침 URL 확정, 내부 테스트 트랙 업로드, 실제 기기 설치 테스트는 화면/외부 환경 확인이 필요하므로 완료 처리하지 않음.

## 2026-05-26 11:20 KST

### 다음 작업 시작

- Play 등록 이미지가 존재하는지만 보지 않고 실제 PNG 크기까지 자동 확인하도록 보강.

### 범위

- 앱 코드, 이미지 파일, Play Console 입력값은 변경하지 않음.
- `scripts\play_release_status.py`의 읽기 전용 검증 기준과 서버 preflight의 정적 확인 기준만 확장.

### 구현 내용

- `scripts\play_release_status.py`에 PNG 헤더 기반 크기 판독 추가.
- 앱 아이콘 `512x512`, 기능 그래픽 `1024x500`, 스크린샷 4장 `1080x1920` 기준 확인 추가.
- `server\scripts\preflight.py`가 Play 이미지 크기 확인 로직 존재를 점검하도록 보강.
- `docs\PROJECT_STATUS.md`의 최신 자동 점검 수치를 갱신.

### 검증

- `uv run python scripts\play_release_status.py --show-manual` 통과: 자동 확인 27/27 OK, 경고 0, 수동 확인 9개.
- `uv run python -m py_compile scripts\play_release_status.py server\scripts\preflight.py` 통과.
- `uv run python server\scripts\preflight.py --env-file .env.example --allow-example` 통과: 679/679.
- `uv run python scripts\release_readiness.py` 결과는 26/57 완료, 31개 남음으로 유지.
- `uv run python scripts\verify_public_repo_safety.py` 통과: 8/8.
- `git diff --check` 통과.
