import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PromptService } from '../../common/services';

// Define the structured output schema for job posting extraction
// Simplified schema: only core fields + fullText (no structured arrays)
const JobPostingSchema = z.object({
  title: z.string().describe('The job title'),
  company: z
    .string()
    .describe('The company name (NEVER use job board names like Workwise/LinkedIn)'),
  location: z
    .string()
    .nullable()
    .describe('The job location (city, country), or null if not specified'),
  language: z
    .string()
    .describe(
      'ISO 639-1 language code (e.g., "de", "en", "fr", "es", "it", "pt", "nl", "pl", "tr", "ar", "zh", "ja")',
    ),
  fullText: z
    .string()
    .describe(
      'Complete job posting text including description, requirements, responsibilities, benefits, salary, etc. Keep original language and formatting.',
    ),
});

export type JobPostingExtraction = z.infer<typeof JobPostingSchema>;

// Constants
const MAX_CONTENT_LENGTH = 12000; // Character limit for LLM processing
const LLM_TEMPERATURE = 0; // Deterministic — no creative rewriting/translation
const LLM_MAX_TOKENS = 16000; // High limit for long job postings

/**
 * Hard wall-clock cap for the entire agent parse pipeline (browser launch +
 * navigation + LLM extraction). The global Express TimeoutMiddleware excludes
 * this route, so without this cap a hung Playwright page or stuck Azure
 * OpenAI request would tie up the single Fly worker indefinitely.
 */
const AGENT_PARSE_HARD_TIMEOUT_MS = 90_000; // 90s

/**
 * Per-call timeout for the Azure OpenAI HTTP request. Independent of the
 * pipeline cap above — a stuck network connection would otherwise leak fetch
 * sockets even after the parse caller gives up.
 */
const AZURE_OPENAI_FETCH_TIMEOUT_MS = 45_000; // 45s

/**
 * Concurrency gate. The agent parser launches a fresh Chromium via Playwright
 * AND the Puppeteer PDF pool can be holding up to 2 more browsers — on a
 * 1 GB shared-cpu-1x Fly VM that means a second concurrent agent parse
 * reliably OOM-kills the worker (kernel SIGKILL, no CORS headers on the
 * in-flight responses). Serialising the agent path keeps RSS bounded.
 */
let inFlightParse: Promise<unknown> | null = null;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AgentUrlParser {
  private readonly logger = new Logger(AgentUrlParser.name);
  private browser: Browser | null = null;
  private readonly maxSteps: number;
  private readonly timeout: number;

  // Azure OpenAI config (read from env, same vars as AzureOpenAIProvider)
  private readonly azureEndpoint: string;
  private readonly azureApiKey: string;
  private readonly azureDeployment: string;
  private readonly azureApiVersion: string;

  constructor() {
    this.maxSteps = parseInt(process.env.AGENT_MAX_STEPS || '10', 10);
    this.timeout = parseInt(process.env.AGENT_TIMEOUT || '30000', 10);

    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '';
    this.azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

    if (!this.azureEndpoint || !this.azureApiKey || !this.azureDeployment) {
      throw new Error(
        'Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT_NAME',
      );
    }

    this.logger.log('AgentUrlParser initialized with Azure OpenAI (direct HTTP)');
  }

  /**
   * Parse job posting from URL using a headless browser + Azure OpenAI extraction.
  /**
   * Parse job posting from URL using a headless browser + Azure OpenAI extraction.
   *
   * Wrapped in:
   *   1. A single-flight gate (`inFlightParse`) so concurrent callers queue
   *      instead of OOM-killing the worker by launching parallel Chromiums.
   *   2. A hard wall-clock cap (`AGENT_PARSE_HARD_TIMEOUT_MS`) so a stuck
   *      Playwright page or Azure OpenAI request can't tie up the worker
   *      forever now that the route is excluded from the global Express
   *      timeout middleware.
   *
   * @param url The job posting URL
   * @returns Structured job posting data
   */
  async parse(url: string): Promise<JobPostingExtraction> {
    // Serialise concurrent parses (see comment on `inFlightParse`).
    if (inFlightParse) {
      this.logger.warn(
        `Another agent parse is already in flight; queueing request for ${url}`,
      );
      try {
        await inFlightParse;
      } catch {
        // Previous parse's failure is irrelevant — we just waited for the slot.
      }
    }

    const run = this.parseInternal(url);
    inFlightParse = run.finally(() => {
      if (inFlightParse === run) {
        inFlightParse = null;
      }
    });
    return run;
  }

  private async parseInternal(url: string): Promise<JobPostingExtraction> {
    this.logger.log(`Starting agent-based parsing for URL: ${url}`);
    const startTime = Date.now();

    // Hard wall-clock cap for the whole pipeline. Implemented as a
    // Promise.race so we surface a friendly error instead of letting the
    // request hang indefinitely.
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Agent parser exceeded hard timeout of ${AGENT_PARSE_HARD_TIMEOUT_MS / 1000}s. ` +
              `Please copy the job description text directly into the form.`,
          ),
        );
      }, AGENT_PARSE_HARD_TIMEOUT_MS);
      // Don't keep the event loop alive purely for this timer.
      timeoutHandle.unref?.();
    });

    try {
      const work = (async () => {
        await this.initBrowser();
        const page = await this.navigateToUrl(url);
        const pageContent = await this.extractPageContent(page);
        this.detectBotProtection(pageContent, url);
        const extracted = await this.extractStructuredData(pageContent, url);
        this.validateExtraction(extracted);
        return extracted;
      })();

      const extracted = await Promise.race([work, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.logger.log(`Successfully parsed URL in ${duration}ms`);

      return extracted;
    } catch (error) {
      this.logger.error(`Agent parsing failed for ${url}: ${error.message}`);
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      await this.closeBrowser();
    }
  }

  /**
   * Detect if the page is blocked by bot protection (Cloudflare, CAPTCHA, etc.)
   */
  private detectBotProtection(pageContent: string, url: string): void {
    const contentLower = pageContent.toLowerCase();
    const hostname = new URL(url).hostname;

    const cloudflareBlocked =
      contentLower.includes('you have been blocked') ||
      contentLower.includes('ray id') ||
      contentLower.includes('cloudflare') ||
      (contentLower.includes('request blocked') && contentLower.includes('error'));

    const captchaBlocked =
      contentLower.includes('captcha') ||
      contentLower.includes('verify you are human') ||
      contentLower.includes('i am not a robot') ||
      contentLower.includes('recaptcha');

    const accessDenied =
      contentLower.includes('access denied') ||
      contentLower.includes('403 forbidden') ||
      contentLower.includes('permission denied');

    const rateLimited =
      contentLower.includes('too many requests') ||
      contentLower.includes('rate limit') ||
      contentLower.includes('429');

    if (cloudflareBlocked) {
      this.logger.warn(`Cloudflare block detected for ${hostname}`);
      throw new Error(
        `Diese Webseite (${hostname}) blockiert automatisierte Zugriffe mit Cloudflare. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (captchaBlocked) {
      this.logger.warn(`CAPTCHA detected for ${hostname}`);
      throw new Error(
        `Diese Webseite (${hostname}) erfordert eine CAPTCHA-Verifizierung. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (accessDenied) {
      this.logger.warn(`Access denied for ${hostname}`);
      throw new Error(
        `Zugriff auf diese Webseite (${hostname}) wurde verweigert. ` +
          `Bitte kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    if (rateLimited) {
      this.logger.warn(`Rate limited by ${hostname}`);
      throw new Error(
        `Zu viele Anfragen an ${hostname}. Bitte warte einen Moment und versuche es erneut, ` +
          `oder kopiere die Stellenbeschreibung direkt und füge sie als Text ein.`,
      );
    }

    const cleanedContent = pageContent.replace(/\s+/g, ' ').trim();
    if (cleanedContent.length < 300) {
      this.logger.warn(
        `Page content suspiciously short (${cleanedContent.length} chars) for ${hostname}`,
      );
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

    const executablePath =
      process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

    this.browser = await chromium.launch({
      headless: true,
      executablePath: executablePath,
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
    await page.setViewportSize({ width: 1920, height: 1080 });

    try {
      this.logger.debug(`Navigating to ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      await page
        .waitForLoadState('networkidle', { timeout: 5000 })
        .catch(() => {
          this.logger.debug('Network idle timeout, proceeding anyway');
        });

      await this.handlePopups(page);
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
        // ignore
      }
    }
  }

  /**
   * Extract text content from page using a battery of common selectors.
   */
  private async extractPageContent(page: Page): Promise<string> {
    this.logger.debug('Extracting page content...');

    const mainContentSelectors = [
      // LinkedIn-specific
      '.jobs-description__content',
      '.jobs-description',
      '.show-more-less-html__markup',
      '[class*="jobs-description"]',
      // ID-based
      '#jobDescriptionText',
      '#job-description',
      '#jobDescription',
      '[id*="job-description"]',
      '[id*="jobDescription"]',
      // Class-based
      '.job-description',
      '.job-detail',
      '.job-details',
      '.jobsearch-jobDescriptionText',
      '.posting',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      // Data attributes
      '[data-testid="job-description"]',
      '[data-testid*="description"]',
      // Semantic HTML
      'main',
      '[role="main"]',
      'article',
      '.content',
    ];

    let bestContent = '';
    let bestSelector = '';
    let bestLength = 0;

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
        // ignore
      }
    }

    if (bestLength < 200) {
      this.logger.debug('No sufficient content from specific selectors, using body as fallback');
      bestContent = await page.locator('body').innerText();
      bestSelector = 'body';
      bestLength = bestContent.length;
    }

    this.logger.debug(`Best selector: ${bestSelector} with ${bestLength} characters`);

    bestContent = this.cleanContent(bestContent);

    let title = await page.title();
    title = title
      .replace(/\s*[-|]\s*(?:Workwise|LinkedIn|Indeed|StepStone|Xing|Monster|Glassdoor)\s*$/gi, '')
      .replace(/\s*at\s+(?:Workwise|LinkedIn|Indeed|StepStone|Xing|Monster|Glassdoor)\s*$/gi, '')
      .trim();

    const fullContent = `Page Title: ${title}\n\n${bestContent}`;
    await page.close();
    return fullContent;
  }

  /**
   * Conservative content cleanup — only remove obvious UI noise.
   */
  private cleanContent(content: string): string {
    const noisePatterns = [
      /sign in to create job alert/gi,
      /new to linkedin\? join now/gi,
      /forgot password\?/gi,
      /get notified about new .* jobs/gi,
      /be among the first \d+ applicants/gi,
      /over \d+ applicants/gi,
      /\d+ applicants/gi,
      /show more\s+show less/gi,
      /apply\s+save\s+share/gi,
      /\n{4,}/g,
    ];

    let cleaned = content;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, '\n\n');
    }

    const uiKeywords = /^(apply|save|share|report|sign in|join now|back|home|search|filter|show)$/i;
    const lines = cleaned.split('\n');
    const filteredLines: string[] = [];
    const seenLines = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length < 20 && uiKeywords.test(trimmed)) continue;

      const normalized = trimmed.toLowerCase();
      if (seenLines.has(normalized)) continue;
      seenLines.add(normalized);

      filteredLines.push(line);
    }

    cleaned = filteredLines.join('\n');

    cleaned = cleaned
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  }

  /**
   * Segment content into logical sections (requirements, responsibilities, etc.)
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
   * Use Azure OpenAI (direct HTTP) to extract structured job posting data.
   */
  private async extractStructuredData(content: string, url: string): Promise<JobPostingExtraction> {
    this.logger.debug('Using Azure OpenAI to extract structured data...');

    const schema = zodToJsonSchema(JobPostingSchema as any);
    const segments = this.segmentContent(content);
    const companyHint = this.detectCompany(content);

    if (companyHint) {
      this.logger.log(`Detected company: "${companyHint}"`);
    } else {
      this.logger.warn('No company detected — LLM will have to extract from content');
    }

    let structuredContent = segments.fullContent;

    // Cut off at "Similar jobs" section to prevent confusion
    const similarJobsIndex = structuredContent.search(
      /\b(similar jobs|people also viewed|show more jobs|explore collaborative articles)\b/i,
    );
    if (similarJobsIndex !== -1) {
      structuredContent = structuredContent.substring(0, similarJobsIndex);
      this.logger.debug(`Cut content at "Similar jobs" section (position ${similarJobsIndex})`);
    }

    structuredContent = structuredContent.substring(0, MAX_CONTENT_LENGTH);

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

    const prompt = await PromptService.renderPrompt('extract-job-posting', {
      url,
      content: structuredContent,
      schema,
      companyHint: companyHint || 'Not detected - extract from content',
    });

    try {
      const responseText = await this.callAzureOpenAI([
        {
          role: 'system',
          content:
            'You are a precise data extraction assistant. Your ONLY job is to COPY text exactly as written. ' +
            'DO NOT translate, rewrite, summarize, or paraphrase. ' +
            'If the text is in German, keep it in German. If English, keep English. ' +
            'COPY EXACTLY - word for word, character for character.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      // Extract JSON from markdown code blocks if present
      let jsonText = responseText;
      const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
        this.logger.debug('Extracted JSON from markdown code block');
      }

      const parsed = JSON.parse(jsonText);
      const validated = JobPostingSchema.parse(parsed);

      // Override if LLM picked a job board name but we detected the real company
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
          `LLM extracted blacklisted job board "${validated.company}" — overriding with detected company "${companyHint}"`,
        );
        validated.company = companyHint;
      } else if (companyHint && validated.company !== companyHint) {
        this.logger.warn(
          `Company mismatch — detected: "${companyHint}" but LLM extracted: "${validated.company}"`,
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
   * Direct HTTP call to Azure OpenAI chat completions endpoint.
   * Replaces the previous LangChain `AzureChatOpenAI.invoke()` dependency.
   *
   * Uses an AbortController so a stuck connection can't leak sockets.
   * Independent of the outer pipeline timeout in `parseInternal()` — that one
   * gives up the response, this one actually closes the underlying socket.
   */
  private async callAzureOpenAI(messages: ChatMessage[]): Promise<string> {
    const url =
      `${this.azureEndpoint.replace(/\/$/, '')}` +
      `/openai/deployments/${this.azureDeployment}/chat/completions` +
      `?api-version=${this.azureApiVersion}`;

    const controller = new AbortController();
    const abortTimer = setTimeout(
      () => controller.abort(),
      AZURE_OPENAI_FETCH_TIMEOUT_MS,
    );
    abortTimer.unref?.();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.azureApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature: LLM_TEMPERATURE,
          max_tokens: LLM_MAX_TOKENS,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const e = err as Error & { name?: string };
      if (e.name === 'AbortError') {
        throw new Error(
          `Azure OpenAI request timed out after ${AZURE_OPENAI_FETCH_TIMEOUT_MS / 1000}s`,
        );
      }
      throw err;
    } finally {
      clearTimeout(abortTimer);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Azure OpenAI request failed: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody.slice(0, 500)}` : ''}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Azure OpenAI returned no content');
    }

    return content;
  }

  /**
   * Detect company name from content using patterns
   */
  private detectCompany(content: string): string | null {
    const aboutPatterns = [
      /über\s+([A-Z][A-Za-z0-9\s&.,-]{2,50}(?:\s+GmbH|\s+AG|\s+SE|\s+Inc\.|\s+LLC|\s+Ltd\.))/i,
      /about\s+([A-Z][A-Za-z0-9\s&.,-]{2,50}(?:\s+GmbH|\s+AG|\s+SE|\s+Inc\.|\s+LLC|\s+Ltd\.))/i,
    ];

    for (const pattern of aboutPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    const metadataPatterns = [
      /at\s+([A-Z][A-Za-z0-9\s&.,-]{2,50})\s+(?:Essen|Berlin|Munich|Hamburg|remote)/i,
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

    if (!data.fullText || data.fullText.length < 50) {
      throw new Error('Insufficient job posting content extracted');
    }
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
   * Health check — verifies the browser can launch.
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

