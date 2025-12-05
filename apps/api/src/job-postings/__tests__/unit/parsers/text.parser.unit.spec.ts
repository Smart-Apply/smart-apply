import { TextParser } from '../../../parsers/text.parser';

describe('TextParser', () => {
  let parser: TextParser;

  beforeEach(() => {
    parser = new TextParser();
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  it('should parse and trim text', () => {
    const input = '  Some job posting text  ';
    const result = parser.parse(input);

    expect(result).toBe('Some job posting text');
  });

  it('should handle multiline text', () => {
    const input = `
      Job Title: Software Engineer
      Company: TechCorp
      Requirements: 5 years experience
    `;

    const result = parser.parse(input);

    expect(result).toContain('Job Title: Software Engineer');
    expect(result).toContain('Company: TechCorp');
  });

  it('should handle empty text', () => {
    const result = parser.parse('   ');

    expect(result).toBe('');
  });
});
