import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ParseJobPostingDto } from './dto/parse-job-posting.dto';
import { JobPostingResponseDto } from './dto/job-posting-response.dto';
import { TextParser } from './parsers/text.parser';
import { UrlParser } from './parsers/url.parser';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';

interface ParsedJobData {
  title: string;
  company: string;
  location?: string;
  description?: string;
  language?: string;
  requirements: string[];
  responsibilities: string[];
  niceToHave: string[];
}

@Injectable()
export class JobPostingsService {
  private readonly logger = new Logger(JobPostingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly textParser: TextParser,
    private readonly urlParser: UrlParser,
    private readonly pdfParser: PdfParser,
    private readonly docxParser: DocxParser,
  ) {}

  /**
   * Parse job posting from various sources and store in database
   * @param dto Parse job posting DTO
   * @returns Job posting response DTO
   */
  async parseJobPosting(dto: ParseJobPostingDto): Promise<JobPostingResponseDto> {
    let rawText: string;
    let parsed: ParsedJobData;

    // 1. Determine input source and extract text
    // Priority: URL > File > Text (URLs are most specific and should use agent parser)
    if (dto.url) {
      this.logger.log(`Parsing job posting from URL: ${dto.url}`);
      const urlResult = await this.urlParser.parse(dto.url);

      // Check if we got structured data from agent parser
      if (typeof urlResult === 'object' && 'rawText' in urlResult) {
        // Agent parser returned structured data
        rawText = urlResult.rawText;
        parsed = urlResult;
        this.logger.log('✅ Agent parser returned structured data');
      } else {
        // Cheerio parser returned raw text
        rawText = urlResult as string;
        parsed = this.extractStructuredData(rawText);
        this.logger.log('✅ Cheerio parser returned raw text');
      }
    } else if (dto.fileId) {
      this.logger.log(`Parsing job posting from file: ${dto.fileId}`);
      rawText = await this.parseFromFile(dto.fileId);
      parsed = this.extractStructuredData(rawText);
    } else if (dto.text) {
      this.logger.log('Parsing job posting from text input');
      rawText = this.textParser.parse(dto.text);
      parsed = this.extractStructuredData(rawText);
    } else {
      throw new BadRequestException('At least one input source (text, url, or fileId) is required');
    }

    // 2. Persist in DB
    const jobPosting = await this.prisma.jobPosting.create({
      data: {
        rawText,
        sourceUrl: dto.url,
        fileId: dto.fileId,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        description: parsed.description,
        language: parsed.language,
        requirements: parsed.requirements,
        responsibilities: parsed.responsibilities,
        niceToHave: parsed.niceToHave,
      },
    });

    this.logger.log(
      `Created job posting: ${jobPosting.id} - ${jobPosting.title} at ${jobPosting.company}`,
    );

    return this.mapToResponseDto(jobPosting);
  }

  /**
   * Parse file content based on file type
   * @param fileId Storage key of uploaded file
   * @returns Extracted text
   */
  private async parseFromFile(fileId: string): Promise<string> {
    try {
      // Decode storage key from base64 ID
      const storageKey = Buffer.from(fileId, 'base64').toString('utf-8');

      // Download file from storage
      const buffer = await this.storageService.download(storageKey);

      // Determine file type from storage key extension
      const extension = storageKey.toLowerCase().split('.').pop();

      if (extension === 'pdf') {
        return await this.pdfParser.parse(buffer);
      } else if (extension === 'docx') {
        return await this.docxParser.parse(buffer);
      } else {
        throw new BadRequestException(`Unsupported file type: ${extension}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse file: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Extract structured data from raw text using regex patterns
   * This is a simple MVP implementation - can be enhanced with LLM later
   * @param text Raw text content
   * @returns Parsed job data
   */
  private extractStructuredData(text: string): ParsedJobData {
    // Extract title (look for common patterns)
    const title = this.extractTitle(text);

    // Extract company name
    const company = this.extractCompany(text);

    // Extract location
    const location = this.extractLocation(text);

    // Extract description (first substantial paragraph or section)
    const description = this.extractDescription(text);

    // Extract requirements
    const requirements = this.extractSection(text, [
      'requirements',
      'qualifications',
      'required skills',
      'must have',
      'what we need',
      'you should have',
      'minimum qualifications',
    ]);

    // Extract responsibilities
    const responsibilities = this.extractSection(text, [
      'responsibilities',
      'duties',
      'what you will do',
      'role description',
      'job description',
      'you will',
      'your mission',
    ]);

    // Extract nice-to-have
    const niceToHave = this.extractSection(text, [
      'nice to have',
      'preferred',
      'bonus',
      'plus',
      'nice-to-have',
      'would be a plus',
      'preferred qualifications',
    ]);

    return {
      title: title || 'Unknown Position',
      company: company || 'Unknown Company',
      location,
      description: description || text.substring(0, 500),
      requirements,
      responsibilities,
      niceToHave,
    };
  }

  /**
   * Extract job title from text
   */
  private extractTitle(text: string): string | undefined {
    // Look for patterns like "Job Title:", "Position:", "Role:", etc.
    const patterns = [
      /(?:job\s+title|position|role|vacancy|opening):\s*([^\n]+)/i,
      /^([^\n]+?(?:engineer|developer|manager|analyst|specialist|consultant|designer|architect|lead|director|coordinator))/im,
      /hiring\s+(?:for\s+)?([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: first line if it looks like a title (short and has job-related keywords)
    const firstLine = text.split('\n')[0]?.trim();
    if (
      firstLine &&
      firstLine.length < 100 &&
      /engineer|developer|manager|analyst|specialist|consultant|designer|architect|lead|director/i.test(
        firstLine,
      )
    ) {
      return firstLine;
    }

    return undefined;
  }

  /**
   * Extract company name from text
   */
  private extractCompany(text: string): string | undefined {
    // Look for patterns like "Company:", "at CompanyName", etc.
    const patterns = [
      /(?:company|employer|organization):\s*([^\n]+)/i,
      /(?:at|@)\s+([A-Z][a-zA-Z0-9\s&]+(?:Inc|LLC|Ltd|GmbH|AG|Corp)?)/,
      /(?:join|working\s+at)\s+([A-Z][a-zA-Z0-9\s&]+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string): string | undefined {
    const patterns = [
      /(?:location|office|based\s+in):\s*([^\n]+)/i,
      /(?:remote|hybrid|on-site|onsite)(?:\s*[,-]\s*([^\n]+))?/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2,})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract description from text
   */
  private extractDescription(text: string): string | undefined {
    // Look for description section
    const patterns = [
      /(?:job\s+description|about\s+(?:the\s+)?(?:role|position)|overview):\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: first substantial paragraph
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 100);
    return paragraphs[0]?.trim();
  }

  // Cache for compiled regex patterns to improve performance
  private sectionRegexCache = new Map<string, RegExp>();

  /**
   * Extract section items (requirements, responsibilities, etc.)
   */
  private extractSection(text: string, headers: string[]): string[] {
    const items: string[] = [];

    // Build pattern for section headers with caching
    const cacheKey = headers.join('|');
    let sectionRegex = this.sectionRegexCache.get(cacheKey);

    if (!sectionRegex) {
      sectionRegex = new RegExp(`(?:${cacheKey})\\s*:?\\s*([\\s\\S]*?)(?=(?:${cacheKey})|$)`, 'i');
      this.sectionRegexCache.set(cacheKey, sectionRegex);
    }

    const match = text.match(sectionRegex);
    if (!match || !match[1]) {
      return items;
    }

    const sectionText = match[1];

    // Extract bullet points (various formats)
    const bulletPatterns = [
      /[•\-\*]\s*([^\n]+)/g,
      /^\s*\d+\.\s*([^\n]+)/gm,
      /^(?:\s{2,}|\t)([A-Z][^\n]+)/gm,
    ];

    for (const pattern of bulletPatterns) {
      const matches = Array.from(sectionText.matchAll(pattern));
      if (matches.length > 0) {
        items.push(...matches.map((m) => m[1].trim()).filter((item) => item.length > 10));
        break; // Use first matching pattern
      }
    }

    // If no bullets found, split by newlines and filter
    if (items.length === 0) {
      items.push(
        ...sectionText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 15 && line.length < 300),
      );
    }

    // Limit to reasonable number of items
    return items.slice(0, 20);
  }

  /**
   * Map Prisma entity to response DTO
   */
  private mapToResponseDto(jobPosting: any): JobPostingResponseDto {
    return {
      id: jobPosting.id,
      title: jobPosting.title,
      company: jobPosting.company,
      location: jobPosting.location,
      description: jobPosting.description,
      requirements: jobPosting.requirements,
      responsibilities: jobPosting.responsibilities,
      niceToHave: jobPosting.niceToHave,
      rawText: jobPosting.rawText,
      sourceUrl: jobPosting.sourceUrl,
      fileId: jobPosting.fileId,
      createdAt: jobPosting.createdAt,
      updatedAt: jobPosting.updatedAt,
    };
  }
}
