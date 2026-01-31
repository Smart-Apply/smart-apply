# OAuth Integration - Setup Guide

## Overview

Smart Apply now supports OAuth 2.0 Social Login with Google and Microsoft (Azure AD). Users can register and log in using their existing accounts from these providers.

## Features

### Implemented ✅
- **Google OAuth 2.0** - Login with Google accounts
- **Microsoft/Azure AD OAuth** - Login with Microsoft work/school accounts
- **Account Linking** - OAuth accounts automatically link to existing email accounts
- **Automatic Profile Creation** - First-time OAuth users get a profile created automatically
- **Secure Token Storage** - OAuth tokens stored encrypted in database
- **Email Verification Skip** - OAuth emails are pre-verified

### Future Enhancements 🔜
- LinkedIn OAuth
- Apple Sign-In
- Facebook Login
- OAuth Provider Management UI (Settings page)
- SAML Integration for Enterprise

## Architecture

### Database Schema

**New Model: `OAuthProvider`**
```prisma
model OAuthProvider {
  id           String            @id @default(cuid())
  provider     OAuthProviderType // GOOGLE, MICROSOFT, LINKEDIN, APPLE, FACEBOOK
  providerId   String            // External OAuth ID (sub claim)
  email        String?           // Email from OAuth provider
  
  // Tokens (encrypted)
  accessToken  String?           @db.Text
  refreshToken String?           @db.Text
  tokenExpiry  DateTime?
  
  // Profile data
  displayName  String?
  avatarUrl    String?
  
  // User relation
  userId       String
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  lastUsedAt   DateTime          @default(now())
  
  @@unique([provider, providerId]) // Each OAuth account is unique
  @@unique([provider, userId])     // One OAuth provider per user
}
```

**User Model Updates:**
- Added `avatarUrl` field for profile pictures from OAuth providers

### Backend Flow

1. **User clicks "Mit Google anmelden"** → Frontend redirects to `GET /auth/google`
2. **Backend redirects to Google OAuth consent screen** → User approves
3. **Google redirects back to** `GET /auth/google/callback?code=...`
4. **GoogleStrategy validates the callback:**
   - Exchanges authorization code for access token
   - Fetches user profile (email, name, picture)
   - Calls `AuthService.validateOAuthUser()`
5. **AuthService handles account logic:**
   - **If OAuth provider exists:** Update last used, return user
   - **If email exists (email match):** Link OAuth provider to existing account
   - **If new user:** Create user + profile + OAuth provider record
6. **Controller generates JWT tokens** → Sets HttpOnly cookies
7. **Redirect to dashboard** → User is logged in

### Passport Strategies

**GoogleStrategy** (`passport-google-oauth20`)
- Scope: `['email', 'profile']`
- Callback URL: `http://localhost:3000/api/v1/auth/google/callback`
- Validates Google profile and creates/links user account

**MicrosoftStrategy** (`passport-azure-ad`)
- Uses BearerStrategy for OAuth 2.0
- Tenant ID: `common` (supports all Microsoft accounts)
- Validates JWT tokens from Microsoft

## Setup Instructions

### 1. Google OAuth Setup

**Create OAuth Credentials in Google Cloud Console:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** and **People API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth 2.0 Client ID**
6. Application type: **Web application**
7. **Authorized JavaScript origins:**
   - Development: `http://localhost:3000`
   - Production: `https://smartapply.app`
8. **Authorized redirect URIs:**
   - Development: `http://localhost:3000/api/v1/auth/google/callback`
   - Production: `https://smartapply.app/api/v1/auth/google/callback`
9. Copy the **Client ID** and **Client Secret**

**Add to `.env`:**
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Microsoft OAuth Setup

**Register App in Azure AD:**

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Name: `Smart Apply`
5. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
6. Redirect URI: 
   - Platform: **Web**
   - URI: `http://localhost:3000/api/v1/auth/microsoft/callback` (dev)
   - URI: `https://smartapply.app/api/v1/auth/microsoft/callback` (prod)
7. After creation, go to **Certificates & secrets** → **New client secret**
8. Copy the **Application (client) ID** and **Client secret value**
9. Go to **API permissions** → **Add a permission**
   - Microsoft Graph → Delegated permissions
   - Select: `openid`, `profile`, `email`

**Add to `.env`:**
```bash
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=common
```

### 3. Backend Configuration

**Update `apps/api/.env`:**
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartapply

# JWT Secret (generate with: openssl rand -base64 64)
JWT_SECRET=your-secure-jwt-secret-at-least-64-characters

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - Microsoft/Azure AD
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=common
```

### 4. Run Migrations

```bash
cd apps/api
npm run prisma:migrate
npm run prisma:generate
```

### 5. Start Application

**Terminal 1 - Backend:**
```bash
cd apps/api
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
```

## Testing OAuth Flow

### Manual Testing Steps

1. **Navigate to login page:** http://localhost:3001/login
2. **Click "Mit Google anmelden"** or **"Mit Microsoft anmelden"**
3. **Approve OAuth consent** in the popup window
4. **You should be redirected** to http://localhost:3001/dashboard?oauth=success
5. **Verify authentication:** You should see your profile in the dashboard

### Test Account Linking

1. **Register normally** with email/password (e.g., test@example.com)
2. **Logout**
3. **Login with Google/Microsoft** using the same email
4. **Check database:** OAuth provider should be linked to existing user

```sql
-- Check linked OAuth providers
SELECT 
  u.email,
  o.provider,
  o.email as oauth_email,
  o.display_name,
  o.last_used_at
FROM users u
LEFT JOIN oauth_providers o ON o.user_id = u.id
WHERE u.email = 'test@example.com';
```

## API Endpoints

### Public Endpoints

**GET /api/v1/auth/google**
- Initiates Google OAuth flow
- Redirects to Google consent screen
- No authentication required

**GET /api/v1/auth/google/callback**
- Handles Google OAuth callback
- Sets JWT tokens in HttpOnly cookies
- Redirects to `/dashboard?oauth=success`

**GET /api/v1/auth/microsoft**
- Initiates Microsoft OAuth flow
- Redirects to Microsoft consent screen
- No authentication required

**GET /api/v1/auth/microsoft/callback**
- Handles Microsoft OAuth callback
- Sets JWT tokens in HttpOnly cookies
- Redirects to `/dashboard?oauth=success`

### Protected Endpoints

**GET /api/v1/auth/oauth/providers**
- Get all linked OAuth providers for current user
- Requires: JWT authentication
- Returns:
```json
[
  {
    "provider": "GOOGLE",
    "email": "user@gmail.com",
    "displayName": "John Doe",
    "avatarUrl": "https://lh3.googleusercontent.com/...",
    "lastUsedAt": "2026-01-31T12:00:00Z",
    "createdAt": "2026-01-15T10:00:00Z"
  }
]
```

**DELETE /api/v1/auth/oauth/providers/:provider**
- Unlink OAuth provider from account
- Requires: JWT authentication
- Parameters: `provider` = GOOGLE | MICROSOFT | LINKEDIN | APPLE | FACEBOOK
- Returns: `{ "message": "OAuth provider GOOGLE unlinked successfully" }`
- **Error:** Returns 400 if attempting to unlink the only authentication method

## Security Considerations

### Implemented Security Measures ✅

1. **HttpOnly Cookies:** JWT tokens stored in HttpOnly cookies (XSS protection)
2. **Secure Tokens:** Access/refresh tokens encrypted in database
3. **Email Verification:** OAuth emails are pre-verified (trusted providers)
4. **Account Linking:** Prevents duplicate accounts for same email
5. **Provider Uniqueness:** One OAuth provider per user (prevents conflicts)
6. **Callback Validation:** Passport strategies validate OAuth responses
7. **CORS Protection:** OAuth callbacks check origin headers
8. **Rate Limiting:** OAuth endpoints use existing auth rate limits (5/15min)

### Best Practices

- **Never expose secrets:** Keep OAuth credentials in environment variables
- **Use HTTPS in production:** OAuth requires secure callback URLs
- **Rotate secrets regularly:** Update OAuth secrets periodically
- **Monitor OAuth usage:** Track failed login attempts via audit logs
- **Implement account recovery:** Allow users to reset password if OAuth provider is inaccessible

## Error Handling

### Common OAuth Errors

**Error: "Email not provided by Google"**
- Cause: User denied email permission in OAuth consent
- Solution: User must approve all required permissions

**Error: "OAuth provider already linked to another account"**
- Cause: Attempting to link OAuth account that's already linked to different user
- Solution: User must unlink from other account first

**Error: "Cannot unlink only authentication method"**
- Cause: Attempting to remove OAuth provider when user has no password set
- Solution: User must set a password before unlinking OAuth

**Error: "Callback URL mismatch"**
- Cause: Callback URL in code doesn't match registered URL in OAuth console
- Solution: Update callback URL in Google Cloud Console / Azure AD

## Frontend Integration

### OAuth Button Implementation

```tsx
// Login with Google
<button onClick={() => window.location.href = api.auth.googleLoginUrl()}>
  Mit Google anmelden
</button>

// Login with Microsoft
<button onClick={() => window.location.href = api.auth.microsoftLoginUrl()}>
  Mit Microsoft anmelden
</button>
```

### API Client Methods

```typescript
// Get OAuth login URLs
const googleUrl = api.auth.googleLoginUrl();
const microsoftUrl = api.auth.microsoftLoginUrl();

// Get linked providers
const providers = await api.auth.getLinkedProviders();

// Unlink provider
await api.auth.unlinkProvider('GOOGLE');
```

## Troubleshooting

### Backend Not Starting

**Check environment variables:**
```bash
cd apps/api
cat .env | grep GOOGLE
cat .env | grep AZURE_AD
```

**Check database connection:**
```bash
docker ps | grep postgres
npm run prisma:studio
```

### OAuth Redirect Issues

**Check callback URLs match exactly:**
- Google Cloud Console → Credentials → OAuth 2.0 Client IDs
- Azure Portal → App registrations → Authentication

**Check CORS origins:**
```bash
# .env file should include both ports
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Database Issues

**Run migrations:**
```bash
cd apps/api
npm run prisma:migrate
npm run prisma:generate
```

**Check OAuth table exists:**
```sql
SELECT * FROM oauth_providers LIMIT 1;
```

## Production Deployment

### Environment Variables

**Required for Google OAuth:**
```bash
GOOGLE_CLIENT_ID=production-client-id
GOOGLE_CLIENT_SECRET=production-secret
```

**Required for Microsoft OAuth:**
```bash
AZURE_AD_CLIENT_ID=production-client-id
AZURE_AD_CLIENT_SECRET=production-secret
AZURE_AD_TENANT_ID=common
```

### Callback URLs

**Update in OAuth Consoles:**
- Google: `https://smartapply.app/api/v1/auth/google/callback`
- Microsoft: `https://smartapply.app/api/v1/auth/microsoft/callback`

**Update in Code:**
```typescript
// apps/api/src/config/config.service.ts
get googleCallbackUrl(): string {
  const baseUrl = this.isProduction 
    ? 'https://smartapply.app'  // Update to actual production URL
    : `http://localhost:${this.port}`;
  return `${baseUrl}/api/v1/auth/google/callback`;
}
```

## Future Enhancements

### LinkedIn OAuth
- Provider: LinkedIn
- Scope: `['r_emailaddress', 'r_liteprofile']`
- Use case: Professional networking integration

### Apple Sign-In
- Provider: Apple
- Use case: iOS app support

### SAML Integration
- Use case: Enterprise customers with SSO
- Provider: Okta, Auth0, Azure AD SAML

### OAuth Management UI
- Settings page to view linked providers
- Ability to link/unlink providers
- Show last used timestamps
- Display linked email addresses

## Support

For issues or questions:
- Check GitHub Issues: https://github.com/Ar1anit/smart-apply/issues
- Review Swagger docs: http://localhost:3000/docs
- Check logs: `apps/api/logs/`

## License

MIT License - See LICENSE file for details
