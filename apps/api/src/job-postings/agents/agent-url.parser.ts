import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import HumanMessage - use require to avoid TypeScript module resolution issues with @langchain/core
// This works at runtime but TypeScript can't resolve the path properly in some configurations
const { HumanMessage } = require('@langchain/core/messages');

// Define the structured output schema for job posting extraction
const JobPostingSchema = z.object({
  title: z.string().describe('The job title'),
  company: z.string().describe('The company name'),
  location: z.string().optional().describe('The job location'),
  description: z.string().optional().describe('The job description'),
  requirements: z.array(z.string()).describe('List of job requirements'),
  responsibilities: z.array(z.string()).describe('List of job responsibilities'),
  niceToHave: z.array(z.string()).describe('Nice to have qualifications'),
  salary: z.string().optional().describe('Salary information if available'),
  applicationDeadline: z.string().optional().describe('Application deadline if available'),
});

export type JobPostingExtraction = z.infer<typeof JobPostingSchema>;

// Constants
const MAX_CONTENT_LENGTH = 12000; // Character limit for LLM processing (GPT-4o-mini context window optimization)

@Injectable()
export class AgentUrlParser {
  private readonly logger = new Logger(AgentUrlParser.name);
  private browser: Browser | null = null;
  private readonly maxSteps: number;
  private readonly timeout: number;
  private readonly llm: ChatOpenAI;

  constructor() {
    // Configuration from environment variables
    this.maxSteps = parseInt(process.env.AGENT_MAX_STEPS || '10', 10);
    this.timeout = parseInt(process.env.AGENT_TIMEOUT || '30000', 10);

    // Initialize LLM for agent reasoning
    // Use Azure OpenAI if configured, otherwise fallback to OpenAI
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

    if (azureEndpoint && azureApiKey && azureDeployment) {
      this.llm = new ChatOpenAI({
        openAIApiKey: azureApiKey,
        configuration: {
          baseURL: `${azureEndpoint}/openai/deployments/${azureDeployment}`,
          defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview' },
          defaultHeaders: { 'api-key': azureApiKey },
        },
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 4000,
      });
    } else {
      // Fallback to standard OpenAI (requires OPENAI_API_KEY env var)
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 4000,
      });
    }

    this.logger.log('AgentUrlParser initialized with LLM provider');
  }

  /**
   * Parse job posting from URL using AI agent with browser automation
   * @param url The job posting URL
   * @returns Structured job posting data
   */
  async parse(url: string): Promise<JobPostingExtraction> {
    this.logger.log(`Starting agent-based parsing for URL: ${url}`);
    const startTime = Date.now();

    try {
      // Step 1: Initialize browser
      await this.initBrowser();

      // Step 2: Navigate to URL and wait for content
      const page = await this.navigateToUrl(url);

      // Step 3: Extract page content
      const pageContent = await this.extractPageContent(page);

      // Step 4: Use LLM to extract structured data
      const extracted = await this.extractStructuredData(pageContent, url);

      // Step 5: Validate extraction completeness
      this.validateExtraction(extracted);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully parsed URL in ${duration}ms`);

      return extracted;
    } catch (error) {
      this.logger.error(`Agent parsing failed for ${url}: ${error.message}`);
      throw error;
    } finally {
      // Cleanup
      await this.closeBrowser();
    }
  }

  /**
   * Initialize Playwright browser
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.logger.debug('Launching browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Navigate to URL and wait for dynamic content
   */
  private async navigateToUrl(url: string): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
      this.logger.debug(`Navigating to ${url}`);

      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      // Wait for network to be idle (dynamic content loaded)
      await page.waitForLoadState('networkidle', {
        timeout: 5000,
      }).catch(() => {
        // Ignore timeout, some sites continuously load content
        this.logger.debug('Network idle timeout, proceeding anyway');
      });

      // Handle common popups and cookie banners
      await this.handlePopups(page);

      // Additional wait for JavaScript rendering
      await page.waitForTimeout(2000);

      return page;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Handle cookie banners and popups
   */
  private async handlePopups(page: Page): Promise<void> {
    // Common selectors for accept buttons on cookie banners
    const acceptSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      'button:has-text("I Accept")',
      'button:has-text("Agree")',
      'button:has-text("OK")',
      '[id*="accept"]',
      '[class*="accept"]',
    ];

    for (const selector of acceptSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click({ timeout: 1000 });
          this.logger.debug(`Clicked accept button: ${selector}`);
          await page.waitForTimeout(500);
          break;
        }
      } catch {
        // Ignore if button not found or not clickable
      }
    }
  }

  /**
   * Extract text content from page
   */
  private async extractPageContent(page: Page): Promise<string> {
    this.logger.debug('Extracting page content...');

    // Try to find main content area with common job posting selectors
    const mainContentSelectors = [
      'main',
      '[role="main"]',
      '.job-description',
      '.job-detail',
      '.job-details',
      '#job-description',
      '#jobDescriptionText',
      'article',
      '.content',
      '.posting',
      '[data-testid="job-description"]',
    ];

    let content = '';

    for (const selector of mainContentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          content = await element.innerText();
          if (content.length > 200) {
            this.logger.debug(`Found main content using selector: ${selector}`);
            break;
          }
        }
      } catch {
        // Try next selector
      }
    }

    // Fallback to body if no main content found
    if (!content || content.length < 200) {
      this.logger.debug('Using body as fallback for content extraction');
      content = await page.locator('body').innerText();
    }

    // Get page title for additional context
    const title = await page.title();
    const fullContent = `Page Title: ${title}\n\n${content}`;

    this.logger.debug(`Extracted ${fullContent.length} characters from page`);

    await page.close();

    return fullContent;
  }

  /**
   * Use LLM to extract structured job posting data from page content
   */
  private async extractStructuredData(
    content: string,
    url: string,
  ): Promise<JobPostingExtraction> {
    this.logger.debug('Using LLM to extract structured data...');

    const schema = zodToJsonSchema(JobPostingSchema);

    const prompt = `You are an expert at extracting structured job posting information from web page content.

URL: ${url}

Extract the following information from the job posting content below:
- Job title
- Company name
- Location (if mentioned)
- Job description
- Requirements (extract as a list)
- Responsibilities (extract as a list)
- Nice to have qualifications (extract as a list)
- Salary information (if available)
- Application deadline (if available)

Important:
- Extract actual information, don't make up data
- For lists, extract individual items
- If information is not available, use empty arrays or omit optional fields
- Be thorough and accurate

Job Posting Content:
${content.substring(0, MAX_CONTENT_LENGTH)}

Respond with a valid JSON object matching this schema:
${JSON.stringify(schema, null, 2)}`;

    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);

      // Parse the response - handle both JSON and text responses
      let jsonText = response.content.toString();

      // Extract JSON from markdown code blocks if present
      const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);

      // Validate against schema
      const validated = JobPostingSchema.parse(parsed);

      this.logger.debug('Successfully extracted structured data');
      return validated;
    } catch (error) {
      this.logger.error(`Failed to extract structured data: ${error.message}`);
      throw new Error(`LLM extraction failed: ${error.message}`);
    }
  }

  /**
   * Validate that extraction has sufficient data
   */
  private validateExtraction(data: JobPostingExtraction): void {
    if (!data.title || data.title.length < 3) {
      throw new Error('Job title not found or too short');
    }

    if (!data.company || data.company.length < 2) {
      throw new Error('Company name not found or too short');
    }

    const totalItems =
      data.requirements.length +
      data.responsibilities.length +
      data.niceToHave.length;

    if (totalItems === 0 && (!data.description || data.description.length < 50)) {
      throw new Error('Insufficient job posting content extracted');
    }

    this.logger.debug('Extraction validation passed');
  }

  /**
   * Close browser and cleanup resources
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      this.logger.debug('Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Health check for agent functionality
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initBrowser();
      await this.closeBrowser();
      return true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}
