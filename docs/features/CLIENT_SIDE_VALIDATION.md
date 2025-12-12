# Client-Side Validation

## Overview

Smart Apply implements comprehensive client-side validation using **Zod** schemas with **react-hook-form** to provide immediate feedback to users and prevent unnecessary API calls. All validation rules mirror the backend DTOs to ensure consistency between frontend and backend validation.

## Architecture

### Centralized Validation Schemas

All Zod schemas are centralized in `/apps/web/src/lib/validation/schemas.ts`:

```typescript
import { z } from 'zod';

// Example: Login schema
export const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
```

### Schema-to-DTO Mapping

Each frontend schema corresponds to a backend DTO:

| Frontend Schema | Backend DTO | Purpose |
|----------------|-------------|---------|
| `registerSchema` | `RegisterDto` | User registration |
| `loginSchema` | `LoginDto` | User authentication |
| `profileSchema` | `UpdateProfileDto` | Profile basic info |
| `skillSchema` | `SkillDto` | Skills management |
| `certificateSchema` | `CertificateDto` | Certificates |
| `experienceSchema` | `ExperienceDto` | Work experience |
| `projectSchema` | `ProjectDto` | Projects |
| `educationSchema` | `EducationDto` | Education |
| `languageSchema` | `LanguageDto` | Languages |
| `jobPostingSchema` | `CreateJobPostingDto` | Job posting creation |
| `jobPostingEditSchema` | (UI-specific) | Job posting editing |
| `jobPostingUrlSchema` | (UI-specific) | URL parsing |
| `createApplicationSchema` | `CreateApplicationDto` | Application creation |

## Usage Patterns

### 1. Basic Form with Validation

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from '@/lib/validation/schemas';

function LoginForm() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur for immediate feedback
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    // Only called if validation passes
    await api.auth.login(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

### 2. Visual Validation Indicators

Use `fieldState` to show validation feedback:

```typescript
<FormField
  control={form.control}
  name="email"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel>E-Mail</FormLabel>
      <FormControl>
        <Input
          type="email"
          className={`
            ${fieldState.error
              ? 'border-red-500 focus:border-red-500'
              : fieldState.isDirty && !fieldState.invalid
              ? 'border-green-500'
              : 'border-input'
            }
          `}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Color Indicators:**
- 🔴 **Red border** - Field has validation error
- 🟢 **Green border** - Field is valid and has been touched
- ⚫ **Gray border** - Field is untouched or pristine

### 3. Validation Modes

**Recommended:** `mode: 'onBlur'`
- Validates when user leaves field (blur event)
- Provides early feedback without being intrusive
- Balance between UX and validation coverage

**Alternative modes:**
- `mode: 'onChange'` - Validates on every keystroke (can be annoying)
- `mode: 'onSubmit'` - Only validates on submit (misses early errors)
- `mode: 'all'` - Combines onChange and onBlur

### 4. Submit Button State

Disable submit button when form is invalid:

```typescript
<SubmitButton
  type="submit"
  disabled={!form.formState.isValid || form.formState.isSubmitting}
  isLoading={form.formState.isSubmitting}
>
  Submit
</SubmitButton>
```

## Validation Rules

### Authentication

#### Password Requirements
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (@$!%*?&#)

```typescript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[\w@$!%*?&#]{8,}$/;

password: z.string()
  .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
  .regex(PASSWORD_REGEX, 'Passwort muss einen Großbuchstaben, ...')
```

#### Email Validation
```typescript
email: z.string().email('Ungültige E-Mail-Adresse')
```

#### Password Confirmation
```typescript
.refine((data) => data.password === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
})
```

### Profile

#### Phone Number (E.164 Format)
```typescript
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

phone: z.string()
  .regex(phoneRegex, 'Telefonnummer muss im internationalen Format sein (z.B. +49123456789)')
  .optional()
  .or(z.literal(''))
```

Examples: `+49123456789`, `+1234567890`, `+441234567890`

#### URL Validation with Empty String Fallback
```typescript
url: z.string()
  .url('Ungültige URL')
  .optional()
  .or(z.literal(''))
```

This allows either a valid URL or an empty string (for clearing the field).

### Job Postings

#### Maximum Length Constraints
```typescript
title: z.string()
  .min(1, 'Titel ist erforderlich')
  .max(200, 'Titel darf maximal 200 Zeichen haben')

company: z.string()
  .min(1, 'Unternehmen ist erforderlich')
  .max(200, 'Unternehmen darf maximal 200 Zeichen haben')

location: z.string()
  .max(200, 'Standort darf maximal 200 Zeichen haben')
  .optional()

salary: z.string()
  .max(100, 'Gehalt darf maximal 100 Zeichen haben')
  .optional()

employmentType: z.string()
  .max(50, 'Beschäftigungsart darf maximal 50 Zeichen haben')
  .optional()
```

### Nested Entities

All nested entities (skills, experiences, education, etc.) support both create and update:

```typescript
export const skillSchema = z.object({
  id: z.string().optional(), // Present for updates, absent for creates
  name: z.string().min(1, 'Skill-Name ist erforderlich'),
  level: z.string().optional(),
});
```

**Pattern:**
- **Create:** Omit `id` field
- **Update:** Include `id` field
- **Delete:** Omit from array (orphan removal)

## Error Messages

All error messages are in **German** to match the UI language:

| English | German |
|---------|--------|
| "Invalid email address" | "Ungültige E-Mail-Adresse" |
| "Password is required" | "Passwort ist erforderlich" |
| "Passwords do not match" | "Passwörter stimmen nicht überein" |
| "Invalid URL" | "Ungültige URL" |
| "Field is required" | "Feld ist erforderlich" |
| "Must be at least X characters" | "Muss mindestens X Zeichen lang sein" |
| "Must be at most X characters" | "Darf maximal X Zeichen haben" |

## Testing Validation

### Manual Testing Checklist

**Auth Forms:**
- [ ] Try invalid email format
- [ ] Try short password (< 8 chars)
- [ ] Try password without uppercase/lowercase/digit/special char
- [ ] Try mismatched password confirmation
- [ ] Verify no API call on validation error
- [ ] Verify API call only when all fields valid

**Profile Forms:**
- [ ] Try invalid phone number format
- [ ] Try invalid URL format
- [ ] Try empty string in URL field (should work)
- [ ] Verify max length constraints
- [ ] Verify required vs. optional fields

**Job Posting Forms:**
- [ ] Try title/company > 200 chars
- [ ] Try location > 200 chars
- [ ] Try empty fullText field
- [ ] Try invalid URL
- [ ] Verify validation on blur

### Expected Behavior

1. **On Blur:**
   - Field validates immediately when user leaves it
   - Error message appears below field
   - Border turns red if invalid

2. **On Submit:**
   - All fields validated
   - Form submission blocked if any field invalid
   - First invalid field scrolled into view (handled by browser)

3. **On Fix:**
   - Error clears immediately when user fixes issue
   - Border turns green when valid
   - Error message removed

## Benefits

### Performance
- ✅ **Reduced API calls** - Invalid data caught before network request
- ✅ **Faster feedback** - Validation happens instantly (no network latency)
- ✅ **Lower backend load** - Fewer 400 validation error responses

### User Experience
- ✅ **Immediate feedback** - Errors shown on blur, not after submit
- ✅ **Clear error messages** - German messages matching UI language
- ✅ **Visual indicators** - Color-coded borders show field state
- ✅ **Accessible** - Screen readers can announce error messages

### Developer Experience
- ✅ **Type safety** - TypeScript infers types from Zod schemas
- ✅ **Centralized** - One place to update validation rules
- ✅ **Consistent** - Frontend mirrors backend validation exactly
- ✅ **Reusable** - Schemas exported and imported where needed

## Migration Guide

### Converting a Form to Use Centralized Schemas

**Before:**
```typescript
import { z } from 'zod';

const localSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8),
});

type FormData = z.infer<typeof localSchema>;
```

**After:**
```typescript
import { loginSchema, type LoginFormValues } from '@/lib/validation/schemas';

type FormData = LoginFormValues;
```

### Adding Validation Mode

**Before:**
```typescript
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
});
```

**After:**
```typescript
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'onBlur', // Add validation mode
  defaultValues: { ... },
});
```

### Adding Visual Indicators

**Before:**
```typescript
<Input {...field} />
```

**After:**
```typescript
<Input
  {...field}
  className={`
    ${fieldState.error
      ? 'border-red-500 focus:border-red-500'
      : fieldState.isDirty && !fieldState.invalid
      ? 'border-green-500'
      : 'border-input'
    }
  `}
/>
```

## Common Pitfalls

### 1. Forgetting to Add Validation Mode
❌ **Wrong:**
```typescript
const form = useForm({
  resolver: zodResolver(schema),
});
```

✅ **Correct:**
```typescript
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',
});
```

### 2. Not Using fieldState for Visual Feedback
❌ **Wrong:**
```typescript
render={({ field }) => <Input {...field} />}
```

✅ **Correct:**
```typescript
render={({ field, fieldState }) => (
  <Input
    {...field}
    className={fieldState.error ? 'border-red-500' : ''}
  />
)}
```

### 3. Inconsistent Validation Rules
❌ **Wrong:** Frontend allows 300 chars, backend only allows 200
✅ **Correct:** Match backend DTO exactly: `.max(200, '...')`

### 4. Submitting Despite Validation Errors
❌ **Wrong:** No validation in onSubmit, allows bad data
✅ **Correct:** Use `form.handleSubmit(onSubmit)` which validates first

## Future Enhancements

Potential improvements for future iterations:

1. **Field-level tooltips** - Show validation requirements on hover
2. **Success icons** - Add checkmark icon for valid fields
3. **Character count** - Show remaining characters for max-length fields
4. **Password strength meter** - Visual indicator of password strength
5. **Async validation** - Check email uniqueness before submit
6. **Custom error component** - Richer error display with icons/animations
7. **Schema sharing** - Share schemas between frontend/backend via monorepo package

## Related Documentation

- [Form Components](../components/FORMS.md)
- [API Response Format](../api/API_RESPONSE_STANDARDIZATION.md)
- [Error Handling](../api/ERROR_HANDLING.md)
- [Backend Validation](../../api/docs/VALIDATION.md)

## Changelog

### 2024-12-12 - Initial Implementation
- Created centralized validation schemas (`lib/validation/schemas.ts`)
- Updated auth forms to use centralized schemas
- Updated job posting forms to use centralized schemas
- Updated experience manager to use centralized schemas
- Added visual validation indicators (red/green borders)
- Set all forms to `mode: 'onBlur'`
- Deprecated old `profile-schema.ts` with backward compatibility
