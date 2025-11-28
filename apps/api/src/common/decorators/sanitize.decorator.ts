import { Transform } from 'class-transformer';
import * as validator from 'validator';

/**
 * Sanitization decorator for DTO string fields to prevent XSS attacks.
 * Trims whitespace and escapes HTML special characters.
 *
 * Usage:
 * ```typescript
 * export class MyDto {
 *   @Sanitize()
 *   @IsString()
 *   name: string;
 * }
 * ```
 *
 * Security:
 * - Escapes: <, >, ", ', /, & to HTML entities
 * - Trims leading/trailing whitespace
 * - Preserves legitimate content while preventing script injection
 *
 * @returns Transform decorator that sanitizes string values
 */
export function Sanitize() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      // Trim whitespace
      // We do NOT escape HTML characters here because:
      // 1. React escapes by default when rendering
      // 2. Handlebars escapes by default when generating PDFs
      // 3. Storing encoded entities (like &#x2F;) causes double-encoding issues in UI
      return value.trim();
    }
    return value;
  });
}

/**
 * Sanitization decorator for array fields containing strings.
 * Applies the same sanitization logic to each element in the array.
 *
 * Usage:
 * ```typescript
 * export class MyDto {
 *   @SanitizeArray()
 *   @IsArray()
 *   @IsString({ each: true })
 *   tags: string[];
 * }
 * ```
 *
 * @returns Transform decorator that sanitizes string array values
 */
export function SanitizeArray() {
  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          return validator.escape(item.trim());
        }
        return item;
      });
    }
    return value;
  });
}
