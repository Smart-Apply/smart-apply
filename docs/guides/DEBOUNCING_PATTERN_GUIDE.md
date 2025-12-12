# Debouncing Pattern Guide for Developers

## Quick Start

To add debouncing to any search or filter input:

### 1. Import the Hook
```typescript
import { useDebounce } from '@/hooks/use-debounce';
```

### 2. Create State Variables
```typescript
// Immediate state (updates on every change)
const [searchTerm, setSearchTerm] = useState('');

// Debounced state (delayed update)
const debouncedSearchTerm = useDebounce(searchTerm, 300);
```

### 3. Use Debounced Value in Queries/Filters
```typescript
// Use the debounced value, not the immediate value
const filteredItems = useMemo(() => {
  if (!debouncedSearchTerm) return items;
  
  return items.filter(item => 
    item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );
}, [items, debouncedSearchTerm]);
```

### 4. Add Loading Indicator (Optional but Recommended)
```tsx
<Input
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>
{searchTerm !== debouncedSearchTerm && (
  <Loader2 className="h-4 w-4 animate-spin" />
)}
```

## Complete Examples

### Example 1: Simple Search Input

```tsx
'use client';

import { useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

export function SearchableList({ items }: { items: Array<{ id: string; name: string }> }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        {searchTerm !== debouncedSearchTerm && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>
      
      <div className="mt-4">
        {filteredItems.map(item => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: API Search with React Query

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

export function ApiSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedSearchTerm],
    queryFn: () => api.search(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length >= 3, // Only search after 3 characters
  });

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search (min 3 characters)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        {(searchTerm !== debouncedSearchTerm || isLoading) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>
      
      <div className="mt-4">
        {data?.results.map(result => (
          <div key={result.id}>{result.title}</div>
        ))}
      </div>
    </div>
  );
}
```

### Example 3: Multiple Filters with Different Delays

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function AdvancedFilters({ items }: { items: JobPosting[] }) {
  // Different inputs with different delays
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');

  // Different debounce delays based on input type
  const debouncedSearch = useDebounce(searchTerm, 300);    // 300ms for text input
  const debouncedCategory = useDebounce(category, 150);     // 150ms for dropdown
  const debouncedLocation = useDebounce(location, 150);     // 150ms for dropdown

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (debouncedSearch) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }

    if (debouncedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === debouncedCategory);
    }

    if (debouncedLocation !== 'all') {
      filtered = filtered.filter(item => item.location === debouncedLocation);
    }

    return filtered;
  }, [items, debouncedSearch, debouncedCategory, debouncedLocation]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Input
          placeholder="Search jobs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm !== debouncedSearch && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>

      {/* Category Filter */}
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="engineering">Engineering</SelectItem>
          <SelectItem value="design">Design</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
        </SelectContent>
      </Select>

      {/* Location Filter */}
      <Select value={location} onValueChange={setLocation}>
        <SelectTrigger>
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          <SelectItem value="remote">Remote</SelectItem>
          <SelectItem value="onsite">On-site</SelectItem>
        </SelectContent>
      </Select>

      {/* Results */}
      <div className="text-sm text-muted-foreground">
        {filteredItems.length} results found
      </div>
    </div>
  );
}
```

### Example 4: With Abort Controller (Cancel Pending Requests)

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';

export function SearchWithAbort() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearchTerm) {
        setResults([]);
        return;
      }

      // Cancel previous request if still pending
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/search?q=${debouncedSearchTerm}`,
          { signal: abortControllerRef.current.signal }
        );
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Search failed:', error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();

    // Cleanup: abort on unmount
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [debouncedSearchTerm]);

  return (
    <div>
      <div className="relative">
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {(searchTerm !== debouncedSearchTerm || isLoading) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
        )}
      </div>
      
      <div className="mt-4">
        {results.map(result => (
          <div key={result.id}>{result.title}</div>
        ))}
      </div>
    </div>
  );
}
```

## Best Practices

### ✅ DO

1. **Use appropriate delays:**
   - Search inputs: 300ms
   - Filter dropdowns: 150ms
   - Text areas: 500ms

2. **Show loading indicators:**
   ```tsx
   {searchTerm !== debouncedSearchTerm && <Loader2 className="animate-spin" />}
   ```

3. **Reset pagination when filters change:**
   ```tsx
   useEffect(() => {
     setCurrentPage(1);
   }, [debouncedSearchTerm]);
   ```

4. **Use with React Query:**
   ```tsx
   const { data } = useQuery({
     queryKey: ['items', debouncedSearchTerm],
     queryFn: () => api.search(debouncedSearchTerm),
   });
   ```

5. **Add minimum character requirements:**
   ```tsx
   enabled: debouncedSearchTerm.length >= 3
   ```

### ❌ DON'T

1. **Don't use debounced value directly in inputs:**
   ```tsx
   // ❌ BAD - Input will lag
   <Input value={debouncedSearchTerm} />
   
   // ✅ GOOD - Input responds immediately
   <Input value={searchTerm} />
   ```

2. **Don't forget cleanup:**
   ```tsx
   // ❌ BAD - Memory leak
   useEffect(() => {
     const timeout = setTimeout(() => {
       setDebounced(value);
     }, 300);
   }, [value]);
   
   // ✅ GOOD - Cleanup on unmount
   useEffect(() => {
     const timeout = setTimeout(() => {
       setDebounced(value);
     }, 300);
     return () => clearTimeout(timeout);
   }, [value]);
   ```

3. **Don't debounce button clicks:**
   ```tsx
   // ❌ BAD - Buttons should respond immediately
   const debouncedClick = useDebounce(onClick, 300);
   
   // ✅ GOOD - Use throttle or disable button instead
   const [isSubmitting, setIsSubmitting] = useState(false);
   ```

## Delay Guidelines Reference

| Input Type | Recommended Delay | Reason |
|------------|------------------|--------|
| Search input (text) | 300ms | User typing continuously |
| Text area | 500ms | Longer inputs, longer pauses |
| Filter dropdown | 150ms | Discrete changes, faster feedback |
| Sort dropdown | 150ms | Discrete changes, faster feedback |
| Number input | 200ms | Balance between UX and accuracy |
| Autocomplete | 200ms | Faster for better autocomplete UX |

## Testing Checklist

When implementing debouncing, test:

- [ ] Fast typing: Type quickly, verify single update after pause
- [ ] Clear button: Clear input, verify immediate reset
- [ ] Loading indicator: Shows while debouncing
- [ ] Filter changes: Multiple rapid changes only apply final value
- [ ] Pagination reset: Goes to page 1 when filters change
- [ ] Empty input: Handles empty string correctly
- [ ] Special characters: Works with unicode, emojis, etc.
- [ ] Component unmount: No memory leaks or errors

## Common Pitfalls & Solutions

### Pitfall 1: Input Feels Laggy
**Problem:** Using debounced value in input `value` prop
```tsx
// ❌ BAD
<Input value={debouncedValue} />
```

**Solution:** Use immediate value for input, debounced for queries
```tsx
// ✅ GOOD
<Input value={searchTerm} />
const { data } = useQuery(['search', debouncedSearchTerm], ...);
```

### Pitfall 2: Memory Leak on Unmount
**Problem:** Not cleaning up timeouts
```tsx
// ❌ BAD - Missing cleanup
useEffect(() => {
  const timeout = setTimeout(...);
}, [value]);
```

**Solution:** Always return cleanup function
```tsx
// ✅ GOOD
useEffect(() => {
  const timeout = setTimeout(...);
  return () => clearTimeout(timeout);
}, [value]);
```

### Pitfall 3: Too Many API Calls Still
**Problem:** Delay too short or missing
```tsx
// ❌ BAD - 50ms is too short
const debounced = useDebounce(value, 50);
```

**Solution:** Use recommended delays
```tsx
// ✅ GOOD - 300ms for search
const debounced = useDebounce(value, 300);
```

### Pitfall 4: No Visual Feedback
**Problem:** User doesn't know search is pending
```tsx
// ❌ BAD - No loading indicator
<Input value={searchTerm} onChange={...} />
```

**Solution:** Show spinner while debouncing
```tsx
// ✅ GOOD
<Input value={searchTerm} onChange={...} />
{searchTerm !== debouncedSearchTerm && <Loader2 className="animate-spin" />}
```

## Related Documentation

- Main Documentation: `docs/features/REQUEST_DEBOUNCING.md`
- Hook Implementation: `apps/web/src/hooks/use-debounce.ts`
- Unit Tests: `apps/web/src/hooks/use-debounce.test.ts`
- Example Usage: `apps/web/src/app/(dashboard)/applications/page.tsx`

## Questions?

See the full documentation in `docs/features/REQUEST_DEBOUNCING.md` or check the existing implementation in `apps/web/src/app/(dashboard)/applications/page.tsx`.
