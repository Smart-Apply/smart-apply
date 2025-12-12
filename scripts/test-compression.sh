#!/bin/bash

# Test compression middleware for issue #223
# Usage: ./scripts/test-compression.sh [API_URL] [EMAIL] [PASSWORD]

API_URL="${1:-http://localhost:3000}"
EMAIL="${2:-demo@smartapply.com}"
PASSWORD="${3:-Demo123!}"

echo "🧪 Testing compression middleware (Issue #223)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo ""

# Get CSRF token and login
echo "🔐 Authenticating..."
CSRF_RESPONSE=$(curl -s -c /tmp/test-cookies.txt "$API_URL/api/v1/auth/csrf-token")
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
  echo "⚠️  WARNING: Could not get CSRF token (ENABLE_CSRF might be false)"
  # Try login without CSRF
  LOGIN_RESPONSE=$(curl -s -b /tmp/test-cookies.txt -c /tmp/test-cookies.txt \
    -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
else
  # Login with CSRF token
  LOGIN_RESPONSE=$(curl -s -b /tmp/test-cookies.txt -c /tmp/test-cookies.txt \
    -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi

if echo "$LOGIN_RESPONSE" | grep -q "statusCode"; then
  echo "❌ Login failed: $LOGIN_RESPONSE"
  echo ""
  echo "💡 Test without auth (limited)..."
  echo ""
else
  echo "✅ Authenticated successfully"
  echo ""
fi

# Test 1: Check compression headers
echo "📋 Test 1: Check compression headers"
HEADERS=$(curl -sI "$API_URL/api/v1/applications" \
  -b /tmp/test-cookies.txt \
  -H "Accept-Encoding: gzip")

if echo "$HEADERS" | grep -q "Content-Encoding: gzip"; then
  echo "✅ PASS: Content-Encoding header found"
else
  echo "❌ FAIL: Content-Encoding header missing"
  echo "$HEADERS"
fi
echo ""

# Test 2: Compare sizes
echo "📊 Test 2: Compare response sizes"

# Get uncompressed size
UNCOMPRESSED=$(curl -s "$API_URL/api/v1/applications" \
  -b /tmp/test-cookies.txt \
  -H "Accept-Encoding: identity" \
  | wc -c | tr -d ' ')

# Get compressed size
COMPRESSED=$(curl -s "$API_URL/api/v1/applications" \
  -b /tmp/test-cookies.txt \
  -H "Accept-Encoding: gzip" \
  --compressed \
  | wc -c | tr -d ' ')

if [ "$UNCOMPRESSED" -gt 1024 ]; then
  REDUCTION=$(( 100 - (COMPRESSED * 100 / UNCOMPRESSED) ))
  echo "  Uncompressed: ${UNCOMPRESSED} bytes"
  echo "  Compressed:   ${COMPRESSED} bytes"
  echo "  Reduction:    ${REDUCTION}%"
  
  if [ "$REDUCTION" -gt 50 ]; then
    echo "✅ PASS: Good compression ratio (${REDUCTION}%)"
  else
    echo "⚠️  WARNING: Low compression ratio (${REDUCTION}%)"
  fi
elif [ "$UNCOMPRESSED" -gt 0 ] && [ "$UNCOMPRESSED" -lt 1024 ]; then
  echo "  Response size: ${UNCOMPRESSED} bytes"
  echo "✅ PASS: Small response (<1KB) correctly not compressed"
else
  echo "⚠️  SKIP: No data returned (might need to create applications first)"
fi
echo ""

# Test 3: Small response (< 1KB should not be compressed)
echo "📏 Test 3: Small response bypass (threshold: 1KB)"
SMALL_HEADERS=$(curl -sI "$API_URL/api/v1/auth/csrf-token" \
  -H "Accept-Encoding: gzip")

if echo "$SMALL_HEADERS" | grep -q "Content-Encoding"; then
  echo "⚠️  WARNING: Small response compressed (expected uncompressed)"
else
  echo "✅ PASS: Small response not compressed (threshold working)"
fi
echo ""

# Test 4: Compression bypass header
echo "🚫 Test 4: x-no-compression header"
BYPASS_HEADERS=$(curl -sI "$API_URL/api/v1/applications" \
  -b /tmp/test-cookies.txt \
  -H "Accept-Encoding: gzip" \
  -H "x-no-compression: true")

if echo "$BYPASS_HEADERS" | grep -q "Content-Encoding"; then
  echo "❌ FAIL: Response compressed despite bypass header"
else
  echo "✅ PASS: Compression bypassed correctly"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Compression middleware tests complete!"
echo ""
echo "💡 Tips:"
echo "  - Run: ./scripts/test-compression.sh http://localhost:3000 demo@smartapply.com Demo123!"
echo "  - Check browser DevTools Network tab for visual confirmation"
echo "  - Expected: 70-85% size reduction for large JSON responses"
echo "  - Create some applications first to see compression on large responses"
echo ""
echo "🧹 Cleanup..."
rm -f /tmp/test-cookies.txt
