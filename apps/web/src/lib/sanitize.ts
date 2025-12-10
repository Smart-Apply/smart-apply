/**
 * Input Sanitization Utilities for XSS Protection
 * 
 * This module provides sanitization functions to prevent Cross-Site Scripting (XSS) attacks.
 * It uses DOMPurify for HTML sanitization and provides text escaping utilities.
 * 
 * Security Strategy:
 * - Plain text fields: Escape all HTML
 * - Rich text fields: Allow safe HTML tags only (whitelist approach)
 * - URLs: Validate protocol (http/https only)
 * - Always sanitize before rendering user-generated content
 */

import DOMPurify from 'isomorphic-dompurify';
import type { Config as DOMPurifyConfig } from 'dompurify';

/**
 * Sanitize HTML content by allowing only safe tags and attributes.
 * Uses a whitelist approach to prevent script injection.
 * 
 * Allowed tags: b, i, em, strong, a, p, br, ul, ol, li, h1-h6
 * Allowed attributes: href (for links), target (for links)
 * 
 * Use this for rich text content that should support basic formatting.
 * 
 * @param dirty - Untrusted HTML string from user input
 * @returns Sanitized HTML string safe to render
 * 
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userBio) }} />
 * ```
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i, // Only allow http(s) and mailto URLs
  });
}

/**
 * Escape all HTML special characters to prevent any HTML rendering.
 * Use this for plain text fields where no HTML should be rendered.
 * 
 * Escapes: < > " ' / &
 * 
 * @param text - Untrusted text string from user input
 * @returns Escaped text string safe to render
 * 
 * @example
 * ```tsx
 * <p>{sanitizeText(userName)}</p>
 * ```
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')   // Must be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize a URL to ensure it uses a safe protocol.
 * Only allows http and https protocols.
 * 
 * @param url - URL string to validate
 * @returns Sanitized URL or empty string if invalid
 * 
 * @example
 * ```tsx
 * <a href={sanitizeUrl(userWebsite)}>Visit Website</a>
 * ```
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Check for valid http(s) protocol
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // Invalid URL format
    return '';
  }
  
  return '';
}

/**
 * Strip all HTML tags from a string, leaving only text content.
 * Use this when you want to display user content as plain text only.
 * 
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 * 
 * @example
 * ```tsx
 * <p>{stripHtml(userComment)}</p>
 * ```
 */
export function stripHtml(html: string): string {
  if (typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // No tags allowed
    KEEP_CONTENT: true, // Keep text content
  });
}

/**
 * Convert HTML to readable plain text with formatting preserved.
 * Converts:
 * - <ul><li> to bullet points (- )
 * - <ol><li> to numbered list (1. 2. etc)
 * - <p> to paragraphs with line breaks
 * - <br> to line breaks
 * - <strong>/<b> preserved as text
 * 
 * Use this when editing HTML content in plain text fields.
 * 
 * @param html - HTML string to convert
 * @returns Plain text with readable formatting
 * 
 * @example
 * ```tsx
 * <Textarea value={htmlToPlainText(description)} />
 * ```
 */
export function htmlToPlainText(html: string): string {
  if (typeof html !== 'string' || !html.trim()) return '';
  
  let text = html;
  
  // Convert <br> and <br/> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert closing </p> tags to double newlines (paragraph breaks)
  text = text.replace(/<\/p>/gi, '\n\n');
  
  // Convert list items to bullet points
  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/<\/li>/gi, '');
  
  // Remove all remaining HTML tags
  text = stripHtml(text);
  
  // Clean up extra whitespace
  text = text
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
  
  return text;
}

/**
 * Convert plain text to HTML with basic formatting.
 * Converts:
 * - Lines starting with "- " to <ul><li> bullets
 * - Lines starting with "1. ", "2. " etc to <ol><li> numbers
 * - Empty lines to paragraph breaks
 * - Single newlines to <br> tags
 * 
 * Use this when saving plain text to HTML format.
 * 
 * @param text - Plain text string
 * @returns HTML string with formatting
 * 
 * @example
 * ```tsx
 * const html = plainTextToHtml(textareaValue);
 * ```
 */
export function plainTextToHtml(text: string): string {
  if (typeof text !== 'string' || !text.trim()) return '';
  
  const lines = text.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;
  let paragraphBuffer: string[] = [];
  
  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      result.push(`<p>${paragraphBuffer.join('<br>')}</p>`);
      paragraphBuffer = [];
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Empty line - close lists and flush paragraph
    if (!trimmed) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      flushParagraph();
      continue;
    }
    
    // Bullet point
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      if (!inUl) {
        if (inOl) {
          result.push('</ol>');
          inOl = false;
        }
        result.push('<ul>');
        inUl = true;
      }
      result.push(`<li>${trimmed.substring(2)}</li>`);
      continue;
    }
    
    // Numbered list (1. 2. 3. etc)
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (!inOl) {
        if (inUl) {
          result.push('</ul>');
          inUl = false;
        }
        result.push('<ol>');
        inOl = true;
      }
      result.push(`<li>${numberMatch[2]}</li>`);
      continue;
    }
    
    // Regular text line
    if (inUl) {
      result.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      result.push('</ol>');
      inOl = false;
    }
    paragraphBuffer.push(trimmed);
  }
  
  // Close any open lists
  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');
  flushParagraph();
  
  return result.join('');
}

/**
 * Sanitize an array of strings.
 * Applies text sanitization to each element.
 * 
 * @param items - Array of strings to sanitize
 * @returns Array of sanitized strings
 * 
 * @example
 * ```tsx
 * {sanitizeArray(skills).map(skill => <Badge key={skill}>{skill}</Badge>)}
 * ```
 */
export function sanitizeArray(items: string[]): string[] {
  if (!Array.isArray(items)) return [];
  
  return items.map(item => sanitizeText(String(item)));
}

/**
 * Configuration for DOMPurify with strict security settings.
 * This can be used for custom sanitization needs.
 */
export const STRICT_SANITIZE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Sanitize with custom DOMPurify configuration.
 * 
 * @param dirty - Untrusted HTML string
 * @param config - Custom DOMPurify configuration
 * @returns Sanitized HTML string
 */
export function sanitizeWithConfig(dirty: string, config: DOMPurifyConfig): string {
  return DOMPurify.sanitize(dirty, config);
}
