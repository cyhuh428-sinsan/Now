# NowNote 공용 서버 오픈 점검

이 문서는 개인 Docker 서버가 아니라 여러 사용자가 접속하는 공용 NowNote 서버를 열기 전에 확인할 운영 절차입니다.
공용 서버는 소스 기능만으로 열지 않고, 도메인, HTTPS, reverse proxy, 사용자별 접속 토큰 강제 설정까지 한 번에 맞춘 뒤 엽니다.

## 1. 공개 도메인

먼저 실제 공개 도메인을 확정합니다.

예시:

```text
nownote.example.com
```

DNS는 서버의 공인 IP를 가리켜야 합니다.
사설망 테스트에서는 공용 서버 완료 항목으로 처리하지 않습니다.

## 2. 서버 환경값

`server/.env`에서 아래 값을 공용 운영 기준으로 바꿉니다.

```env
NOW_PUBLIC_BASE_URL=https://nownote.example.com
NOW_BEHIND_REVERSE_PROXY=true
NOW_USER_TOKEN_REQUIRED=true
```

`NOW_API_TOKEN`과 `NOW_POSTGRES_PASSWORD`는 긴 랜덤 값이어야 합니다.
사용자별 접속 토큰 필수 모드에서는 앱과 Web/설치형 프로그램이 `X-Now-User-Token` 헤더를 함께 보내야 합니다.

## 3. Reverse Proxy

NowNote API 컨테이너는 기본적으로 호스트 `8750` 포트에서 대기합니다.
공용 운영에서는 외부 사용자에게 `8750` 포트를 직접 열기보다 HTTPS reverse proxy를 앞에 둡니다.

예시 파일:

- Nginx: `reverse_proxy/nginx.nownote.conf.example`
- Caddy: `reverse_proxy/Caddyfile.example`

운영 서버에서는 예시의 도메인과 인증서 설정을 실제 값으로 바꿉니다.
방화벽은 일반적으로 `80`, `443`만 공개하고, `8750`은 서버 내부 또는 reverse proxy에서만 접근하게 둡니다.

## 4. 배포와 점검

공용 기준까지 함께 확인하려면 아래처럼 실행합니다.

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url https://nownote.example.com --public-server
```

수동으로 나눠 확인할 때:

```bash
python3 scripts/preflight.py --public-server
docker compose up --build -d
python3 scripts/smoke_test.py --base-url https://nownote.example.com --token 긴-랜덤-토큰 --issue-local-user-token
```

`--public-server`는 아래 조건이 부족하면 실패하는 것이 정상입니다.

- `NOW_USER_TOKEN_REQUIRED=true`
- `NOW_PUBLIC_BASE_URL=https://도메인`
- `NOW_BEHIND_REVERSE_PROXY=true`

## 5. 운영 화면 확인

공용 오픈 전에는 아래 화면을 확인합니다.

- `https://nownote.example.com/admin/public`
- `https://nownote.example.com/admin/ops`
- `https://nownote.example.com/admin/users`
- `https://nownote.example.com/admin/devices`
- `https://nownote.example.com/auth/token`

`/api/v1/server` 응답의 `public_server_readiness.status`가 `ready`인지 확인합니다.
`remaining`에 `public_https_reverse_proxy`가 남아 있으면 공개 URL 또는 reverse proxy 설정이 아직 끝나지 않은 상태입니다.

## 6. 사용자 발급 흐름

1. `/admin/users/new`에서 사용자 ID를 만듭니다.
2. 사용자 수정 화면에서 사용자별 접속 토큰을 발급합니다.
3. 발급된 토큰 원문은 한 번만 표시되므로 사용자에게 안전하게 전달합니다.
4. 2단계 인증을 켠 사용자는 토큰 확인 때 6자리 코드를 함께 입력합니다.
5. 사용자는 앱 또는 Web/설치형 설정 화면에 서버 주소, API 토큰, 사용자 ID, 기기 ID, 사용자별 접속 토큰을 입력합니다.

## 7. 오픈 전 보류 기준

아래 중 하나라도 끝나지 않았으면 공용 서버를 정식 오픈하지 않습니다.

- HTTPS 인증서가 적용되지 않음
- reverse proxy가 실제 공개 도메인에서 동작하지 않음
- `NOW_USER_TOKEN_REQUIRED=true`가 아님
- 사용자별 데이터 격리 smoke test가 통과하지 않음
- `/admin/ops`에 `bad` 항목이 남아 있음
