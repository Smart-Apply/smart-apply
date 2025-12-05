import { BadRequestException } from '@nestjs/common';
import { UrlParser } from '../../../parsers/url.parser';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the AgentUrlParser
jest.mock('../../../agents/agent-url.parser', () => {
  return {
    AgentUrlParser: jest.fn().mockImplementation(() => {
      return {
        parse: jest.fn().mockResolvedValue({
          title: 'Senior Engineer',
          company: 'TechCorp',
          location: 'Remote',
          description: 'Great job opportunity',
          requirements: ['5 years experience'],
          responsibilities: ['Write code'],
          niceToHave: ['PhD'],
        }),
      };
    }),
  };
});

describe('UrlParser', () => {
  let parser: UrlParser;

  beforeEach(() => {
    // Disable agent parser for most tests
    process.env.ENABLE_AGENT_PARSER = 'false';
    parser = new UrlParser();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(parser).toBeDefined();
  });

  it('should parse HTML content from URL using Cheerio', async () => {
    const mockHtml = `
      <html>
        <head><title>Job Posting</title></head>
        <body>
          <main>
            <h1>Senior Engineer at TechCorp</h1>
            <p>We are looking for an experienced engineer with the following requirements and qualifications for this role.</p>
            <p>Your responsibilities will include coding, testing, and collaborating with the team.</p>
            <p>Required skills: JavaScript, TypeScript, Node.js, and experience with cloud platforms.</p>
          </main>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValue({ data: mockHtml });

    const result = await parser.parse('https://example.com/job');

    expect(typeof result).toBe('string');
    expect(result).toContain('Senior Engineer at TechCorp');
    expect(result).toContain('We are looking for an experienced engineer');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com/job',
      expect.objectContaining({
        timeout: expect.any(Number),
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    );
  });

  it('should remove scripts and styles', async () => {
    const mockHtml = `
      <html>
        <body>
          <script>console.log('test');</script>
          <style>body { margin: 0; }</style>
          <main>
            Job posting content here with requirements and responsibilities listed below.
            This is enough text to pass the minimum length requirement for extraction with proper skills and experience needed for the role.
            The qualifications include various technical abilities and domain knowledge.
          </main>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValue({ data: mockHtml });

    const result = await parser.parse('https://example.com/job');

    expect(result).not.toContain('console.log');
    expect(result).not.toContain('margin: 0');
    expect(result).toContain('Job posting content');
  });

  it('should throw error for timeout', async () => {
    mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED', isAxiosError: true });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(parser.parse('https://example.com/job')).rejects.toThrow(BadRequestException);
  });

  it('should throw error for 404', async () => {
    mockedAxios.get.mockRejectedValue({
      response: { status: 404 },
      isAxiosError: true,
    });
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(parser.parse('https://example.com/job')).rejects.toThrow(BadRequestException);
  });

  it('should throw error for server error', async () => {
    const axiosError: any = new Error('Server error');
    axiosError.response = { status: 500 };
    axiosError.isAxiosError = true;

    mockedAxios.get.mockRejectedValue(axiosError);
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(parser.parse('https://example.com/job')).rejects.toThrow(BadRequestException);
  });

  describe('Agent Parser Fallback', () => {
    beforeEach(() => {
      // Enable agent parser for these tests
      process.env.ENABLE_AGENT_PARSER = 'true';
      parser = new UrlParser();
    });

    it('should use agent parser when Cheerio returns insufficient content', async () => {
      const mockHtml = '<html><body><main>Hi</main></body></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await parser.parse('https://example.com/job');

      // Should return structured data from agent parser
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('company');
      expect(result).toHaveProperty('rawText');
    });

    it('should use Cheerio when it returns sufficient content', async () => {
      const mockHtml = `
        <html>
          <body>
            <main>
              Senior Engineer at TechCorp
              We are looking for an engineer with skills and experience.
              Requirements: 5 years of experience in software development.
              Responsibilities include: writing code, testing, and deploying.
              This is a great opportunity with qualifications needed.
            </main>
          </body>
        </html>
      `;
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await parser.parse('https://example.com/job');

      // Should return string from Cheerio (fast path)
      expect(typeof result).toBe('string');
    });
  });

  describe('Content Sufficiency Check', () => {
    it('should detect insufficient content (too short)', () => {
      const shortText = 'Hi there';
      expect(parser['isSufficientContent'](shortText)).toBe(false);
    });

    it('should detect insufficient content (missing indicators)', () => {
      const textWithoutIndicators = 'Lorem ipsum '.repeat(50); // Long but no job indicators
      expect(parser['isSufficientContent'](textWithoutIndicators)).toBe(false);
    });

    it('should detect sufficient content', () => {
      const goodText = `
        Senior Engineer position at TechCorp.
        Requirements: 5 years experience in software development.
        Responsibilities include writing clean code and testing.
        Must have qualifications in computer science.
      `;
      expect(parser['isSufficientContent'](goodText)).toBe(true);
    });
  });
});
