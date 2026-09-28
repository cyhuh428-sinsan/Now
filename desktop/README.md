# NowNote Windows 설치형 프로그램

이 폴더는 Windows `.exe` 설치 파일을 만드는 NowNote 설치형 프로그램 패키지입니다.

중요한 기준:

- 설치형 프로그램은 별도 `.exe` 파일로 배포합니다.
- Web 전용 기능을 제외한 디자인, 화면 구조, 기능 구성은 Web과 동일하게 유지합니다.
- Web 전용 기능은 hosted Web 로그인 화면, 서버 공유문서 전용 조회, 그룹 참가/그룹 메신저처럼 공용 서버 Web 세션이 있어야 하는 기능입니다.
- Electron은 `desktop/app/index.html`을 로컬 앱 파일로 실행합니다.
- `desktop/app`에는 설치형 빌드에 포함할 Web 동일 화면 소스를 둡니다.
- 설치형은 Electron 전용 로컬 JSON 저장소를 우선 사용할 수 있습니다.
- 설치형 서버 연결은 ID/password 로그인이 아니라 서버 주소, 사용자 ID, 앱/설치형 접속 토큰 기준을 유지합니다.
- 2단계 인증 코드는 저장하지 않고 연결 테스트 때만 입력합니다.
- 구형 개인 서버 API 토큰과 기기 ID 직접 입력은 기본 화면이 아니라 고급 호환 설정에서만 확인합니다.

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
desktop/dist/NowNote-Setup-2.3.8-x64.exe
```

설치형 로컬 저장소가 재시작 후에도 유지되는지는 설치 파일 생성 후 아래 명령으로 점검합니다.

```bash
cd desktop
npm run check:storage
```

## Obsidian Vault 수동 동기화 (2.3.9 개발 후보)

설치형 화면 설정에서 Vault 폴더를 고른 뒤 **변경 내용 비교**를 실행합니다. 비교는 파일과 메모를 변경하지 않습니다. 목록의 기본 작업은 보류이며, 항목별 방향을 선택하고 **선택 항목 동기화**를 눌러야 반영됩니다. 주제·분류 본문은 각 폴더의 `_index.md`에 저장됩니다. Vault에만 있는 파일이나 빈 폴더는 가져올 상위 항목을 지정할 수 있습니다.

충돌·중복 ID·기존 무표식 `_index.md`는 자동 덮어쓰지 않습니다. 적용 결과의 실패 항목은 다시 비교합니다. 기존 파일을 바꾸기 전에 데스크톱 userData의 `vault-backups`에 복구 사본을 남깁니다. 복구는 프로그램을 종료한 뒤 원본을 따로 보관하고 해당 사본을 원래 위치에 복사한 후 재비교합니다. 실제 사용자 Vault로 테스트하지 말고 `D:\tmp\nownote-239-vault-qa` 같은 격리 폴더와 `NOWNOTE_DESKTOP_USER_DATA_DIR`을 사용합니다.

동시 편집으로 인한 덮어쓰기를 피하기 위해 Vault 안에도 `.nownote-*.backup` 숨김 원본을 보존합니다. 충돌 시 실패 메시지의 경로를 확인하세요. 자동 정리하지 않으며, 저장 실패 후 되돌린 신규 파일의 사본은 Vault 루트에 남을 수 있습니다.

안전한 하드 링크를 지원하지 않는 Vault에서는 기존 파일 변경·이동을 원본 이동 전에 중단합니다. 임시 파일 정리 실패는 적용 성공과 구분해 경고 경로를 표시합니다.

검증 명령: `node --test tests/vault-*.test.cjs tests/store-file.test.cjs`, `node scripts/check-vault-sync.mjs`. 후자는 임시 Vault/userData만 생성·삭제합니다.

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
