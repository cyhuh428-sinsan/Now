# NowNote Windows 설치형 프로그램

이 폴더는 Windows `.exe` 설치 파일을 만드는 NowNote 설치형 프로그램 패키지입니다.

중요한 기준:

- 설치형 프로그램은 별도 `.exe` 파일로 배포합니다.
- Web 전용 기능을 제외한 디자인, 화면 구조, 기능 구성은 Web과 동일하게 유지합니다.
- Web 전용 기능은 hosted Web 로그인 화면, 서버 공유문서 전용 조회, 그룹 참가/그룹 메신저처럼 공용 서버 Web 세션이 있어야 하는 기능입니다.
- Electron은 `desktop/app/index.html`을 로컬 앱 파일로 실행합니다.
- `desktop/app`에는 설치형 빌드에 포함할 Web 동일 화면 소스를 둡니다.
- 설치형은 Electron 전용 로컬 JSON 저장소를 우선 사용할 수 있습니다.

## 개발 실행

```bash
cd desktop
npm install
npm run start
```

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

설치형 로컬 저장소가 재시작 후에도 유지되는지는 설치 파일 생성 후 아래 명령으로 점검합니다.

```bash
cd desktop
npm run check:storage
```

## 빌드 산출물 관리

아래 폴더는 생성물이라 Git에 올리지 않습니다.

```text
desktop/dist/
desktop/node_modules/
```

아래 폴더는 설치형 프로그램에 포함되는 실제 화면 소스라 Git에 올립니다.

```text
desktop/app/
```
