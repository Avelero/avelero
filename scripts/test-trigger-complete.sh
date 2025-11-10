#!/bin/bash

set -e

echo "======================================"
echo "Trigger.dev Complete Test & Diagnostic"
echo "======================================"
echo ""

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Cleaning up old processes${NC}"
pkill -f "trigger.dev" 2>/dev/null || true
sleep 2
echo "✓ Cleaned up"
echo ""

echo -e "${YELLOW}Step 2: Checking authentication${NC}"
cd packages/jobs
export TRIGGER_SECRET_KEY=$(grep TRIGGER_SECRET_KEY .env | cut -d '=' -f2)
echo "Using key: ${TRIGGER_SECRET_KEY:0:20}..."
npx --yes trigger.dev@4.0.6 whoami 2>&1 | grep -E "Email|Project"
echo ""

echo -e "${YELLOW}Step 3: Starting trigger.dev worker in background${NC}"
npx --yes trigger.dev@4.0.6 dev > /tmp/trigger-worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"
echo ""

echo -e "${YELLOW}Step 4: Waiting for worker to initialize (30 seconds)${NC}"
for i in {1..30}; do
    echo -n "."
    sleep 1

    # Check if worker logged "ready"
    if grep -q "ready" /tmp/trigger-worker.log 2>/dev/null; then
        echo ""
        echo -e "${GREEN}✓ Worker is ready!${NC}"
        break
    fi
done
echo ""
echo ""

echo -e "${YELLOW}Step 5: Worker status and logs${NC}"
if ps -p $WORKER_PID > /dev/null; then
    echo -e "${GREEN}✓ Worker process is running${NC}"
else
    echo -e "${RED}✗ Worker process died!${NC}"
    cat /tmp/trigger-worker.log
    exit 1
fi
echo ""

echo "Last 30 lines of worker log:"
tail -30 /tmp/trigger-worker.log
echo ""

echo -e "${YELLOW}Step 6: Checking what tasks are registered${NC}"
grep -E "task|Task|ready|Ready|Watching" /tmp/trigger-worker.log | tail -10
echo ""

echo "======================================"
echo -e "${GREEN}Setup complete!${NC}"
echo "======================================"
echo ""
echo "The trigger.dev worker is running in the background."
echo "Worker PID: $WORKER_PID"
echo "Logs: /tmp/trigger-worker.log"
echo ""
echo "To stop the worker: kill $WORKER_PID"
echo ""
echo "Now test your bulk import in the UI."
echo "Watch the logs: tail -f /tmp/trigger-worker.log"
echo ""
