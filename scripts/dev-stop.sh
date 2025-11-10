#!/bin/bash

# Stop all development services

cd "$(dirname "$0")/.."

echo "Stopping all development services..."

# Kill processes by pattern
pkill -f "next dev" 2>/dev/null || true
pkill -f "bun run src/index.ts" 2>/dev/null || true
pkill -f "email dev" 2>/dev/null || true
pkill -f "trigger.dev.*dev" 2>/dev/null || true

# Wait a moment
sleep 2

# Check if anything is still running
REMAINING=$(ps aux | grep -E "next dev|bun run src/index.ts|email dev|trigger.dev.*dev" | grep -v grep | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "✓ All services stopped successfully"
else
    echo "⚠ Some processes may still be running:"
    ps aux | grep -E "next dev|bun run src/index.ts|email dev|trigger.dev.*dev" | grep -v grep
fi

# Clean up log files
rm -f /tmp/avelero-*.log 2>/dev/null || true
echo "✓ Cleaned up log files"
