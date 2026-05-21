# NowNote 보안 정책

NowNote는 로컬 우선 메모 앱과 직접 운영 가능한 서버를 함께 제공합니다.
보안 문제는 공개 이슈에 민감정보를 올리지 않고 비공개로 먼저 공유하는 것을 원칙으로 합니다.

## 신고 방법

보안 취약점, 토큰 노출, 인증 우회, 데이터 격리 문제를 발견하면 아래 주소로 신고합니다.

- 이메일: cyhuh428@gmail.com

신고할 때는 가능한 범위에서 아래 정보를 함께 전달해 주세요.

- 영향 받는 구성: 모바일 앱, Web/설치형 화면, 서버, Docker 배포, 공개 개인정보 페이지
- 재현 단계
- 영향 범위
- 로그 또는 화면 캡처

API 토큰, 사용자별 접속 토큰, DB 비밀번호, Android 서명 키, 실제 개인정보는 신고 본문에 그대로 넣지 않습니다.

## 민감정보 기준

아래 파일과 값은 Git에 올리지 않습니다.

- `server/.env`
- `now_app/android/key.properties`
- `now_app/android/upload-keystore.jks`
- 실제 `NOW_API_TOKEN`
- 실제 `NOW_POSTGRES_PASSWORD`
- 사용자별 접속 토큰
- LLM API 키

예시 파일에는 `change-this-*` 또는 `CHANGE_ME` placeholder만 사용합니다.

## 서버 운영 기준

개인 Docker 서버는 운영자가 직접 API 토큰과 DB 비밀번호를 관리합니다.

공용 서버로 열기 전에는 아래 조건을 확인합니다.

- `NOW_USER_TOKEN_REQUIRED=true`
- `NOW_PUBLIC_BASE_URL=https://도메인`
- `NOW_BEHIND_REVERSE_PROXY=true`
- 사용자별 접속 토큰 발급과 검증
- 2단계 코드 검증
- 사용자별 데이터 격리 smoke test

## 데이터 보호 기준

- 2단계 인증 코드는 저장하지 않고 확인 요청에만 사용합니다.
- 사용자별 접속 토큰은 원문을 저장하지 않고 해시와 발급 시각만 저장합니다.
- 서버 API 토큰과 LLM API 키는 모바일 기기의 보안 저장소에 저장합니다.
- Android 자동 클라우드 백업에는 개인 기록과 서버 접속 정보를 포함하지 않도록 설정합니다.

## 점검

배포 전에는 서버 디렉터리에서 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰
```

공용 서버 오픈 전에는 추가로 아래 점검을 실행합니다.

```bash
python3 scripts/preflight.py --public-server
```
