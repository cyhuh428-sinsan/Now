# NOW 2.3 App Work Order Result

- 작업일: 2026-06-12
- 담당: App
- 기준 문서: `docs/NOW_2_3_WORK_ORDER_APP.md`
- 거버넌스 기준: `docs/NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md`
- 앱 작업 범위 외 항목: Server, Web, 설치형 프로그램 변경 없음

## 1. 작업 범위

- 앱 서버 연결/동기화 기준을 운영 서버 `https://nownote.sinsan.kr` 기준으로 정리
- 앱/설치형 접속 토큰 기반 연결 흐름 문서 반영
- 구형 개인 서버 API 토큰은 기본 흐름이 아닌 고급 설정 항목으로 유지
- 앱 README와 모바일 런타임 체크리스트를 2.3 기준으로 갱신
- 설정 화면의 앱 버전 표시를 2.3 릴리즈 기준으로 수정
- Flutter 정적 검증, 단위 테스트, 전체 테스트 수행
- 2.3 릴리즈 APK 산출물 생성
- 에뮬레이터 설치/실행 검증 수행

## 2. 변경 파일

- `now_app/README.md`
  - 2.3 앱 작업지시서 참조 추가
  - 운영 서버 `https://nownote.sinsan.kr` 기준 점검 문구 추가
  - `NowNote-2.3.x.apk` 릴리즈 산출물 정리 기준 추가
  - GitHub Release asset 업로드 대상 기록 기준 추가
- `now_app/docs/mobile_runtime_checklist_ko.md`
  - 운영 서버 주소와 앱/설치형 접속 토큰 기준 점검 항목 추가
  - 2단계 인증 코드는 요청 시 입력하고 저장하지 않는 기준 반영
  - 구형 개인 서버 API 토큰과 기기 ID는 고급 설정에서만 확인하도록 정리
  - 서버 메모 내려오기 확인 항목을 모바일 앱 화면 기준으로 정리
- `now_app/pubspec.yaml`
  - 앱 메타데이터 버전을 `2.3.5+23005`로 갱신
- `now_app/lib/features/settings/settings_page.dart`
  - 설정 화면 `앱 정보 > 버전` 표시를 `2.3.5 (23005)`로 갱신
- `now_app/test/features/settings/settings_page_test.dart`
  - 설정 화면 버전 표시 테스트 기대값을 `2.3.5 (23005)`로 갱신

## 3. 검증 결과

| 구분 | 명령 | 결과 |
| --- | --- | --- |
| 모바일 표면 정적 검증 | `C:\Users\cyhuh\anaconda3\python.exe now_app\scripts\verify_mobile_surface.py` | 통과, 142/142 |
| 서버 동기화 서비스 테스트 | `flutter test test\services\server_sync_service_test.dart` | 통과, 3 tests |
| Flutter 전체 테스트 | `flutter test` | 통과, 61 tests |
| 릴리즈 APK 빌드 | `flutter build apk --release` | 통과 |
| Android 설치/실행 점검 | `C:\Users\cyhuh\anaconda3\python.exe scripts\check_android_launch.py --serial emulator-5554 --apk build\app\outputs\flutter-apk\NowNote-2.3.5.apk` | 통과 |

## 4. APK 산출물

- 파일명: `NowNote-2.3.5.apk`
- 경로: `now_app/build/app/outputs/flutter-apk/NowNote-2.3.5.apk`
- versionName: `2.3.5`
- versionCode: `23005`
- 크기: `75,951,250 bytes`
- 생성시각: `2026-06-13 오전 4:14:48`
- 설치 대상: Android Emulator `emulator-5554`
- 설치 결과: 성공
- 실행 결과: 성공
- 크래시 확인: 실행 직후 crash buffer에 앱 크래시 없음

## 5. 에뮬레이터 확인 메모

- 최초 `--build-number 235` 산출물은 기존 설치 앱의 `versionCode 4001`보다 낮아 Android에서 다운그레이드로 차단됨
- `--build-number 23005`로 다시 빌드하여 versionCode 문제 해소
- 기존 에뮬레이터 설치본은 디버그 서명이고 릴리즈 APK는 릴리즈 서명이어서 업데이트 설치가 차단됨
- 릴리즈 APK 자체 설치 검증을 위해 기존 `com.sinsan.nownote`를 에뮬레이터에서 삭제한 뒤 재설치함
- 삭제 후 릴리즈 APK 설치/실행 점검 통과

## 6. GitHub Release Asset

- 업로드 대상 파일: `NowNote-2.3.5.apk`
- Release: `v2.3.5` / `NowNote 2.3.5`
- asset id: `445986351`
- 업로드 상태: `uploaded`
- 업로드 크기: `75,951,250 bytes`
- 업로드 확인 시각: `2026-06-12T19:36:24Z`
- 다운로드 URL: `https://github.com/cyhuh428-sinsan/Now/releases/download/v2.3.5/NowNote-2.3.5.apk`

## 7. 완료 판단

- 앱 서버 연결/동기화 흐름은 운영 서버와 앱/설치형 접속 토큰 기준으로 문서화 완료
- 구형 개인 서버 API 토큰은 기본 흐름이 아닌 고급 설정 기준으로 정리 완료
- 모바일 정적 검증과 Flutter 테스트 통과
- `NowNote-2.3.5.apk` 릴리즈 산출물 생성 완료
- 에뮬레이터 설치/실행 검증 통과
- GitHub Release asset 업로드 완료

## 8. 추가 앱 수정 결과 - 계층 메모 조회/본문 찾기

- 작업일: 2026-06-14
- 담당: App
- 앱 작업 범위 외 항목: Server, Web, 설치형 프로그램 변경 없음

### 변경 내용

- 계층 메모 목록의 상단 검색 문구를 `목록 제목/본문 검색`으로 정리하여 본문 찾기와 구분
- 계층 메모 상세 보기 화면에 `본문 찾기` 입력창 추가
- 상세 보기 본문에서 검색어 일치 개수 표시
- 상세 보기 본문에서 검색어를 노란색 배경으로 강조 표시
- URL/이메일 링크 표시 기능은 유지하면서 검색어 강조가 같이 동작하도록 처리
- 계층 메모 카드의 열기 아이콘 옆에 하위 메모 추가 아이콘을 직접 배치
- 기존 더보기 메뉴의 하위 메모 추가 항목은 중복을 피하기 위해 제거

### 검증 결과

| 구분 | 명령 | 결과 |
| --- | --- | --- |
| Flutter 전체 테스트 | `flutter test` | 통과, 72 tests |
| 릴리즈 APK 빌드 | `flutter build apk --release` | 통과 |
| 모바일 표면 정적 검증 | `C:\Users\cyhuh\anaconda3\python.exe scripts\verify_mobile_surface.py` | 통과, 142/142 |
| Android 설치/실행 점검 | `C:\Users\cyhuh\anaconda3\python.exe scripts\check_android_launch.py --serial emulator-5554 --apk build\app\outputs\flutter-apk\app-release.apk` | 통과 |

### 완료 판단

- 목록 검색과 열린 메모 본문 찾기를 분리 완료
- 열린 메모 안에서 단어를 찾고 일치 위치를 확인할 수 있도록 본문 강조 표시 완료
- 계층 메모 카드의 열기/추가/더보기 아이콘 배치 정리 완료
- 릴리즈 APK 재빌드 완료
