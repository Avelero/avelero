#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMP_DIR="$(mktemp -d /tmp/avelero-live-billing.XXXXXX)"
TEMP_PROJECT_DIR="$TEMP_DIR/project"
TEMP_SUPABASE_DIR="$TEMP_PROJECT_DIR/supabase"
CONFIG_FILE="$TEMP_SUPABASE_DIR/config.toml"
PROJECT_ID="create-v1-live-billing"
API_PORT="4000"
STRIPE_LOG_FILE="$TEMP_DIR/stripe-listen.log"
API_LOG_FILE="$TEMP_DIR/api-server.log"
XDG_CONFIG_HOME="$TEMP_DIR/xdg"
STATUS_ENV_FILE="$TEMP_DIR/supabase-status.env"

cleanup() {
  local exit_code=$?
  set +e

  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${STRIPE_PID:-}" ]]; then
    kill "$STRIPE_PID" >/dev/null 2>&1 || true
    wait "$STRIPE_PID" >/dev/null 2>&1 || true
  fi

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

mkdir -p "$TEMP_PROJECT_DIR" "$XDG_CONFIG_HOME"
cp -R "$ROOT_DIR/apps/api/supabase" "$TEMP_SUPABASE_DIR"

LC_ALL=C perl -pi -e 's/^project_id = ".*"$/project_id = "create-v1-live-billing"/' "$CONFIG_FILE"
LC_ALL=C perl -pi -e 's/54321/55421/g; s/54322/55422/g; s/54323/55423/g; s/54324/55424/g; s/54327/55427/g; s/54328/55428/g' "$CONFIG_FILE"

if ! grep -q "^\[inbucket\]" "$CONFIG_FILE"; then
  cat >> "$CONFIG_FILE" <<'EOF'

[inbucket]
port = 55424
smtp_port = 55425
pop3_port = 55426
EOF
fi

set -a
# shellcheck source=/dev/null
source "$ROOT_DIR/apps/api/.env.test"
set +a

export NODE_ENV="test"
export PORT="$API_PORT"
export STRIPE_LIVE_TESTS="true"
export APP_URL="http://localhost:3000"
export ADDITIONAL_REDIRECT_URL="http://localhost:3000"
export SEND_EMAIL_HOOK_URI="http://localhost:55421/functions/v1/send-email"
export SEND_EMAIL_HOOK_SECRET="v1,whsec_YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="
export GOOGLE_CLIENT_ID="test-google-client-id"
export GOOGLE_SECRET="test-google-secret"
export GOOGLE_REDIRECT_URI="http://localhost:55421/auth/v1/callback"
export XDG_CONFIG_HOME

: "${STRIPE_SECRET_KEY:?Missing STRIPE_SECRET_KEY in environment}"

echo "Starting disposable Supabase live billing stack..."
supabase start --workdir "$TEMP_PROJECT_DIR"

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

echo "Syncing taxonomy data into disposable live billing DB..."
(cd "$ROOT_DIR/packages/taxonomy" && bun run sync)

echo "Starting Stripe webhook listener..."
stripe listen \
  --print-secret \
  --api-key "$STRIPE_SECRET_KEY" \
  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.created,invoice.finalized,invoice.updated,invoice.overdue,invoice.paid,invoice.payment_failed,invoice.voided,invoice.marked_uncollectible \
  --forward-to "http://127.0.0.1:${API_PORT}/webhooks/stripe" \
  >"$STRIPE_LOG_FILE" 2>&1 &
STRIPE_PID=$!

for _ in $(seq 1 100); do
  if ! kill -0 "$STRIPE_PID" >/dev/null 2>&1; then
    echo "Stripe listener exited unexpectedly"
    cat "$STRIPE_LOG_FILE"
    exit 1
  fi

  if grep -Eqo 'whsec_[A-Za-z0-9_]+' "$STRIPE_LOG_FILE"; then
    export STRIPE_WEBHOOK_SECRET
    STRIPE_WEBHOOK_SECRET="$(grep -Eo 'whsec_[A-Za-z0-9_]+' "$STRIPE_LOG_FILE" | head -n 1)"
    break
  fi

  sleep 0.2
done

if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  echo "Failed to capture STRIPE_WEBHOOK_SECRET from stripe listen"
  cat "$STRIPE_LOG_FILE"
  exit 1
fi

echo "Starting API server for webhook delivery..."
(
  cd "$ROOT_DIR/apps/api"
  bun run src/index.ts
) >"$API_LOG_FILE" 2>&1 &
API_PID=$!

api_ready="false"
for _ in $(seq 1 100); do
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "API server exited unexpectedly"
    cat "$API_LOG_FILE"
    exit 1
  fi

  if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    api_ready="true"
    break
  fi

  sleep 0.2
done

if [[ "$api_ready" != "true" ]]; then
  echo "API server never became healthy"
  cat "$API_LOG_FILE"
  exit 1
fi

echo "Running live Stripe billing suite..."
(cd "$ROOT_DIR/apps/api" && bun run test:billing:live)
