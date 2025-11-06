import { AgentUrlParser } from './agent-url.parser';

// Mock environment variables for testing
process.env.AGENT_MAX_STEPS = '10';
process.env.AGENT_TIMEOUT = '30000';
process.env.ENABLE_AGENT_PARSER = 'true';

describe('AgentUrlParser', () => {
  let parser: AgentUrlParser;

  beforeEach(() => {
    // Set OPENAI_API_KEY to 'mock' for testing (will fail gracefully)
    process.env.OPENAI_API_KEY = 'mock-key-for-testing';
  });

  afterEach(async () => {
    // Cleanup
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

  // Note: Full integration tests require valid API keys and real URLs
  // These should be run in E2E test environment with proper configuration
  describe('Integration tests (requires API keys)', () => {
    beforeEach(() => {
      // Skip if no real API key is set
      if (!process.env.AZURE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
        pending('Skipping integration tests - no API key configured');
      }
    });

    it.skip('should parse a simple job posting page', async () => {
      parser = new AgentUrlParser();
      
      // This would require a real URL and API key
      const result = await parser.parse('https://example.com/job-posting');
      
      expect(result.title).toBeDefined();
      expect(result.company).toBeDefined();
      expect(result.requirements).toBeInstanceOf(Array);
    });
  });
});
