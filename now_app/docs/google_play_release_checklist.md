# Google Play 출시 준비 체크리스트

## 현재 앱 정보
- 앱 이름: NowNote
- 패키지명: `com.sinsan.nownote`
- 버전: `1.0.0+1`
- 최소 SDK: 26
- 현재 릴리스 Manifest targetSdkVersion: 36
- 현재 신규 앱 제출 기준: Android 15, API 35 이상 타깃 필요

## 1단계 확인 결과
- [x] 작업 기준 경로: `D:\Project\Now\now_app`
- [x] Flutter 앱 구조 확인
- [x] 앱 이름: `NowNote`
- [x] 패키지명: `com.sinsan.nownote`
- [x] 버전: `1.0.0+1`
- [x] 릴리스 AAB 산출물 존재: `build/app/outputs/bundle/release/app-release.aab`
- [x] 릴리스 Manifest targetSdkVersion 36 확인
- [ ] 현재 AAB가 최신 수정 사항으로 다시 빌드되었는지 확인
- [ ] 릴리스 Manifest에서 `android.permission.CAPTURE_AUDIO_OUTPUT` 제거 반영 확인

## 현재 의심되는 부분
- `flutter_sound_core`가 릴리스 Manifest에 `android.permission.CAPTURE_AUDIO_OUTPUT` 권한을 추가하고 있었음.
- 앱 Manifest에 `tools:node="remove"`로 제거 규칙을 추가했으나, 최신 AAB 재빌드 후 병합 Manifest에서 제거 여부를 다시 확인해야 함.
- `flutter --version`, `flutter pub get` 명령이 현재 셸에서 장시간 응답하지 않았음.
- Gradle 실행은 Android Studio 내장 JDK와 프로젝트 내부 `GRADLE_USER_HOME` 지정이 필요했음.
- 실제 업로드 키가 아직 없으므로 현재 산출물은 정식 Play 업로드용 최종 서명본으로 확정할 수 없음.

## 코드/빌드 준비
- [x] 앱 표시 이름 NowNote 적용
- [x] 패키지명 `com.sinsan.nownote` 적용
- [x] 런처 아이콘 적용
- [x] 서버 API 토큰 보안 저장소 저장 적용
- [x] Google Play용 AAB 빌드 경로 확인
- [x] 업로드 키 설정 템플릿 추가: `android/key.properties.example`
- [x] 키 생성/릴리스 빌드 스크립트의 Flutter/JDK 경로 환경변수 지원
- [ ] 실제 업로드 키 생성
- [ ] `android/key.properties` 작성
- [ ] 서명된 AAB 빌드

## 업로드 키 생성 예시
PowerShell에서 프로젝트의 `android` 폴더 기준으로 실행합니다.

비밀번호를 채팅이나 Git에 남기지 않기 위해 환경변수로 설정한 뒤 스크립트를 실행합니다.

```powershell
$env:NOWNOTE_KEYSTORE_PASSWORD='직접정한_긴_비밀번호'
$env:NOWNOTE_KEY_PASSWORD='직접정한_긴_비밀번호'
powershell -ExecutionPolicy Bypass -File .\create_upload_key.ps1
```

`android/key.properties`와 `upload-keystore.jks`는 절대 Git에 올리면 안 됩니다.
`JAVA_HOME`, `NOWNOTE_KEYTOOL`, `NOWNOTE_FLUTTER_BIN`, `NOWNOTE_JAVA_HOME`으로 로컬 경로를 지정할 수 있습니다.

## AAB 빌드
```powershell
powershell -ExecutionPolicy Bypass -File .\build_release_aab.ps1
```

결과 파일:
`build/app/outputs/bundle/release/app-release.aab`

## 등록 가능 판정 기준
이전 SectorMap 등록 준비 로그 기준으로, AAB 생성만으로는 "등록 가능"이라고 판단하지 않습니다.

등록 가능이라고 말하려면 최소한 아래가 모두 확인되어야 합니다.

- [ ] 릴리스 AAB 빌드 성공
- [ ] 릴리스 APK 또는 AAB 기반 테스트 빌드를 실제 에뮬레이터/기기에 설치
- [ ] 홈 화면 정상 표시
- [ ] 메모 생성/조회 정상
- [ ] 음성 메모 권한 요청 및 입력 흐름 정상
- [ ] 계층 메모 생성/펼침/삭제 규칙 정상
- [ ] 일정/할 일 홈 표시 정상
- [ ] LLM 브리핑이 데이터 없음/생성 실패 상태에서도 화면을 깨뜨리지 않음
- [ ] 앱 실행 중 주요 오류 로그 없음
- [ ] Play Console 심사 위험 권한의 사용 목적 문구 준비
- [ ] Android 자동 클라우드 백업 제외 규칙이 릴리스 병합 리소스에 반영됐는지 확인

검증 중 핵심 기능 실패가 발견되면, 그 상태는 "등록용 파일 생성 완료"일 뿐 "등록 가능"이 아닙니다.

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
- [ ] Health Connect 권한 선언
- [ ] 마이크/카메라/캘린더 권한 사용 목적 설명
- [ ] 내부 테스트 트랙에 AAB 업로드

## Data safety 작성 참고
앱 기능상 다음 항목을 검토해야 합니다.

- 앱 활동 또는 앱 상호작용: 메모, 기록, 사용자가 입력한 콘텐츠
- 오디오: 음성 메모/녹음
- 사진 및 동영상: 캡처/이미지 기록
- 캘린더: 일정 조회/관리
- 건강 및 피트니스: Health Connect 데이터

NowNote는 기본 로컬 저장으로 사용할 수 있지만, 사용자가 서버 연결을 켜면 메모, 녹음 파일, 텍스트 변환 결과, 분석 작업 입력 내용, 사용자 ID, 기기 ID가 지정 서버로 전송될 수 있습니다. Data safety는 로컬 전용 기준이 아니라 선택형 서버 기능까지 포함해 신고해야 합니다.

## 심사 위험 메모
- Health Connect 권한은 별도 선언과 명확한 사용 목적이 필요합니다.
- 마이크/카메라/캘린더 권한은 앱 핵심 기능과 연결된 설명이 필요합니다.
- Android 13 이상 알림 권한(`POST_NOTIFICATIONS`)은 브리핑 알림 기능 기준으로 Manifest와 권한 설명이 맞아야 합니다.
- 브리핑 알림은 정확한 알람 권한을 피하기 위해 일반 예약 방식으로 동작합니다. 향후 정확한 알람이 필요해지면 Play 권한 선언을 별도로 검토해야 합니다.
- 서버 API 토큰은 보안 저장소에 저장하며, 기존 일반 설정 저장값은 최초 로드 시 자동 이전합니다.
- LLM 분석이 외부 API로 전송된다면 개인정보처리방침과 Data safety에 반드시 반영해야 합니다.
- 공개 개인정보처리방침 URL이 필요합니다. PDF나 로그인 필요한 페이지는 피해야 합니다.

## 참고 공식 문서
- Google Play Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Sensitive permissions / Health Connect: https://support.google.com/googleplay/android-developer/answer/9888170
