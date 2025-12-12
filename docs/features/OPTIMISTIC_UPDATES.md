# Optimistic Updates Implementation

## Overview

Smart Apply implements optimistic updates for all mutations to provide instant UI feedback and eliminate loading spinners for common operations. This document describes the implementation patterns, benefits, and testing strategies.

## Benefits

### User Experience
- **Instant Feedback**: UI updates immediately without waiting for server response
- **No Loading Spinners**: Operations feel instantaneous
- **Reduced Perceived Latency**: Users can continue working while mutations complete
- **Better Error Handling**: Clear rollback to previous state on errors

### Performance
- **Reduced Network Round-trips**: UI updates don't wait for server confirmation
- **Optimized Query Invalidation**: Background refetch only, not blocking
- **Better Caching**: React Query maintains consistent cache state

### Developer Experience
- **Consistent Pattern**: All mutations follow the same 4-phase pattern
- **Type-Safe**: Full TypeScript support with proper context types
- **Testable**: Clear separation of optimistic vs. server state

## Implementation Pattern

All mutations follow this 4-phase pattern:

### Phase 1: onMutate (Optimistic Update)
```typescript
onMutate: async (newData) => {
  // 1. Cancel outgoing refetches to avoid race conditions
  await queryClient.cancelQueries({ queryKey: ['items'] });
  
  // 2. Snapshot previous state for rollback
  const previousItems = queryClient.getQueryData(['items']);
  
  // 3. Optimistically update cache
  queryClient.setQueryData(['items'], (old: Item[] | undefined) => {
    // Add temp item with 'temp-{timestamp}' ID pattern
    const tempItem = { id: 'temp-' + Date.now(), ...newData };
    return [tempItem, ...(old || [])];
  });
  
  // 4. Return context for error rollback
  return { previousItems };
}
```

### Phase 2: onError (Rollback)
```typescript
onError: (error: unknown, _variables, context) => {
  // Restore previous state from context
  if (context?.previousItems) {
    queryClient.setQueryData(['items'], context.previousItems);
  }
  
  // Show user-friendly error message
  toastError(error, 'Fehler beim Erstellen des Eintrags');
}
```

### Phase 3: onSuccess (Replace Temp Data)
```typescript
onSuccess: (newItem) => {
  // Replace temp ID with real server data
  queryClient.setQueryData(['items'], (old: Item[] | undefined) => {
    if (!old) return [newItem];
    return old.map(item => 
      item.id.startsWith('temp-') ? newItem : item
    );
  });
  
  toastSuccess('Eintrag erfolgreich erstellt');
}
```

### Phase 4: onSettled (Background Consistency)
```typescript
onSettled: () => {
  // Always refetch in background for data consistency
  // This catches any server-side changes (computed fields, etc.)
  queryClient.invalidateQueries({ queryKey: ['items'] });
}
```

## Implemented Mutations

### Applications (`apps/web/src/hooks/use-applications.ts`)

#### `useCreateApplication()`
- **Optimistic**: Adds application with temp ID immediately
- **Success**: Replaces temp ID with real application data
- **Error**: Removes temp application from list
- **Pattern**: Create with temp ID

#### `useDeleteApplication()`
- **Optimistic**: Removes application from list immediately
- **Success**: Confirms deletion with toast
- **Error**: Restores deleted application to list
- **Pattern**: Delete with rollback

### Job Postings (`apps/web/src/hooks/use-job-postings.ts`)

#### `useCreateJobPosting()`
- **Optimistic**: Adds job posting with temp ID immediately
- **Success**: Replaces temp ID with real job posting data
- **Error**: Removes temp job posting from list
- **Pattern**: Create with temp ID

#### `useParseJobPosting()`
- **Optimistic**: Adds placeholder job posting with "Lädt..." title
- **Success**: Replaces placeholder with parsed job posting
- **Error**: Removes placeholder from list
- **Pattern**: Create with loading placeholder

#### `useDeleteJobPosting()`
- **Optimistic**: Removes job posting from list immediately
- **Success**: Confirms deletion with toast
- **Error**: Restores deleted job posting to list
- **Pattern**: Delete with rollback

### Profile (`apps/web/src/hooks/use-profile.ts`)

#### `useUpdateProfile()`
- **Optimistic**: Updates profile fields and nested arrays immediately
- **Success**: Replaces optimistic data with server response
- **Error**: Restores previous profile state
- **Pattern**: Update with nested data

**Special Handling for Nested Arrays:**
```typescript
// Merge nested arrays if provided, otherwise keep existing
skills: updateData.skills ?? previousProfile.skills,
experiences: updateData.experiences ?? previousProfile.experiences,
// ... etc for all nested collections
```

## Temporary ID Pattern

### Format
All temporary IDs use the pattern: `'temp-' + Date.now()`

**Example**: `temp-1702394567890`

### Why This Pattern?
1. **Unique**: Timestamp ensures uniqueness across mutations
2. **Identifiable**: Prefix allows easy filtering (`id.startsWith('temp-')`)
3. **Debug-Friendly**: Timestamp helps trace when item was created
4. **Type-Safe**: Compatible with string ID types

### Replacement Logic
```typescript
// Replace all temp IDs with real data
old.map(item => item.id.startsWith('temp-') ? newItem : item)
```

## Error Handling

### Rollback Strategy
1. **Capture State**: `onMutate` returns context with previous state
2. **Restore on Error**: `onError` receives context and restores state
3. **User Notification**: Always show error toast with actionable message

### Example Error Flow
```
1. User clicks "Create Application"
2. onMutate: Add temp application to list (UI updates immediately)
3. API call fails (network error)
4. onError: Remove temp application, restore previous list
5. Toast: "Fehler beim Erstellen der Bewerbung"
6. User sees original list as if nothing happened
```

## Testing Strategy

### Manual Testing Checklist

#### Create Operations
- [ ] Item appears in list immediately (before server responds)
- [ ] Item has temp ID (inspect in React DevTools)
- [ ] On success: Temp ID replaced with real ID
- [ ] On error: Temp item removed, error toast shown
- [ ] Background refetch updates data after success

#### Delete Operations
- [ ] Item removed from list immediately
- [ ] On success: Deletion confirmed with toast
- [ ] On error: Item restored to list, error toast shown
- [ ] Background refetch confirms deletion

#### Update Operations
- [ ] Changes visible immediately in UI
- [ ] On success: Server data replaces optimistic data
- [ ] On error: Changes reverted, error toast shown
- [ ] Nested arrays update correctly

### Automated Testing (Future)
```typescript
// Example test structure
describe('useCreateApplication', () => {
  it('should optimistically add application', async () => {
    const { result } = renderHook(() => useCreateApplication());
    
    act(() => {
      result.current.mutate({ jobPostingId: '123' });
    });
    
    // Check optimistic update
    const applications = queryClient.getQueryData(['applications']);
    expect(applications[0].id).toMatch(/^temp-/);
  });
  
  it('should rollback on error', async () => {
    // Mock API error
    mockApiError();
    
    const { result } = renderHook(() => useCreateApplication());
    
    await act(async () => {
      await result.current.mutateAsync({ jobPostingId: '123' });
    });
    
    // Check rollback
    const applications = queryClient.getQueryData(['applications']);
    expect(applications).not.toContainEqual(expect.objectContaining({
      id: expect.stringMatching(/^temp-/)
    }));
  });
});
```

## Common Pitfalls & Solutions

### Pitfall 1: Forgetting to Cancel Queries
**Problem**: Outgoing queries overwrite optimistic updates
```typescript
// ❌ Bad: No cancelQueries
onMutate: async (newData) => {
  queryClient.setQueryData(['items'], /* ... */);
}

// ✅ Good: Cancel first
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['items'] });
  queryClient.setQueryData(['items'], /* ... */);
}
```

### Pitfall 2: Not Handling Undefined Cache
**Problem**: Cache might be undefined on first mutation
```typescript
// ❌ Bad: Assumes cache exists
queryClient.setQueryData(['items'], (old) => [newItem, ...old]);

// ✅ Good: Handle undefined
queryClient.setQueryData(['items'], (old: Item[] | undefined) => {
  return [newItem, ...(old || [])];
});
```

### Pitfall 3: Missing Context Return
**Problem**: onError can't rollback without context
```typescript
// ❌ Bad: No return
onMutate: async (newData) => {
  const previous = queryClient.getQueryData(['items']);
  queryClient.setQueryData(['items'], /* ... */);
  // Missing return!
}

// ✅ Good: Return context
onMutate: async (newData) => {
  const previousItems = queryClient.getQueryData(['items']);
  queryClient.setQueryData(['items'], /* ... */);
  return { previousItems }; // ✓
}
```

### Pitfall 4: Forgetting onSettled
**Problem**: Cache diverges from server state over time
```typescript
// ❌ Bad: No background refetch
onSuccess: (newItem) => {
  queryClient.setQueryData(['items'], /* ... */);
  // Missing onSettled!
}

// ✅ Good: Always refetch
onSuccess: (newItem) => {
  queryClient.setQueryData(['items'], /* ... */);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['items'] }); // ✓
}
```

## Performance Considerations

### Memory Usage
- **Minimal Impact**: Context only stores single snapshot per mutation
- **Short-Lived**: Context cleared after onError/onSuccess completes
- **Garbage Collected**: No memory leaks from optimistic updates

### Network Traffic
- **Reduced**: UI updates don't block on network
- **Optimized**: Background refetch uses React Query caching
- **Configurable**: staleTime/gcTime control refetch behavior

### Query Invalidation Strategy
```typescript
// List query: Refetch in background
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['applications'] });
}

// Detail query: Remove from cache (will refetch on access)
onMutate: async (deletedId) => {
  queryClient.removeQueries({ queryKey: ['applications', deletedId] });
}
```

## Migration Guide

### Upgrading Existing Mutations

**Before (Simple Invalidation):**
```typescript
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.items.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toastSuccess('Item created');
    },
    onError: (error) => {
      toastError(error, 'Failed to create item');
    },
  });
}
```

**After (Optimistic Updates):**
```typescript
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.items.create(data),
    
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousItems = queryClient.getQueryData(['items']);
      
      queryClient.setQueryData(['items'], (old: Item[] | undefined) => {
        const tempItem = { id: 'temp-' + Date.now(), ...newItem };
        return [tempItem, ...(old || [])];
      });
      
      return { previousItems };
    },
    
    onError: (error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems);
      }
      toastError(error, 'Failed to create item');
    },
    
    onSuccess: (newItem) => {
      queryClient.setQueryData(['items'], (old: Item[] | undefined) => {
        if (!old) return [newItem];
        return old.map(item => 
          item.id.startsWith('temp-') ? newItem : item
        );
      });
      toastSuccess('Item created');
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

## Future Enhancements

### Possible Improvements
1. **Conflict Resolution**: Handle concurrent updates with version vectors
2. **Offline Support**: Queue mutations when offline, replay on reconnect
3. **Undo/Redo**: Leverage context for undo functionality
4. **Progress Tracking**: Show progress for multi-step mutations
5. **Batch Operations**: Optimize multiple mutations in sequence

### Monitoring
- Track rollback frequency (high = API issues or validation problems)
- Measure perceived performance (time to UI update vs. API response)
- Monitor toast error rates by mutation type

## References

- [React Query Optimistic Updates Docs](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Issue #217: Implement Optimistic Updates](https://github.com/Ar1anit/smart-apply/issues/217)
- [Agent Instructions: Implementation Patterns](/.github/agents/scalability-enhancement-agent.md)

## Summary

Optimistic updates transform Smart Apply from a traditional request-response UI to a modern, instant-feedback experience. By following the 4-phase pattern consistently across all mutations, we ensure:

1. **Instant UI updates** (onMutate)
2. **Error resilience** (onError rollback)
3. **Data consistency** (onSuccess + onSettled)
4. **Developer confidence** (consistent pattern)

The implementation eliminates loading spinners, reduces perceived latency, and creates a more responsive user experience while maintaining data integrity through background refetches.
