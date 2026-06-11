#!/usr/bin/env bash
# =============================================================================
# DevDocs Studio — Secret Generation Script
# =============================================================================
# Generates cryptographically strong random secrets for all required
# environment variables and writes them to .env files.
#
# Usage:
#   ./scripts/generate-secrets.sh              # Generate and print secrets
#   ./scripts/generate-secrets.sh --write      # Also write to .env files
#   ./scripts/generate-secrets.sh --force      # Overwrite existing .env files
#
# Options:
#   --write    Write generated secrets to .env files (merges with existing)
#   --force    Overwrite ALL secret values even if already set
#   --dry-run  Print generated secrets without writing anything (default)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
WRITE=false
FORCE=false
DRY_RUN=true

for ARG in "$@"; do
  case "$ARG" in
    --write)    WRITE=true;  DRY_RUN=false ;;
    --force)    FORCE=true ;;
    --dry-run)  DRY_RUN=true; WRITE=false ;;
    --help|-h)
      echo "Usage: $0 [--write] [--force] [--dry-run]"
      echo ""
      echo "  --write    Write secrets to .env files"
      echo "  --force    Overwrite existing secret values"
      echo "  --dry-run  Print only, do not write (default)"
      exit 0
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Secret generation helpers
# ---------------------------------------------------------------------------

# Generate a random hex string of given byte length (default 32 bytes = 64 hex chars)
gen_hex() {
  local BYTES="${1:-32}"
  openssl rand -hex "$BYTES" 2>/dev/null || \
    python3 -c "import secrets; print(secrets.token_hex($BYTES))" 2>/dev/null || \
    head -c "$BYTES" /dev/urandom | xxd -p | tr -d '\n'
}

# Generate a random base64 URL-safe string of given byte length
gen_base64() {
  local BYTES="${1:-32}"
  openssl rand -base64 "$BYTES" 2>/dev/null | tr '+/' '-_' | tr -d '=' || \
    python3 -c "import secrets; print(secrets.token_urlsafe($BYTES))"
}

# Generate a random alphanumeric password
gen_password() {
  local LENGTH="${1:-32}"
  LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*()-_=+[]{}' </dev/urandom 2>/dev/null \
    | head -c "$LENGTH" || \
    openssl rand -base64 "$LENGTH" | head -c "$LENGTH"
}

# Generate VAPID key pair
gen_vapid_keys() {
  if command -v web-push &>/dev/null; then
    web-push generate-vapid-keys --json
  else
    echo '{"publicKey":"<run: npx web-push generate-vapid-keys>","privateKey":"<run: npx web-push generate-vapid-keys>"}'
  fi
}

# ---------------------------------------------------------------------------
# Generate all secrets
# ---------------------------------------------------------------------------
generate_secrets() {
  echo ""
  echo -e "${BOLD}${CYAN}Generating DevDocs Studio Secrets${RESET}"
  echo -e "${YELLOW}Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')${RESET}"
  echo ""

  # JWT secrets
  JWT_ACCESS_SECRET=$(gen_hex 48)
  JWT_REFRESH_SECRET=$(gen_hex 48)
  SESSION_SECRET=$(gen_hex 48)

  # Database passwords
  POSTGRES_PASSWORD=$(gen_password 24)
  MONGODB_PASSWORD=$(gen_password 24)
  REDIS_PASSWORD=$(gen_password 24)
  RABBITMQ_PASSWORD=$(gen_password 24)

  # API / service secrets
  INTERNAL_API_KEY=$(gen_hex 32)
  WEBHOOK_SECRET=$(gen_hex 32)
  ENCRYPTION_KEY=$(gen_hex 32)   # Must be exactly 32 bytes for AES-256

  # VAPID keys for web push
  VAPID_PRIVATE_KEY=$(gen_hex 32)
  VAPID_PUBLIC_KEY="$(gen_base64 33)"

  # Meilisearch master key
  MEILISEARCH_MASTER_KEY=$(gen_hex 24)

  # Elasticsearch password
  ELASTICSEARCH_PASSWORD=$(gen_password 20)

  # Export the map for use in write function
  declare -gA SECRETS_MAP=(
    ["JWT_ACCESS_SECRET"]="$JWT_ACCESS_SECRET"
    ["JWT_REFRESH_SECRET"]="$JWT_REFRESH_SECRET"
    ["SESSION_SECRET"]="$SESSION_SECRET"
    ["POSTGRES_PASSWORD"]="$POSTGRES_PASSWORD"
    ["MONGODB_PASSWORD"]="$MONGODB_PASSWORD"
    ["REDIS_PASSWORD"]="$REDIS_PASSWORD"
    ["RABBITMQ_PASSWORD"]="$RABBITMQ_PASSWORD"
    ["INTERNAL_API_KEY"]="$INTERNAL_API_KEY"
    ["WEBHOOK_SECRET"]="$WEBHOOK_SECRET"
    ["ENCRYPTION_KEY"]="$ENCRYPTION_KEY"
    ["VAPID_PRIVATE_KEY"]="$VAPID_PRIVATE_KEY"
    ["VAPID_PUBLIC_KEY"]="$VAPID_PUBLIC_KEY"
    ["MEILISEARCH_API_KEY"]="$MEILISEARCH_MASTER_KEY"
    ["ELASTICSEARCH_PASSWORD"]="$ELASTICSEARCH_PASSWORD"
  )

  echo -e "${BOLD}Generated Secrets:${RESET}"
  echo ""
  printf "  %-35s %s\n" "JWT_ACCESS_SECRET"     "$JWT_ACCESS_SECRET"
  printf "  %-35s %s\n" "JWT_REFRESH_SECRET"    "$JWT_REFRESH_SECRET"
  printf "  %-35s %s\n" "SESSION_SECRET"        "$SESSION_SECRET"
  printf "  %-35s %s\n" "POSTGRES_PASSWORD"     "$POSTGRES_PASSWORD"
  printf "  %-35s %s\n" "MONGODB_PASSWORD"      "$MONGODB_PASSWORD"
  printf "  %-35s %s\n" "REDIS_PASSWORD"        "$REDIS_PASSWORD"
  printf "  %-35s %s\n" "RABBITMQ_PASSWORD"     "$RABBITMQ_PASSWORD"
  printf "  %-35s %s\n" "INTERNAL_API_KEY"      "$INTERNAL_API_KEY"
  printf "  %-35s %s\n" "WEBHOOK_SECRET"        "$WEBHOOK_SECRET"
  printf "  %-35s %s\n" "ENCRYPTION_KEY"        "$ENCRYPTION_KEY"
  printf "  %-35s %s\n" "VAPID_PUBLIC_KEY"      "$VAPID_PUBLIC_KEY"
  printf "  %-35s %s\n" "VAPID_PRIVATE_KEY"     "$VAPID_PRIVATE_KEY"
  printf "  %-35s %s\n" "MEILISEARCH_API_KEY"   "$MEILISEARCH_MASTER_KEY"
  printf "  %-35s %s\n" "ELASTICSEARCH_PASSWORD" "$ELASTICSEARCH_PASSWORD"
  echo ""
}

# ---------------------------------------------------------------------------
# Write a single key=value into a .env file (merge mode)
# ---------------------------------------------------------------------------
write_env_var() {
  local ENV_FILE="$1"
  local KEY="$2"
  local VALUE="$3"

  if [ ! -f "$ENV_FILE" ]; then
    warn "  .env not found: $ENV_FILE — skipping"
    return
  fi

  # Check if key already has a real value (not a placeholder)
  if grep -q "^${KEY}=" "$ENV_FILE" 2>/dev/null; then
    EXISTING=$(grep "^${KEY}=" "$ENV_FILE" | cut -d= -f2-)
    IS_PLACEHOLDER=false

    # Consider these patterns as placeholder values
    for PLACEHOLDER in "" "change-me" "changeme" "your-" "todo" "CHANGE_ME" "xxxxx"; do
      if [[ "$EXISTING" == *"$PLACEHOLDER"* ]] || [ -z "$EXISTING" ]; then
        IS_PLACEHOLDER=true
        break
      fi
    done

    if [ "$IS_PLACEHOLDER" = true ] || [ "$FORCE" = true ]; then
      # Replace the line
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENV_FILE"
      else
        sed -i "s|^${KEY}=.*|${KEY}=${VALUE}|" "$ENV_FILE"
      fi
      info "  Updated $KEY in $(basename "$ENV_FILE")"
    else
      info "  Skipped $KEY (already set) in $(basename "$ENV_FILE")"
    fi
  else
    # Key not present — append it
    echo "${KEY}=${VALUE}" >> "$ENV_FILE"
    info "  Appended $KEY to $(basename "$ENV_FILE")"
  fi
}

# ---------------------------------------------------------------------------
# Write secrets to .env files
# ---------------------------------------------------------------------------
write_secrets() {
  echo ""
  echo -e "${BOLD}Writing secrets to .env files...${RESET}"

  # Root .env
  ROOT_ENV="$ROOT_DIR/.env"

  # Create from example if missing
  if [ ! -f "$ROOT_ENV" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
      cp "$ROOT_DIR/.env.example" "$ROOT_ENV"
      info "Created $ROOT_ENV from .env.example"
    else
      touch "$ROOT_ENV"
      info "Created empty $ROOT_ENV"
    fi
  fi

  echo ""
  echo "  Root .env:"
  for KEY in "${!SECRETS_MAP[@]}"; do
    write_env_var "$ROOT_ENV" "$KEY" "${SECRETS_MAP[$KEY]}"
  done

  # Per-service .env files
  for SERVICE_DIR in "$ROOT_DIR"/services/*/; do
    SERVICE=$(basename "$SERVICE_DIR")
    SERVICE_ENV="$SERVICE_DIR/.env"

    if [ -f "$SERVICE_ENV" ]; then
      echo ""
      echo "  $SERVICE/.env:"
      for KEY in "${!SECRETS_MAP[@]}"; do
        # Only write if the key appears in the file
        if grep -q "^${KEY}" "$SERVICE_ENV" 2>/dev/null; then
          write_env_var "$SERVICE_ENV" "$KEY" "${SECRETS_MAP[$KEY]}"
        fi
      done
    fi
  done

  echo ""
  success "Secrets written. Review .env files before committing."
  warn "NEVER commit .env files to source control!"
}

# ---------------------------------------------------------------------------
# Validate that required secrets are set in .env
# ---------------------------------------------------------------------------
validate_secrets() {
  echo ""
  echo -e "${BOLD}Validating required secrets...${RESET}"
  echo ""

  local ENV_FILE="$ROOT_DIR/.env"
  local MISSING=0

  REQUIRED_SECRETS=(
    JWT_ACCESS_SECRET
    JWT_REFRESH_SECRET
    SESSION_SECRET
    POSTGRES_PASSWORD
  )

  PLACEHOLDER_PATTERNS=("change-me" "your-" "changeme" "xxxxx")

  for KEY in "${REQUIRED_SECRETS[@]}"; do
    if grep -q "^${KEY}=" "$ENV_FILE" 2>/dev/null; then
      VALUE=$(grep "^${KEY}=" "$ENV_FILE" | cut -d= -f2-)
      IS_PLACEHOLDER=false
      for P in "${PLACEHOLDER_PATTERNS[@]}"; do
        if [[ "$VALUE" == *"$P"* ]] || [ -z "$VALUE" ]; then
          IS_PLACEHOLDER=true
          break
        fi
      done

      if [ "$IS_PLACEHOLDER" = true ]; then
        echo -e "  ${YELLOW}[WEAK]${RESET}  $KEY — contains placeholder value"
        MISSING=$((MISSING + 1))
      else
        LEN=${#VALUE}
        echo -e "  ${GREEN}[OK]${RESET}    $KEY — set (length: $LEN)"
      fi
    else
      echo -e "  ${RED}[MISS]${RESET}  $KEY — not found in .env"
      MISSING=$((MISSING + 1))
    fi
  done

  echo ""
  if [ "$MISSING" -gt 0 ]; then
    warn "$MISSING secret(s) need attention."
    echo "  Run: ./scripts/generate-secrets.sh --write"
  else
    success "All required secrets are set."
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
generate_secrets

if [ "$WRITE" = true ]; then
  write_secrets
  validate_secrets
elif [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Dry-run mode. Pass --write to update .env files.${RESET}"
  echo ""
  validate_secrets
fi

echo ""
echo -e "${BOLD}Done.${RESET}"
echo ""
echo "  Security reminders:"
echo "    - Never commit .env files to version control"
echo "    - Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) in production"
echo "    - Rotate secrets regularly (every 90 days minimum)"
echo "    - Use separate secrets for each environment (dev/staging/production)"
echo ""
