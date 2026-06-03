# NowNote Windows 설치형 프로그램

이 폴더는 Windows `.exe` 설치 파일을 만드는 NowNote 설치형 프로그램 패키지입니다.

중요한 기준:

- 설치형 프로그램은 Web 정적 파일을 복사하거나 포장하지 않습니다.
- 화면 디자인과 기본 배치는 Web과 같은 계열을 유지합니다.
- 내부 동작은 `desktop/app`의 별도 소스에서 관리합니다.
- Web은 서버 공유 문서 전용 브라우저 클라이언트입니다.
- 설치형 프로그램은 PC 로컬 문서를 우선 관리하는 별도 PC 클라이언트입니다.
- 설치형은 Electron 전용 로컬 JSON 저장소를 우선 사용합니다.

## 기준

- 서버 없이 로컬 단독 사용이 가능합니다.
- 문서는 사용자 데이터 폴더의 `nownote-desktop-store.json`에 저장됩니다.
- 예전 설치형 포장 화면의 저장 데이터가 있으면 첫 실행 때 설치형 전용 저장 키로 가져옵니다.
- 새 지식 메모는 기본적으로 PC 로컬 문서로 저장합니다.
- Windows 설치 파일은 NSIS 기반 `.exe`로 생성합니다.
- `.msi`는 1차 설치형 범위에 포함하지 않고, WiX 도구를 붙이는 단계에서 추가합니다.

## 개발 실행

```bash
cd desktop
npm install
npm run start
```

`npm run start`는 `desktop/app/index.html`을 Electron 창에서 직접 엽니다.

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

설치형 로컬 저장소가 재시작 후에도 유지되는지는 설치 파일 생성 후 아래 명령으로 점검합니다.

```bash
cd desktop
npm run check:storage
```

이 점검은 테스트 전용 사용자 데이터 폴더를 만들어 메모를 작성하고, 앱을 재시작한 뒤 같은 메모가 다시 로드되는지 확인합니다.

## 사용자 안내

설치 후 서버 연결 설정을 비워두면 현재 PC에만 저장하는 단독 프로그램으로 사용할 수 있습니다.
로컬 원본 데이터와 화면 설정은 사용자 데이터 폴더의 `nownote-desktop-store.json` 파일에 저장됩니다.
새로 작성한 지식 메모는 PC 안에 저장됩니다.
공용 서버 연동 기능은 Web과 같은 보안 기준을 따르되, 설치형 전용 화면에서 단계적으로 확장합니다.

## 빌드 산출물 관리

아래 폴더는 생성물이라 Git에 올리지 않습니다.

```text
desktop/dist/
desktop/node_modules/
```

아래 폴더는 설치형 프로그램의 실제 소스라 Git에 올립니다.

```text
desktop/app/
```
