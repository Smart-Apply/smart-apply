import * as sanitizeHtml from 'sanitize-html';

/**
 * Strip LLM placeholder patterns from generated text
 * Removes patterns like "[Your Name]", "[Dein Name]", and closing signatures
 */
export function stripLLMPlaceholders(content: string): string {
  if (!content) return '';

  let result = content;

  // Pattern 1: Remove square bracket placeholders (multilingual)
  // e.g., "[Your Name]", "[Ihr Name]", "[Your Address]", "[Company Name]"
  const bracketPattern =
    /\[(?:Your|Ihr|Dein|Their|My|Mein|Our|Unser|The|Der|Die|Das)\s+[\w\s]+\]/gi;
  result = result.replace(bracketPattern, '');

  // Pattern 2: Remove name line after closing phrase in HTML
  // Matches: <p>Mit freundlichen Grüßen</p>\n<p>Max Mustermann</p>
  const htmlClosingWithNamePattern =
    /(<p>(?:Sincerely|Best regards|Mit freundlichen Grüßen|Beste Grüße|Cordiali saluti|Cordialement|Atentamente),?<\/p>)\s*<p>[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+(?:\s+[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+)*<\/p>\s*$/gi;
  result = result.replace(htmlClosingWithNamePattern, '$1');

  // Pattern 3: Remove name line after closing phrase in plain text/markdown
  // Matches: "Sincerely,\n\nJohn Doe" or "Mit freundlichen Grüßen\n\nMax Mustermann"
  const textClosingWithNamePattern =
    /(Sincerely|Best regards|Mit freundlichen Grüßen|Beste Grüße|Cordiali saluti|Cordialement|Atentamente),?\s*\n+\s*[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+(?:\s+[A-ZÄÖÜ][a-zA-ZäöüÄÖÜßéèêëàâçîïôûùÿœ]+)*\s*$/gm;
  result = result.replace(textClosingWithNamePattern, '$1,');

  // Clean up excess newlines and whitespace
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'h1',
  'h2',
  'h3',
];
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
};
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

export function sanitizeRichText(content: string): string {
  if (!content) {
    return '';
  }

  // @ts-ignore - sanitize-html has typing issues with default import
  const sanitize = sanitizeHtml.default || sanitizeHtml;

  return sanitize(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    transformTags: {
      a: (tagName: string, attribs: Record<string, string>) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  });
}
