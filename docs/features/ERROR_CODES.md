# Error Code System

This document describes the error code system implemented in Smart Apply for better user experience and error handling.

## Overview

All API errors now include a `code` field that uniquely identifies the type of error. These codes map to user-friendly German messages that provide actionable guidance to users.

## Error Response Structure

Every error response includes:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-12T10:00:00.000Z",
  "path": "/api/v1/applications",
  "method": "POST",
  "message": "Du hast bereits eine Bewerbung für diese Stelle erstellt.",
  "code": "APPLICATION_DUPLICATE"
}
```

### Fields

- **statusCode**: HTTP status code (400, 401, 404, 409, 500, etc.)
- **timestamp**: ISO 8601 timestamp of when the error occurred
- **path**: API endpoint path where the error occurred
- **method**: HTTP method (GET, POST, PUT, DELETE, etc.)
- **message**: User-friendly German error message
- **code**: Error code for programmatic handling (see Error Codes section)
- **errors** (optional): Array of validation errors for 400 responses

## Error Codes

### Authentication Errors (401, 409)

| Code                       | HTTP Status | Message                                                             |
| -------------------------- | ----------- | ------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`      | 401         | E-Mail oder Passwort ist falsch. Bitte versuche es erneut.          |
| `UNAUTHORIZED`             | 401         | Bitte melde dich an, um fortzufahren.                               |
| `USER_EXISTS`              | 409         | Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an. |
| `USER_NOT_FOUND`           | 401         | Benutzer nicht gefunden. Bitte melde dich erneut an.                |
| `REFRESH_TOKEN_INVALID`    | 401         | Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.           |
| `REFRESH_TOKEN_NOT_FOUND`  | 401         | Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.           |
| `INVALID_TOKEN_TYPE`       | 401         | Ungültiger Token-Typ. Bitte melde dich erneut an.                   |
| `SESSION_EXPIRED`          | 401         | Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.           |

### Profile Errors (404, 400, 500)

| Code                    | HTTP Status | Message                                                                |
| ----------------------- | ----------- | ---------------------------------------------------------------------- |
| `PROFILE_NOT_FOUND`     | 404         | Bitte erstelle zuerst dein Profil im Profil-Bereich.                   |
| `PROFILE_INCOMPLETE`    | 400         | Bitte vervollständige dein Profil, bevor du fortfährst.                |
| `PROFILE_UPDATE_FAILED` | 500         | Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.     |

### Job Posting Errors (404)

| Code                       | HTTP Status | Message                                                                         |
| -------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `JOB_POSTING_NOT_FOUND`    | 404         | Stellenanzeige nicht gefunden. Möglicherweise wurde sie gelöscht.               |
| `JOB_POSTING_PARSE_FAILED` | 400         | Die Stellenanzeige konnte nicht verarbeitet werden. Bitte überprüfe das Format. |

### Application Errors (404, 400, 409)

| Code                            | HTTP Status | Message                                                                                                              |
| ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `APPLICATION_NOT_FOUND`         | 404         | Bewerbung nicht gefunden. Möglicherweise wurde sie gelöscht.                                                         |
| `APPLICATION_DUPLICATE`         | 409         | Du hast bereits eine Bewerbung für diese Stelle erstellt. Bitte bearbeite die bestehende Bewerbung oder lösche sie.  |
| `APPLICATION_GENERATING`        | 400         | Dokumente werden aktuell erstellt. Bitte warte einen Moment.                                                         |
| `APPLICATION_GENERATION_FAILED` | 500         | Die Bewerbung konnte nicht erstellt werden. Bitte versuche es erneut.                                                |
| `APPLICATION_NO_RESUME`         | 400         | Bitte speichere zuerst deinen Lebenslauf.                                                                            |
| `APPLICATION_NO_JOB`            | 400         | Keine Stellenanzeige verknüpft. Bitte wähle eine Stelle aus.                                                         |
| `APPLICATION_RESUME_CORRUPTED`  | 400         | Gespeicherter Lebenslauf ist beschädigt. Bitte aktualisiere ihn.                                                     |

### LLM Errors (500, 400)

| Code                   | HTTP Status | Message                                                                                           |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `LLM_TIMEOUT`          | 500         | Die KI-Generierung dauert länger als erwartet. Deine Bewerbung wird im Hintergrund erstellt.      |
| `LLM_PARSE_ERROR`      | 500         | Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.                         |
| `LLM_INVALID_RESPONSE` | 500         | Die KI hat eine ungültige Antwort geliefert. Bitte versuche es erneut.                            |

### File Upload Errors (400)

| Code                | HTTP Status | Message                                                            |
| ------------------- | ----------- | ------------------------------------------------------------------ |
| `FILE_TOO_LARGE`    | 400         | Die Datei ist zu groß. Maximal 10 MB sind erlaubt.                 |
| `FILE_INVALID_TYPE` | 400         | Ungültiger Dateityp. Nur PDF-, Word- und Textdateien sind erlaubt. |

### Password Errors (400)

| Code                       | HTTP Status | Message                                                                       |
| -------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `PASSWORD_INCORRECT`       | 400         | Das aktuelle Passwort ist falsch. Bitte versuche es erneut.                   |
| `PASSWORD_SAME_AS_CURRENT` | 400         | Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.             |
| `PASSWORD_CHANGE_OAUTH`    | 400         | Passwort kann für OAuth-Konten nicht geändert werden.                         |

### Rate Limiting (429)

| Code                  | HTTP Status | Message                                                              |
| --------------------- | ----------- | -------------------------------------------------------------------- |
| `RATE_LIMIT_EXCEEDED` | 429         | Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.  |

### Generic Errors (400, 403, 404, 500)

| Code                    | HTTP Status | Message                                                          |
| ----------------------- | ----------- | ---------------------------------------------------------------- |
| `VALIDATION_ERROR`      | 400         | Ungültige Eingabe. Bitte überprüfe deine Daten.                  |
| `FORBIDDEN`             | 403         | Zugriff verweigert. Du hast keine Berechtigung für diese Aktion. |
| `NOT_FOUND`             | 404         | Die angeforderte Ressource wurde nicht gefunden.                 |
| `INTERNAL_SERVER_ERROR` | 500         | Ein Fehler ist aufgetreten. Bitte versuche es später erneut.     |

## Backend Implementation

### Throwing Errors with Codes

```typescript
import { ErrorCode } from '../common/constants/error-codes';
import { UnauthorizedWithCode, NotFoundWithCode, BadRequestWithCode } from '../common/exceptions/coded-http.exception';

// Example: Invalid credentials
throw new UnauthorizedWithCode(ErrorCode.INVALID_CREDENTIALS);

// Example: Profile not found
throw new NotFoundWithCode(ErrorCode.PROFILE_NOT_FOUND);

// Example: Application duplicate with custom message
throw new ConflictWithCode(ErrorCode.APPLICATION_DUPLICATE, 'Custom context');
```

### Available Exception Classes

- `BadRequestWithCode` (400)
- `UnauthorizedWithCode` (401)
- `ForbiddenWithCode` (403)
- `NotFoundWithCode` (404)
- `ConflictWithCode` (409)
- `InternalServerErrorWithCode` (500)

### Exception Filter

The `AllExceptionsFilter` automatically:

1. Extracts the error code from the exception
2. Maps it to a user-friendly German message
3. Adds default codes for standard HTTP exceptions without explicit codes
4. Logs full stack traces for 500 errors (server-side only)
5. Prevents stack trace leakage to clients

## Frontend Implementation

### Error Handling in API Client

The frontend `api-client.ts` automatically handles errors:

```typescript
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';

try {
  const data = await api.applications.create({ jobPostingId: '...' });
} catch (error) {
  // Automatically shows user-friendly German message
  const message = getErrorMessage(error);
  toast.error(message);
}
```

### Error Message Priority

The frontend resolves error messages in this order:

1. **Error Code** → Maps code to localized message from `error-messages.ts`
2. **Backend Message** → Uses message from backend if code not found
3. **Default Message** → Falls back to generic error message

Example:

```typescript
// Backend returns: { code: 'INVALID_CREDENTIALS', message: '...' }
// Frontend shows: "E-Mail oder Passwort ist falsch. Bitte versuche es erneut."
```

### Validation Errors

Validation errors (400) may include an `errors` array:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": ["email must be an email", "password is too short"],
  "errors": ["email must be an email", "password is too short"]
}
```

The frontend automatically formats these:

```typescript
import { formatValidationErrors } from '@/lib/error-messages';

const message = formatValidationErrors(error.data.errors);
// Returns: "email must be an email\npassword is too short"
```

## Testing

### E2E Tests

See `apps/api/test/e2e/features/error-messages.e2e-spec.ts` for comprehensive tests:

```bash
cd apps/api
npm run test:e2e -- error-messages
```

Tests validate:

- ✅ All errors include `code` field
- ✅ Messages are in German
- ✅ Messages are actionable (contain "Bitte" or instructions)
- ✅ 500 errors don't leak stack traces
- ✅ Validation errors include details

### Manual Testing

1. **Invalid Login**

   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"wrong"}'
   ```

   Expected: `{ "code": "INVALID_CREDENTIALS", ... }`

2. **Duplicate Application**

   ```bash
   # Create application twice with same jobPostingId
   curl -X POST http://localhost:3000/api/v1/applications \
     -H "Cookie: access_token=..." \
     -H "Content-Type: application/json" \
     -d '{"jobPostingId":"abc-123"}'
   ```

   Expected: `{ "code": "APPLICATION_DUPLICATE", ... }`

3. **Profile Not Found**

   ```bash
   # Delete profile then try to fetch it
   curl -X GET http://localhost:3000/api/v1/profile \
     -H "Cookie: access_token=..."
   ```

   Expected: `{ "code": "PROFILE_NOT_FOUND", ... }`

## Future Enhancements

### Internationalization (i18n)

Currently, all messages are in German. Future versions will support `Accept-Language` header:

```http
GET /api/v1/profile
Accept-Language: en
```

Response:

```json
{
  "code": "PROFILE_NOT_FOUND",
  "message": "Please create your profile first in the profile section."
}
```

### Implementation Plan

1. Add `@nestjs/i18n` package
2. Create translation files (`en.json`, `de.json`)
3. Update `AllExceptionsFilter` to use `I18nService`
4. Extract `Accept-Language` header in filter
5. Return translated message based on locale

## Best Practices

### For Backend Developers

1. **Always use coded exceptions** for predictable errors

   ```typescript
   // ❌ Bad
   throw new NotFoundException('Profile not found');
   
   // ✅ Good
   throw new NotFoundWithCode(ErrorCode.PROFILE_NOT_FOUND);
   ```

2. **Let the filter handle messages** - Don't duplicate messages

   ```typescript
   // ❌ Bad
   throw new NotFoundWithCode(ErrorCode.PROFILE_NOT_FOUND, 'Bitte erstelle zuerst dein Profil');
   
   // ✅ Good
   throw new NotFoundWithCode(ErrorCode.PROFILE_NOT_FOUND);
   ```

3. **Add new codes to the enum** when adding new error types

   ```typescript
   // apps/api/src/common/constants/error-codes.ts
   export enum ErrorCode {
     // ... existing codes
     NEW_ERROR_CODE = 'NEW_ERROR_CODE',
   }
   
   export const ERROR_MESSAGES: Record<ErrorCode, string> = {
     // ... existing messages
     [ErrorCode.NEW_ERROR_CODE]: 'Neue Fehlermeldung auf Deutsch.',
   };
   ```

### For Frontend Developers

1. **Use `getErrorMessage()` for all errors**

   ```typescript
   // ✅ Good
   const message = getErrorMessage(error);
   toast.error(message);
   ```

2. **Don't hardcode error messages** in components

   ```typescript
   // ❌ Bad
   toast.error('Ein Fehler ist aufgetreten');
   
   // ✅ Good
   const message = getErrorMessage(error);
   toast.error(message);
   ```

3. **Add new codes to frontend enum** when backend adds them

   ```typescript
   // apps/web/src/lib/error-messages.ts
   export const ERROR_MESSAGES: Record<string, string> = {
     // ... existing messages
     NEW_ERROR_CODE: 'Neue Fehlermeldung auf Deutsch.',
   };
   ```

## Monitoring

### Server Logs

500 errors are logged with full stack traces:

```text
[ERROR] POST /api/v1/applications - 500 [INTERNAL_SERVER_ERROR]
Error: Failed to generate application
    at ApplicationsService.create (/app/src/applications/applications.service.ts:123:11)
    ...
```

### Client Errors

Client-side errors are NOT logged server-side. Only the error code and message are sent to the client.

## Security Considerations

1. **No stack traces in production** - 500 errors only log server-side
2. **No PII in error messages** - Messages are generic and actionable
3. **No sensitive data leakage** - Validation errors don't expose internal details
4. **Rate limiting** - RATE_LIMIT_EXCEEDED prevents brute force attacks

## Related Documentation

- [Security Documentation](./SECURITY.md)
- [Testing Strategy](../testing/TESTING_STRATEGY.md)
- [API Documentation](./API.md)
