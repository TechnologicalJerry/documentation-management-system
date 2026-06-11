#!/usr/bin/env bash
# =============================================================================
# DevDocs Studio — Initial Project Setup Script
# =============================================================================
# This script bootstraps a fresh development environment:
#   1. Checks prerequisites
#   2. Copies .env files
#   3. Installs npm dependencies
#   4. Starts Docker infrastructure
#   5. Waits for databases to be ready
#   6. Runs Prisma migrations
#   7. Generates Prisma clients
#   8. Seeds development data
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants & colors
# ---------------------------------------------------------------------------
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
step()    { echo -e "\n${BOLD}${CYAN}==> $*${RESET}"; }
die()     { error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites check
# ---------------------------------------------------------------------------
check_prerequisites() {
  step "Checking prerequisites..."

  local MISSING=0

  # Node.js
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 22 ]; then
      success "Node.js $NODE_VER"
    else
      error "Node.js 22+ required (found $NODE_VER)"
      MISSING=1
    fi
  else
    error "Node.js not found. Install from https://nodejs.org"
    MISSING=1
  fi

  # npm
  if command -v npm &>/dev/null; then
    success "npm $(npm --version)"
  else
    error "npm not found."
    MISSING=1
  fi

  # Docker
  if command -v docker &>/dev/null; then
    success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
  else
    error "Docker not found. Install from https://docs.docker.com/get-docker/"
    MISSING=1
  fi

  # Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    success "Docker Compose $(docker compose version --short 2>/dev/null || echo 'v2')"
  elif command -v docker-compose &>/dev/null; then
    success "docker-compose $(docker-compose --version | awk '{print $3}' | tr -d ',')"
  else
    error "Docker Compose not found."
    MISSING=1
  fi

  # Git
  if command -v git &>/dev/null; then
    success "Git $(git --version | awk '{print $3}')"
  else
    warn "Git not found — version control features will be unavailable."
  fi

  if [ "$MISSING" -ne 0 ]; then
    die "Missing prerequisites. Please install the above and re-run this script."
  fi
}

# ---------------------------------------------------------------------------
# Copy .env files
# ---------------------------------------------------------------------------
setup_env_files() {
  step "Setting up environment files..."

  # Root .env
  if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
      cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
      success "Created $ROOT_DIR/.env from .env.example"
      warn "Review and update $ROOT_DIR/.env with your actual values."
    else
      warn "No .env.example found at root. Skipping root .env setup."
    fi
  else
    info ".env already exists at root. Skipping."
  fi

  # Per-service .env files
  for SERVICE_DIR in "$ROOT_DIR"/services/*/; do
    SERVICE=$(basename "$SERVICE_DIR")
    ENV_FILE="$SERVICE_DIR/.env"
    EXAMPLE_FILE="$SERVICE_DIR/.env.example"

    if [ ! -f "$ENV_FILE" ]; then
      if [ -f "$EXAMPLE_FILE" ]; then
        cp "$EXAMPLE_FILE" "$ENV_FILE"
        success "Created .env for $SERVICE"
      else
        info "No .env.example for $SERVICE — skipping."
      fi
    else
      info ".env already exists for $SERVICE. Skipping."
    fi
  done
}

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------
install_dependencies() {
  step "Installing dependencies..."

  cd "$ROOT_DIR"
  npm install
  success "Dependencies installed."
}

# ---------------------------------------------------------------------------
# Start Docker infrastructure
# ---------------------------------------------------------------------------
start_docker() {
  step "Starting Docker infrastructure..."

  cd "$ROOT_DIR"

  if docker compose ps &>/dev/null 2>&1; then
    docker compose up -d
  else
    docker-compose up -d
  fi

  success "Docker services started."
}

# ---------------------------------------------------------------------------
# Wait for PostgreSQL
# ---------------------------------------------------------------------------
wait_for_postgres() {
  step "Waiting for PostgreSQL to be ready..."

  local HOST="${POSTGRES_HOST:-localhost}"
  local PORT="${POSTGRES_PORT:-5432}"
  local MAX_RETRIES=30
  local RETRY=0

  while ! pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
      # Try nc as fallback
      if command -v nc &>/dev/null; then
        nc -z "$HOST" "$PORT" 2>/dev/null && break
      fi
      warn "PostgreSQL not reachable after $MAX_RETRIES attempts — continuing anyway."
      return 0
    fi
    info "  Waiting for PostgreSQL ($RETRY/$MAX_RETRIES)..."
    sleep 2
  done

  success "PostgreSQL is ready at $HOST:$PORT"
}

# ---------------------------------------------------------------------------
# Wait for MongoDB
# ---------------------------------------------------------------------------
wait_for_mongo() {
  step "Waiting for MongoDB to be ready..."

  local HOST="${MONGODB_HOST:-localhost}"
  local PORT="${MONGODB_PORT:-27017}"
  local MAX_RETRIES=30
  local RETRY=0

  while ! nc -z "$HOST" "$PORT" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
      warn "MongoDB not reachable after $MAX_RETRIES attempts — continuing anyway."
      return 0
    fi
    info "  Waiting for MongoDB ($RETRY/$MAX_RETRIES)..."
    sleep 2
  done

  success "MongoDB is ready at $HOST:$PORT"
}

# ---------------------------------------------------------------------------
# Wait for Redis
# ---------------------------------------------------------------------------
wait_for_redis() {
  step "Waiting for Redis to be ready..."

  local HOST="${REDIS_HOST:-localhost}"
  local PORT="${REDIS_PORT:-6379}"
  local MAX_RETRIES=20
  local RETRY=0

  while ! redis-cli -h "$HOST" -p "$PORT" ping &>/dev/null 2>&1; do
    # Fall back to nc
    if nc -z "$HOST" "$PORT" 2>/dev/null; then
      break
    fi
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
      warn "Redis not reachable after $MAX_RETRIES attempts — continuing anyway."
      return 0
    fi
    info "  Waiting for Redis ($RETRY/$MAX_RETRIES)..."
    sleep 2
  done

  success "Redis is ready at $HOST:$PORT"
}

# ---------------------------------------------------------------------------
# Run Prisma migrations
# ---------------------------------------------------------------------------
run_migrations() {
  step "Running database migrations..."

  bash "$SCRIPT_DIR/migrate.sh"
  success "Migrations complete."
}

# ---------------------------------------------------------------------------
# Generate Prisma clients
# ---------------------------------------------------------------------------
generate_prisma_clients() {
  step "Generating Prisma clients..."

  for SERVICE_DIR in "$ROOT_DIR"/services/*/; do
    SERVICE=$(basename "$SERVICE_DIR")
    SCHEMA="$SERVICE_DIR/prisma/schema.prisma"

    if [ -f "$SCHEMA" ]; then
      info "Generating Prisma client for $SERVICE..."
      (cd "$SERVICE_DIR" && npx prisma generate 2>&1 | tail -3) || \
        warn "Failed to generate Prisma client for $SERVICE"
    fi
  done

  success "Prisma clients generated."
}

# ---------------------------------------------------------------------------
# Seed databases
# ---------------------------------------------------------------------------
seed_databases() {
  step "Seeding development databases..."

  for SERVICE_DIR in "$ROOT_DIR"/services/*/; do
    SERVICE=$(basename "$SERVICE_DIR")
    SEED_TS="$SERVICE_DIR/prisma/seed.ts"
    SEED_JS="$SERVICE_DIR/prisma/seed.js"

    if [ -f "$SEED_TS" ] || [ -f "$SEED_JS" ]; then
      info "Seeding $SERVICE..."
      (cd "$SERVICE_DIR" && npm run prisma:seed 2>&1 | tail -5) || \
        warn "Seed failed for $SERVICE (non-fatal)"
    fi
  done

  success "Seeding complete."
}

# ---------------------------------------------------------------------------
# Build shared packages
# ---------------------------------------------------------------------------
build_packages() {
  step "Building shared packages..."

  cd "$ROOT_DIR"

  for PKG_DIR in packages/*/; do
    PKG=$(basename "$PKG_DIR")
    if [ -f "$PKG_DIR/package.json" ]; then
      info "Building $PKG..."
      (cd "$PKG_DIR" && npm run build 2>/dev/null) || \
        warn "Build failed for package $PKG (non-fatal)"
    fi
  done

  success "Shared packages built."
}

# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------
print_summary() {
  echo ""
  echo -e "${GREEN}${BOLD}======================================================"
  echo "  DevDocs Studio — Setup Complete!"
  echo -e "======================================================${RESET}"
  echo ""
  echo "  Services:"
  echo "    API Gateway:  http://localhost:3000"
  echo "    Auth:         http://localhost:3001"
  echo "    User:         http://localhost:3002"
  echo "    Project:      http://localhost:3003"
  echo "    Document:     http://localhost:3004"
  echo "    Template:     http://localhost:3005"
  echo "    AI:           http://localhost:3006"
  echo "    Export:       http://localhost:3007"
  echo "    File:         http://localhost:3008"
  echo "    Notification: http://localhost:3009"
  echo "    Audit:        http://localhost:3010"
  echo "    Analytics:    http://localhost:3011"
  echo ""
  echo "  Infrastructure:"
  echo "    PostgreSQL:   localhost:5432"
  echo "    MongoDB:      localhost:27017"
  echo "    Redis:        localhost:6379"
  echo "    RabbitMQ:     localhost:5672  (UI: localhost:15672)"
  echo "    Elasticsearch: localhost:9200"
  echo ""
  echo "  Next steps:"
  echo "    1. Review and update .env with real API keys"
  echo "    2. Run: make dev-gateway   (start individual services)"
  echo "    3. Run: make health-check  (verify everything is running)"
  echo "    4. Read: docs/DEVELOPMENT.md for full setup guide"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo -e "${BOLD}${CYAN}"
  echo "  ____          ____             "
  echo " |  _ \  _____  |  _ \  ___   ___ ___ "
  echo " | | | |/ _ \\ \\ | | | |/ _ \\ / __/ __|"
  echo " | |_| |  __/\\  \\| |_| | (_) | (__\\__ \\"
  echo " |____/ \\___|\\__/|____/ \\___/ \\___|___/"
  echo ""
  echo "  Studio — Backend Setup"
  echo -e "${RESET}"

  check_prerequisites
  setup_env_files
  install_dependencies
  start_docker
  sleep 5  # Brief wait for containers to initialize

  wait_for_postgres
  wait_for_mongo
  wait_for_redis

  run_migrations
  generate_prisma_clients
  build_packages
  seed_databases

  print_summary
}

main "$@"
