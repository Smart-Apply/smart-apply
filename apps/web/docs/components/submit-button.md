# SubmitButton Component

## Overview

A reusable button component with built-in loading state support. Prevents duplicate form submissions by automatically disabling the button during async operations and showing a loading spinner.

## Location

`apps/web/src/components/ui/submit-button.tsx`

## Props

Extends all standard `ButtonProps` from shadcn/ui with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isLoading` | `boolean` | `false` | Whether to show loading state |
| `loadingText` | `string` | `'Lädt...'` | Text to display during loading |
| `children` | `ReactNode` | - | Button content when not loading |
| All `ButtonProps` | - | - | `variant`, `size`, `className`, etc. |

## Usage Examples

### With React Query Mutation

```tsx
import { SubmitButton } from '@/components/ui/submit-button';
import { useCreateApplication } from '@/hooks/use-applications';

function CreateApplicationButton() {
  const mutation = useCreateApplication();

  return (
    <SubmitButton 
      onClick={() => mutation.mutate({ jobPostingId: '123' })}
      isLoading={mutation.isPending}
      loadingText="Erstelle Bewerbung..."
    >
      Bewerbung erstellen
    </SubmitButton>
  );
}
```

### With react-hook-form

```tsx
import { SubmitButton } from '@/components/ui/submit-button';
import { useForm } from 'react-hook-form';

function LoginForm() {
  const form = useForm();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <SubmitButton 
        type="submit"
        isLoading={form.formState.isSubmitting}
        loadingText="Anmelden..."
      >
        Anmelden
      </SubmitButton>
    </form>
  );
}
```

## Features

1. **Automatic Disabling**: Button is automatically disabled when `isLoading` is true
2. **Loading Spinner**: Shows Lucide `Loader2` icon with spin animation
3. **Contextual Text**: Loading text changes based on the action
4. **Type Safety**: Full TypeScript support with proper prop types
5. **Composable**: Accepts all standard Button props (variant, size, className, etc.)

## Common Loading Texts

| Action | German Text |
|--------|-------------|
| General Save | `"Speichere..."` |
| Login | `"Anmelden..."` |
| Register | `"Registriere..."` |
| Create | `"Erstelle {Item}..."` |
| Delete | `"Wird gelöscht..."` |
| Export | `"Exportiere..."` |
| AI Processing | `"AI arbeitet..."` |

## Implementation Locations

- ✅ Auth forms (login, register)
- ✅ Profile edit page
- ✅ Application wizard
- ✅ Applications list (delete dialog)
- ✅ Application edit page (save, export, AI changes)

## Best Practices

1. **Always use SubmitButton for async actions** - Never manually implement loading states
2. **Use descriptive loading text** - Tell users what's happening
3. **Combine with optimistic updates** - Use React Query's optimistic updates for better UX
