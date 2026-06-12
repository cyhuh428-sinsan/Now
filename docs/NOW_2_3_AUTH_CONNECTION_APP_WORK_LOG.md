# NowNote 2.3 인증/서버 연결 앱 작업 기록

## 작업 범위

- 담당 영역: 모바일 앱(`now_app`)
- 기준 문서: `docs/NOW_2_3_AUTH_CONNECTION_WORK_ORDER.md`
- 비담당 영역: 서버, Web, 설치형 프로그램은 수정하지 않음

## 변경 내용

### 서버 설정 화면

- `사용자별 접속 토큰` 문구를 `앱/설치형 접속 토큰`으로 변경했다.
- `API 토큰` 문구를 `구형 개인 서버 API 토큰`으로 변경했다.
- 기본 입력 영역에는 서버 주소, 앱/설치형 접속 토큰, 2단계 인증 코드, 사용자 ID를 표시하도록 정리했다.
- 구형 개인 서버 API 토큰과 기기 ID는 `고급 설정` 영역으로 이동했다.
- 화면 설명에 모바일 앱은 서버 주소, 사용자 ID, 앱/설치형 접속 토큰으로 연결하고 2단계 인증 코드는 연결 테스트 때만 입력한다고 명시했다.

### 메모 조회 문제 확인 및 수정

- 확인된 앱 측 원인: 첫 동기화에서 로컬에 업로드할 메모가 없고 마지막 동기화 시각이 없으면 앱이 `/api/v1/sync` 요청을 보내지 않았다.
- 영향: 새 기기 또는 로컬 메모가 없는 상태에서 서버에 이미 있는 일자별 메모/계층 메모를 내려받지 못할 수 있었다.
- 수정: 첫 동기화 또는 전체 동기화에서는 로컬 업로드 항목이 없어도 서버 조회 요청을 보내도록 조기 종료 조건을 변경했다.
- 유지한 항목:
  - `/api/v1/auth/token-login` 호출 유지
  - `X-Now-User-Token` 헤더 유지
  - `Authorization: Bearer`는 구형 개인 서버 호환용으로만 유지
  - 2단계 인증 코드는 저장하지 않고 연결 테스트 요청에만 전달

### 검증 보강

- `now_app/scripts/verify_mobile_surface.py`에 인증/연결 기준 검증을 추가했다.
- 추가 검증:
  - `앱/설치형 접속 토큰` 문구 존재
  - `구형 개인 서버 API 토큰` 문구 존재 및 고급 설정 이후 배치
  - 기존 `API 토큰`, `사용자별 접속 토큰` 라벨 미사용
  - `/api/v1/auth/token-login` 유지
  - `X-Now-User-Token` 유지
  - 구형 `Authorization` 흐름이 호환용으로만 남아 있음
  - 2단계 인증 저장 필드가 없음
  - 첫 서버 조회 회귀 방지 테스트 존재

### 앱 문서

- `now_app/README.md`의 서버 연결 설명을 2.3 기준 문구로 정리했다.

## 검증 결과

- 모바일 표면 정적 검증: 통과
  - 명령: `C:\Users\cyhuh\anaconda3\python.exe now_app\scripts\verify_mobile_surface.py`
  - 결과: `NowNote mobile surface verification passed (142/142 checks)`
- 앱 동기화 서비스 테스트: 통과
  - 명령: `flutter test test\services\server_sync_service_test.dart`
  - 결과: `All tests passed!`
- 전체 Flutter 테스트: 통과
  - 명령: `flutter test`
  - 결과: `All tests passed!`
- Flutter 정적 분석: 기존 info 6건으로 종료 코드 1
  - 명령: `flutter analyze`
  - 결과: 기존 테스트 파일의 const/로컬 변수명 스타일 info 6건
  - 이번 변경 파일에서는 분석 이슈가 보고되지 않았다.

## 남은 확인

- 실제 기기 또는 에뮬레이터에서 서버 주소, 사용자 ID, 앱/설치형 접속 토큰으로 연결 테스트를 실행해야 한다.
- 서버에 이미 있는 일자별 메모와 계층 메모가 새 앱 설치 상태에서 내려오는지 실제 서버로 확인해야 한다.
