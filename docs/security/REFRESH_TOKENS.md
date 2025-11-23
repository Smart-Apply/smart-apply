# Refresh Token Strategy

This document describes the refresh token implementation in Smart Apply, which provides enhanced security and improved user experience through automatic token refresh.

## Overview

The application uses a dual-token authentication strategy:

- **Access Token**: Short-lived (15 minutes), used for API authentication
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens

Both tokens are stored in HttpOnly cookies for XSS protection.

## Architecture

### Token Flow

```
┌─────────────┐                ┌─────────────┐                ┌──────────────┐
│   Client    │                │   Backend   │                │  Database    │
└──────┬──────┘                └──────┬──────┘                └──────┬───────┘
       │                              │                               │
       │  1. Login/Register           │                               │
       ├─────────────────────────────>│                               │
       │                              │                               │
       │                              │  2. Generate Tokens          │
       │                              │  3. Hash Refresh Token       │
       │                              ├──────────────────────────────>│
       │                              │                               │
       │  4. Set Cookies (access +    │                               │
       │     refresh tokens)          │                               │
       │<─────────────────────────────┤                               │
       │                              │                               │
       │  5. API Request (access      │                               │
       │     token in cookie)         │                               │
       ├─────────────────────────────>│                               │
       │                              │                               │
       │  6. 401 (token expired)      │                               │
       │<─────────────────────────────┤                               │
       │                              │                               │
       │  7. POST /auth/refresh       │                               │
       │     (refresh token in cookie)│                               │
       ├─────────────────────────────>│                               │
       │                              │                               │
       │                              │  8. Validate & Revoke Old    │
       │                              ├──────────────────────────────>│
       │                              │                               │
       │                              │  9. Generate New Tokens      │
       │                              │  10. Store New Refresh Token │
       │                              ├──────────────────────────────>│
       │                              │                               │
       │  11. Set New Cookies         │                               │
       │<─────────────────────────────┤                               │
       │                              │                               │
       │  12. Retry Original Request  │                               │
       ├─────────────────────────────>│                               │
       │                              │                               │
       │  13. Success                 │                               │
       │<─────────────────────────────┤                               │
```

## Backend Implementation

### Database Schema

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique // Hashed token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  isRevoked Boolean  @default(false)
  
  // Security tracking
  userAgent String?
  ipAddress String?
  
  @@index([userId])
  @@index([token])
}
```

### Token Generation

When a user logs in or registers:

1. **Generate Access Token** (15 minutes expiration)
   ```typescript
   const accessToken = jwtService.sign(
     { sub: userId, email, type: 'access' },
     { expiresIn: '15m' }
   );
   ```

2. **Generate Refresh Token** (30 days expiration)
   ```typescript
   const refreshToken = jwtService.sign(
     { sub: userId, email, type: 'refresh' },
     { expiresIn: '30d' }
   );
   ```

3. **Hash and Store Refresh Token**
   ```typescript
   const hashedToken = await argon2.hash(refreshToken);
   await prisma.refreshToken.create({
     data: {
       token: hashedToken,
       userId,
       expiresAt: /* 30 days from now */,
       userAgent: req.headers['user-agent'],
       ipAddress: req.ip,
     },
   });
   ```

4. **Set HttpOnly Cookies**
   ```typescript
   res.cookie('access_token', accessToken, {
     httpOnly: true,
     secure: isProduction,
     sameSite: 'strict',
     maxAge: 15 * 60 * 1000, // 15 minutes
   });

   res.cookie('refresh_token', refreshToken, {
     httpOnly: true,
     secure: isProduction,
     sameSite: 'strict',
     maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
   });
   ```

### Token Refresh Endpoint

**POST /api/v1/auth/refresh**

1. Extract refresh token from cookie
2. Verify JWT signature and expiration
3. Check token type is 'refresh'
4. Validate token exists in database (not revoked, not expired)
5. **Revoke old refresh token** (rotation strategy)
6. Generate new token pair
7. Store new refresh token
8. Set new cookies
9. Clean up old/expired tokens

### Token Rotation

For enhanced security, each refresh operation:
- Invalidates the old refresh token
- Generates a new access token AND new refresh token
- Limits the damage if a refresh token is compromised

### Security Features

1. **Max Tokens Per User**: Limit of 5 active refresh tokens per user (oldest are automatically revoked)
2. **Device Tracking**: Store user agent and IP address for audit trail
3. **Token Hashing**: Refresh tokens are hashed before storage (using argon2)
4. **Automatic Cleanup**: Expired and revoked tokens are deleted during refresh
5. **Token Type Validation**: Access tokens cannot be used as refresh tokens and vice versa

## Frontend Implementation

### Automatic Token Refresh

The API client automatically handles token refresh:

```typescript
async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include', // Include cookies
    });

    if (response.status === 401 && !isAuthEndpoint) {
      // Access token expired, try to refresh
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Retry original request with new access token
        return fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          credentials: 'include',
        });
      } else {
        // Refresh failed, redirect to login
        window.location.href = '/login?session_expired=true';
      }
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}
```

### Refresh Token Endpoint

```typescript
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send refresh token cookie
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return false;
  }
}
```

## Configuration

### Environment Variables

```bash
# Short-lived access tokens (15 minutes recommended)
JWT_ACCESS_EXPIRES_IN=15m

# Long-lived refresh tokens (30 days recommended)
JWT_REFRESH_EXPIRES_IN=30d
```

### Cookie Configuration

**Development:**
- `secure: false` (HTTP allowed)
- `sameSite: 'strict'`

**Production:**
- `secure: true` (HTTPS only)
- `sameSite: 'strict'`

## Security Considerations

### Why HttpOnly Cookies?

1. **XSS Protection**: JavaScript cannot access HttpOnly cookies
2. **Automatic Inclusion**: Browser automatically includes cookies in requests
3. **No localStorage Risk**: Tokens are not exposed in client-side storage

### Why Token Rotation?

If a refresh token is compromised:
- The old token becomes invalid after first use
- The attacker gets a window of only one refresh cycle
- Legitimate user will fail to refresh, detecting the compromise

### Why Short Access Tokens?

- Limits the damage if an access token is stolen
- Forces regular re-authentication via refresh token
- Provides better audit trail of user sessions

### Logout

On logout:
1. All refresh tokens for the user are revoked in database
2. Both cookies are cleared
3. User must re-authenticate to get new tokens

```typescript
// Logout endpoint
await authService.revokeRefreshToken(userId); // Revoke all tokens
res.clearCookie('access_token');
res.clearCookie('refresh_token');
```

## Testing

Comprehensive E2E tests cover:

- ✅ Token refresh with valid refresh token
- ✅ Rejection of invalid/missing refresh token
- ✅ Rejection of revoked refresh token
- ✅ Token rotation (old token becomes invalid)
- ✅ Max tokens per user enforcement
- ✅ Logout revokes all refresh tokens
- ✅ Device tracking (user agent, IP address)
- ✅ Expired token rejection
- ✅ Access token cannot be used as refresh token

Run tests:
```bash
cd apps/api
npm run test:e2e -- auth-refresh.e2e-spec.ts
```

## Troubleshooting

### Access Token Expired Too Quickly

The access token expires after 15 minutes by design. The frontend should automatically refresh it. If users are being logged out:

1. Check browser console for refresh errors
2. Verify `/auth/refresh` endpoint is accessible
3. Check that cookies are being set with correct domain/path

### Refresh Token Not Working

1. Verify refresh token exists in database
2. Check token is not expired (`expiresAt > now()`)
3. Verify token is not revoked (`isRevoked = false`)
4. Check cookie is being sent with request

### Too Many Devices Error

Users can have max 5 active refresh tokens. If exceeded:
- Oldest tokens are automatically revoked
- User must re-login on old devices
- Increase `MAX_TOKENS_PER_USER` in auth.service.ts if needed

## Migration Guide

### From Old System (7-day Access Tokens)

The system is backward compatible:

1. Old clients with 7-day tokens will continue to work
2. New clients automatically use refresh token flow
3. JWT_EXPIRES_IN is kept for backward compatibility
4. No database migration required for existing users

### Production Deployment

1. Set environment variables:
   ```bash
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=30d
   ```

2. Run database migration:
   ```bash
   npm run prisma:migrate deploy
   ```

3. Deploy backend with new code
4. Deploy frontend with new code
5. Users will automatically get refresh tokens on next login

## References

- [OWASP JWT Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [RFC 6749: OAuth 2.0 - Refresh Tokens](https://datatracker.ietf.org/doc/html/rfc6749#section-1.5)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)

## Future Enhancements

- [ ] Add suspicious refresh pattern detection (multiple rapid refreshes)
- [ ] Implement device management UI (view/revoke sessions)
- [ ] Add push notifications for new login from unknown device
- [ ] Implement "remember this device" feature with longer refresh token TTL
- [ ] Add GraphQL subscription for real-time session revocation
