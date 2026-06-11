#!/usr/bin/env bash
# =============================================================================
# DevDocs Studio — Service Health Check Script
# =============================================================================
# Checks the health of all services and infrastructure components.
# Returns exit code 0 if all healthy, 1 if any service is unhealthy.
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +o allexport
fi

# ---------------------------------------------------------------------------
# Colors and helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
WARN_COUNT=0
RESULTS=()

check_http() {
  local NAME="$1"
  local URL="$2"
  local EXPECTED="${3:-200}"
  local TIMEOUT="${4:-5}"

  local HTTP_STATUS
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout "$TIMEOUT" \
    --max-time "$TIMEOUT" \
    "$URL" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}[PASS]${RESET} $NAME  ($URL)  HTTP $HTTP_STATUS"
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$NAME")
  elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "  ${RED}[FAIL]${RESET} $NAME  ($URL)  Connection refused / timeout"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$NAME")
  else
    echo -e "  ${YELLOW}[WARN]${RESET} $NAME  ($URL)  HTTP $HTTP_STATUS (expected $EXPECTED)"
    WARN_COUNT=$((WARN_COUNT + 1))
    RESULTS+=("WARN|$NAME")
  fi
}

check_tcp() {
  local NAME="$1"
  local HOST="$2"
  local PORT="$3"
  local TIMEOUT="${4:-3}"

  if nc -z -w "$TIMEOUT" "$HOST" "$PORT" 2>/dev/null; then
    echo -e "  ${GREEN}[PASS]${RESET} $NAME  ($HOST:$PORT)  TCP open"
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$NAME")
  else
    echo -e "  ${RED}[FAIL]${RESET} $NAME  ($HOST:$PORT)  TCP connection failed"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$NAME")
  fi
}

check_redis() {
  local HOST="${REDIS_HOST:-localhost}"
  local PORT="${REDIS_PORT:-6379}"
  local NAME="Redis"

  if redis-cli -h "$HOST" -p "$PORT" ping 2>/dev/null | grep -q PONG; then
    echo -e "  ${GREEN}[PASS]${RESET} $NAME  ($HOST:$PORT)  PONG received"
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$NAME")
  elif nc -z -w 3 "$HOST" "$PORT" 2>/dev/null; then
    echo -e "  ${YELLOW}[WARN]${RESET} $NAME  ($HOST:$PORT)  Port open but redis-cli not available"
    WARN_COUNT=$((WARN_COUNT + 1))
    RESULTS+=("WARN|$NAME")
  else
    echo -e "  ${RED}[FAIL]${RESET} $NAME  ($HOST:$PORT)  Not reachable"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$NAME")
  fi
}

check_postgres() {
  local HOST="${POSTGRES_HOST:-localhost}"
  local PORT="${POSTGRES_PORT:-5432}"
  local NAME="PostgreSQL"

  if command -v pg_isready &>/dev/null; then
    if pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null; then
      echo -e "  ${GREEN}[PASS]${RESET} $NAME  ($HOST:$PORT)  Ready"
      PASS=$((PASS + 1))
      RESULTS+=("PASS|$NAME")
      return 0
    fi
  fi

  # Fallback to TCP check
  check_tcp "$NAME" "$HOST" "$PORT"
}

check_mongo() {
  local HOST="${MONGODB_HOST:-localhost}"
  local PORT="${MONGODB_PORT:-27017}"
  check_tcp "MongoDB" "$HOST" "$PORT"
}

section() {
  echo ""
  echo -e "${BOLD}${CYAN}--- $* ---${RESET}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}DevDocs Studio — Health Check${RESET}"
echo "$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------
section "Infrastructure"

check_postgres
check_mongo
check_redis
check_tcp "RabbitMQ AMQP"     "${RABBITMQ_HOST:-localhost}" "${RABBITMQ_PORT:-5672}"
check_http "RabbitMQ Management" "http://${RABBITMQ_HOST:-localhost}:15672" "200"
check_tcp "Elasticsearch"       "${ELASTICSEARCH_HOST:-localhost}" "${ELASTICSEARCH_PORT:-9200}"
check_http "Elasticsearch HTTP" "http://${ELASTICSEARCH_HOST:-localhost}:${ELASTICSEARCH_PORT:-9200}/_cluster/health" "200"

# ---------------------------------------------------------------------------
# API Services (via health endpoints)
# ---------------------------------------------------------------------------
section "Application Services"

GATEWAY_HOST="${GATEWAY_HOST:-localhost}"
GATEWAY_PORT="${GATEWAY_PORT:-3000}"

check_http "API Gateway"          "http://${GATEWAY_HOST}:${GATEWAY_PORT}/health"
check_http "Auth Service"         "http://localhost:${AUTH_SERVICE_PORT:-3001}/health"
check_http "User Service"         "http://localhost:${USER_SERVICE_PORT:-3002}/health"
check_http "Project Service"      "http://localhost:${PROJECT_SERVICE_PORT:-3003}/health"
check_http "Document Service"     "http://localhost:${DOCUMENT_SERVICE_PORT:-3004}/health"
check_http "Template Service"     "http://localhost:${TEMPLATE_SERVICE_PORT:-3005}/health"
check_http "AI Service"           "http://localhost:${AI_SERVICE_PORT:-3006}/health"
check_http "Export Service"       "http://localhost:${EXPORT_SERVICE_PORT:-3007}/health"
check_http "File Service"         "http://localhost:${FILE_SERVICE_PORT:-3008}/health"
check_http "Notification Service" "http://localhost:${NOTIFICATION_SERVICE_PORT:-3009}/health"
check_http "Audit Service"        "http://localhost:${AUDIT_SERVICE_PORT:-3010}/health"
check_http "Analytics Service"    "http://localhost:${ANALYTICS_SERVICE_PORT:-3011}/health"

# ---------------------------------------------------------------------------
# Docker Containers (if docker is available)
# ---------------------------------------------------------------------------
if command -v docker &>/dev/null; then
  section "Docker Containers"
  echo ""
  docker-compose ps 2>/dev/null || docker compose ps 2>/dev/null || \
    echo -e "  ${YELLOW}[WARN]${RESET} Docker Compose status unavailable"
fi

# ---------------------------------------------------------------------------
# Metrics endpoints
# ---------------------------------------------------------------------------
section "Observability"

check_http "Gateway Metrics"   "http://${GATEWAY_HOST}:${METRICS_PORT:-9090}/metrics" "200"
check_http "Elasticsearch"     "http://${ELASTICSEARCH_HOST:-localhost}:9200" "200"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL + WARN_COUNT))

echo ""
echo -e "${BOLD}======================================"
echo "  Health Check Summary"
echo -e "======================================${RESET}"
echo ""
echo -e "  ${GREEN}Passing:${RESET}  $PASS / $TOTAL"
echo -e "  ${YELLOW}Warnings:${RESET} $WARN_COUNT / $TOTAL"
echo -e "  ${RED}Failing:${RESET}  $FAIL / $TOTAL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}Status: UNHEALTHY${RESET}"
  echo ""
  echo "  Failed services:"
  for RESULT in "${RESULTS[@]}"; do
    STATUS="${RESULT%%|*}"
    NAME="${RESULT##*|}"
    if [ "$STATUS" = "FAIL" ]; then
      echo -e "    ${RED}- $NAME${RESET}"
    fi
  done
  echo ""
  echo "  Troubleshooting:"
  echo "    make docker-up      — start infrastructure"
  echo "    make docker-logs    — view service logs"
  echo "    make docker-ps      — check container status"
  echo ""
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}${BOLD}Status: DEGRADED${RESET} (warnings present)"
  echo ""
  exit 0
else
  echo -e "  ${GREEN}${BOLD}Status: HEALTHY${RESET}"
  echo ""
  exit 0
fi
