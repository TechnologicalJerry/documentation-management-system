#!/usr/bin/env bash
# =============================================================================
# DevDocs Studio — Database Migration Script
# =============================================================================
# Runs Prisma migrations for all services that have a prisma/schema.prisma.
# In development:  prisma migrate dev
# In production:   prisma migrate deploy  (set NODE_ENV=production)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# Load root .env if available
if [ -f "$ROOT_DIR/.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +o allexport
fi

NODE_ENV="${NODE_ENV:-development}"
FAILED_SERVICES=()

# ---------------------------------------------------------------------------
# Migrate a single service
# ---------------------------------------------------------------------------
migrate_service() {
  local SERVICE_DIR="$1"
  local SERVICE
  SERVICE=$(basename "$SERVICE_DIR")
  local SCHEMA="$SERVICE_DIR/prisma/schema.prisma"

  if [ ! -f "$SCHEMA" ]; then
    return 0
  fi

  info "Migrating $SERVICE..."

  # Load service-level .env if present
  local ENV_VARS=()
  if [ -f "$SERVICE_DIR/.env" ]; then
    while IFS= read -r LINE; do
      [[ -z "$LINE" || "$LINE" == \#* ]] && continue
      ENV_VARS+=("$LINE")
    done < "$SERVICE_DIR/.env"
  fi

  # Determine DATABASE_URL from service-specific env or build from shared vars
  local DATABASE_URL
  if grep -q "DATABASE_URL" "$SCHEMA" 2>/dev/null; then
    DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER:-devdocs}:${POSTGRES_PASSWORD:-devdocs_password}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-devdocs_studio}}"
    export DATABASE_URL
  fi

  local STATUS=0

  if [ "$NODE_ENV" = "production" ]; then
    # Production: deploy only (no schema changes allowed)
    info "  Mode: production (migrate deploy)"
    (
      cd "$SERVICE_DIR"
      env "${ENV_VARS[@]}" npx prisma migrate deploy 2>&1
    ) || STATUS=$?
  else
    # Development: auto-create migrations
    info "  Mode: development (migrate dev)"
    (
      cd "$SERVICE_DIR"
      env "${ENV_VARS[@]}" npx prisma migrate dev --skip-generate 2>&1
    ) || STATUS=$?
  fi

  if [ "$STATUS" -ne 0 ]; then
    error "Migration FAILED for $SERVICE (exit code $STATUS)"
    FAILED_SERVICES+=("$SERVICE")
    return 1
  fi

  success "  $SERVICE migration complete."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
step() { echo -e "\n${BOLD}${CYAN}==> $*${RESET}"; }

step "Running database migrations (NODE_ENV=$NODE_ENV)"

# Detect services with Prisma schemas
SERVICES_WITH_PRISMA=()
for SERVICE_DIR in "$ROOT_DIR"/services/*/; do
  if [ -f "$SERVICE_DIR/prisma/schema.prisma" ]; then
    SERVICES_WITH_PRISMA+=("$SERVICE_DIR")
  fi
done

if [ "${#SERVICES_WITH_PRISMA[@]}" -eq 0 ]; then
  warn "No services with Prisma schemas found. Nothing to migrate."
  exit 0
fi

info "Found ${#SERVICES_WITH_PRISMA[@]} service(s) with Prisma schemas:"
for SERVICE_DIR in "${SERVICES_WITH_PRISMA[@]}"; do
  info "  - $(basename "$SERVICE_DIR")"
done

echo ""

# Run migrations (sequentially to avoid DB conflicts)
for SERVICE_DIR in "${SERVICES_WITH_PRISMA[@]}"; do
  migrate_service "$SERVICE_DIR" || true
done

# Report results
echo ""
if [ "${#FAILED_SERVICES[@]}" -gt 0 ]; then
  error "Migration failed for the following services:"
  for S in "${FAILED_SERVICES[@]}"; do
    error "  - $S"
  done
  echo ""
  echo "Common fixes:"
  echo "  1. Ensure PostgreSQL is running:   make docker-up"
  echo "  2. Check DATABASE_URL in .env"
  echo "  3. Check prisma/schema.prisma for syntax errors"
  echo "  4. Run prisma studio: make prisma-studio SERVICE=<name>"
  exit 1
else
  echo -e "${GREEN}${BOLD}All migrations completed successfully.${RESET}"
fi
