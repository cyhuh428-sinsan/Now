#!/usr/bin/env sh
set -eu

BASE_URL="http://localhost:8750"
PUBLIC_SERVER=false
SKIP_PULL=false
SMOKE_TIMEOUT="30"
READY_RETRIES="60"
READY_DELAY="2"
USER_TOKEN=""
ISSUE_LOCAL_USER_TOKEN=false

usage() {
  cat <<'EOF'
NowNote 로컬/WSL 서버 갱신 도우미

사용법:
  sh scripts/deploy_local.sh [옵션]

옵션:
  --base-url URL        스모크 테스트 기준 서버 주소. 기본: http://localhost:8750
  --public-server      공용 서버 오픈 전 preflight 기준까지 확인
  --skip-pull          git pull origin main 생략
  --timeout 초         smoke test 요청 대기 시간. 기본: 30
  --ready-retries 횟수 /health/ready 준비 재시도 횟수. 기본: 60
  --ready-delay 초     /health/ready 재시도 간격. 기본: 2
  --user-token TOKEN   NOW_USER_TOKEN_REQUIRED=true smoke test에 사용할 사용자별 접속 토큰
  --issue-local-user-token
                      호환용 옵션. 공용 모드에서는 사용자 토큰이 없으면 자동 발급됩니다.
  -h, --help           도움말 표시
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      if [ "$#" -lt 2 ]; then
        echo "--base-url 값이 필요합니다." >&2
        exit 2
      fi
      BASE_URL="$2"
      shift 2
      ;;
    --public-server)
      PUBLIC_SERVER=true
      shift
      ;;
    --skip-pull)
      SKIP_PULL=true
      shift
      ;;
    --timeout)
      if [ "$#" -lt 2 ]; then
        echo "--timeout 값이 필요합니다." >&2
        exit 2
      fi
      SMOKE_TIMEOUT="$2"
      shift 2
      ;;
    --ready-retries)
      if [ "$#" -lt 2 ]; then
        echo "--ready-retries 값이 필요합니다." >&2
        exit 2
      fi
      READY_RETRIES="$2"
      shift 2
      ;;
    --ready-delay)
      if [ "$#" -lt 2 ]; then
        echo "--ready-delay 값이 필요합니다." >&2
        exit 2
      fi
      READY_DELAY="$2"
      shift 2
      ;;
    --user-token)
      if [ "$#" -lt 2 ]; then
        echo "--user-token 값이 필요합니다." >&2
        exit 2
      fi
      USER_TOKEN="$2"
      shift 2
      ;;
    --issue-local-user-token)
      ISSUE_LOCAL_USER_TOKEN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SERVER_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$SERVER_DIR/.." && pwd)

cd "$SERVER_DIR"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  echo "python3 또는 python 명령을 찾을 수 없습니다." >&2
  return 1
}

get_env_value() {
  key="$1"
  if [ ! -f ".env" ]; then
    return 0
  fi
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^[ \t]+|[ \t]+$/, "")
      gsub(/^'\''|'\''$/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' ".env"
}

wait_ready() {
  attempt=1
  while [ "$attempt" -le "$READY_RETRIES" ]; do
    if curl -fsS "$BASE_URL/health/ready" >/dev/null 2>&1; then
      echo "[OK] 서버 ready 확인"
      return 0
    fi
    echo "[대기] 서버 ready 준비 중... ($attempt/$READY_RETRIES)"
    attempt=$((attempt + 1))
    sleep "$READY_DELAY"
  done
  echo "[실패] 서버 ready 확인 실패: $BASE_URL/health/ready" >&2
  return 1
}

compose_up() {
  if docker compose version >/dev/null 2>&1; then
    docker compose up --build -d
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose up --build -d
    return 0
  fi
  echo "docker compose 또는 docker-compose 명령을 찾을 수 없습니다." >&2
  return 1
}

PYTHON=$(find_python)

echo "== NowNote 서버 갱신 시작 =="
echo "서버 주소: $BASE_URL"

if [ "$SKIP_PULL" = "false" ]; then
  echo "== 소스 갱신 =="
  cd "$REPO_DIR"
  git pull origin main
  cd "$SERVER_DIR"
fi

if [ ! -f ".env" ]; then
  echo ".env 파일이 없습니다. 먼저 server/.env.example을 복사해 server/.env를 준비하세요." >&2
  exit 1
fi

echo "== 배포 전 점검 =="
"$PYTHON" scripts/preflight.py
if [ "$PUBLIC_SERVER" = "true" ]; then
  "$PYTHON" scripts/preflight.py --public-server
fi

echo "== 컨테이너 갱신 =="
compose_up

echo "== 서버 준비 확인 =="
wait_ready
curl -fsS "$BASE_URL/health" >/dev/null
curl -fsS "$BASE_URL/api/v1/server" >/dev/null

echo "== 스모크 테스트 =="
API_TOKEN=$(get_env_value "NOW_API_TOKEN")
USER_TOKEN_REQUIRED=$(get_env_value "NOW_USER_TOKEN_REQUIRED")
if [ "$USER_TOKEN_REQUIRED" = "true" ] && [ -z "$USER_TOKEN" ]; then
  ISSUE_LOCAL_USER_TOKEN=true
fi

set -- scripts/smoke_test.py \
  --base-url "$BASE_URL" \
  --timeout "$SMOKE_TIMEOUT" \
  --ready-retries "$READY_RETRIES" \
  --ready-delay "$READY_DELAY"
if [ -n "$API_TOKEN" ]; then
  set -- "$@" --token "$API_TOKEN"
fi
if [ -n "$USER_TOKEN" ]; then
  set -- "$@" --user-token "$USER_TOKEN"
fi
if [ "$ISSUE_LOCAL_USER_TOKEN" = "true" ]; then
  set -- "$@" --issue-local-user-token
fi
"$PYTHON" "$@"

echo "== 완료 =="
echo "운영 화면: $BASE_URL/admin"
echo "모니터: $BASE_URL/monitor"
