# NowNote Google Play 출시 준비 체크리스트

## 현재 앱 정보

- 앱 이름: NowNote
- 패키지명: `com.sinsan.nownote`
- 버전: `2.3.7+23007`
- 개인정보처리방침 URL: `https://nownote.sinsan.kr/privacy`

## 코드/빌드 준비

- [x] 앱 표시 이름 `NowNote` 적용
- [x] 패키지명 `com.sinsan.nownote` 적용
- [x] `health` 권한 없음
- [x] `READ_CALENDAR`, `WRITE_CALENDAR` 권한 없음
- [x] 서버 주소와 앱/설치형 접속 토큰 기반 연결 흐름 적용
- [x] 2단계 인증 코드는 연결 테스트 때만 입력하고 저장하지 않음
- [x] 기본 메모 기능은 로컬 저장으로 동작
- [x] 서버 연결 시 메모 동기화 가능
- [x] 릴리스 서명 설정: `nownote_app/android/key.properties`가 있으면 별도 업로드 키 사용
- [x] NowNote 전용 업로드 키로 AAB 생성 및 로컬 서명 확인

## 업로드 서명 설정

`nownote_app/android/key.properties`와 `nownote_app/android/upload-keystore.jks`는 로컬에만 둔다. `key.properties`에는 `storePassword`, `keyPassword`, `keyAlias`, `storeFile`을 지정한다. 키 파일을 `android` 폴더에 두는 경우 `storeFile=../upload-keystore.jks`를 사용한다.

키 파일이 없으면 릴리스 AAB는 서명되지 않는다. Play Console에 올리기 전에 `flutter build appbundle --release`로 다시 빌드하고 AAB 서명을 검증한다. 업로드 키와 비밀번호 파일은 Git에 포함되지 않으며, 둘 다 별도로 안전하게 백업해야 한다.

## Play Console에서 준비할 항목

- [ ] 앱 생성
- [ ] 기본 스토어 등록정보 작성
- [ ] 앱 카테고리 선택: 생산성
- [ ] 연락처 이메일 입력
- [ ] 개인정보처리방침 URL 등록
- [ ] Data safety 양식 작성
- [ ] 앱 액세스 권한 설명
- [ ] 광고 없음 여부 선택
- [ ] 콘텐츠 등급 설문
- [ ] 타깃 연령층 및 대상 사용자 설정
- [ ] 내부 테스트 트랙에 최종 AAB 업로드

## 권한 설명 기준

- 마이크: 음성 메모 녹음과 STT 변환
- 카메라: 메모용 사진 촬영과 텍스트 추출
- 사진 및 이미지: 선택 이미지에서 텍스트 추출
- 알림: 앱 상태 안내

## Now 앱과 구분되는 제외 항목

- NowNote는 Health Connect 권한을 요청하지 않는다.
- NowNote는 기기 캘린더 읽기/쓰기 권한을 요청하지 않는다.
- NowNote는 회의/대화 기록 기능을 포함하지 않는다.
- NowNote는 생활 도메인 캡처 분류 화면을 별도 메뉴로 제공하지 않는다.

## 등록 가능 판정 기준

- [x] Flutter 테스트 통과
- [x] APK 빌드 성공
- [x] 실제 기기 또는 에뮬레이터 실행 확인
- [x] 앱 권한 목록에서 health/calendar 제외 확인
- [ ] Play Console 수동 입력 완료
- [ ] 최종 서명된 AAB 업로드
- [ ] 내부 테스트 트랙 배포 확인

## 작업현황 (2026-09-28)

- 담당: 어울 / Stage: NowNote Google Play 서명 준비
- 상태: NowNote 전용 키 생성 및 서명된 AAB 로컬 검증 완료, Play Console 등록 대기
- 변경 파일: `nownote_app/android/app/build.gradle.kts`, `.gitignore`, 이 체크리스트
- 검증: `nownote_app` Flutter 테스트 88개 통과, `flutter build appbundle --release --no-pub` 성공, `jarsigner -verify`에서 `jar verified`
- 서명 확인: AAB와 NowNote 업로드 키의 인증서 SHA-256 지문 일치 (`A6:70:E7:A6:37:B9:29:31:61:2D:33:3C:F8:D0:F3:9B:C6:AB:B3:C9:A3:21:81:70:F8:E3:4F:E1:46:2E:13:77`)
- 산출물: `nownote_app/build/play-release/NowNote-2.3.7-23007-a3ea626.aab` (SHA-256 `4F267B4D8B116657110F49646F2A3DD9D970B266577343350150C20D7191A44C`)
- 로컬 보안: `D:\Project\Now\nownote_app\android`와 작업 worktree에 키/설정 파일 보관, Git 무시 확인, 네 파일의 ACL을 현재 사용자/SYSTEM/Administrators로 제한
- 오류 횟수: 1회 (`icacls` 다중 경로 인수 오류, 파일별 조회로 해결)
- 미검증: Play Console 업로드 및 내부 테스트, 업로드 키의 별도 백업
- 다음 조치: 업로드 키와 비밀번호 파일을 별도 안전 저장소에 백업하고 Play Console에 서명된 AAB 업로드

## 작업현황 (2026-09-28, OmniRoute 전환)

- 담당: 어울 / Stage: NowNote LLM 제공자 전환 및 Now 호환성 유지
- 상태: NowNote에서 DeepSeek 선택지를 OmniRoute로 교체, Now 앱의 기존 DeepSeek 선택지는 유지. 공통 코어에 OmniRoute 제공자와 모델 설정 추가
- 변경 파일: `packages/now_core/lib/llm/`, `packages/now_core/lib/now_core.dart`, `nownote_app/lib/features/settings/`, `nownote_app/lib/features/today/today_providers.dart`, `nownote_app/lib/features/tree/tree_llm_providers.dart`, `now_app/lib/features/settings/`, `now_app/lib/llm/providers/llm_providers.dart`, 관련 테스트와 이 체크리스트
- 설정: 엔드포인트 `https://omniroute.sinsan.kr/v1`; 모델 기본값 `auto`(설정에서 변경 가능). 기존 DeepSeek 키는 OmniRoute 키로 복사하지 않음
- 검증: NowNote 분석 문제 없음/테스트 89개 통과, now_core 분석 문제 없음/테스트 388개 통과, Now 테스트 86개 통과. Now 분석의 기존 미수정 파일 경고·권고 20건은 남음
- 빌드: NowNote `flutter build appbundle --release --no-pub` 성공. `jarsigner -verify`에서 `jar verified`, 인증서 SHA-256 지문은 위 NowNote 업로드 키와 일치
- 새 산출물: `D:\Project\Now\nownote_app\build\play-release\NowNote-2.3.7-23007-omniroute-71f5374e.aab` (SHA-256 `71F5374EB85DFA20B44B2F3EEA0C4040BBEAC2ECADC3374A7930A5CC8370874E`). 위의 이전 AAB는 변경 전 버전으로 보존
- 오류 횟수: 2회 (core 패키지 설정 누락으로 테스트/분석 실패 후 오프라인 `pub get`으로 해결, Java 서명 도구가 PATH에 없어 설치 경로로 재실행)
- 미검증: 실제 OmniRoute 키를 통한 인증·모델 `auto` 사용 가능 여부, 실기기 실행, Play Console 업로드 및 내부 테스트, 업로드 키 별도 백업
- 다음 조치: 실제 키로 OmniRoute 연결 테스트 후 모델을 확정하고, Play Console 업로드 전 버전 코드와 이전 업로드 여부 확인
