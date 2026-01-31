#!/bin/bash
# Simple script to verify OAuth endpoints are registered
echo "Testing OAuth endpoints..."
echo "1. Google login URL: http://localhost:3000/api/v1/auth/google"
echo "2. Google callback URL: http://localhost:3000/api/v1/auth/google/callback"
echo "3. Microsoft login URL: http://localhost:3000/api/v1/auth/microsoft"
echo "4. Microsoft callback URL: http://localhost:3000/api/v1/auth/microsoft/callback"
echo "5. Get linked providers: GET http://localhost:3000/api/v1/auth/oauth/providers"
echo "6. Unlink provider: DELETE http://localhost:3000/api/v1/auth/oauth/providers/:provider"
