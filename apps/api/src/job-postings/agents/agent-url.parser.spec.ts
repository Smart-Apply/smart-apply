import { AgentUrlParser } from './agent-url.parser';

// Mock environment variables for testing
process.env.AGENT_MAX_STEPS = '10';
process.env.AGENT_TIMEOUT = '30000';
process.env.ENABLE_AGENT_PARSER = 'true';
process.env.AZURE_OPENAI_ENDPOINT =
  process.env.AZURE_OPENAI_ENDPOINT || 'https://example.openai.azure.com';
process.env.AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || 'mock-key-for-testing';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME =
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini';

describe('AgentUrlParser', () => {
  let parser: AgentUrlParser;

  afterEach(async () => {
    if (parser) {
      await parser['closeBrowser']();
    }
  });

  it('should be defined', () => {
    parser = new AgentUrlParser();
    expect(parser).toBeDefined();
  });

  it('should have configurable max steps and timeout', () => {
    parser = new AgentUrlParser();
    expect(parser['maxSteps']).toBe(10);
    expect(parser['timeout']).toBe(30000);
  });

  // Skip browser tests in CI/environments without Playwright browsers installed
  it.skip('should initialize browser successfully', async () => {
    parser = new AgentUrlParser();
    await parser['initBrowser']();
    expect(parser['browser']).toBeDefined();
    await parser['closeBrowser']();
  });

  it.skip('should perform health check', async () => {
    parser = new AgentUrlParser();
    const isHealthy = await parser.healthCheck();
    expect(typeof isHealthy).toBe('boolean');
  });

  // Full integration tests require valid API keys, real URLs, and Playwright browsers
  describe('Integration tests (requires API keys)', () => {
    beforeEach(() => {
      if (!process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY === 'mock-key-for-testing') {
        pending('Skipping integration tests — no real Azure OpenAI key configured');
      }
    });

    it.skip('should parse a simple job posting page', async () => {
      parser = new AgentUrlParser();
      const result = await parser.parse('https://example.com/job-posting');
      expect(result.title).toBeDefined();
      expect(result.company).toBeDefined();
      expect(result.fullText).toBeDefined();
    });
  });
});

