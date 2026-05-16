# @smart-apply/shared

Shared TypeScript types and interfaces for the Smart Apply monorepo.

## Purpose

This package provides type-safe data contracts between the frontend (Next.js) and backend (NestJS) applications. By sharing types, we ensure:

- **Type Safety**: Frontend and backend use identical interfaces
- **Single Source of Truth**: Update types once, propagate everywhere
- **Reduced Duplication**: No manual copying of type definitions
- **Better DX**: Auto-completion and type checking across the stack

## Usage

### In Backend (NestJS)

```typescript
import { User, Profile, Application } from '@smart-apply/shared';

// Use in services, controllers, or DTOs
function getUserProfile(user: User): Profile {
  // ...
}
```

### In Frontend (Next.js)

```typescript
import { User, Application, JobPosting } from '@smart-apply/shared';

// Use in components, hooks, or API clients
const applications: Application[] = await fetchApplications();
```

## Available Types

### Core Entities

- `User` - User account information
- `Profile` - User profile with skills, experiences, education, etc.
- `JobPosting` - Job posting details
- `Application` - Job application with cover letter and resume
- `Template` - Document templates for PDFs

### Nested Types

- `Skill`, `Experience`, `Education`, `Certificate`, `Project`, `Language`
- `ResumeData`, `ResumeExperience`, `ResumeProject`, etc.

### DTOs

- `UpdateProfileDto` - Profile update payload
- `EducationDto` - Education with string dates for API transport

### ATS & Keywords

- `ATSKeywords`, `KeywordMatch`, `MatchAnalysis`
- `ApplicationKeywordsResponse`

### Sessions & Auth

- `Session`, `SessionsResponse`
- `AuthResponse`, `ErrorResponse`

### Enums

- `ApplicationGenerationStatus`: `'PENDING' | 'GENERATING' | 'READY' | 'FAILED'`
- `ApplicationTrackingStatus`: `'CREATED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'`
- `TemplateType`: `'COVER_LETTER' | 'RESUME' | 'BOTH'`
- `KeywordCategory`: `'technical' | 'soft' | 'responsibility' | 'requirement' | 'tool' | 'industry' | 'seniority' | 'misc'`

## Development

### Build the package

```bash
pnpm shared:build
```

### Watch mode (auto-rebuild on changes)

```bash
pnpm shared:watch
```

### After modifying types

1. Edit `packages/shared/src/index.ts`
2. Run `pnpm shared:build`
3. Types are automatically available in both apps (via pnpm workspaces)

## Architecture Notes

- **Backend DTOs**: NestJS uses class-validator decorators for validation. The shared types serve as interfaces, while DTOs add validation logic.
- **Frontend Types**: Next.js components import directly from `@smart-apply/shared` without modification.
- **Date Handling**: Use ISO date strings (`string`) for API transport, convert to `Date` objects as needed in business logic.

## Migration Guide

### Before (Duplicated Types)

```typescript
// apps/api/src/types.ts
export interface User { ... }

// apps/web/src/types/index.ts
export interface User { ... } // ❌ Duplicate!
```

### After (Shared Types)

```typescript
// packages/shared/src/index.ts
export interface User { ... }

// apps/api/src/users/users.service.ts
import { User } from '@smart-apply/shared'; // ✅

// apps/web/src/components/UserProfile.tsx
import { User } from '@smart-apply/shared'; // ✅
```

## Future Enhancements

- [ ] Add JSDoc comments for better IntelliSense
- [ ] Generate OpenAPI schemas from shared types
- [ ] Add runtime validation utilities (Zod schemas)
- [ ] Split into sub-packages if it grows large (e.g., `@smart-apply/shared-types`, `@smart-apply/shared-utils`)
