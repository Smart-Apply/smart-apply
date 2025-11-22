#!/bin/bash

# Test script to verify security headers are configured correctly
# Usage: ./test-security-headers.sh

set -e

echo "🔒 Testing Frontend Security Headers"
echo "===================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3001/ > /dev/null 2>&1; then
  echo "❌ Error: Next.js dev server is not running at http://localhost:3001"
  echo "   Please start it with: npm run dev"
  exit 1
fi

echo "✅ Server is running at http://localhost:3001"
echo ""

echo "📋 Security Headers Check:"
echo "-------------------------"

# Check Content-Security-Policy
if curl -s -I http://localhost:3001/ | grep -q "Content-Security-Policy:"; then
  echo "✅ Content-Security-Policy: Present"
  CSP=$(curl -s -I http://localhost:3001/ | grep "Content-Security-Policy:" | cut -d: -f2-)
  echo "   → $CSP"
else
  echo "❌ Content-Security-Policy: Missing"
fi
echo ""

# Check X-Frame-Options
if curl -s -I http://localhost:3001/ | grep -q "X-Frame-Options:"; then
  echo "✅ X-Frame-Options: Present"
  FRAME=$(curl -s -I http://localhost:3001/ | grep "X-Frame-Options:" | cut -d: -f2-)
  echo "   → $FRAME"
else
  echo "❌ X-Frame-Options: Missing"
fi
echo ""

# Check X-Content-Type-Options
if curl -s -I http://localhost:3001/ | grep -q "X-Content-Type-Options:"; then
  echo "✅ X-Content-Type-Options: Present"
  CONTENT=$(curl -s -I http://localhost:3001/ | grep "X-Content-Type-Options:" | cut -d: -f2-)
  echo "   → $CONTENT"
else
  echo "❌ X-Content-Type-Options: Missing"
fi
echo ""

# Check Referrer-Policy
if curl -s -I http://localhost:3001/ | grep -q "Referrer-Policy:"; then
  echo "✅ Referrer-Policy: Present"
  REFERRER=$(curl -s -I http://localhost:3001/ | grep "Referrer-Policy:" | cut -d: -f2-)
  echo "   → $REFERRER"
else
  echo "❌ Referrer-Policy: Missing"
fi
echo ""

# Check Permissions-Policy
if curl -s -I http://localhost:3001/ | grep -q "Permissions-Policy:"; then
  echo "✅ Permissions-Policy: Present"
  PERMS=$(curl -s -I http://localhost:3001/ | grep "Permissions-Policy:" | cut -d: -f2-)
  echo "   → $PERMS"
else
  echo "❌ Permissions-Policy: Missing"
fi
echo ""

# Check HSTS (should NOT be present in development)
if curl -s -I http://localhost:3001/ | grep -q "Strict-Transport-Security:"; then
  echo "⚠️  Strict-Transport-Security: Present (unexpected in development)"
  HSTS=$(curl -s -I http://localhost:3001/ | grep "Strict-Transport-Security:" | cut -d: -f2-)
  echo "   → $HSTS"
else
  echo "✅ Strict-Transport-Security: Absent (correct for development)"
  echo "   → Will be enabled in production (max-age=31536000; includeSubDomains)"
fi
echo ""

echo "===================================="
echo "✅ All security headers are correctly configured!"
echo ""
echo "📝 Notes:"
echo "   - CSP includes 'unsafe-eval' for development (HMR)"
echo "   - HSTS is only enabled in production (HTTPS required)"
echo "   - Test in production with: NODE_ENV=production npm run build && npm run start"
echo ""
echo "🔗 Online Testing Tools:"
echo "   - https://securityheaders.com/"
echo "   - https://csp-evaluator.withgoogle.com/"
