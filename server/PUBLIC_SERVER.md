# NowNote 공용 서버 오픈 점검

이 문서는 개인 Docker 서버가 아니라 여러 사용자가 접속하는 공용 NowNote 서버를 열기 전에 확인할 운영 절차입니다.
공용 서버는 소스 기능만으로 열지 않고, 도메인, HTTPS, reverse proxy, 사용자별 접속 토큰 강제 설정까지 한 번에 맞춘 뒤 엽니다.
공용 서버 운영자는 일반 사용자의 계정 생성과 토큰 전달에 직접 개입하지 않고, Web 가입/로그인/토큰 발급 흐름을 열어둔 뒤 모니터링과 차단을 담당합니다.

## 1. 공개 도메인

먼저 실제 공개 도메인을 확정합니다.

현재 1차 공개 도메인은 아래 값으로 확정했습니다.

```text
nownote.sinsan.kr
```

DNS는 서버의 공인 IP를 가리켜야 합니다.
사설망 테스트에서는 공용 서버 완료 항목으로 처리하지 않습니다.

NowNote 서버는 루트 `/`에서 외부 PC용 Web 프로그램을 제공합니다.
개인정보처리방침은 `/privacy`와 `/privacy-policy`에서 제공합니다.
공용 도메인을 열 때 `https://nownote.sinsan.kr/`가 Web 프로그램으로 열려야 하며, 개인정보처리방침은 `https://nownote.sinsan.kr/privacy`, 운영 화면은 `/admin`과 `/monitor`에서 별도로 확인합니다.

## 2. 서버 환경값

`server/.env`에서 아래 값을 공용 운영 기준으로 바꿉니다.

```env
NOW_PUBLIC_BASE_URL=https://nownote.sinsan.kr
NOW_BEHIND_REVERSE_PROXY=true
NOW_USER_TOKEN_REQUIRED=true
NOW_SELF_REGISTRATION_ENABLED=true
NOW_SMTP_HOST=smtp.example.com
NOW_SMTP_FROM=noreply@nownote.sinsan.kr
```

예시 파일은 `server/.env.public.example`입니다.
`NOW_API_TOKEN`과 `NOW_POSTGRES_PASSWORD`는 긴 랜덤 값이어야 합니다.
사용자별 접속 토큰 필수 모드에서는 모바일 앱과 설치형 프로그램이 `X-Now-User-Token` 헤더를 함께 보내야 합니다.
Web 프로그램은 사용자 ID와 비밀번호로 로그인하고 서버가 발급한 `X-Now-Web-Session` 세션으로 공유 문서에 접근합니다.
사용자는 Web에서 직접 가입하고, 로그인 후 앱/설치형 연결 토큰을 직접 발급하거나 다시 확인할 수 있습니다.
비밀번호 재설정은 등록 이메일로 발송된 코드로 처리하므로 공용 오픈 전 SMTP 설정을 끝내야 합니다.

## 3. Reverse Proxy

NowNote API 컨테이너는 기본적으로 호스트 `8750` 포트에서 대기합니다.
공용 운영에서는 외부 사용자에게 `8750` 포트를 직접 열기보다 HTTPS reverse proxy를 앞에 둡니다.

예시 파일:

- Nginx: `reverse_proxy/nginx.nownote.conf.example`
- Nginx 실제 도메인 예시: `reverse_proxy/nginx.nownote.sinsan.kr.conf.example`
- Caddy: `reverse_proxy/Caddyfile.example`

운영 서버에서는 예시의 도메인과 인증서 설정을 실제 값으로 바꿉니다.
방화벽은 일반적으로 `80`, `443`만 공개하고, `8750`은 서버 내부 또는 reverse proxy에서만 접근하게 둡니다.

### Nginx Proxy Manager 사용 시

#### 권장 방식. 도메인 전체를 NowNote 서버로 연결

NowNote API와 Nginx Proxy Manager가 같은 Docker 네트워크에서 서로 이름을 해석할 수 있으면 Proxy Host를 아래처럼 설정합니다.

```text
Domain Names: nownote.sinsan.kr
Scheme: http
Forward Hostname / IP: now-api
Forward Port: 8080
Websockets Support: 필요 시 켬
SSL: 기존 Let's Encrypt 인증서 유지
Force SSL: 켬
```

Nginx Proxy Manager가 `now-api` 컨테이너 이름을 해석하지 못하는 환경이면 대체로 아래처럼 호스트 공개 포트를 사용합니다.

```text
Scheme: http
Forward Hostname / IP: 서버 IP 또는 호스트명
Forward Port: 8750
```

AMD 서버 기준으로 NowNote API가 `140.245.68.207:8750`에서 준비 완료라면 Nginx Proxy Manager의 Proxy Host 화면을 아래처럼 둡니다.

```text
Domain Names: nownote.sinsan.kr
Scheme: http
Forward Hostname / IP: 140.245.68.207
Forward Port: 8750
Access List: Publicly Accessible
SSL: Let's Encrypt 인증서
Force SSL: 켬
```

기존 화면이 `Forward Hostname / IP=nownote-site`, `Forward Port=80`이면 아직 정적 개인정보처리방침 사이트로 연결된 상태입니다.
도메인 전체를 NowNote 서버로 전환할 때는 `nownote-site -> 140.245.68.207`, `80 -> 8750`으로 바꿉니다.

NowNote 서버 자체가 루트 `/`에서 Web 프로그램을, `/privacy`에서 개인정보처리방침을 제공하므로 이 방식이 공용 서버와 개인 서버 모두의 기본 구조입니다.

#### 비권장. 기존 정적 사이트를 루트에 유지하는 방식

기존 `nownote-site:80` 정적 개인정보처리방침 사이트를 루트 도메인으로 유지하면 `https://nownote.sinsan.kr`이 Web 프로그램이 되지 않습니다.
NowNote 1차 운영 기준에서는 이 방식을 쓰지 않습니다.
부득이하게 과거 구성을 임시 유지할 때만 Nginx Proxy Manager의 `Custom locations`에서 아래 경로를 NowNote 서버로 보냅니다.

```text
/app          -> http://now-api:8080
/api          -> http://now-api:8080
/health       -> http://now-api:8080
/admin        -> http://now-api:8080
/monitor      -> http://now-api:8080
/auth         -> http://now-api:8080
/docs         -> http://now-api:8080
/openapi.json -> http://now-api:8080
```

Nginx Proxy Manager가 `now-api` 이름을 해석하지 못하면 각 경로의 Forward Hostname/IP를 `서버 IP 또는 호스트명`, Forward Port를 `8750`으로 설정합니다.

저장 후 `https://nownote.sinsan.kr/`가 Web 프로그램을 반환하고, `https://nownote.sinsan.kr/privacy`가 개인정보처리방침을 반환해야 합니다.
`https://nownote.sinsan.kr/health`, `https://nownote.sinsan.kr/health/ready`, `https://nownote.sinsan.kr/api/v1/server`는 HTML이 아니라 JSON을 반환해야 합니다.
개인정보처리방침 HTML이 계속 반환되면 아직 `nownote-site:80` 같은 정적 사이트로 연결된 상태입니다.
경로별 연결 방식을 쓰는 경우에도 `https://nownote.sinsan.kr/health/ready`가 JSON `{"status":"ready"}`를 반환해야 합니다.

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

공개 도메인이 실제 NowNote 서버로 연결됐는지는 아래 항목으로 확인합니다.

- 화면: `/admin/public`
- JSON: `/api/v1/admin/public-route`

`/api/v1/admin/public-route`는 `NOW_PUBLIC_BASE_URL` 기준으로 `/health/ready`와 `/api/v1/server`를 호출합니다.
두 주소가 JSON이 아니라 HTML을 반환하면 정적 페이지나 다른 서비스로 reverse proxy가 연결된 상태로 봅니다.

## 6. 사용자 가입과 토큰 발급 흐름

1. `NOW_API_TOKEN`은 운영자/API 보호용으로만 사용하고 일반 사용자에게 배포하지 않습니다.
2. 일반 사용자는 `https://nownote.sinsan.kr`에서 사용자 ID, 비밀번호, 이메일로 직접 가입합니다.
3. Web 사용자는 사용자 ID와 비밀번호로 로그인합니다.
4. 로그인 후 화면 설정의 서버 연결 영역에서 모바일 앱과 설치형 프로그램용 연결 토큰을 직접 발급합니다.
5. 발급된 토큰은 사용자가 같은 화면에서 다시 확인할 수 있고, 노출됐다고 판단하면 새로 발급합니다.
6. 모바일 앱과 설치형 사용자는 설정 화면에 서버 주소, 사용자 ID, 기기 ID, 연결 토큰을 입력합니다.
7. 비밀번호를 잊은 사용자는 등록 이메일로 재설정 코드를 받아 새 비밀번호를 설정합니다.
8. 운영자는 `/admin/users`에서 그룹, 활성 상태, 2단계 인증 사용 여부, 최근 접속 상태를 모니터링합니다.
9. 운영자 계정은 2단계 인증을 켭니다.

Web은 외부 PC 사용을 고려하므로 사용자별 접속 토큰을 직접 붙여넣는 방식으로 운영하지 않습니다.
서버에 공유된 내 문서만 표시하고, 일자별 메모는 기본 공유, 지식 메모는 공유로 선택한 항목만 서버 원본으로 다룹니다.

`/admin/users/new`와 `/admin/users/{owner_id}/token`은 운영자 계정 선등록, 테스트 계정, 장애 대응용 보조 기능입니다. 공용 서버의 일반 가입 흐름은 Web 직접 가입을 기준으로 합니다.

## 7. 오픈 전 보류 기준

아래 중 하나라도 끝나지 않았으면 공용 서버를 정식 오픈하지 않습니다.

- HTTPS 인증서가 적용되지 않음
- reverse proxy가 실제 공개 도메인에서 동작하지 않음
- `NOW_USER_TOKEN_REQUIRED=true`가 아님
- 비밀번호 재설정용 SMTP 설정이 없음
- 사용자별 데이터 격리 smoke test가 통과하지 않음
- `/admin/ops`에 `bad` 항목이 남아 있음
