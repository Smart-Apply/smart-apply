import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { load } from 'cheerio';
import axios from 'axios';
import { AgentUrlParser, type JobPostingExtraction } from '../agents/agent-url.parser';

interface ParsedJobData {
  title: string;
  company: string;
  location?: string;
  description?: string;
  requirements: string[];
  responsibilities: string[];
  niceToHave: string[];
  rawText: string;
}

@Injectable()
export class UrlParser {
  private readonly logger = new Logger(UrlParser.name);
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly useAgentFallback: boolean;
  private agentParser?: AgentUrlParser;

  constructor() {
    // Check if agent-based parsing is enabled
    this.useAgentFallback = process.env.ENABLE_AGENT_PARSER !== 'false';
    
    if (this.useAgentFallback) {
      try {
        this.agentParser = new AgentUrlParser();
        this.logger.log('Agent-based URL parser enabled as fallback');
      } catch (error) {
        this.logger.warn('Failed to initialize agent parser, continuing with Cheerio only');
        this.useAgentFallback = false;
      }
    }
  }

  /**
   * Parse job posting from URL with intelligent fallback strategy
   * 1. Try fast Cheerio parser first
   * 2. If insufficient data, use agent-based parser
   * 3. Return error with guidance if both fail
   * @param url URL to job posting page
   * @returns Parsed job data or raw text
   */
  async parse(url: string): Promise<string | ParsedJobData> {
    // Step 1: Try fast Cheerio-based parsing
    try {
      const text = await this.parseWithCheerio(url);
      
      // Check if we got sufficient content
      if (this.isSufficientContent(text)) {
        this.logger.log(`Successfully parsed ${url} with Cheerio (fast path)`);
        return text;
      }
      
      this.logger.warn(`Insufficient content from Cheerio for ${url}, trying agent parser...`);
    } catch (error) {
      this.logger.debug(`Cheerio parser failed for ${url}: ${error.message}`);
    }

    // Step 2: Try agent-based parsing if enabled
    if (this.useAgentFallback && this.agentParser) {
      try {
        this.logger.log(`Using agent-based parser for ${url}`);
        const agentResult = await this.agentParser.parse(url);
        
        // Convert agent result to our format
        return {
          title: agentResult.title,
          company: agentResult.company,
          location: agentResult.location,
          description: agentResult.description,
          requirements: agentResult.requirements,
          responsibilities: agentResult.responsibilities,
          niceToHave: agentResult.niceToHave,
          rawText: this.convertToRawText(agentResult),
        };
      } catch (error) {
        this.logger.error(`Agent parser also failed for ${url}: ${error.message}`);
        throw new BadRequestException(
          'Failed to parse job posting. This site may require manual copying. ' +
          'Try copying the job description text directly instead of using the URL.',
        );
      }
    }

    // Step 3: No fallback available
    throw new BadRequestException(
      'Could not extract sufficient content from URL. ' +
      'This site may use heavy JavaScript rendering. ' +
      'Try enabling the agent-based parser (ENABLE_AGENT_PARSER=true) or copy the text directly.',
    );
  }

  /**
   * Parse job posting using Cheerio (fast but limited to static HTML)
   * @param url URL to job posting page
   * @returns Extracted text content
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
    const matchCount = indicators.filter(indicator => lowerText.includes(indicator)).length;

    // Require at least 2 indicators for sufficient content
    return matchCount >= 2;
  }

  /**
   * Convert agent result to raw text format
   */
  private convertToRawText(agentResult: JobPostingExtraction): string {
    const parts: string[] = [];

    parts.push(`Job Title: ${agentResult.title}`);
    parts.push(`Company: ${agentResult.company}`);
    
    if (agentResult.location) {
      parts.push(`Location: ${agentResult.location}`);
    }
    
    if (agentResult.description) {
      parts.push(`\nDescription:\n${agentResult.description}`);
    }
    
    if (agentResult.requirements.length > 0) {
      parts.push(`\nRequirements:\n${agentResult.requirements.map(r => `- ${r}`).join('\n')}`);
    }
    
    if (agentResult.responsibilities.length > 0) {
      parts.push(`\nResponsibilities:\n${agentResult.responsibilities.map(r => `- ${r}`).join('\n')}`);
    }
    
    if (agentResult.niceToHave.length > 0) {
      parts.push(`\nNice to Have:\n${agentResult.niceToHave.map(n => `- ${n}`).join('\n')}`);
    }

    if (agentResult.salary) {
      parts.push(`\nSalary: ${agentResult.salary}`);
    }

    if (agentResult.applicationDeadline) {
      parts.push(`\nApplication Deadline: ${agentResult.applicationDeadline}`);
    }

    return parts.join('\n');
  }
}
