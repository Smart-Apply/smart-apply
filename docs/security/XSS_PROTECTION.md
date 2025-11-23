# XSS Protection Implementation

## Overview

This document describes the input sanitization strategy implemented to protect Smart Apply from Cross-Site Scripting (XSS) attacks.

## Defense-in-Depth Strategy

We implement XSS protection at multiple layers:

1. **Backend Sanitization**: All user inputs are sanitized at the API level before storage
2. **Frontend Validation**: URLs and rich text are validated before rendering
3. **React's Built-in Protection**: React automatically escapes text content
4. **Security Headers**: Helmet provides additional security headers (implemented separately)

## Backend Implementation

### Sanitization Decorator

Location: `apps/api/src/common/decorators/sanitize.decorator.ts`

Two decorators are available:
- `@Sanitize()`: For individual string fields
- `@SanitizeArray()`: For arrays of strings

### How It Works

```typescript
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class UpdateProfileDto {
  @Sanitize()
  @IsString()
  firstName: string;
}
```

The decorator:
1. Trims leading/trailing whitespace
2. Escapes HTML special characters using `validator.escape()`:
   - `<` → `&lt;`
   - `>` → `&gt;`
   - `"` → `&quot;`
   - `'` → `&#x27;`
   - `/` → `&#x2F;`
   - `&` → `&amp;`

### Applied To

✅ **Auth Module**
- `RegisterDto.firstName`
- `RegisterDto.lastName`
- (Passwords are NOT sanitized to preserve special characters)

✅ **Profile Module**
- All text fields in `UpdateProfileDto`
- `SkillDto`: name, level
- `CertificateDto`: name, issuer
- `ExperienceDto`: title, company, location, description
- `ProjectDto`: name, description, technologies[]
- `EducationDto`: degree, institution, fieldOfStudy, gpa, description

✅ **Job Postings Module**
- `ParseJobPostingDto.text`

✅ **Applications Module**
- `CreateApplicationDto.notes`

## Frontend Implementation

### Sanitization Utilities

Location: `apps/web/src/lib/sanitize.ts`

#### Functions

**sanitizeHtml(dirty: string): string**
- Use for rich text content
- Allows safe HTML tags: `<b>`, `<i>`, `<em>`, `<strong>`, `<a>`, `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<h1-6>`
- Allows safe attributes: `href`, `target`
- Only permits http(s) and mailto protocols
- Removes all scripts, event handlers, and dangerous content

**sanitizeText(text: string): string**
- Use for plain text (no HTML allowed)
- Escapes all HTML special characters
- Same escaping as backend

**sanitizeUrl(url: string): string**
- Validates URLs before use in `href` attributes
- Only allows `http://` and `https://` protocols
- Rejects `javascript:`, `data:`, `file:`, and other dangerous protocols
- Returns empty string for invalid URLs

**stripHtml(html: string): string**
- Removes all HTML tags, keeps text content
- Use when you want plain text from HTML

**sanitizeArray(items: string[]): string[]**
- Applies text sanitization to each array element

### Applied To

✅ **Profile Page**
- LinkedIn URL validation
- Portfolio URL validation
- Certificate URL validation
- Project URL validation

### Usage Examples

```tsx
// Sanitize URLs before rendering
<a href={sanitizeUrl(profile.linkedinUrl)}>LinkedIn</a>

// Rich text content (if needed)
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userBio) }} />

// Plain text is already safe with React (no manual sanitization needed)
<p>{profile.firstName}</p>
```

## React's Built-in Protection

React automatically escapes values rendered with `{variable}` syntax:

```tsx
// ✅ Safe - React escapes automatically
<p>{userInput}</p>

// ⚠️ Potentially dangerous - need sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} />
<a href={userInput}>Link</a>
```

## Testing

### Backend Tests

Location: `apps/api/test/xss-sanitization.e2e-spec.ts`

Tests cover:
- XSS payloads in registration
- Profile update sanitization
- Skills, experience, education, certificates, projects
- Job posting text sanitization
- Application notes sanitization
- Edge cases (empty strings, whitespace trimming)

Run tests:
```bash
npm run test:e2e -- xss-sanitization.e2e-spec.ts
```

### Frontend Tests

Location: `apps/web/src/lib/__tests__/sanitize.test.ts`

Tests cover:
- HTML sanitization with safe/unsafe tags
- Text escaping
- URL validation (http/https vs javascript:/data:)
- HTML stripping
- Array sanitization
- 10+ common XSS attack vectors
- Real-world scenarios

Run tests:
```bash
cd apps/web
npm test -- sanitize.test.ts
```

## XSS Attack Vectors Tested

Our sanitization protects against:

1. `<script>alert("XSS")</script>` - Script injection
2. `<img src=x onerror=alert("XSS")>` - Event handler injection
3. `<svg onload=alert("XSS")>` - SVG-based XSS
4. `<iframe src="javascript:alert('XSS')">` - JavaScript protocol
5. `<a href="javascript:alert('XSS')">` - Link-based XSS
6. `<body onload=alert("XSS")>` - Body event injection
7. `<input onfocus=alert("XSS") autofocus>` - Input event injection
8. `<div style="background:url(javascript:alert('XSS'))">` - Style-based XSS
9. Encoded payloads (e.g., `&#X41` for 'A')
10. Data URIs with scripts

## Security Best Practices

### DO ✅

- Always sanitize user input on the backend (defense-in-depth)
- Validate URLs before using in `href` attributes
- Use `sanitizeHtml()` for rich text content
- Use `rel="noopener noreferrer"` for external links
- Test with common XSS payloads

### DON'T ❌

- Don't trust client-side validation alone
- Don't use `dangerouslySetInnerHTML` without sanitization
- Don't allow `javascript:`, `data:`, or other dangerous protocols in URLs
- Don't sanitize passwords (preserve special characters for security)
- Don't remove security measures "because React escapes automatically"

## Limitations

### What This Protects Against
✅ Stored XSS via user profiles
✅ Script injection in job postings
✅ Cookie/token theft attempts
✅ Malicious links
✅ HTML injection

### What This Does NOT Protect Against
❌ SQL Injection (use Prisma's parameterized queries - already protected)
❌ CSRF (separate protection implemented)
❌ File upload exploits (separate validation needed)
❌ Server-side template injection
❌ XML External Entity (XXE) attacks

## Future Improvements

- [ ] Add Content Security Policy (CSP) headers
- [ ] Implement Subresource Integrity (SRI) for CDN resources
- [ ] Add input sanitization to remaining components
- [ ] Audit logging for suspicious input patterns
- [ ] Rate limiting on submission endpoints (already implemented for auth)

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [validator.js Documentation](https://github.com/validatorjs/validator.js)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

## Audit Trail

| Date | Change | Author |
|------|--------|--------|
| 2025-11-16 | Initial implementation | GitHub Copilot |
| 2025-11-16 | Backend sanitization decorators | GitHub Copilot |
| 2025-11-16 | Frontend sanitization utilities | GitHub Copilot |
| 2025-11-16 | E2E and unit tests | GitHub Copilot |
