# Date Formatting Documentation

## Overview
Smart Apply uses a standardized, progressive date formatting system that provides context-appropriate detail levels.

## Format Rules

### 1. Recent Time (< 1 hour)
**Format:** Relative time in German  
**Examples:**
- `vor 5 Minuten`
- `vor 30 Minuten`
- `vor 45 Minuten`

**Use case:** Very recent activity where exact time is less important than recency.

---

### 2. Today
**Format:** `Heute um HH:mm`  
**Examples:**
- `Heute um 09:15`
- `Heute um 14:30`
- `Heute um 18:45`

**Use case:** Activities from today where users need to know the time but the date is obvious.

---

### 3. Yesterday
**Format:** `Gestern um HH:mm`  
**Examples:**
- `Gestern um 10:00`
- `Gestern um 15:30`
- `Gestern um 22:15`

**Use case:** Recent activities from yesterday where the time provides useful context.

---

### 4. This Year
**Format:** `dd. MMM um HH:mm`  
**Examples:**
- `15. Jan um 14:30`
- `28. Feb um 09:00`
- `03. Dez um 16:45`

**Use case:** Activities from the current year where month context is important but year is implied.

---

### 5. Older Dates
**Format:** `dd.MM.yyyy`  
**Examples:**
- `15.01.2023`
- `28.02.2022`
- `03.12.2021`

**Use case:** Historical activities where full date context is needed without time.

---

## Tooltip Enhancement

All date displays include a tooltip showing the full timestamp:

**Tooltip Format:** `dd.MM.yyyy HH:mm`  
**Example:** `15.01.2024 14:30`

For more detailed tooltips with seconds, use `formatTooltipTimestamp()`:

**Detailed Format:** `dd. MMMM yyyy, HH:mm:ss`  
**Example:** `15. Januar 2024, 14:30:45`

This provides detailed information on hover while keeping the UI clean.

---

## Implementation

### Functions Available

1. **`formatDateSmart(date)`** - Progressive granularity (primary function)
2. **`formatDateFull(date)`** - Full timestamp for tooltips (`dd.MM.yyyy HH:mm`)
3. **`formatTooltipTimestamp(date)`** - Detailed tooltip with seconds (`dd. MMMM yyyy, HH:mm:ss`)
4. **`formatFullTimestamp(date)`** - Backwards compatible, same as `formatDateFull()`
5. **`formatRelativeTime(date)`** - Pure relative time (e.g., "vor 2 Stunden")
6. **`formatDate(date, format?)`** - Custom format string

### Usage Example

```typescript
import { formatDateSmart, formatDateFull } from '@/lib/format-date';

// Display with tooltip
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="text-sm text-muted-foreground">
        {formatDateSmart(application.createdAt)}
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <p>{formatDateFull(application.createdAt)}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Benefits

1. **Progressive Disclosure:** Shows appropriate detail level based on recency
2. **Consistency:** Same format across all pages (Applications, Dashboard, Sessions)
3. **Localization:** German locale throughout (`de` from `date-fns`)
4. **Timezone Awareness:** Automatically converts to user's timezone
5. **Accessibility:** Detailed tooltip for assistive technologies

---

## Files Using Standardized Formatting

- ✅ `apps/web/src/app/(dashboard)/applications/page.tsx`
- ✅ `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- ✅ `apps/web/src/app/(dashboard)/settings/sessions/page.tsx`
- ✅ `apps/web/src/app/(dashboard)/profile/page.tsx` (uses `formatDate` for month/year)
- ✅ `apps/web/src/app/(dashboard)/applications/[id]/page.tsx` (uses `formatDate` for expiry times)

---

## Edge Cases Handled

1. **Future Dates (< 1 hour):** Not currently supported - will fall through to "Today" or date format
2. **Invalid Dates:** Gracefully handled by `date-fns` (returns "Invalid Date")
3. **Timezone Transitions:** Automatically adjusts for DST changes using `toZonedTime()`
4. **Leap Years:** Correctly handles February 29th
5. **Cross-timezone Year Comparison:** Uses timezone-converted dates for accurate year detection

---

## Testing Examples

```typescript
// Test 1: 5 minutes ago
formatDateSmart(new Date(Date.now() - 5 * 60 * 1000))
// Output: "vor 5 Minuten"

// Test 2: 2 hours ago (today)
formatDateSmart(new Date(Date.now() - 2 * 60 * 60 * 1000))
// Output: "Heute um 12:30" (if current time is 14:30)

// Test 3: Yesterday at 14:30
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(14, 30, 0, 0);
formatDateSmart(yesterday)
// Output: "Gestern um 14:30"

// Test 4: 2 months ago (this year)
const twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
twoMonthsAgo.setDate(15);
twoMonthsAgo.setHours(10, 15, 0, 0);
formatDateSmart(twoMonthsAgo)
// Output: "15. Okt um 10:15" (if current month is December)

// Test 5: January 15, 2023
formatDateSmart(new Date('2023-01-15T10:30:00Z'))
// Output: "15.01.2023"
```

---

## Migration Notes

- **Breaking Change:** `formatFullTimestamp()` format changed from `dd. MMMM yyyy, HH:mm` to `dd.MM.yyyy HH:mm`
  - **Impact:** Existing code relying on the verbose format will see shorter dates
  - **Fix:** Use `formatTooltipTimestamp()` if you need the detailed format with month names
  - **Reason:** Consistency with `formatDateFull()` and German locale conventions
- **`formatDateFull()`:** New function, same format as updated `formatFullTimestamp()`
- **Backwards Compatible:** Existing functions remain available
- **Minimal Impact:** Only 3 files updated in this PR
- **For detailed tooltips:** Use `formatTooltipTimestamp()` for format with seconds and month names
