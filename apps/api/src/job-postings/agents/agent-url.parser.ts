import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { AzureChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PromptService } from '../../common/services';

// Define the structured output schema for job posting extraction
// Using .nullable() for optional fields because LLMs often return null instead of undefined
const JobPostingSchema = z.object({
  title: z.string().describe('The job title'),
  company: z.string().describe('The company name'),
  location: z.string().nullable().describe('The job location, or null if not specified'),
  description: z.string().nullable().describe('The job description, or null if not available'),
  language: z
    .string()
    .describe('Detected language code (e.g., "de" for German, "en" for English, "fr" for French)'),
  requirements: z.array(z.string()).describe('List of job requirements'),
  responsibilities: z.array(z.string()).describe('List of job responsibilities'),
  niceToHave: z.array(z.string()).describe('Nice to have qualifications'),
  salary: z.string().nullable().describe('Salary information if available, or null if not specified'),
  applicationDeadline: z.string().nullable().describe('Application deadline if available, or null if not specified'),
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
  private readonly llm: AzureChatOpenAI;

  constructor() {
    // Configuration from environment variables
    this.maxSteps = parseInt(process.env.AGENT_MAX_STEPS || '10', 10);
    this.timeout = parseInt(process.env.AGENT_TIMEOUT || '30000', 10);

    // Initialize LLM for agent reasoning using Azure OpenAI
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

    if (!azureEndpoint || !azureApiKey || !azureDeployment) {
      throw new Error(
        'Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME',
      );
    }

    this.llm = new AzureChatOpenAI({
      azureOpenAIApiKey: azureApiKey,
      azureOpenAIApiDeploymentName: azureDeployment,
      azureOpenAIApiVersion: azureApiVersion,
      azureOpenAIEndpoint: azureEndpoint,
      temperature: 0.2, // Lower temperature for more consistent extraction
      maxTokens: 4000,
    });

    this.logger.log('AgentUrlParser initialized with Azure OpenAI');
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

      // Step 3.5: Check for bot protection / blocking
      this.detectBotProtection(pageContent, url);

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
   * Detect if the page is blocked by bot protection (Cloudflare, CAPTCHA, etc.)
   * Throws a user-friendly error if blocking is detected
   */
  private detectBotProtection(pageContent: string, url: string): void {
    const contentLower = pageContent.toLowerCase();
    const hostname = new URL(url).hostname;

    // Cloudflare block indicators
    const cloudflareBlocked =
      contentLower.includes('you have been blocked') ||
      contentLower.includes('ray id') ||
      contentLower.includes('cloudflare') ||
      (contentLower.includes('request blocked') && contentLower.includes('error'));

    // CAPTCHA indicators
    const captchaBlocked =
      contentLower.includes('captcha') ||
      contentLower.includes('verify you are human') ||
      contentLower.includes('i am not a robot') ||
      contentLower.includes('recaptcha');

    // Access denied indicators
    const accessDenied =
      contentLower.includes('access denied') ||
      contentLower.includes('403 forbidden') ||
      contentLower.includes('permission denied');

    // Rate limiting indicators
    const rateLimited =
      contentLower.includes('too many requests') ||
      contentLower.includes('rate limit') ||
      contentLower.includes('429');

    if (cloudflareBlocked) {
      this.logger.warn(`🛡️ Cloudflare block detected for ${hostname}`);
      throw new Error(
        `Diese Webseite (${hostname}) blockiert automatisierte Zugriffe mit Cloudflare. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (captchaBlocked) {
      this.logger.warn(`🤖 CAPTCHA detected for ${hostname}`);
      throw new Error(
        `Diese Webseite (${hostname}) erfordert eine CAPTCHA-Verifizierung. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (accessDenied) {
      this.logger.warn(`🚫 Access denied for ${hostname}`);
      throw new Error(
        `Zugriff auf diese Webseite (${hostname}) wurde verweigert. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (rateLimited) {
      this.logger.warn(`⏱️ Rate limited by ${hostname}`);
      throw new Error(
        `Zu viele Anfragen an ${hostname}. Bitte warte einen Moment und versuche es erneut, ` +
          `oder kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    // Check if content is too short (likely blocked or error page)
    const cleanedContent = pageContent.replace(/\s+/g, ' ').trim();
    if (cleanedContent.length < 300) {
      this.logger.warn(`📄 Page content suspiciously short (${cleanedContent.length} chars) for ${hostname}`);
      // Don't throw here, let the LLM try to extract what it can
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
      await page
        .waitForLoadState('networkidle', {
          timeout: 5000,
        })
        .catch(() => {
          // Ignore timeout, some sites continuously load content
          this.logger.debug('Network idle timeout, proceeding anyway');
        });

      // Handle common popups and cookie banners
      await this.handlePopups(page);

      // Additional wait for JavaScript rendering
      await page.waitForTimeout(3000);

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
   * Uses a generic approach: tries multiple common selectors and picks the one with most content
   */
  private async extractPageContent(page: Page): Promise<string> {
    this.logger.debug('Extracting page content...');

    // Generic selectors for job postings across different sites
    // Ordered by specificity (more specific first)
    const mainContentSelectors = [
      // ID-based selectors (most specific)
      '#jobDescriptionText',
      '#job-description',
      '#jobDescription',
      '[id*="job-description"]',
      '[id*="jobDescription"]',

      // Class-based selectors (common patterns)
      '.job-description',
      '.job-detail',
      '.job-details',
      '.jobsearch-jobDescriptionText',
      '.posting',
      '[class*="job-description"]',
      '[class*="jobDescription"]',

      // Data attribute selectors
      '[data-testid="job-description"]',
      '[data-testid*="description"]',

      // Semantic HTML (generic fallbacks)
      'main',
      '[role="main"]',
      'article',
      '.content',
    ];

    let bestContent = '';
    let bestSelector = '';
    let bestLength = 0;

    // Try all selectors and keep the one with most content
    for (const selector of mainContentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 500 })) {
          const content = await element.innerText();
          if (content.length > bestLength) {
            bestContent = content;
            bestSelector = selector;
            bestLength = content.length;
          }
        }
      } catch {
        // Continue trying other selectors
      }
    }

    // Fallback to body if no good content found
    if (bestLength < 200) {
      this.logger.debug('No sufficient content from specific selectors, using body as fallback');
      bestContent = await page.locator('body').innerText();
      bestSelector = 'body';
      bestLength = bestContent.length;
    }

    this.logger.debug(`Best selector: ${bestSelector} with ${bestLength} characters`);

    // Clean up the content before sending to LLM
    bestContent = this.cleanContent(bestContent);

    // Log content preview for debugging
    if (bestContent.length < 500) {
      this.logger.warn(`Content seems short after cleaning: ${bestContent}`);
    } else {
      this.logger.debug(`Content preview after cleaning: ${bestContent.substring(0, 300)}...`);
    }

    // Get page title for additional context
    let title = await page.title();

    // Clean job board names from title (often contains "at Workwise", "- LinkedIn", etc.)
    title = title
      .replace(/\s*[-|]\s*(?:Workwise|LinkedIn|Indeed|StepStone|Xing|Monster|Glassdoor)\s*$/gi, '')
      .replace(/\s*at\s+(?:Workwise|LinkedIn|Indeed|StepStone|Xing|Monster|Glassdoor)\s*$/gi, '')
      .trim();

    this.logger.debug(`Original page title: ${await page.title()}`);
    this.logger.debug(`Cleaned page title: ${title}`);

    const fullContent = `Page Title: ${title}\n\n${bestContent}`;

    await page.close();

    return fullContent;
  }

  /**
   * Clean extracted content by removing common noise patterns
   * Removes UI elements, navigation, login prompts, similar jobs, etc.
   */
  private cleanContent(content: string): string {
    // Remove common noise patterns (case-insensitive)
    const noisePatterns = [
      // Job board company names that should never appear as the hiring company
      /\bWorkwise\b(?!\s+GmbH)/gi,
      /\bLinkedIn\b(?!\s+Corporation)/gi,
      /\bIndeed\b(?!\s+Inc)/gi,
      /\bStepStone\b/gi,

      // Login/Sign-in prompts (very aggressive - captures entire login flows)
      /sign in.*?(?:user agreement|cookie policy).{0,1000}/gis,
      /welcome back.*?(?:sign in|join now).{0,500}/gis,
      /join or sign in.*?cookie policy.{0,500}/gis,
      /not you\?.*?(?:email|password).{0,300}/gis,
      /by clicking.*?(?:agree|continue).*?(?:user agreement|privacy policy|cookie policy).{0,400}/gis,
      /new to linkedin\?.*?join now.{0,200}/gis,
      /forgot password\?.{0,100}/gis,
      /remove photo.{0,100}/gis,

      // Similar jobs and recommendations (remove entire sections)
      /similar jobs.*?(?=\n\n[A-Z]|$)/gis,
      /people also viewed.*?(?=\n\n[A-Z]|$)/gis,
      /show more jobs like this.*?show fewer jobs like this/gis,
      /show more jobs.*$/gis,
      /show fewer jobs.*$/gis,

      // Job alerts and notifications
      /get notified.*?(?:sign in|create job alert)/gis,
      /sign in to create job alert.*/gis,
      /see who.*?has hired for this role.*/gis,

      // LinkedIn-specific UI noise
      /get ai-powered advice.*/gis,
      /referrals increase your chances.*?see who you know/gis,
      /be among the first \d+ applicants.*/gis,
      /apply save share report/gis,
      /save report this job/gis,

      // Generic job search UI and metadata
      /explore collaborative articles.*?explore more/gis,
      /we're unlocking community knowledge.*/gis,
      /similar searches.*?(?=\n\n[A-Z]|$)/gis,
      /\d+\s+open jobs/gi,
      /seniority level.*?employment type.*?job function.*?industries/gis,
      /mid-senior level.*?full-time.*?engineering and information technology.*?business consulting and services/gis,

      // Job listing metadata (dates, locations without context)
      /\d+\s+(?:hours?|days?|weeks?|months?)\s+ago(?!\s+[a-z])/gi,

      // Repeated UI patterns
      /show more\s+show less/gi,
      /apply\s+join or sign in/gi,

      // Multiple consecutive newlines
      /\n{3,}/g,
    ];

    let cleaned = content;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, '\n\n');
    }

    // Remove lines that are pure navigation/UI (short lines with UI keywords)
    const uiKeywords =
      /^(apply|save|share|report|sign in|join now|back|home|search|filter|show|email|password|phone|continue)$/i;
    const lines = cleaned.split('\n');
    const filteredLines: string[] = [];
    const seenLines = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines temporarily
      if (trimmed.length === 0) continue;

      // Remove short UI lines
      if (trimmed.length < 50 && uiKeywords.test(trimmed)) continue;

      // Remove duplicate lines (especially job titles repeated)
      const normalized = trimmed.toLowerCase();
      if (seenLines.has(normalized)) continue;
      seenLines.add(normalized);

      filteredLines.push(line);
    }

    cleaned = filteredLines.join('\n');

    // Final cleanup: normalize whitespace but preserve structure
    cleaned = cleaned
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();

    return cleaned;
  }

  /**
   * Segment content into logical sections (requirements, responsibilities, etc.)
   * This helps the LLM focus on the right content for each field
   */
  private segmentContent(content: string): {
    companyInfo?: string;
    requirements?: string;
    responsibilities?: string;
    niceToHave?: string;
    benefits?: string;
    fullContent: string;
  } {
    const sections: Record<string, string> = {};

    // Pattern to detect section headers (German and English)
    const sectionPatterns = [
      {
        key: 'companyInfo',
        regex:
          /(?:über|about)\s+([A-Z][^\n]{2,50})\s*\n([\s\S]{50,800}?)(?=\n\n[A-Z]|was\s+(?:bieten|erwartet|solltest)|$)/gim,
      },
      {
        key: 'requirements',
        regex:
          /(?:was solltest du mitbringen|anforderungen|requirements|qualifications|what you bring|deine qualifikationen|das bringst du mit)\s*[:\n]+([\s\S]{50,1500}?)(?=\n\n(?:[A-Z]|was\s+|bonus|verantwort|aufgaben)|$)/gim,
      },
      {
        key: 'responsibilities',
        regex:
          /(?:was erwartet dich|verantwortlichkeiten|responsibilities|your tasks|deine aufgaben|das erwartet dich|aufgaben)\s*[:\n]+([\s\S]{50,1500}?)(?=\n\n(?:[A-Z]|was\s+|bonus|anforderung)|$)/gim,
      },
      {
        key: 'niceToHave',
        regex:
          /(?:bonuspunkte|von vorteil|idealerweise|wünschenswert|nice to have|bonus points|preferred|would be a plus)\s*[:\n,]+([\s\S]{20,500}?)(?=\n\n[A-Z]|$)/gim,
      },
      {
        key: 'benefits',
        regex:
          /(?:was bieten wir|benefits|what we offer|perks|wir bieten)\s*[:\n]+([\s\S]{50,1000}?)(?=\n\n[A-Z]|$)/gim,
      },
    ];

    for (const { key, regex } of sectionPatterns) {
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        // Take the first substantial match
        const match = matches[0];
        const extracted = match[key === 'companyInfo' ? 2 : 1]?.trim();
        if (extracted && extracted.length > 30) {
          sections[key] = extracted;
        }
      }
    }

    return {
      ...sections,
      fullContent: content,
    } as any;
  }

  /**
   * Use LLM to extract structured job posting data from page content
   */
  private async extractStructuredData(content: string, url: string): Promise<JobPostingExtraction> {
    this.logger.debug('Using LLM to extract structured data...');

    // Log first 500 chars of cleaned content for debugging
    this.logger.log(`📄 Cleaned content preview (first 500 chars):\n${content.substring(0, 500)}`);

    const schema = zodToJsonSchema(JobPostingSchema as any);

    // Segment content into logical sections
    const segments = this.segmentContent(content);

    // Detect company name from content
    const companyHint = this.detectCompany(content);

    // Log company detection result prominently
    if (companyHint) {
      this.logger.log(`🏢 ✅ Detected company: "${companyHint}"`);
    } else {
      this.logger.warn(`🏢 ❌ No company detected - LLM will have to extract from content`);
    }

    // Build structured input for LLM with segmented sections
    let structuredContent = segments.fullContent.substring(0, MAX_CONTENT_LENGTH);

    // Add segmented sections as hints if available
    if (segments.companyInfo) {
      structuredContent += `\n\n=== COMPANY SECTION ===\n${segments.companyInfo}`;
    }
    if (segments.requirements) {
      structuredContent += `\n\n=== REQUIREMENTS SECTION ===\n${segments.requirements}`;
    }
    if (segments.responsibilities) {
      structuredContent += `\n\n=== RESPONSIBILITIES SECTION ===\n${segments.responsibilities}`;
    }
    if (segments.niceToHave) {
      structuredContent += `\n\n=== NICE TO HAVE SECTION ===\n${segments.niceToHave}`;
    }

    // Load prompt template and inject variables
    const prompt = await PromptService.renderPrompt('extract-job-posting', {
      url,
      content: structuredContent,
      schema,
      companyHint: companyHint || 'Not detected - extract from content',
    });

    // Log what we're sending to LLM
    this.logger.log(
      `📤 Sending to LLM with company hint: "${companyHint || 'Not detected - extract from content'}"`,
    );
    this.logger.debug(
      `📤 First 800 chars of structured content sent to LLM:\n${structuredContent.substring(0, 800)}`,
    );

    try {
      // Invoke LLM with prompt string directly
      const response = await this.llm.invoke(prompt);

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

      // Log extracted company for comparison
      this.logger.log(`📥 LLM extracted company: "${validated.company}"`);

      // Post-processing: Override if LLM extracted a job board name but we detected the real company
      const jobBoardBlacklist = [
        'Workwise',
        'LinkedIn',
        'Indeed',
        'StepStone',
        'Xing',
        'Monster',
        'Glassdoor',
      ];
      if (companyHint && jobBoardBlacklist.includes(validated.company)) {
        this.logger.warn(
          `⚠️ LLM extracted blacklisted job board "${validated.company}" - overriding with detected company "${companyHint}"`,
        );
        validated.company = companyHint;
      } else if (companyHint && validated.company !== companyHint) {
        this.logger.warn(
          `⚠️ COMPANY MISMATCH! Detected: "${companyHint}" but LLM extracted: "${validated.company}"`,
        );
      }

      this.logger.debug('Successfully extracted structured data');
      return validated;
    } catch (error) {
      this.logger.error(`Failed to extract structured data: ${error.message}`);
      throw new Error(`LLM extraction failed: ${error.message}`);
    }
  }

  /**
   * Detect company name from content using patterns
   */
  private detectCompany(content: string): string | null {
    // Try to find "Über [Company]" or "About [Company]" patterns (highest priority)
    const aboutPatterns = [
      /über\s+([A-Z][A-Za-z0-9\s&.,-]{2,50}(?:\s+GmbH|\s+AG|\s+SE|\s+Inc\.|\s+LLC|\s+Ltd\.))/i,
      /about\s+([A-Z][A-Za-z0-9\s&.,-]{2,50}(?:\s+GmbH|\s+AG|\s+SE|\s+Inc\.|\s+LLC|\s+Ltd\.))/i,
    ];

    for (const pattern of aboutPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        this.logger.debug(`Detected company from 'Über/About' section: ${company}`);
        return company;
      }
    }

    // Try to find company in job posting metadata patterns
    const metadataPatterns = [
      // "Platform Architect - AWS at SAPERED Essen"
      /at\s+([A-Z][A-Za-z0-9\s&.,-]{2,50})\s+(?:Essen|Berlin|Munich|Hamburg|remote)/i,
      // "SAPERED GmbH 2 weeks ago"
      /([A-Z][A-Za-z0-9\s&.,-]{2,50}(?:\s+GmbH|\s+AG|\s+SE))\s+\d+\s+(?:hours?|days?|weeks?|months?)\s+ago/i,
    ];

    for (const pattern of metadataPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        const blacklist = [
          'Workwise',
          'LinkedIn',
          'Indeed',
          'StepStone',
          'Job',
          'Career',
          'Talent',
        ];
        if (!blacklist.some((term) => company.includes(term))) {
          this.logger.debug(`Detected company from metadata: ${company}`);
          return company;
        }
      }
    }

    return null;
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
      data.requirements.length + data.responsibilities.length + data.niceToHave.length;

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
