# NowNote 공개 저장소 오픈 점검

이 문서는 NowNote를 공개 GitHub 저장소로 열기 전에 확인할 항목을 정리합니다.
실제 비밀값, 서명 키, 운영 서버 값은 저장소에 올리지 않습니다.

## 1. 공개 전 자동 점검

루트 디렉터리에서 아래 명령을 실행합니다.

```bash
python3 scripts/verify_public_repo_safety.py
```

이 검사는 Git에 추적되는 파일 기준으로 다음 항목을 확인합니다.

- `server/.env`가 추적되지 않는지 확인
- `now_app/android/key.properties`가 추적되지 않는지 확인
- Android 업로드 키 파일이 추적되지 않는지 확인
- API 토큰, DB 비밀번호, Android 서명 비밀번호에 실제값으로 보이는 값이 들어오지 않았는지 확인
- 개인 키, GitHub 토큰, OpenAI 형식 API 키, Slack 토큰 같은 원문 비밀값 패턴이 없는지 확인

서버 preflight도 함께 실행합니다.

```bash
cd server
python3 scripts/preflight.py --env-file .env.example --allow-example
```

## 2. 공개해도 되는 파일

아래 파일은 공개 저장소에 포함해도 됩니다.

- `.env.example`
- `now_app/android/key.properties.example`
- README, 도움말, 배포 문서
- GitHub 이슈/PR 템플릿
- 테스트와 preflight 스크립트

## 3. 공개하면 안 되는 파일

아래 파일은 공개 저장소에 포함하지 않습니다.

- `server/.env`
- `now_app/android/key.properties`
- `now_app/android/upload-keystore.jks`
- 실제 운영 도메인에 묶인 비공개 토큰
- 실제 사용자 데이터가 들어 있는 DB, 백업, 녹음 파일
- 실제 API 키 또는 개인 키

## 4. 문서와 템플릿 확인

공개 전 아래 문서가 현재 정책과 맞는지 확인합니다.

- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

현재 preflight는 위 파일의 존재와 핵심 보안/기여 문구를 확인합니다.

## 5. 라이선스

라이선스는 법적 선택이므로 자동으로 정하지 않습니다.
오픈소스 공개 전 신산님이 라이선스를 확정한 뒤 루트에 `LICENSE` 파일을 추가합니다.

후보 예시:

- MIT License: 사용과 배포가 단순한 편입니다.
- Apache License 2.0: 특허 조항까지 명확히 다루고 싶을 때 적합합니다.
- AGPLv3: 서버 프로그램을 수정해 네트워크로 제공하는 경우에도 공개 의무를 강하게 두고 싶을 때 검토합니다.

## 6. 공개 후 첫 확인

공개 후 GitHub Actions preflight가 통과하는지 확인합니다.
실패하면 Actions 로그의 실패 항목을 기준으로 수정하고, 로컬에서 같은 검증을 다시 실행합니다.
