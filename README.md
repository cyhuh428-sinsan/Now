# NowNote

![NowNote Preflight](https://github.com/cyhuh428-sinsan/Now/actions/workflows/preflight.yml/badge.svg)

NowNote는 한국어 사용 흐름을 먼저 기준으로 만든 로컬/서버 병행 메모 시스템입니다.

모바일 앱은 빠른 기록과 음성 메모를 중심으로 사용하고, Windows 설치형 프로그램은 PC 로컬 문서와 공유 문서를 함께 다룹니다. 서버 제공 Web 프로그램은 로컬 메모장이 아니라 서버에 공유된 내 문서만 접속하는 브라우저 클라이언트입니다. 서버는 Docker 기반으로 직접 운영하거나 공용 서버에 연결할 수 있도록 준비합니다.

## 구성

- `now_app`: Flutter 모바일 앱
- `web`: 서버가 루트 주소에서 제공하는 공유 문서 전용 Web 화면
- `desktop`: Windows `.exe` 설치형 프로그램 포장. 1차 산출물은 Web 화면 포장 기반이지만 최종 설치형은 별도 PC 클라이언트 기준으로 분리
- `server`: Docker 기반 NowNote 서버
- `docs`: 공통 도움말, 인증 기준, 작업 진행 기록

## 1차 목표

- 일자별 메모: 날짜마다 메모장 하나를 두고 계속 추가
- 계층 메모: 주제 / 분류 / 메모 3단계 구조
- 음성 메모: 실시간 변환 또는 녹음 후 변환 흐름 유지
- 검색과 분류: 제목, 경로, 태그, 본문 검색
- Markdown: 작성, 미리보기, 가져오기, 내보내기
- 서버 동기화: 개인 Docker 서버 또는 공용 서버 연결
- 운영 화면: `/monitor`, `/admin`에서 상태와 백업/점검 확인
- 한국어 우선: 처음에는 한국어 화면과 문서를 기준으로 개발

## 사용 방식

### 단독 사용자

서버에 연결하지 않고 현재 기기 안에서만 메모를 관리합니다.

- 모바일 앱은 빠른 기록과 음성 입력에 적합합니다.
- Windows 설치형 프로그램은 집 PC의 계층 메모와 Markdown 정리에 적합합니다.
- Web 프로그램은 단독 로컬 저장용이 아니라 서버에 공유된 문서를 접속하는 용도입니다.
- 주기적으로 DB 백업 또는 Markdown 내보내기를 해두는 것이 좋습니다.

### 서버 연결 사용자

개인 Docker 서버나 공용 NowNote 서버에 연결해 여러 기기에서 메모를 동기화합니다.

- 개인 서버는 `server/.env`의 API 토큰과 DB 비밀번호를 먼저 바꿔야 합니다.
- 앱과 설치형 프로그램은 Web에서 발급한 앱/설치형 연결 토큰으로 동기화합니다.
- Web 프로그램은 사용자 ID와 비밀번호로 로그인하고 서버의 공유 문서를 원본으로 사용합니다.
- 공용 서버는 사용자 직접 가입, 앱/설치형 연결 토큰, 이메일 비밀번호 재설정, 2단계 코드 검증, HTTPS/reverse proxy 기준을 충족해야 합니다.
- 2단계 인증 코드는 저장하지 않고 확인 요청에만 사용합니다.

## 시작 위치

- 처음 설치 가이드: `INSTALL.md`
- 모바일 앱: `now_app/README.md`
- Windows 설치형 프로그램: `desktop/README.md`
- Web 프로그램 원본/개발 문서: `web/README.md`
- 서버 설치와 운영: `server/README.md`
- 사용자 도움말: `docs/HELP.md`
- 현재 진행 상태: `docs/PROJECT_STATUS.md`
- 1차 마무리 체크리스트: `docs/PHASE1_RELEASE_CHECKLIST.md`
- 공개 저장소 오픈 점검: `docs/OPEN_SOURCE_RELEASE.md`
- 오픈소스 라이선스 선택 가이드: `docs/LICENSE_DECISION.md`
- 서버 인증 기준: `docs/SERVER_AUTH_POLICY.md`
- 보안 정책: `SECURITY.md`
- 기여 안내: `CONTRIBUTING.md`

## 라이선스

NowNote는 Apache License 2.0으로 공개합니다.
자세한 내용은 루트 `LICENSE` 파일을 확인하세요.

## 서버 빠른 실행

개인 Linux 서버에 NowNote 서버를 설치할 때는 먼저 `INSTALL.md`를 기준으로 진행합니다.
서버 디렉터리에서 `.env`를 준비한 뒤 Docker Compose로 실행합니다.

```bash
cd server
docker compose up --build -d
```

기본 포트는 `8750`입니다.

```bash
curl http://localhost:8750/health
curl http://localhost:8750/health/ready
```

배포 전 점검은 서버 디렉터리에서 실행합니다.

```bash
python3 scripts/preflight.py
python3 scripts/smoke_test.py --base-url http://localhost:8750
```

Linux 서버에서는 갱신, 점검, 컨테이너 재시작, smoke test를 한 번에 실행할 수 있습니다.
도우미 위치는 `server/scripts/deploy_local.sh`입니다.

```bash
cd server
sh scripts/deploy_local.sh --base-url http://localhost:8750
```

공개 저장소에 올리기 전에는 루트 디렉터리에서 비밀값 포함 여부를 확인합니다.

```bash
python3 scripts/verify_public_repo_safety.py
```

1차 마무리 상태는 루트 디렉터리에서 요약 확인할 수 있습니다.

```bash
python3 scripts/release_readiness.py
python3 scripts/release_readiness.py --show-blockers
```

Google Play 등록 준비 상태는 루트 디렉터리에서 자동 확인과 수동 확인 항목을 나눠 볼 수 있습니다.

```bash
python3 scripts/play_release_status.py --show-manual
```

현재 로컬 개발/배포 환경 상태는 루트 디렉터리에서 확인할 수 있습니다.

```bash
python3 scripts/local_environment_status.py --base-url http://localhost:8750
```

## 현재 정책

- 메모 본문에 사진 첨부는 1차 범위에 넣지 않습니다.
- 암호화 저장은 1차 범위에서는 켜지지 않으며, 로그인 사용자 전용 선택 기능으로 분리해 설계합니다.
- 공용 서버 오픈 전에는 `NOW_USER_TOKEN_REQUIRED=true`, 공개 HTTPS, reverse proxy 환경을 반드시 확인합니다.
- 실제 `.env`, Android `key.properties`, `upload-keystore.jks`는 Git에 올리지 않습니다.
