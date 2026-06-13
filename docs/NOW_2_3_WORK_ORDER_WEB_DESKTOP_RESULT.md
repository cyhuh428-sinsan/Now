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
- 본문찾기 결과 이동 시 선택 위치와 스크롤이 검색 결과 위치로 이동함
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
- 크기: `101,032,764 bytes`
- 생성시각: `2026-06-14 오전 4:41:14`
- SHA256: `A11FAC428A3E34F53E6ACAA6E1F4AC5706716DD214B62CBBF070311C6BA70A5D`

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
- Release 태그: `v2.3.5`
- Release URL: `https://github.com/cyhuh428-sinsan/Now/releases/tag/v2.3.5`
- 업로드 결과: 완료
- 업로드 asset 상태: `uploaded`
- 업로드 asset 크기: `101,032,764 bytes`
- 다운로드 URL: `https://github.com/cyhuh428-sinsan/Now/releases/download/v2.3.5/NowNote-Setup-2.3.5-x64.exe`

## 8. 완료 판단

- Web/설치형 입력, 검색, 본문찾기, 단축키, Tab 들여쓰기 검증 통과
- Web/설치형 본문찾기 결과 위치 이동 보정 완료
- Web 공유 문서 첫 화면을 `그룹 지식체계` 기준으로 열어 같은 그룹의 공유 문서가 바로 보이도록 보정
- Web/설치형 그룹 메신저 좌측 목록에 그룹원 영역 표시 추가
- 그룹 메신저 폰트를 기준표에 맞춰 제목 12px, 본문 11px, 설명 9px 중심으로 축소
- 그룹 메신저 팝업 폭/높이를 확대해 대화 목록과 입력창 영역을 넓게 표시
- 설치형 트리 목록에 공유/비공유/읽기 전용 상태 아이콘 표시 추가
- Web 메신저 2.3 room/첨부 UI 표면 검증 통과
- 설치형 Web 전용 기능 숨김 기준 검증 통과
- 설치형 `NowNote-Setup-2.3.5-x64.exe` 릴리즈 산출물 생성 완료
- 설치형 저장/입력/단축키 재검증 통과
- GitHub Release asset 업로드 완료
- Web/설치형 최종 완료

## 9. 2026-06-14 공유 메모/메신저 표시 보정

### 변경 내용

- Web hosted 모드의 기본 공유 보기 탭을 `내 공유메모`에서 `그룹 지식체계`로 변경
- 로그인 후 서버 공유 문서를 전체 재로딩할 때도 `그룹 지식체계` 탭을 기본 선택하도록 보정
- 그룹 메신저 좌측 방 목록 아래에 그룹원 목록을 표시
- 그룹 메신저 방/그룹원/본문 글자 크기를 2.3 폰트 기준에 맞춰 축소
- 그룹 메신저 전용 팝업 폭을 최대 1100px로 확대하고 메시지 목록 높이를 늘림
- 설치형 프로그램 트리 목록에만 공유 상태 아이콘을 표시

### 검증 결과

- `node --check web\app.js`: 통과
- `node --check desktop\app\app.js`: 통과
- `C:\Users\cyhuh\anaconda3\python.exe web\scripts\verify_web_surface.py`: 통과, 726/726
- `npm run dist:win` in `desktop`: 통과
- `npm run check:storage` in `desktop`: 통과
