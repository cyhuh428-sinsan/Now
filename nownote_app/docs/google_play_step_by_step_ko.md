# NowNote Google Play 등록 순서

## 1. 앱 생성

Play Console에서 새 앱을 만들고 아래 값을 입력한다.

- 앱 이름: `NowNote`
- 기본 언어: `한국어`
- 앱 또는 게임: `앱`
- 무료 또는 유료: `무료`

## 2. 스토어 등록정보

`google_play_paste_ready_ko.md`의 기본 스토어 등록정보를 복사해 입력한다.

- 짧은 설명
- 전체 설명
- 카테고리
- 태그 후보

## 3. 그래픽 자료

아래 파일을 우선 등록한다. 최종 제출 전 실제 기기 화면으로 교체할 수 있다.

- `play_assets/app_icon_512.png`
- `play_assets/feature_graphic_1024x500.png`
- `play_assets/screenshot_01_home.png`
- `play_assets/screenshot_02_daily_notes.png`
- `play_assets/screenshot_03_tree_notes.png`
- `play_assets/screenshot_04_voice.png`

## 4. 앱 액세스와 광고

- 앱 액세스: 기본 메모 기능은 로그인 없이 사용 가능
- 서버 동기화와 그룹 메신저는 사용자가 서버 연결을 설정한 경우만 사용
- 광고 포함 여부: 없음

## 5. Data safety

기본 저장은 로컬이지만, 사용자가 서버 연결을 켠 경우 전송될 수 있는 데이터를 포함해 신고한다.

- 사용자가 입력한 콘텐츠
- 오디오 파일
- 사진 및 동영상
- 앱 활동
- 사용자 ID
- 기기 ID

NowNote는 Health Connect와 기기 캘린더 권한을 쓰지 않는다.

## 6. 권한 설명

- 마이크: 음성 메모 녹음과 텍스트 변환
- 카메라: 사진 촬영과 텍스트 추출
- 사진 및 이미지: 선택 이미지에서 텍스트 추출
- 알림: 앱 상태 안내

## 7. 릴리스

최종 AAB를 빌드한 뒤 내부 테스트 트랙에 업로드한다.

최종 제출 전 확인한다.

- 앱 이름과 패키지명이 NowNote 기준인지
- 권한 목록에 health/calendar가 없는지
- 개인정보처리방침 URL이 공개로 열리는지
- Data safety가 선택형 서버 전송을 포함하는지
