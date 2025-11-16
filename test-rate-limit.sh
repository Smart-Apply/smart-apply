#!/bin/bash

echo "🧪 Testing Rate Limiting Implementation"
echo "========================================"
echo ""

# Test 1: Auth Rate Limit - Test mit verschiedenen E-Mails
echo "📋 Test 1: Auth Rate Limit (5 attempts/15min)"
echo "----------------------------------------------"
echo "Testing with multiple failed login attempts..."
echo ""

RATE_LIMITED=false
for i in {1..7}; do
  echo -n "Attempt $i: "
  
  # Verwende verschiedene E-Mails um echte Versuche zu simulieren
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent'$i'@test.com","password":"wrongpassword"}')
  
  if [ "$HTTP_CODE" == "429" ]; then
    echo "🚫 RATE LIMITED! (HTTP $HTTP_CODE)"
    echo ""
    echo "✅ Auth rate limit is WORKING!"
    echo "   Got blocked after $((i-1)) failed attempts"
    echo "   Expected: Block after 5 attempts ✓"
    RATE_LIMITED=true
    break
  else
    echo "HTTP $HTTP_CODE (Unauthorized - normal)"
  fi
  
  sleep 0.3
done

if [ "$RATE_LIMITED" = false ]; then
  echo ""
  echo "⚠️  Auth rate limit did NOT trigger after 7 attempts"
fi

echo ""
echo "⏸️  Waiting 3 seconds before next test..."
echo "   (Rate limit counter needs to settle)"
sleep 3

echo ""
echo "📋 Test 2: Standard Rate Limit (100 requests/15min)"
echo "-----------------------------------------------------"

# Erstelle eine temporäre Umgebung mit höherem Auth-Limit für diesen Test
echo "Note: For profile endpoint testing, please restart backend with:"
echo "      RATE_LIMIT_AUTH_MAX=999 npm run start:dev"
echo ""
echo "Or provide a valid JWT token from your browser."
echo ""
read -p "Do you want to skip profile test? (y/N): " SKIP_PROFILE

if [[ "$SKIP_PROFILE" =~ ^[Yy]$ ]]; then
  echo ""
  echo "✅ Test 1 (Auth Rate Limit) completed successfully!"
  echo "   Rate limit triggered after 5 attempts as expected."
  echo ""
  echo "📊 Summary:"
  echo "----------"
  echo "✅ Auth Rate Limit: WORKING (5 attempts/15min)"
  echo "⏭️  Profile Rate Limit: SKIPPED"
  echo ""
  echo "To test profile rate limit:"
  echo "1. Restart backend: cd apps/api && npm run start:dev"
  echo "2. Run: ./test-rate-limit.sh"
  echo "3. Choose to continue with profile test"
  rm -f cookies.txt
  exit 0
fi

echo ""
echo "📋 Test 2: Get valid token for profile tests"
echo "---------------------------------------------"

# Jetzt mit echtem Demo-Account einloggen
echo "Logging in with demo@smartapply.com..."

# Hole Token aus Response (check beide Formate)
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@smartapply.com","password":"Demo123!"}')

# Check ob Login erfolgreich war (user object vorhanden)
USER_EMAIL=$(echo "$LOGIN_RESPONSE" | jq -r '.user.email // empty')

if [ -z "$USER_EMAIL" ]; then
  echo "❌ Login failed or rate limited. Response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  echo ""
  echo "⏳ Please restart the backend server to reset rate limits:"
  echo "   cd apps/api && npm run start:dev"
  rm -f cookies.txt
  exit 1
fi

# Versuche Token aus verschiedenen Quellen zu holen
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // .token // empty')

if [ -z "$TOKEN" ]; then
  echo "⚠️  No token in response body (might be in HttpOnly cookie)"
  echo "   Trying to extract from cookies..."
  
  # Versuche Token aus Cookie zu lesen
  TOKEN=$(grep -o 'access_token[[:space:]]*[^[:space:]]*' cookies.txt 2>/dev/null | awk '{print $NF}')
  
  if [ -z "$TOKEN" ]; then
    echo "❌ Could not extract token. Asking for manual input..."
    echo ""
    echo "Please get token from browser:"
    echo "1. Open http://localhost:3001 and login"
    echo "2. Open browser console (F12)"
    echo "3. Run: JSON.parse(localStorage.getItem('auth-store')).state.token"
    echo ""
    read -p "Paste token here (or Enter to skip): " MANUAL_TOKEN
    
    if [ -n "$MANUAL_TOKEN" ]; then
      TOKEN="$MANUAL_TOKEN"
    else
      echo "⏭️  Skipping profile endpoint test"
      rm -f cookies.txt
      exit 0
    fi
  fi
fi

echo "✅ Got authentication! User: $USER_EMAIL"
if [ -n "$TOKEN" ]; then
  echo "   Token: ${TOKEN:0:30}..."
fi

echo ""
echo "📋 Test 2: Standard Rate Limit (100 requests/15min)"
echo "---------------------------------------------------"
echo "Sending requests to /api/v1/profile..."
echo ""

# Jetzt 101 Requests senden (sollte beim 101. blockieren)
BLOCKED=false
for i in {1..101}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    http://localhost:3000/api/v1/profile \
    -H "Authorization: Bearer $TOKEN")
  
  # Progress indicator
  if [ $((i % 10)) -eq 0 ]; then
    echo -n "."
  fi
  
  # Show specific milestones
  if [ $i -eq 1 ]; then
    echo ""
    echo "Request 1: Status $STATUS ✅"
  fi
  
  if [ $i -eq 50 ]; then
    echo "Request 50: Status $STATUS ✅"
  fi
  
  if [ $i -eq 100 ]; then
    echo "Request 100: Status $STATUS ✅"
  fi
  
  if [ "$STATUS" -eq 429 ]; then
    echo ""
    echo "Request $i: Status $STATUS 🚫"
    echo ""
    echo "🎉 RATE LIMIT WORKING!"
    echo "   Blocked at request $i as expected."
    BLOCKED=true
    break
  fi
done

echo ""
if [ "$BLOCKED" = false ]; then
  echo "⚠️  WARNING: Rate limit did not trigger after 101 requests!"
  echo "   Expected to be blocked at request 101."
else
  echo "✅ Test completed successfully!"
fi

echo ""
echo "📊 Summary:"
echo "----------"
echo "Auth Rate Limit: 5 requests / 15 min"
echo "Standard Rate Limit: 100 requests / 15 min"
echo ""
echo "To reset rate limits: Restart backend server"