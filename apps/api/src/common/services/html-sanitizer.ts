import * as sanitizeHtml from 'sanitize-html';

/**
 * Strip LLM placeholder patterns from generated text
 * Removes patterns like "[Your Name]", "[Dein Name]", and closing signatures
 */
export function stripLLMPlaceholders(content: string): string {
  if (!content) return '';

  let result = content;

  // Pattern 1: Remove square bracket placeholders (multilingual)
  // e.g., "[Your Name]", "[Ihr Name]", "[Full Name]", "[Name]", "[Signature]"
  const bracketPattern =
    /\[(?:Your|Ihr|Dein|Their|My|Mein|Our|Unser|The|Der|Die|Das|Full|Vollständiger?|Candidate'?s?)?\s*(?:Name|Address|Adresse|Signature|Unterschrift|Title|Titel|Phone|Telefon|Email|E-Mail|Date|Datum|Company|Firma|Position|Stelle)[\w\s]*\]/gi;
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

  // Pattern 4: Strip standalone closing phrase at the end (safety fallback)
  // The template adds closing phrase automatically, so remove any LLM-generated ones
  result = stripClosingPhrase(result);

  // Clean up excess newlines and whitespace
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Strip closing phrases from the end of LLM-generated content.
 * The PDF template adds the closing phrase automatically, so we remove any
 * LLM-generated closing phrases to prevent duplication.
 *
 * Supported languages: German, English, French, Spanish, Italian
 */
export function stripClosingPhrase(content: string): string {
  if (!content) return '';

  // Pattern matches closing phrases in multiple languages at the end of content
  // Handles both HTML (<p>...</p>) and plain text formats
  const closingPhrases = [
    // German
    'Mit freundlichen Grüßen',
    'Beste Grüße',
    'Freundliche Grüße',
    'Herzliche Grüße',
    'Viele Grüße',
    // English
    'Sincerely',
    'Best regards',
    'Kind regards',
    'Yours sincerely',
    'Yours faithfully',
    'Best wishes',
    'Warm regards',
    // French
    'Cordialement',
    'Bien cordialement',
    'Salutations distinguées',
    // Spanish
    'Atentamente',
    'Saludos cordiales',
    'Un cordial saludo',
    // Italian
    'Cordiali saluti',
    'Distinti saluti',
  ];

  // Build regex pattern for all closing phrases
  const escapedPhrases = closingPhrases.map((phrase) =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const phrasesPattern = escapedPhrases.join('|');

  // Pattern 1: HTML format - <p>Closing phrase,?</p> at end (with optional trailing whitespace)
  const htmlPattern = new RegExp(`<p>\\s*(?:${phrasesPattern}),?\\s*<\/p>\\s*$`, 'gi');

  // Pattern 2: Plain text format - Closing phrase,? at end of string
  const textPattern = new RegExp(`(?:${phrasesPattern}),?\\s*$`, 'gim');

  let result = content;

  // Remove HTML closing phrase
  result = result.replace(htmlPattern, '');

  // Remove plain text closing phrase (only if not in HTML context)
  if (!result.includes('<p>')) {
    result = result.replace(textPattern, '');
  }

  return result.trim();
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
