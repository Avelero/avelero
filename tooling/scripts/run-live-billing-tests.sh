#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMP_DIR="/tmp/avelero-live-billing"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
TEMP_PROJECT_DIR="$TEMP_DIR/project"
TEMP_SUPABASE_DIR="$TEMP_PROJECT_DIR/supabase"
CONFIG_FILE="$TEMP_SUPABASE_DIR/config.toml"
PROJECT_ID="create-v1-live-billing"
API_PORT="4000"
STRIPE_LOG_FILE="$TEMP_DIR/stripe-listen.log"
API_LOG_FILE="$TEMP_DIR/api-server.log"
XDG_CONFIG_HOME="$TEMP_DIR/xdg"
STATUS_ENV_FILE="$TEMP_DIR/supabase-status.env"

load_optional_env_file() {
  local env_file="$1"

  if [[ ! -r "$env_file" ]]; then
    return 0
  fi

  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  set +a
}

run_api_preflight() {
  # Exercise the live webhook route before Stripe clocks burn minutes on a broken server.
  # Fail fast when the API server or webhook endpoint is not actually usable.
  local unsigned_status
  local unsigned_body
  local signed_output

  unsigned_body="$TEMP_DIR/webhook-preflight-unsigned.json"
  unsigned_status="$(
    curl -sS \
      -o "$unsigned_body" \
      -w '%{http_code}' \
      -X POST "http://127.0.0.1:${API_PORT}/webhooks/stripe" \
      -H 'content-type: application/json' \
      --data '{"preflight":true}'
  )"

  if [[ "$unsigned_status" != "400" ]]; then
    echo "Unsigned webhook preflight failed: expected HTTP 400, got ${unsigned_status}"
    cat "$unsigned_body" || true
    return 1
  fi

  if ! signed_output="$(
    cd "$ROOT_DIR/apps/api"
    STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" PORT="$API_PORT" bun -e '
      import Stripe from "stripe";

      // Send one valid signed webhook before the suite starts so long failures fail fast.
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const payload = JSON.stringify({
        id: `evt_preflight_${crypto.randomUUID().replace(/-/g, "")}`,
        object: "event",
        type: "codex.preflight.webhook",
        data: {
          object: {
            id: `obj_preflight_${crypto.randomUUID().replace(/-/g, "")}`,
            object: "preflight",
          },
        },
      });
      const signature = await stripe.webhooks.generateTestHeaderStringAsync({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
      });

      const response = await fetch(
        `http://127.0.0.1:${process.env.PORT}/webhooks/stripe`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          body: payload,
        },
      );

      const body = await response.text();
      console.log(JSON.stringify({ status: response.status, body }));

      if (response.status !== 200) {
        process.exit(1);
      }
    '
  )"; then
    echo "Signed webhook preflight failed"
    echo "$signed_output"
    return 1
  fi

  echo "$signed_output"
}

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

  if [[ $exit_code -ne 0 ]]; then
    echo "Live billing runner artifacts preserved at: ${TEMP_DIR:-unknown}" >&2
  else
    rm -rf "${TEMP_DIR:-}"
  fi
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

load_optional_env_file "$ROOT_DIR/apps/api/.env.test"

export NODE_ENV="test"
export PORT="$API_PORT"
export STRIPE_LIVE_TESTS="true"
export INTERNAL_API_KEY="${INTERNAL_API_KEY:-live-billing-test-key}"
export APP_URL="http://localhost:3000"
export ADDITIONAL_REDIRECT_URL="http://localhost:3000"
export SEND_EMAIL_HOOK_URI="http://localhost:55421/functions/v1/send-email"
export SEND_EMAIL_HOOK_SECRET="v1,whsec_YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE="
export GOOGLE_CLIENT_ID="test-google-client-id"
export GOOGLE_SECRET="test-google-secret"
export GOOGLE_REDIRECT_URI="http://localhost:55421/auth/v1/callback"
export XDG_CONFIG_HOME

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "Missing STRIPE_SECRET_KEY. Set it in the environment or add a test-mode key to apps/api/.env.test." >&2
  exit 1
fi

if [[ "${STRIPE_SECRET_KEY}" != sk_test_* ]]; then
  echo "Live Stripe billing tests require a Stripe test-mode secret key (sk_test_*)." >&2
  exit 1
fi

echo "Stopping any stale live billing Supabase stack..."
supabase stop \
  --project-id "$PROJECT_ID" \
  --no-backup \
  --workdir "$TEMP_PROJECT_DIR" >/dev/null 2>&1 || true

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
  --api-key "$STRIPE_SECRET_KEY" \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.created,invoice.finalized,invoice.updated,invoice.overdue,invoice.paid,invoice.payment_failed,invoice.voided,invoice.marked_uncollectible \
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

# Kill any stale API server left over from a previous run.
lsof -ti:"$API_PORT" | xargs kill 2>/dev/null || true

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

echo "Running API dependency and webhook preflight..."
dependencies_body="$TEMP_DIR/health-dependencies.json"
dependencies_status="$(
  curl -sS \
    -o "$dependencies_body" \
    -w '%{http_code}' \
    "http://127.0.0.1:${API_PORT}/health/dependencies"
)"

if [[ "$dependencies_status" != "200" ]]; then
  echo "API dependency preflight failed: expected HTTP 200, got ${dependencies_status}"
  cat "$dependencies_body" || true
  echo "--- api server log ---"
  cat "$API_LOG_FILE" || true
  exit 1
fi

if ! run_api_preflight; then
  echo "--- stripe listener log ---"
  cat "$STRIPE_LOG_FILE" || true
  echo "--- api server log ---"
  cat "$API_LOG_FILE" || true
  exit 1
fi

echo "Running live Stripe billing suite..."
if ! (cd "$ROOT_DIR/apps/api" && bun run test:billing:live); then
  echo ""
  echo "Live Stripe billing suite failed."
  echo "Full logs preserved at: ${TEMP_DIR}"
  echo "  Stripe listener: ${STRIPE_LOG_FILE}"
  echo "  API server:      ${API_LOG_FILE}"
  exit 1
fi
