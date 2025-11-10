#!/bin/bash

echo "=== Trigger.dev Diagnostic ==="
echo ""

echo "1. Checking for running trigger.dev processes:"
ps aux | grep "trigger.dev" | grep -v grep | grep -v diagnose
echo ""

echo "2. Checking TRIGGER_SECRET_KEY in root .env:"
if [ -f ".env" ]; then
    grep "TRIGGER_SECRET_KEY" .env
else
    echo "  ❌ No root .env file found"
fi
echo ""

echo "3. Checking TRIGGER_SECRET_KEY in packages/jobs/.env:"
if [ -f "packages/jobs/.env" ]; then
    grep "TRIGGER_SECRET_KEY" packages/jobs/.env
else
    echo "  ❌ No packages/jobs/.env file found"
fi
echo ""

echo "4. Checking TRIGGER_SECRET_KEY in apps/api/.env:"
if [ -f "apps/api/.env" ]; then
    grep "TRIGGER_SECRET_KEY" apps/api/.env
else
    echo "  ❌ No apps/api/.env file found"
fi
echo ""

echo "5. Checking project ID in trigger.config.ts:"
grep "project:" packages/jobs/trigger.config.ts
echo ""

echo "6. Checking trigger.dev SDK version:"
echo "  packages/jobs:"
grep "@trigger.dev/sdk" packages/jobs/package.json
echo "  apps/api:"
grep "@trigger.dev/sdk" apps/api/package.json
echo ""

echo "7. Checking if authenticated:"
if [ -f "$HOME/.config/trigger/config.json" ]; then
    echo "  ✓ Auth config exists"
else
    echo "  ❌ Not authenticated - run: cd packages/jobs && npx trigger.dev@4.0.6 login"
fi
echo ""

echo "8. Testing trigger.dev CLI:"
cd packages/jobs
TRIGGER_SECRET_KEY=$(grep TRIGGER_SECRET_KEY .env | cut -d '=' -f2) npx trigger.dev@4.0.6 whoami
echo ""

echo "=== End Diagnostic ==="
