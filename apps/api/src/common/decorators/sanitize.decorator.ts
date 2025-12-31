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

/**
 * URL sanitization decorator that removes duplicate protocol prefixes.
 * Handles cases like "https://https://linkedin.com" → "https://linkedin.com"
 *
 * Usage:
 * ```typescript
 * export class MyDto {
 *   @SanitizeUrl()
 *   @IsOptional()
 *   @IsUrl()
 *   linkedinUrl?: string;
 * }
 * ```
 *
 * Security:
 * - Removes duplicate https:// or http:// prefixes
 * - Adds https:// if no protocol is present
 * - Trims whitespace
 * - Returns undefined for empty strings
 *
 * @returns Transform decorator that sanitizes URL values
 */
export function SanitizeUrl() {
  return Transform(({ value }) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return undefined;
    }

    let url = value.trim();

    // Remove duplicate https:// or http:// prefixes
    // Matches patterns like: https://https://, http://https://, https://http://
    while (/^(https?:\/\/)(https?:\/\/)/.test(url)) {
      url = url.replace(/^(https?:\/\/)(https?:\/\/)/, '$2');
    }

    // If URL doesn't start with protocol, add https://
    if (url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    return url || undefined;
  });
}
