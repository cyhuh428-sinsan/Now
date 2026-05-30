# NowNote 기여 안내

NowNote는 한국어 사용 흐름을 먼저 기준으로 개발합니다.
기여자는 기능 추가보다 기존 방향과 안전 기준을 먼저 확인해야 합니다.

## 기본 원칙

- 화면 문구와 사용자 문서는 한국어를 우선합니다.
- 영어 문서는 한국어 기준이 안정된 뒤 맞춥니다.
- 메모 본문에 사진 첨부는 1차 범위에 넣지 않습니다.
- 계층 메모는 주제 / 분류 / 메모 3단계 기준을 유지합니다.
- 암호화 저장은 메모 단위 선택 기능이며, 암호화 키를 저장소나 서버에 저장하지 않습니다.
- 서버 연결은 개인 Docker 서버와 공용 서버 흐름을 구분합니다.

## 작업 위치

- 모바일 앱: `now_app`
- Web/설치형 기준 화면: `web`
- 서버: `server`
- 공통 문서: `docs`

서버 기능을 작업할 때는 앱 폴더보다 저장소 루트와 `server`를 기준으로 봅니다.
모바일 UI나 Android 출시 문서를 작업할 때는 `now_app`을 기준으로 봅니다.

## 민감정보 금지

아래 값은 커밋하지 않습니다.

- `server/.env`
- `now_app/android/key.properties`
- `now_app/android/upload-keystore.jks`
- 실제 API 토큰
- 실제 DB 비밀번호
- 사용자별 접속 토큰
- LLM API 키

예시 파일에는 `change-this-*` 또는 `CHANGE_ME` placeholder만 사용합니다.

## 변경 전 확인

작업 전에는 변경 범위를 먼저 좁힙니다.

- 기존 동작을 바꾸는지 확인
- Web, 모바일, 서버 문서 중 같이 바꿔야 하는 곳 확인
- 서버 capability와 도움말 문구가 어긋나지 않는지 확인
- 공개 저장소/Google Play/개인정보 문서에 영향이 있는지 확인

## 점검

서버 관련 변경, 문서 정합성 변경, 공개 저장소 기준 변경은 서버 디렉터리에서 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py
```

`.env.example` 구조만 확인할 때는 아래 명령을 사용할 수 있습니다.

```bash
python3 scripts/preflight.py --env-file .env.example --allow-example
```

서버를 띄운 뒤에는 smoke test를 실행합니다.

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

공용 서버 오픈 전에는 아래 점검이 통과해야 합니다.

```bash
python3 scripts/preflight.py --public-server
```

## 문서 갱신

작업 중 오류나 대화 중단에 대비해 `docs/WORK_PROGRESS.md`를 갱신합니다.

기록할 내용:

- 시작한 작업
- 확인한 사실
- 구현 내용
- 검증 결과

## 커밋 기준

- 하나의 커밋은 하나의 의도를 갖습니다.
- 기능 변경과 문서 정리는 가능하면 분리합니다.
- 민감정보 제외, 공개 문서, 배포 절차처럼 운영에 영향을 주는 기준은 preflight 또는 smoke test에 회귀 방지 점검을 추가합니다.

## 기여 라이선스

NowNote에 제출하는 기여 코드는 별도 서면 합의가 없는 한 저장소의 Apache License 2.0 조건으로 제공됩니다.
