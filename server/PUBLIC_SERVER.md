# NowNote 공용 서버 오픈 점검

이 문서는 개인 Docker 서버가 아니라 여러 사용자가 접속하는 공용 NowNote 서버를 열기 전에 확인할 운영 절차입니다.
공용 서버는 소스 기능만으로 열지 않고, 도메인, HTTPS, reverse proxy, 사용자별 접속 토큰 강제 설정까지 한 번에 맞춘 뒤 엽니다.

## 1. 공개 도메인

먼저 실제 공개 도메인을 확정합니다.

현재 1차 공개 도메인은 아래 값으로 확정했습니다.

```text
nownote.sinsan.kr
```

DNS는 서버의 공인 IP를 가리켜야 합니다.
사설망 테스트에서는 공용 서버 완료 항목으로 처리하지 않습니다.

NowNote 서버는 공개 페이지로 `/`와 `/privacy`에서 개인정보처리방침을 제공합니다.
공용 도메인을 열 때 `https://nownote.sinsan.kr/`가 인증 없이 열려야 하며, 운영 화면은 `/admin`과 `/monitor`에서 별도로 확인합니다.

## 2. 서버 환경값

`server/.env`에서 아래 값을 공용 운영 기준으로 바꿉니다.

```env
NOW_PUBLIC_BASE_URL=https://nownote.sinsan.kr
NOW_BEHIND_REVERSE_PROXY=true
NOW_USER_TOKEN_REQUIRED=true
```

예시 파일은 `server/.env.public.example`입니다.
`NOW_API_TOKEN`과 `NOW_POSTGRES_PASSWORD`는 긴 랜덤 값이어야 합니다.
사용자별 접속 토큰 필수 모드에서는 앱과 Web/설치형 프로그램이 `X-Now-User-Token` 헤더를 함께 보내야 합니다.

## 3. Reverse Proxy

NowNote API 컨테이너는 기본적으로 호스트 `8750` 포트에서 대기합니다.
공용 운영에서는 외부 사용자에게 `8750` 포트를 직접 열기보다 HTTPS reverse proxy를 앞에 둡니다.

예시 파일:

- Nginx: `reverse_proxy/nginx.nownote.conf.example`
- Nginx 실제 도메인 예시: `reverse_proxy/nginx.nownote.sinsan.kr.conf.example`
- Caddy: `reverse_proxy/Caddyfile.example`

운영 서버에서는 예시의 도메인과 인증서 설정을 실제 값으로 바꿉니다.
방화벽은 일반적으로 `80`, `443`만 공개하고, `8750`은 서버 내부 또는 reverse proxy에서만 접근하게 둡니다.

## 4. 배포와 점검

공용 기준까지 함께 확인하려면 아래처럼 실행합니다.

```bash
cd ~/deploy/Now/server
sh scripts/deploy_local.sh --base-url https://nownote.sinsan.kr --public-server
```

수동으로 나눠 확인할 때:

```bash
python3 scripts/preflight.py --public-server
docker compose up --build -d
python3 scripts/smoke_test.py --base-url https://nownote.sinsan.kr --token 긴-랜덤-토큰 --issue-local-user-token
```

`--public-server`는 아래 조건이 부족하면 실패하는 것이 정상입니다.

- `NOW_USER_TOKEN_REQUIRED=true`
- `NOW_PUBLIC_BASE_URL=https://도메인`
- `NOW_BEHIND_REVERSE_PROXY=true`

## 5. 운영 화면 확인

공용 오픈 전에는 아래 화면을 확인합니다.

- `https://nownote.sinsan.kr/`
- `https://nownote.sinsan.kr/privacy`
- `https://nownote.sinsan.kr/admin/public`
- `https://nownote.sinsan.kr/admin/ops`
- `https://nownote.sinsan.kr/admin/users`
- `https://nownote.sinsan.kr/admin/devices`
- `https://nownote.sinsan.kr/auth/token`

`/api/v1/server` 응답의 `public_server_readiness.status`가 `ready`인지 확인합니다.
`remaining`에 `public_https_reverse_proxy`가 남아 있으면 공개 URL 또는 reverse proxy 설정이 아직 끝나지 않은 상태입니다.

공개 도메인이 실제 NowNote API로 연결됐는지는 아래 항목으로 확인합니다.

- 화면: `/admin/public`
- JSON: `/api/v1/admin/public-route`

`/api/v1/admin/public-route`는 `NOW_PUBLIC_BASE_URL` 기준으로 `/health/ready`와 `/api/v1/server`를 호출합니다.
두 주소가 JSON이 아니라 HTML을 반환하면 정적 페이지나 다른 서비스로 reverse proxy가 연결된 상태로 봅니다.

## 6. 사용자 발급 흐름

1. `NOW_API_TOKEN`은 운영자/API 보호용으로만 사용하고 일반 사용자에게 배포하지 않습니다.
2. `/admin/users/new`에서 운영자 계정 1개와 테스트 사용자 1개를 먼저 만듭니다.
3. `/admin/users`에서 사용자별 접속 토큰을 발급합니다.
4. 발급된 토큰 원문은 한 번만 표시되므로 사용자에게 안전하게 전달합니다.
5. 신규 사용자는 처음에는 테스트 그룹 또는 비활성 상태로 만들고, 연결 확인 후 활성화합니다.
6. 운영자 계정은 2단계 인증을 켭니다.
7. 사용자는 앱 또는 Web/설치형 설정 화면에 서버 주소, 사용자 ID, 기기 ID, 사용자별 접속 토큰을 입력합니다.

## 7. 오픈 전 보류 기준

아래 중 하나라도 끝나지 않았으면 공용 서버를 정식 오픈하지 않습니다.

- HTTPS 인증서가 적용되지 않음
- reverse proxy가 실제 공개 도메인에서 동작하지 않음
- `NOW_USER_TOKEN_REQUIRED=true`가 아님
- 사용자별 데이터 격리 smoke test가 통과하지 않음
- `/admin/ops`에 `bad` 항목이 남아 있음
