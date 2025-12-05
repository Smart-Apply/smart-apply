import { BadRequestException } from '@nestjs/common';
import { DocxParser } from '../../../parsers/docx.parser';

// Mock mammoth
jest.mock('mammoth', () => {
  const extractRawText = jest.fn(({ buffer }) => {
    const content = buffer.toString();
    if (content.includes('valid')) {
      return Promise.resolve({
        value:
          'Backend Developer at Microsoft\n\nQualifications:\n- 3+ years of Node.js\n- AWS experience',
      });
    } else if (content.includes('empty')) {
      return Promise.resolve({
        value: '',
      });
    } else if (content.includes('short')) {
      return Promise.resolve({
        value: 'Short',
      });
    } else if (content.includes('invalid')) {
      return Promise.reject(new Error('Invalid DOCX'));
    }
    return Promise.resolve({
      value: 'Default DOCX content for testing with enough characters to pass validation',
    });
  });
  
  return {
    default: { extractRawText },
    extractRawText,
  };
});

describe('DocxParser', () => {
  let parser: DocxParser;

  beforeEach(() => {
    parser = new DocxParser();
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  it('should parse valid DOCX and extract text', async () => {
    const buffer = Buffer.from('valid docx content');

    const result = await parser.parse(buffer);

    expect(result).toContain('Backend Developer');
    expect(result).toContain('Qualifications');
  });

  it('should throw error for empty DOCX', async () => {
    const buffer = Buffer.from('empty docx');

    await expect(parser.parse(buffer)).rejects.toThrow(BadRequestException);
    await expect(parser.parse(buffer)).rejects.toThrow('Could not extract meaningful text');
  });

  it('should throw error for short content', async () => {
    const buffer = Buffer.from('short');

    // Content returned by mock is less than 50 characters
    await expect(parser.parse(buffer)).rejects.toThrow(BadRequestException);
  });
});
