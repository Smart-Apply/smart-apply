# Intelligent PDF Filenames (Issue #284)

## Overview
Professional, readable, and consistent PDF filenames with intelligent length management and fallbacks.

## Implementation

### Format
`{LastName}_{Company}_{Position}_{DocumentType}.pdf`

### Features

#### 1. Normalization
- **Umlauts:** ä→ae, ö→oe, ü→ue, ß→ss
- **Spaces:** Converted to hyphens
- **Special characters:** Removed (except `-` and `_`)
- **Duplicate separators:** Removed
- **ASCII-only:** All characters normalized to ASCII

#### 2. Length Management (80 chars default)
Progressive truncation strategy:
1. **Full format:** `LastName_Company_Position_DocumentType.pdf`
2. **Truncate position:** Limited to 20 characters
3. **Remove position:** `LastName_Company_DocumentType.pdf`
4. **Truncate company:** Limited to available space
5. **Minimum format:** `LastName_DocumentType.pdf`

#### 3. Fallbacks
- No company: `LastName_Position_DocumentType.pdf`
- No position: `LastName_Company_DocumentType.pdf`
- Only lastname: `LastName_DocumentType.pdf`
- Only firstname: `FirstName_DocumentType.pdf`
- No name: `Bewerbung_DocumentType.pdf`

## Examples

### Normal Cases
```
Input:
- lastName: "Mustermann"
- company: "BWI GmbH"
- position: "Solution Architect"
- documentType: "Anschreiben"

Output: Mustermann_BWI-GmbH_Solution-Architect_Anschreiben.pdf
```

### Umlaut Replacement
```
Input:
- lastName: "Müller"
- company: "Städtische Werke München"
- documentType: "Lebenslauf"

Output: Mueller_Staedtische-Werke-Muenchen_Lebenslauf.pdf
```

### Special Characters
```
Input:
- lastName: "O'Brien"
- company: "Tech & Co."
- position: "Software Engineer (m/w/d)"
- documentType: "Anschreiben"

Output: OBrien_Tech-Co_Software-Engineer-mwd_Anschreiben.pdf
```

### Long Company Name
```
Input:
- lastName: "Schmidt"
- company: "Bundesministerium für Wirtschaft und Klimaschutz"
- documentType: "Anschreiben"
- maxLength: 60

Output: Schmidt_Bundesministerium-fuer_Anschreiben.pdf
(Company truncated to fit within limit)
```

### Missing Data
```
Input:
- lastName: "Schmidt"
- position: "Developer"
- documentType: "Anschreiben"

Output: Schmidt_Developer_Anschreiben.pdf
(No company provided)

Input:
- lastName: "Mustermann"
- company: "BWI"
- documentType: "Lebenslauf"

Output: Mustermann_BWI_Lebenslauf.pdf
(No position provided)

Input:
- documentType: "Anschreiben"

Output: Bewerbung_Anschreiben.pdf
(No name provided - generic fallback)
```

## Implementation Details

### Files Modified
1. **`apps/web/src/lib/pdf-utils.ts`**
   - Added `generatePdfFilename()` function with comprehensive logic
   - Added `normalizeForFilename()` helper for character normalization
   - Added `truncateText()` helper for smart truncation
   - Updated `generateFilename()` to support profile data (backward compatible)

2. **`apps/web/src/app/(dashboard)/applications/[id]/page.tsx`**
   - Added `useProfile()` hook to fetch user profile
   - Updated all `generateFilename()` calls to pass `lastName` and `firstName`
   - Updated ZIP filename generation to include lastname
   - Applied to: download cover letter, download resume, download both, preview functions

### Test Coverage
93 comprehensive test cases covering:
- Normal cases with all data present
- Umlaut replacement (ä, ö, ü, ß)
- Special character handling
- Length management and truncation
- Edge cases and fallbacks
- Document types (Anschreiben, Lebenslauf)
- Backward compatibility

### API
```typescript
interface FilenameOptions {
  lastName?: string;
  firstName?: string;
  company?: string;
  position?: string;
  documentType: 'Anschreiben' | 'Lebenslauf';
  maxLength?: number; // Default: 80
}

function generatePdfFilename(options: FilenameOptions): string;
```

## Migration
The implementation is **backward compatible**:
- Old code without profile data: Falls back to `Bewerbung_DocumentType.pdf`
- New code with profile data: Uses intelligent naming
- No breaking changes to existing API

## Benefits
1. **Professional:** Clean, readable filenames for recruiters
2. **Consistent:** Predictable naming pattern across all downloads
3. **Safe:** ASCII-only, no special characters that might cause issues
4. **Flexible:** Handles missing data gracefully with fallbacks
5. **Smart:** Automatically truncates long names while maintaining readability
6. **Localized:** German document types (Anschreiben, Lebenslauf)

## Future Enhancements
- Add counter/timestamp for duplicate filenames (same lastname + company)
- Support for custom filename patterns via user preferences
- Abbreviation dictionary for common long company names (e.g., "Bundesamt für Migration und Flüchtlinge" → "BAMF")
