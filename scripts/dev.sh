#!/bin/bash

# Simple dev script without turbo complexity
# Starts all services needed for development

set -e

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Trap to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down all services...${NC}"
    pkill -P $$ 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${GREEN}======================================"
echo -e "  Avelero Development Environment"
echo -e "======================================${NC}\n"

# Load environment variables (safely handle comments and empty lines)
if [ -f .env ]; then
    set -a
    source <(grep -v '^#' .env | grep -v '^$' | sed 's/\r$//')
    set +a
fi

# Check for required env vars
if [ -z "$TRIGGER_SECRET_KEY" ]; then
    echo -e "${RED}Error: TRIGGER_SECRET_KEY not found in .env${NC}"
    echo "Please create .env file with TRIGGER_SECRET_KEY"
    exit 1
fi

echo -e "${BLUE}Starting services...${NC}\n"

# Start API
echo -e "${GREEN}[1/6]${NC} Starting API server (port 3000)..."
cd apps/api
bun run dev > /tmp/avelero-api.log 2>&1 &
API_PID=$!
cd ../..
echo "       PID: $API_PID"

# Start Web
echo -e "${GREEN}[2/6]${NC} Starting Web app (port 3001)..."
cd apps/web
bun run dev > /tmp/avelero-web.log 2>&1 &
WEB_PID=$!
cd ../..
echo "       PID: $WEB_PID"

# Start App
echo -e "${GREEN}[3/6]${NC} Starting App (port 3000)..."
cd apps/app
bun run dev > /tmp/avelero-app.log 2>&1 &
APP_PID=$!
cd ../..
echo "       PID: $APP_PID"

# Start DPP
echo -e "${GREEN}[4/6]${NC} Starting DPP app (port 3002)..."
cd apps/dpp
bun run dev > /tmp/avelero-dpp.log 2>&1 &
DPP_PID=$!
cd ../..
echo "       PID: $DPP_PID"

# Start Email Dev
echo -e "${GREEN}[5/6]${NC} Starting Email dev (port 3003)..."
cd packages/email
bun run dev > /tmp/avelero-email.log 2>&1 &
EMAIL_PID=$!
cd ../..
echo "       PID: $EMAIL_PID"

# Start Trigger.dev Worker
echo -e "${GREEN}[6/6]${NC} Starting Trigger.dev worker..."
cd packages/jobs
if [ -f .env ]; then
    set -a
    source <(grep -v '^#' .env | grep -v '^$' | sed 's/\r$//')
    set +a
fi
bun run jobs > /tmp/avelero-trigger.log 2>&1 &
TRIGGER_PID=$!
cd ../..
echo "       PID: $TRIGGER_PID"

echo ""
echo -e "${GREEN}======================================"
echo -e "  All services started!"
echo -e "======================================${NC}\n"

echo -e "${BLUE}Service URLs:${NC}"
echo "  API:     http://localhost:3000"
echo "  App:     http://localhost:3000"
echo "  Web:     http://localhost:3001"
echo "  DPP:     http://localhost:3002"
echo "  Email:   http://localhost:3003"
echo ""

echo -e "${BLUE}Service PIDs:${NC}"
echo "  API:        $API_PID"
echo "  Web:        $WEB_PID"
echo "  App:        $APP_PID"
echo "  DPP:        $DPP_PID"
echo "  Email:      $EMAIL_PID"
echo "  Trigger.dev: $TRIGGER_PID"
echo ""

echo -e "${BLUE}Logs:${NC}"
echo "  API:        tail -f /tmp/avelero-api.log"
echo "  Web:        tail -f /tmp/avelero-web.log"
echo "  App:        tail -f /tmp/avelero-app.log"
echo "  DPP:        tail -f /tmp/avelero-dpp.log"
echo "  Email:      tail -f /tmp/avelero-email.log"
echo "  Trigger.dev: tail -f /tmp/avelero-trigger.log"
echo ""

echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for all background processes
wait
