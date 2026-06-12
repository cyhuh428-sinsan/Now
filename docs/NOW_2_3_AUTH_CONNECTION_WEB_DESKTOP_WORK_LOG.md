# NowNote 2.3 인증/서버 연결 Web/설치형 작업 기록

작성일: 2026-06-12
담당 범위: Web, Windows 설치형 프로그램
기준 문서: `docs/NOW_2_3_AUTH_CONNECTION_WORK_ORDER.md`, `docs/NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md`

## 작업 범위

- Web 로그인은 사용자 ID / 비밀번호 흐름을 유지했다.
- Web 로그인 화면에는 앱/설치형 접속 토큰 입력을 추가하지 않았다.
- 설치형 프로그램은 ID/password 로그인 방식으로 바꾸지 않고, 서버 API 연결 구조를 유지했다.
- 설치형 서버 연결 기본 화면은 서버 주소, 사용자 ID, 앱/설치형 접속 토큰, 2단계 인증 코드 중심으로 정리했다.
- 구형 개인 서버 API 토큰과 기기 ID 직접 입력은 `구형 개인 서버 호환 설정` 고급 영역으로 이동했다.
- 동기화 요청의 `X-Now-User-Token` 헤더와 `/api/v1/auth/token-login` 연결 테스트 흐름은 유지했다.

## 수정 파일

- `web/index.html`
- `web/app.js`
- `web/styles.css`
- `web/help.html`
- `web/README.md`
- `web/runtime_checklist_ko.md`
- `web/scripts/verify_web_surface.py`
- `desktop/app/index.html`
- `desktop/app/app.js`
- `desktop/app/styles.css`
- `desktop/app/help.html`
- `desktop/README.md`
- `docs/HELP.md`
- `README.md`

## 주요 변경 내용

- `API 토큰` 기본 입력을 제거하고 `구형 개인 서버 API 토큰`으로 명칭을 변경했다.
- `구형 개인 서버 API 토큰`과 `기기 ID`를 기본 화면이 아닌 고급 접힘 영역에 배치했다.
- `사용자별 접속 토큰` 표현을 `앱/설치형 접속 토큰`으로 정리했다.
- Web의 앱/설치형 토큰 발급 안내를 “앱/설치형 서버 연결 설정에 붙여넣는 값”으로 명확히 했다.
- 2단계 인증 코드는 저장값이 아니라 연결 테스트 때만 입력하는 값으로 문서와 화면 안내를 맞췄다.
- Web/설치형 표면 검증 스크립트에 새 고급 설정 영역, 토큰 명칭, `X-Now-User-Token` 유지 검사를 추가했다.

## 검증 결과

- `node --check web\app.js`: 통과
- `node --check desktop\app\app.js`: 통과
- `C:\Users\cyhuh\anaconda3\python.exe web\scripts\verify_web_surface.py`: 통과, 720/720
- `npm run check:storage` in `desktop`: 통과
  - 로컬 저장 재시작 복원 확인
  - 본문 Tab/Shift+Tab 들여쓰기 확인
  - Ctrl+F / Ctrl+Shift+F 단축키 확인
- `node web\scripts\check_desktop_client_policies.mjs`: 통과
  - 공유 메모 동기화 정책 유지
  - 비공유/삭제/암호화 보호 정책 유지

## 담당 밖으로 제외한 항목

- 서버 API 구현 변경
- 모바일 앱 Flutter 화면/서비스/검증 스크립트 변경
- GitHub Release asset 업로드
- 전체 2.3 릴리즈 완료 판정

## 남은 확인 필요

- 실제 서버 계정과 앱/설치형 접속 토큰이 제공되면 설치형 연결 테스트를 실서버로 1회 확인해야 한다.
- 이번 환경에서는 in-app Browser 조작 도구가 노출되지 않아 화면 스냅샷 검증은 수행하지 못했다.
- `web/dist/`는 `.gitignore` 대상 생성 산출물이므로 원본 수정 후 별도 재패키징 시 갱신한다.
