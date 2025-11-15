#!/bin/bash
# Manual CORS Testing Script
# This script demonstrates CORS behavior with allowed and blocked origins

API_URL="http://localhost:3000"
ALLOWED_ORIGIN="http://localhost:3001"
BLOCKED_ORIGIN="https://malicious-site.com"

echo "================================================"
echo "Smart Apply API - CORS Security Test"
echo "================================================"
echo ""

# Test 1: Preflight request from allowed origin
echo "Test 1: Preflight request from ALLOWED origin"
echo "Origin: $ALLOWED_ORIGIN"
echo "Expected: Should return CORS headers"
echo "---"
curl -s -X OPTIONS "$API_URL/api/v1/auth/me" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -i | grep -iE "access-control|http/"
echo ""
echo ""

# Test 2: Preflight request from blocked origin
echo "Test 2: Preflight request from BLOCKED origin"
echo "Origin: $BLOCKED_ORIGIN"
echo "Expected: Should NOT return matching Access-Control-Allow-Origin"
echo "---"
curl -s -X OPTIONS "$API_URL/api/v1/auth/me" \
  -H "Origin: $BLOCKED_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -i | grep -iE "access-control|http/"
echo ""
echo ""

# Test 3: Check allowed methods
echo "Test 3: Check allowed HTTP methods"
echo "Expected: GET, POST, PUT, DELETE, PATCH"
echo "---"
curl -s -X OPTIONS "$API_URL/api/v1/auth/me" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -i | grep -i "access-control-allow-methods"
echo ""
echo ""

# Test 4: Check allowed headers
echo "Test 4: Check allowed headers"
echo "Expected: Content-Type, Authorization"
echo "---"
curl -s -X OPTIONS "$API_URL/api/v1/auth/me" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -i | grep -i "access-control-allow-headers"
echo ""
echo ""

# Test 5: Check credentials support
echo "Test 5: Check credentials support"
echo "Expected: Access-Control-Allow-Credentials: true"
echo "---"
curl -s -X OPTIONS "$API_URL/api/v1/auth/me" \
  -H "Origin: $ALLOWED_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -i | grep -i "access-control-allow-credentials"
echo ""
echo ""

echo "================================================"
echo "Test Complete"
echo "================================================"
echo ""
echo "Summary:"
echo "- Allowed origin ($ALLOWED_ORIGIN) should receive CORS headers"
echo "- Blocked origin ($BLOCKED_ORIGIN) should NOT receive matching CORS headers"
echo "- Allowed methods: GET, POST, PUT, DELETE, PATCH"
echo "- Allowed headers: Content-Type, Authorization"
echo "- Credentials: Enabled (true)"
echo ""
echo "For full test suite, run: npm run test:e2e -- cors.e2e-spec.ts"
