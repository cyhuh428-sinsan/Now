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
- 연결 테스트에서 서버 연결 후 운영자용 상태 조회(`/api/v1/admin/ops`)가 401을 반환해도 앱이 미처리 예외를 내지 않도록 보조 조회 실패를 분리했다.

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
- Android 에뮬레이터 설치/실행: 통과
  - 대상: `emulator-5554`
  - APK: `build\app\outputs\flutter-apk\app-x86_64-debug.apk`
  - 결과: 설치 성공, 앱 실행 성공, 실행 직후 크래시 없음
- Android 에뮬레이터 서버 설정 화면 확인: 통과
  - 서버 주소: `https://nownote.sinsan.kr`
  - 확인: 서버 설정 화면에서 앱/설치형 접속 토큰 문구와 고급 설정 분리 표시
  - 연결 테스트: 서버 연결 결과 카드 표시, 미처리 401 예외 없음
- 통합 작업지시서 앱 작업 재점검: 부분 완료
  - 기준: `docs/NOW_2_3_INTEGRATED_WORK_ORDER.md` 앱 작업지시
  - 남은 앱 변경 검토 완료
  - 모바일 정적 검증 재실행 통과
  - `flutter test test\services\server_sync_service_test.dart` 재실행 통과
  - 에뮬레이터 `emulator-5554` 앱 실행 재확인 통과
  - 문서와 앱 설정 범위에서 실제 앱/설치형 접속 토큰은 발견되지 않음
- 운영 서버 실제 토큰 연결 테스트: 통과
  - 대상: `emulator-5554`
  - 서버 주소: `https://nownote.sinsan.kr`
  - 사용자 ID: `cyhuh`
  - 인증 방식: 앱/설치형 접속 토큰
  - 결과: 사용자 프로필, 그룹 `sinsan`, 표시 이름, 이메일, 시간대, 2단계 인증 상태 조회 성공
- 운영 서버 메모 동기화 확인: 통과
  - 작업: 서버 설정 화면에서 `전체 다시 동기화` 실행
  - 결과 메시지: `메모 업로드 0건 · 서버 변경 5건 확인`
  - 앱 화면 확인: `기록 > 메모 > 계층 메모`에 서버 항목 `비밀번호`, `개인노트` 표시
- 전체 Flutter 테스트: 통과
  - 명령: `flutter test`
  - 결과: 61개 테스트 통과

## 남은 확인

- 앱 인증 연결과 서버 메모 내려오기는 운영 서버 기준으로 확인했다.
- 2.3 전체 릴리즈 판정은 서버, Web/설치형, 앱의 잔여 릴리즈 산출물 검증을 함께 본 뒤 별도 판단한다.
