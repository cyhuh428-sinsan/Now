# NOW 2.3 Web 및 설치형 프로그램 작업지시 결과

- 작업일: 2026-06-12
- 담당: Web 및 설치형 프로그램
- 기준 문서: `docs/NOW_2_3_WORK_ORDER_WEB_DESKTOP.md`
- 거버넌스 기준: `docs/NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md`
- 작업 범위 외 항목: Server, Mobile App 구현 변경 없음

## 1. 작업 범위

- Web/설치형 입력 안정성 검증
- Web/설치형 단축키와 Tab 들여쓰기 검증
- Web 메신저 2.3 UI 표면 확인
- 설치형 Web 전용 기능 숨김 기준 확인
- 설치형 버전과 exe 산출물명을 2.3.5 기준으로 정리
- Web/설치형 README와 검증 스크립트의 exe 산출물 기준 갱신
- 설치형 릴리즈 exe 산출물 생성

## 2. 변경 파일

- `desktop/package.json`
  - 설치형 패키지 버전을 `2.3.5`로 변경
  - electron-builder 산출물이 `NowNote-Setup-2.3.5-x64.exe`로 생성되도록 정리
- `desktop/package-lock.json`
  - 루트 패키지 버전을 `2.3.5`로 동기화
- `desktop/README.md`
  - Windows 설치 파일 생성 결과를 `NowNote-Setup-2.3.5-x64.exe`로 갱신
- `web/README.md`
  - 설치형 생성 결과 안내를 `NowNote-Setup-2.3.5-x64.exe`로 갱신
- `web/scripts/verify_web_surface.py`
  - 설치형 README 검증 기준을 `NowNote-Setup-2.3.5-x64.exe`로 갱신
- `docs/NOW_2_3_AUTH_CONNECTION_WEB_DESKTOP_WORK_LOG.md`
  - 설치형 2.3.5 산출물명, 생성 시각, 크기 기록 정정
- `docs/NOW_2_3_WORK_ORDER_WEB_DESKTOP_RESULT.md`
  - 본 작업 결과 파일 추가

## 3. 검증 결과

| 구분 | 명령 | 결과 |
| --- | --- | --- |
| Web JS 문법 검사 | `node --check web\app.js` | 통과 |
| 설치형 JS 문법 검사 | `node --check desktop\app\app.js` | 통과 |
| Web/설치형 표면 검증 | `C:\Users\cyhuh\anaconda3\python.exe web\scripts\verify_web_surface.py` | 통과, 720/720 |
| 설치형 정책 검증 | `node web\scripts\check_desktop_client_policies.mjs` | 통과 |
| Web import/export 브라우저 검증 | `node web\scripts\check_import_export.mjs` | 통과 |
| Web 그래프/Canvas/공유뷰 검증 | `node web\scripts\check_graph_view.mjs` | 통과 |
| 설치형 릴리즈 빌드 | `npm run dist:win` in `desktop` | 통과 |
| 설치형 저장/입력/단축키 검증 | `npm run check:storage` in `desktop` | 1회 timeout 후 잔류 NowNote 프로세스 종료, 재실행 통과 |

## 4. Web/설치형 동작 확인

- 제목 입력, 본문 입력, 전체 검색, 본문찾기 입력은 검증 스크립트 기준 통과
- `Ctrl+F`는 전체 검색으로 열림
- `Ctrl+Shift+F`는 현재 메모 본문찾기로 열림
- `Tab`은 설정된 칸 수 기준 들여쓰기 동작
- `Shift+Tab`은 내어쓰기 동작
- Web 그룹 공유/메신저 UI는 hosted Web 전용으로 유지
- 설치형에서는 hosted Web 전용 그룹 공유/메신저 확장 기능이 숨김 상태로 유지
- 메신저가 닫힌 상태에서는 메시지 목록 polling을 중지하는 코드 기준 유지
- 메신저 자동 갱신은 열린 상태에서만 동작하고, 비활성 탭에서는 갱신을 건너뛰는 기준 유지

## 5. EXE 산출물

- 파일명: `NowNote-Setup-2.3.5-x64.exe`
- 경로: `desktop/dist/NowNote-Setup-2.3.5-x64.exe`
- 설치형 package version: `2.3.5`
- 크기: `101,031,365 bytes`
- 생성시각: `2026-06-12 오후 11:06:27`
- SHA256: `8A2E99C4CE1E46797F370F7EBF7D4EC4202D8257D845B33A153EA8F03368C8D2`

## 6. 운영 서버 확인

- 기준 주소: `https://nownote.sinsan.kr`
- 루트 응답: `200 OK`
- 배포본 HTML에서 확인한 항목:
  - `앱/설치형 접속 토큰`
  - `구형 개인 서버 API 토큰`
  - `groupMessengerRoomList`
  - `groupMessengerFileInput`
- 사용자 확인 기준으로 Web 로그인, 계정 생성, 비밀번호 재설정, 앱/설치형 접속 토큰 발급, 설치형 실제 연결은 이전 확인 완료로 본다.

## 7. GitHub Release Asset

- 업로드 대상 파일: `NowNote-Setup-2.3.5-x64.exe`
- 현재 로컬 환경 확인 결과 `gh` CLI가 없음
- 현재 노출된 GitHub 도구에도 Release asset 업로드 기능이 없음
- 따라서 실제 GitHub Release asset 업로드는 미수행
- 업로드 가능 도구 또는 권한이 준비되면 위 exe 파일을 Release asset으로 등록해야 함

## 8. 완료 판단

- Web/설치형 입력, 검색, 본문찾기, 단축키, Tab 들여쓰기 검증 통과
- Web 메신저 2.3 room/첨부 UI 표면 검증 통과
- 설치형 Web 전용 기능 숨김 기준 검증 통과
- 설치형 `NowNote-Setup-2.3.5-x64.exe` 릴리즈 산출물 생성 완료
- 설치형 저장/입력/단축키 재검증 통과
- GitHub Release asset 실제 업로드만 외부 도구 부재로 보류
