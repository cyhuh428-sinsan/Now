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
- [ ] 업로드 키로 서명한 최종 AAB 생성 및 서명 확인

## 업로드 서명 설정

`nownote_app/android/key.properties`와 `nownote_app/android/upload-keystore.jks`는 로컬에만 둔다. `key.properties`에는 `storePassword`, `keyPassword`, `keyAlias`, `storeFile`을 지정한다. 키 파일을 `android` 폴더에 두는 경우 `storeFile=../upload-keystore.jks`를 사용한다.

키 파일이 없으면 릴리스 AAB는 서명되지 않는다. Play Console에 올리기 전에 `flutter build appbundle --release`로 다시 빌드하고 AAB 서명을 검증한다.

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
- 상태: 코드 설정 및 빌드 검증 완료, 업로드 서명과 Play Console 등록 대기
- 변경 파일: `nownote_app/android/app/build.gradle.kts`, `.gitignore`, 이 체크리스트
- 검증: `nownote_app` Flutter 테스트 88개 통과, `flutter build appbundle --release --no-pub` 성공
- 서명 확인: 생성된 `app-release.aab`는 `jarsigner -verify` 결과 `jar is unsigned`
- 오류 횟수: 0회 (서명 확인 도구 PATH 미등록은 Android Studio JDK의 `jarsigner`로 확인)
- 미검증: 실제 업로드 키로 서명한 AAB, Play Console 업로드 및 내부 테스트
- 다음 조치: NowNote 업로드 키와 `key.properties`를 로컬에 준비한 뒤 AAB 재빌드, 서명 확인, Play Console 업로드
