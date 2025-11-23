# Application Creation Wizard

A multi-step wizard component that guides users through the process of creating a new job application with AI-generated documents.

## Overview

The ApplicationWizard component implements a 3-step flow:

1. **Profile Selection** - Validates user profile completeness
2. **Job Selection** - Allows selection of saved job postings
3. **Review & Generate** - Final confirmation before submission

## Features

### Step Indicators
- Visual progress bar with icons
- Active step highlighting
- Completed step checkmarks
- Responsive design for mobile and desktop

### Step 1: Profile Selection
- Displays user profile summary
- Shows skills with badges
- Lists recent experiences
- **Validation**: Requires summary and at least one skill
- Shows warning if profile is incomplete
- Link to profile edit page for quick fixes

### Step 2: Job Selection
- Lists all saved job postings
- Visual selection with checkmarks
- Displays job title, company, and location
- Empty state with link to add new job
- **Validation**: Requires job selection before proceeding

### Step 3: Review & Generate
- Shows profile summary with top 5 skills
- Displays selected job posting details
- Information box explaining what happens next
- **Action**: Creates application via API

## Navigation

- **Next Button**: Advances to next step (with validation)
- **Back Button**: Returns to previous step
- **Cancel Button**: Returns to dashboard
- **Submit Button**: Creates application and redirects

## Component Structure

```
ApplicationWizard
├── Step Indicator (Progress Bar)
├── Step Content
│   ├── ProfileStep
│   │   ├── Profile Summary
│   │   ├── Skills List
│   │   ├── Experiences Preview
│   │   └── Completeness Warning (if incomplete)
│   ├── JobStep
│   │   ├── Job Postings List
│   │   ├── Selection UI
│   │   └── Empty State
│   └── ReviewStep
│       ├── Profile Summary
│       ├── Job Summary
│       └── Info Box
└── Navigation Buttons
```

## Usage

```tsx
import { ApplicationWizard } from '@/components/forms/application-wizard';

export default function NewApplicationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1>Neue Bewerbung erstellen</h1>
      <ApplicationWizard />
    </div>
  );
}
```

## API Integration

The wizard integrates with the following hooks:
- `useProfile()` - Fetches user profile data
- `useJobPostings()` - Fetches saved job postings
- `useCreateApplication()` - Creates new application

### API Call on Submit

```typescript
POST /api/v1/applications
{
  "jobPostingId": "string"
}
```

### Response

```typescript
{
  "id": "string",
  "status": "PENDING",
  "jobPostingId": "string",
  "userId": "string",
  "createdAt": "2024-11-14T20:00:00Z",
  "updatedAt": "2024-11-14T20:00:00Z"
}
```

## Validation Rules

### Profile Step
- ✅ Must have summary text
- ✅ Must have at least 1 skill
- ⚠️ Shows warning if incomplete
- ⚠️ Prevents navigation to next step

### Job Step
- ✅ Must select exactly 1 job posting
- ⚠️ Shows error toast if none selected
- ⚠️ Prevents navigation to review step

### Review Step
- ✅ Final confirmation before submission
- ✅ Shows loading state during API call
- ✅ Redirects on success
- ⚠️ Shows error toast on failure

## Error Handling

- **Network Errors**: Caught by mutation's onError handler
- **Validation Errors**: Shown as toast notifications
- **Loading States**: Spinner during data fetching
- **API Errors**: Displayed with retry option via toast

## Accessibility

- Semantic HTML structure
- ARIA labels for step indicators
- Keyboard navigation support
- Focus management between steps
- Screen reader friendly error messages

## Mobile Responsiveness

- Stacked layout on mobile
- Touch-friendly buttons
- Simplified step labels on small screens
- Responsive grid for job postings

## State Management

The wizard maintains internal state for:
- `currentStep`: Current active step
- `selectedJobId`: Selected job posting ID

External state (via hooks):
- Profile data (React Query)
- Job postings list (React Query)
- Application creation mutation (React Query)

## Future Enhancements

- [ ] Save draft applications
- [ ] Step validation with form schemas
- [ ] Progress persistence (localStorage)
- [ ] Job posting preview modal
- [ ] Profile quick-edit inline
- [ ] Multi-job application creation
