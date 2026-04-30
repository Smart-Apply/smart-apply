import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { load } from 'cheerio';
import axios from 'axios';
import { AgentUrlParser, type JobPostingExtraction } from '../agents/agent-url.parser';

interface ParsedJobData {
  title: string;
  company: string;
  location?: string;
  language?: string;
  fullText: string;
  rawText: string;
}

@Injectable()
export class UrlParser {
  private readonly logger = new Logger(UrlParser.name);
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly useAgentFallback: boolean;
  private agentParser?: AgentUrlParser;

  /**
   * Job boards that render content with JavaScript and need the
   * Playwright-based agent parser. Cheerio cannot extract anything
   * meaningful from these.
   */
  private readonly DYNAMIC_SITES = [
    'linkedin.com',
    'workwise.io',
    'indeed.com',
    'glassdoor.com',
    'xing.com',
  ];

  constructor() {
    // Agent parser is enabled by default; disable with ENABLE_AGENT_PARSER=false
    this.useAgentFallback = process.env.ENABLE_AGENT_PARSER !== 'false';

    if (this.useAgentFallback) {
      try {
        this.agentParser = new AgentUrlParser();
        this.logger.log('Agent-based URL parser enabled as fallback');
      } catch (error) {
        this.logger.warn(
          `Failed to initialize agent parser, continuing with Cheerio only: ${error.message}`,
        );
        this.useAgentFallback = false;
      }
    }
  }

  /**
   * Parse job posting from URL with intelligent fallback strategy:
   * 1. Known dynamic sites (LinkedIn, Workwise, etc.) → agent parser directly
   * 2. Static sites → fast Cheerio first
   * 3. If Cheerio returns thin content → agent parser fallback
   * 4. Otherwise → friendly error asking the user to paste the text
   */
  async parse(url: string): Promise<string | ParsedJobData> {
    const isDynamicSite = this.DYNAMIC_SITES.some((site) => url.includes(site));

    if (isDynamicSite) {
      if (!this.useAgentFallback || !this.agentParser) {
        throw new BadRequestException(
          'This job board renders content with JavaScript and requires the agent parser. ' +
            'Please copy the job description text directly into the form, ' +
            'or set ENABLE_AGENT_PARSER=true.',
        );
      }

      this.logger.log(`Detected dynamic site, using agent parser directly for ${url}`);
      try {
        const agentResult = await this.agentParser.parse(url);
        return {
          title: agentResult.title,
          company: agentResult.company,
          location: agentResult.location ?? undefined,
          language: agentResult.language ?? undefined,
          fullText: agentResult.fullText,
          rawText: this.convertToRawText(agentResult),
        };
      } catch (error) {
        this.logger.error(`Agent parser failed for ${url}: ${error.message}`);
        throw new BadRequestException(
          error.message ||
            'Failed to parse job posting from dynamic site. ' +
              'Please copy the job description text directly into the form.',
        );
      }
    }

    // Static / server-rendered sites: try fast Cheerio first
    try {
      const text = await this.parseWithCheerio(url);
      if (this.isSufficientContent(text)) {
        this.logger.log(`Successfully parsed ${url} with Cheerio (fast path)`);
        return text;
      }
      this.logger.warn(`Insufficient content from Cheerio for ${url}, trying agent parser...`);
    } catch (error) {
      this.logger.debug(`Cheerio parser failed for ${url}: ${error.message}`);
    }

    // Cheerio failed or returned thin content → try the agent
    if (this.useAgentFallback && this.agentParser) {
      try {
        this.logger.log(`Using agent-based parser for ${url}`);
        const agentResult = await this.agentParser.parse(url);
        return {
          title: agentResult.title,
          company: agentResult.company,
          location: agentResult.location ?? undefined,
          language: agentResult.language ?? undefined,
          fullText: agentResult.fullText,
          rawText: this.convertToRawText(agentResult),
        };
      } catch (error) {
        this.logger.error(`Agent parser also failed for ${url}: ${error.message}`);
        throw new BadRequestException(
          error.message ||
            'Failed to parse job posting. Please copy the job description text directly into the form.',
        );
      }
    }

    throw new BadRequestException(
      'Could not extract sufficient content from URL. ' +
        'This site may use heavy JavaScript rendering. ' +
        'Try enabling the agent parser (ENABLE_AGENT_PARSER=true) or copy the text directly.',
    );
  }

  /**
   * Parse job posting using Cheerio (fast but limited to static HTML)
   */
  private async parseWithCheerio(url: string): Promise<string> {
    try {
      this.logger.log(`Fetching job posting from URL: ${url}`);

      const response = await axios.get(url, {
        timeout: this.REQUEST_TIMEOUT,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        maxRedirects: 5,
      });

      const $ = load(response.data);

      // Remove scripts, styles, navigation, footer, etc.
      $('script, style, nav, footer, header, aside, iframe, noscript').remove();

      // Try to find main content area (common patterns)
      let text = '';
      const mainSelectors = [
        'main',
        '[role="main"]',
        '.job-description',
        '.job-detail',
        '#job-description',
        'article',
        '.content',
      ];

      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          text = element.text();
          break;
        }
      }

      // Fallback to body if no main content found
      if (!text) {
        text = $('body').text();
      }

      // Clean up whitespace
      text = text
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .trim();

      if (!text || text.length < 50) {
        throw new BadRequestException('Could not extract meaningful content from URL');
      }

      this.logger.log(`Successfully extracted ${text.length} characters from URL`);
      return text;
    } catch (error) {
      this.logger.error(`Failed to parse URL: ${error.message}`);

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('Request timeout: URL took too long to respond');
        }
        if (error.response?.status === 404) {
          throw new BadRequestException('URL not found (404)');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new BadRequestException('Server error when accessing URL');
        }
      }

      throw new BadRequestException(`Failed to parse URL: ${error.message}`);
    }
  }

  /**
   * Check if extracted content is sufficient
   */
  private isSufficientContent(text: string): boolean {
    // Must have reasonable length
    if (!text || text.length < 200) {
      return false;
    }

    // Check for common job posting indicators
    const indicators = [
      'requirements',
      'responsibilities',
      'qualifications',
      'experience',
      'skills',
      'description',
      'about',
      'role',
    ];

    const lowerText = text.toLowerCase();
    const matchCount = indicators.filter((indicator) => lowerText.includes(indicator)).length;

    // Require at least 2 indicators for sufficient content
    return matchCount >= 2;
  }

  /**
   * Convert agent extraction result into a plain-text "raw" representation
   * (used as the JobPosting.rawText for downstream consumers).
   */
  private convertToRawText(agentResult: JobPostingExtraction): string {
    const parts: string[] = [];

    parts.push(`Job Title: ${agentResult.title}`);
    parts.push(`Company: ${agentResult.company}`);

    if (agentResult.location) {
      parts.push(`Location: ${agentResult.location}`);
    }

    if (agentResult.fullText) {
      parts.push(`\n${agentResult.fullText}`);
    }

    return parts.join('\n');
  }
}

