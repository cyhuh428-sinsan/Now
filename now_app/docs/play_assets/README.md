# NowNote Google Play 이미지 자료

## 생성된 파일
- `app_icon_512.png`: Play Console 앱 아이콘
- `feature_graphic_1024x500.png`: 기능 그래픽
- `screenshot_01_home.png`: 홈 화면 소개
- `screenshot_02_daily_notes.png`: 날짜별 메모 소개
- `screenshot_03_tree_notes.png`: 계층 메모 소개
- `screenshot_04_voice.png`: 음성 기록 소개

## 규격
- 앱 아이콘: 512 x 512
- 기능 그래픽: 1024 x 500
- 휴대전화 스크린샷: 1080 x 1920

## 기준
- 이번 출시 버전 기준으로 기본 로컬 사용을 중심으로 하되, 선택형 서버 동기화/녹음 업로드/서버 분석 기능이 추가됐습니다.
- 스크린샷에 서버 기능을 노출하는 경우 개인정보처리방침과 Data safety 문구가 같은 기준인지 확인해야 합니다.
- 실제 앱 화면 캡처가 필요한 경우 이 파일들을 임시 등록용 초안으로 보고, 최종 제출 전에 실기기 캡처 이미지로 교체하는 것을 권장합니다.

## 재생성
```powershell
pwsh -ExecutionPolicy Bypass -File .\generate_play_assets.ps1
```
