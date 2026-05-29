# NowNote Windows 설치형 프로그램

이 폴더는 `web` 화면을 Windows 데스크톱 앱으로 감싸서 `.exe` 설치 파일을 만드는 Electron 패키지입니다.

## 기준

- 기존 Web 기능을 그대로 사용합니다.
- 서버 없이 로컬 단독 사용이 가능합니다.
- 공용 서버 접속값을 입력하면 서버와 동기화할 수 있습니다.
- Windows 설치 파일은 NSIS 기반 `.exe`로 생성합니다.
- `.msi`는 1차 설치형 범위에 포함하지 않고, WiX 도구를 붙이는 단계에서 추가합니다.

## 개발 실행

```bash
cd desktop
npm install
npm run start
```

`npm run start`는 먼저 `web` 정적 파일을 `desktop/app`으로 복사한 뒤 Electron 창을 엽니다.

## Windows 설치 파일 만들기

```bash
cd desktop
npm install
npm run dist:win
```

생성 위치:

```text
desktop/dist/NowNote-Setup-0.1.0-x64.exe
```

생성된 설치 파일을 실행하면 NowNote가 Windows 시작 메뉴와 바탕화면 바로가기에 등록됩니다.

## 사용자 안내

설치 후 서버 연결 설정을 비워두면 현재 PC에만 저장하는 단독 프로그램으로 사용할 수 있습니다.
공용 서버에 접속하려면 화면 설정의 서버 연결 항목에 운영자가 제공한 값을 입력합니다.

```text
서버 주소: 예) https://nownote.sinsan.kr
API 토큰: 운영자가 제공한 서버 연결용 토큰
사용자 ID: 운영자가 만든 사용자 ID
사용자별 접속 토큰: 운영자가 발급한 사용자 토큰
2단계 인증 코드: 필요한 경우 6자리 코드
```

## 빌드 산출물 관리

아래 폴더는 생성물이라 Git에 올리지 않습니다.

```text
desktop/app/
desktop/dist/
desktop/node_modules/
```
