# NowNote 서버 인증 기준

이 문서는 1차 서버에서 개인 Docker 서버와 공용 NowNote 서버의 인증 기준을 구분하기 위한 운영 메모입니다.

## 현재 구현

- 서버 API 보호는 `.env`의 `NOW_API_TOKEN` 하나를 기준으로 합니다.
- 앱과 Web/설치형 프로그램은 서버 주소, API 토큰, 사용자 ID, 기기 ID를 저장해 서버에 연결합니다.
- 사용자 ID(`owner_id`)별 프로필, 시간대, 그룹, 2단계 인증 사용 여부, 활성 상태는 서버에 저장됩니다.
- 관리자 화면과 API에서 사용자별 접속 토큰을 발급할 수 있습니다.
- 사용자별 접속 토큰은 원문을 저장하지 않고 해시와 발급 시각만 저장합니다.
- 사용자 토큰 확인 화면 `/auth/token`과 토큰 확인 API `/api/v1/auth/token-login`이 준비되어 있습니다.
- 비활성 사용자는 프로필 조회 외의 동기화, 메모, 녹음, 분석 API가 차단됩니다.
- `NOW_USER_TOKEN_REQUIRED=true`이면 데이터 API는 `X-Now-User-Token` 헤더를 사용자 ID와 대조합니다.
- 사용자별 기기 목록 조회와 기기 활성/비활성 변경 API가 준비되어 있습니다.
- 2단계 인증 사용자는 토큰 로그인 때 6자리 추가 코드를 검증합니다.

## 개인 Docker 서버

개인 서버는 서버 소유자와 사용자가 사실상 같은 운영 모델입니다.

- `NOW_API_TOKEN`을 긴 랜덤 값으로 바꿉니다.
- `NOW_USER_TOKEN_REQUIRED=false`로 시작할 수 있습니다.
- DB 비밀번호를 첫 실행 전에 확정합니다.
- 서버는 외부에 공개하지 않거나, 필요한 사람에게만 API 토큰을 공유합니다.
- 사용자 ID는 `local_user`로 시작해도 되고, 여러 기기를 구분하려면 운영자가 정한 owner ID를 사용할 수 있습니다.

이 모델에서는 1차 인증 구조로 실제 사용이 가능합니다.

## 공용 NowNote 서버

공용 서버는 서로 다른 사용자가 같은 서버에 접속하는 운영 모델입니다.

현재의 단일 `NOW_API_TOKEN`만으로는 공용 서버를 정식 오픈하기에 부족합니다. 사용자별 접속 토큰은 발급, 토큰 확인 화면/API, 2단계 코드 검증, 데이터 API 검증 단계까지 준비되어 있으며, 공용 서버 오픈 전에는 아래 기능을 추가로 확정해야 합니다.

- HTTPS, reverse proxy, 운영 알림

관리 화면의 사용자 그룹, 활성 상태, 2단계 인증 사용 여부, 사용자 토큰 확인 화면/API, 2단계 코드 검증 절차, 사용자별 기기 조회/해제 API, 사용자별 데이터 격리 자동 검증은 공용 서버 운영을 위한 준비 기능입니다. 공개 운영 절차가 완성되기 전까지는 제한된 테스트 서버로만 사용합니다.

## 점검 명령

개인 Docker 서버 배포 전:

```bash
python3 scripts/preflight.py
```

공용 서버 오픈 전:

```bash
python3 scripts/preflight.py --public-server
```

사용자별 토큰 필수 모드에서 서버 동작을 점검할 때:

```bash
python3 scripts/smoke_test.py --base-url http://localhost:8750 --token 긴-랜덤-토큰 --issue-local-user-token
```

`--public-server`는 `NOW_PUBLIC_BASE_URL=https://도메인`, `NOW_BEHIND_REVERSE_PROXY=true`가 설정되지 않으면 의도적으로 실패합니다. 이 실패는 공용 서버에 필요한 공개 운영 절차가 아직 남아 있음을 알려주는 안전장치입니다.
