# NowNote 모바일 앱

NowNote 모바일 앱은 빠른 입력, 음성 메모, 일자별 메모를 중심으로 사용하는 로컬 우선 Flutter 앱입니다.

전체 프로젝트 설명은 상위 문서와 함께 봅니다.

- 공통 도움말: `../docs/HELP.md`
- 서버: `../server/README.md`
- Web/설치형 기준 화면: `../web/README.md`
- 실제 실행 점검서: `docs/mobile_runtime_checklist_ko.md`
- 2.3 앱 작업지시서: `../docs/NOW_2_3_WORK_ORDER_APP.md`

## 1차 범위

- 홈에서 오늘 일정과 오늘 메모를 빠르게 확인
- 일자별 메모는 날짜마다 메모장 하나를 두고 계속 추가
- 계층 메모는 주제 / 분류 / 메모 3단계 구조로 정리
- 음성 입력은 일자별 메모와 계층 메모의 입력 수단으로 사용
- 회의, 대화, 살림, 여행 기능은 기존 구조 유지
- 서버를 연결하지 않으면 현재 기기 안에서만 저장
- 개인 Docker 서버나 공용 NowNote 서버에 연결하면 메모, 녹음, 분석 작업을 동기화
- Markdown 가져오기는 외부 `.md`, `.markdown`, `.txt` 파일을 새 지식 메모로 추가

## 서버 연결

서버 설정 화면에서 아래 값을 입력합니다.

- 서버 주소
- 사용자 ID
- 앱/설치형 접속 토큰
- 2단계 인증 코드

고급 설정에서 필요한 경우에만 아래 값을 확인합니다.

- 구형 개인 서버 API 토큰
- 기기 ID

모바일 앱은 Web 로그인용 비밀번호를 입력하지 않고, 서버 주소, 사용자 ID, 앱/설치형 접속 토큰으로 서버에 연결합니다.
개인 서버 API 토큰은 2.3 기본 사용 흐름에서는 필요 없으며, 기존 개인 서버 호환이 필요할 때만 고급 설정에서 사용합니다.
2단계 인증 코드는 저장하지 않고, 연결 확인 때만 입력합니다.

## 백업과 가져오기

- DB 백업은 모바일 앱 전체 데이터를 복원할 때 사용합니다.
- Markdown 가져오기는 외부 파일을 NowNote 내부 메모로 복사해 새 지식 메모를 만듭니다.
- 가져온 파일은 원본과 연결하지 않습니다.
- NowNote에서 수정하거나 삭제해도 원본 파일은 바뀌지 않습니다.

## 암호화 저장

지식 메모는 필요할 때 메모 단위로 암호화할 수 있습니다.

암호화한 메모는 서버와 동기화되어도 암호문으로 저장됩니다.
Web, 설치형 프로그램, 앱에서 같은 메모를 열려면 같은 키를 입력해야 합니다.
암호화 키는 앱이나 서버에 저장하지 않으므로, 키를 잊으면 원문을 복구할 수 없습니다.

## 개발 실행

Flutter 개발 환경에서 실행합니다.

```text
flutter pub get
flutter run
```

Android 에뮬레이터에서 Windows/WSL 서버에 연결할 때는 보통 `http://10.0.2.2:8750` 주소를 사용합니다.
NowNote 2.3 운영 서버 기준 점검은 `https://nownote.sinsan.kr` 주소와 Web에서 발급한 앱/설치형 접속 토큰을 사용합니다.

모바일 앱의 핵심 화면과 서버 연결 요소가 빠지지 않았는지는 아래 명령으로 정적 점검합니다.

```bash
python scripts/verify_mobile_surface.py
```

실제 실행 전에는 Flutter, ADB, 에뮬레이터/실기기 연결, 로컬 서버 응답 상태를 먼저 확인합니다.

```bash
python scripts/check_android_runtime.py
```

에뮬레이터가 꺼져 있다면 AVD 목록과 부팅 상태를 아래 명령으로 확인합니다.

```bash
python scripts/check_android_emulator.py
```

필요할 때는 등록된 첫 AVD를 시작하고 부팅 완료 후 앱 설치/실행 점검까지 이어갈 수 있습니다.

```bash
python scripts/check_android_emulator.py --start --launch-app
```

이미 앱이 설치된 에뮬레이터에서 설치 없이 실행 상태만 확인하려면 아래처럼 실행합니다.

```bash
python scripts/check_android_emulator.py --launch-app --skip-install
```

연결된 에뮬레이터나 실기기에 현재 APK를 설치하고 앱 실행까지 확인할 때는 아래 명령을 사용합니다.

```bash
python scripts/check_android_launch.py
```

이 점검은 APK ABI와 기기 ABI 호환성, 실행 직후 crash buffer의 앱 크래시 여부도 함께 확인합니다.
에뮬레이터 저장공간이 부족하면 설치 단계에서 `INSTALL_FAILED_INSUFFICIENT_STORAGE`가 나올 수 있습니다.
이 경우 이미 설치된 앱은 `--skip-install`로 실행 상태를 확인하고, 새 APK 설치가 필요하면 AVD 저장공간을 정리한 뒤 다시 실행합니다.

에뮬레이터와 실제 기기에서 확인해야 하는 흐름은 `docs/mobile_runtime_checklist_ko.md`를 기준으로 점검합니다.

## 2.3 릴리즈 APK

NowNote 2.3 릴리즈 APK는 저장소 공통 릴리즈 번호와 맞춰 `NowNote-2.3.x.apk` 이름으로 정리합니다.
APK를 만든 뒤 파일명, 생성 시각, 크기, 검증 결과를 앱 작업 로그에 기록하고 GitHub Release asset 업로드 대상으로 포함합니다.
