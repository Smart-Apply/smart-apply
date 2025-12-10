/**
 * Markdown conversion utilities for Tiptap editor
 * 
 * Pipeline:
 * - Loading: Markdown (from LLM) → HTML → Tiptap
 * - Saving: Tiptap → HTML → Markdown (for storage)
 */

import { marked } from 'marked';
import TurndownService from 'turndown';

// Configure marked for safe HTML output
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

// Configure turndown for clean Markdown output
const turndownService = new TurndownService({
  headingStyle: 'atx', // Use # for headings
  bulletListMarker: '-', // Use - for bullet lists
  codeBlockStyle: 'fenced', // Use ``` for code blocks
  emDelimiter: '*', // Use * for emphasis
  strongDelimiter: '**', // Use ** for strong
});

// Custom rule for paragraph handling to preserve line breaks
turndownService.addRule('paragraph', {
  filter: 'p',
  replacement: function (content) {
    return '\n\n' + content + '\n\n';
  },
});

/**
 * Convert Markdown to HTML for Tiptap editor
 * Used when loading content from LLM/database
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return '<p></p>';
  }

  try {
    // Parse markdown to HTML
    const html = marked.parse(markdown, { async: false }) as string;
    
    // Clean up the HTML for Tiptap
    return html
      .trim()
      // Ensure we have at least a paragraph
      .replace(/^(?!<)/, '<p>') 
      .replace(/(?<!>)$/, '</p>');
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    // Fallback: wrap in paragraph tags
    return `<p>${markdown}</p>`;
  }
}

/**
 * Convert HTML from Tiptap to Markdown for storage
 * Used when saving content to database
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '' || html === '<p></p>') {
    return '';
  }

  try {
    const markdown = turndownService.turndown(html);
    return markdown.trim();
  } catch (error) {
    console.error('Error converting HTML to markdown:', error);
    // Fallback: strip HTML tags
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Check if a string appears to be Markdown (has markdown syntax)
 */
export function isMarkdown(text: string): boolean {
  if (!text) return false;
  
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/, // Headers
    /^\s*[-*+]\s/, // Unordered lists
    /^\s*\d+\.\s/, // Ordered lists
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /_[^_]+_/, // Italic alt
    /\[.+\]\(.+\)/, // Links
    /^>\s/, // Blockquotes
    /`[^`]+`/, // Inline code
    /```/, // Code blocks
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Check if a string appears to be HTML
 */
export function isHtml(text: string): boolean {
  if (!text) return false;
  return /<[^>]+>/.test(text);
}

/**
 * Clean and normalize HTML content
 * Removes redundant nested tags and normalizes structure
 */
function cleanHtml(html: string): string {
  let cleaned = html;
  
  // Step 1: Remove redundant paragraph wrappings around block elements
  // e.g., <p><ul>...</ul></p> -> <ul>...</ul>
  cleaned = cleaned.replace(/<p>\s*(<(?:ul|ol|blockquote|div|h[1-6])[^>]*>)/gi, '$1');
  cleaned = cleaned.replace(/<\/(ul|ol|blockquote|div|h[1-6])>\s*<\/p>/gi, '</$1>');
  
  // Step 2: Remove paragraph tags wrapping lists (more aggressive)
  // e.g., <p><ul> or </ul></p>
  cleaned = cleaned.replace(/<p>\s*<(ul|ol)/gi, '<$1');
  cleaned = cleaned.replace(/<\/(ul|ol)>\s*<\/p>/gi, '</$1>');
  
  // Step 3: Remove redundant paragraph tags inside list items
  // e.g., <li><p>text</p></li> -> <li>text</li>
  cleaned = cleaned.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, '<li>$1</li>');
  
  // Step 4: Handle deeply nested paragraphs in lists
  // e.g., <li><p><ul>... becomes <li><ul>...
  cleaned = cleaned.replace(/<li>\s*<p>\s*<(ul|ol)/gi, '<li><$1');
  
  // Step 5: Remove empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
  
  // Step 6: Clean up excessive whitespace while preserving line breaks
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  // Step 7: Normalize line breaks
  cleaned = cleaned.replace(/>\s+</g, '><');
  
  // Ensure at least one paragraph if completely empty
  if (!cleaned.trim() || cleaned === '') {
    return '<p></p>';
  }
  
  // If content doesn't start with a block element, wrap in paragraph
  if (!/^\s*<(p|ul|ol|h[1-6]|blockquote|div)/.test(cleaned)) {
    return `<p>${cleaned}</p>`;
  }
  
  return cleaned;
}

/**
 * Smart convert: Detect format and convert to HTML for Tiptap
 * Handles both Markdown and HTML inputs
 */
export function toTiptapHtml(content: string): string {
  if (!content || content.trim() === '') {
    return '<p></p>';
  }

  // Check if content has Markdown list syntax that needs conversion
  // This takes priority over HTML detection since LLM might mix both
  const hasMarkdownLists = /(?:^|\n)\s*[-*+]\s+\S|(?:^|\n)\s*\d+\.\s+\S/m.test(content);
  const hasMarkdownHeaders = /(?:^|\n)#{1,6}\s+\S/m.test(content);
  const hasMarkdownFormatting = /\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_/.test(content);
  
  // If it has markdown syntax, always convert (even if it also has some HTML)
  if (hasMarkdownLists || hasMarkdownHeaders || hasMarkdownFormatting || isMarkdown(content)) {
    const html = markdownToHtml(content);
    return cleanHtml(html);
  }

  // If it's already HTML, clean and normalize it
  if (isHtml(content)) {
    return cleanHtml(content);
  }

  // Plain text - wrap in paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length === 0) {
    return '<p></p>';
  }
  
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}
