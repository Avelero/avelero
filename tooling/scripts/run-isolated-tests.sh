#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMP_DIR="$(mktemp -d /tmp/avelero-test-db.XXXXXX)"
TEMP_PROJECT_DIR="$TEMP_DIR/project"
TEMP_SUPABASE_DIR="$TEMP_PROJECT_DIR/supabase"
CONFIG_FILE="$TEMP_SUPABASE_DIR/config.toml"
PROJECT_ID="create-v1-test"

cleanup() {
  local exit_code=$?
  set +e

  if [[ -d "${TEMP_PROJECT_DIR:-}" ]]; then
    supabase stop \
      --project-id "$PROJECT_ID" \
      --no-backup \
      --workdir "$TEMP_PROJECT_DIR" >/dev/null 2>&1 || true
  fi

  rm -rf "${TEMP_DIR:-}"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

mkdir -p "$TEMP_PROJECT_DIR"
cp -R "$ROOT_DIR/apps/api/supabase" "$TEMP_SUPABASE_DIR"

LC_ALL=C perl -pi -e 's/^project_id = ".*"$/project_id = "create-v1-test"/' "$CONFIG_FILE"
LC_ALL=C perl -pi -e 's/54321/55321/g; s/54322/55322/g; s/54323/55323/g; s/54324/55324/g; s/54327/55327/g; s/54328/55328/g' "$CONFIG_FILE"

if ! grep -q "^\[inbucket\]" "$CONFIG_FILE"; then
  cat >> "$CONFIG_FILE" <<'EOF'

[inbucket]
port = 55324
smtp_port = 55325
pop3_port = 55326
EOF
fi

export APP_URL="http://localhost:3000"
export ADDITIONAL_REDIRECT_URL="http://localhost:3000"
export SEND_EMAIL_HOOK_URI="http://localhost:55321/functions/v1/send-email"
export SEND_EMAIL_HOOK_SECRET="v1,whsec_YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="
export GOOGLE_CLIENT_ID="test-google-client-id"
export GOOGLE_SECRET="test-google-secret"
export GOOGLE_REDIRECT_URI="http://localhost:55321/auth/v1/callback"

echo "Starting disposable Supabase test stack..."
supabase start --workdir "$TEMP_PROJECT_DIR"

STATUS_ENV_FILE="$TEMP_DIR/supabase-status.env"
supabase status -o env --workdir "$TEMP_PROJECT_DIR" > "$STATUS_ENV_FILE"

set -a
# shellcheck source=/dev/null
source "$STATUS_ENV_FILE"
set +a

: "${DB_URL:?Missing DB_URL from supabase status}"
: "${API_URL:?Missing API_URL from supabase status}"
: "${ANON_KEY:?Missing ANON_KEY from supabase status}"
: "${SERVICE_ROLE_KEY:?Missing SERVICE_ROLE_KEY from supabase status}"

export DATABASE_URL="$DB_URL"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_KEY="$SERVICE_ROLE_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo "Syncing taxonomy data into disposable test DB..."
(cd "$ROOT_DIR/packages/taxonomy" && bun run sync)

echo "Running monorepo test suite against disposable test DB..."
(cd "$ROOT_DIR" && bun run test:raw)
