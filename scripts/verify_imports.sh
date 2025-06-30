#!/bin/bash
# verify_imports.sh - Script to verify all imports use the correct paths

echo "=== CHECKING SERVICE IMPORTS ==="
echo

# Check that all imports use the standardized paths
echo ">> Checking TTS imports:"
grep -r --include="*.js" "require.*ttsService" ./server | grep -v "services/ttsService"
echo

echo ">> Checking Translation imports:"
grep -r --include="*.js" "require.*translationService" ./server | grep -v "services/translationService"
echo

# Check that all socket handlers use the correct imports
echo ">> Checking socket controllers imports:"
grep -r --include="*.js" "require.*services" ./server/socket
echo

echo ">> Checking API controllers imports:"
grep -r --include="*.js" "require.*services" ./server/controllers
echo

echo "=== CHECKING DOCKER CONFIGURATION ==="
echo

echo ">> Checking docker-compose.yml service paths:"
grep -A2 "context:" ./docker-compose.yml
echo

echo "=== VERIFICATION COMPLETE ==="
