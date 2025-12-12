import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ParseJobPostingDto } from './dto/parse-job-posting.dto';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { JobPostingResponseDto } from './dto/job-posting-response.dto';
import { TextParser } from './parsers/text.parser';
import { UrlParser } from './parsers/url.parser';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';

interface ParsedJobData {
  title: string;
  company: string;
  location?: string;
  language?: string;
  fullText: string;
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
   * @param userId User ID from JWT token
   * @param dto Parse job posting DTO
   * @returns Job posting response DTO
   */
  async parseJobPosting(userId: string, dto: ParseJobPostingDto): Promise<JobPostingResponseDto> {
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
        // Ensure fullText is present
        if (!parsed.fullText) {
          parsed.fullText = rawText;
        }
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
        userId,
        rawText,
        sourceUrl: dto.url,
        fileId: dto.fileId,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        language: parsed.language,
        fullText: parsed.fullText,
      },
    });

    this.logger.log(
      `Created job posting: ${jobPosting.id} - ${jobPosting.title} at ${jobPosting.company}`,
    );

    return this.mapToResponseDto(jobPosting);
  }

  /**
   * Create job posting manually with all fields
   * @param userId User ID from JWT token
   * @param dto Create job posting DTO
   * @returns Job posting response DTO
   */
  async create(userId: string, dto: CreateJobPostingDto): Promise<JobPostingResponseDto> {
    this.logger.log(`Creating manual job posting: ${dto.title} at ${dto.company}`);

    const jobPosting = await this.prisma.jobPosting.create({
      data: {
        userId,
        title: dto.title,
        company: dto.company,
        location: dto.location,
        language: dto.language,
        fullText: dto.fullText,
        sourceUrl: dto.url,
        rawText: dto.fullText, // For manual input, fullText is also the rawText
      },
    });

    this.logger.log(`Created manual job posting: ${jobPosting.id}`);

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
   * Simplified extraction fallback (when agent parsing fails)
   * Just extracts basic fields, fullText is the raw text
   */
  private extractStructuredData(text: string): ParsedJobData {
    // Basic extraction - try to find title and company in first few lines
    const lines = text.split('\n').filter((l) => l.trim());
    const firstLine = lines[0] || 'Unknown Position';
    const secondLine = lines[1] || 'Unknown Company';

    // Simple title detection (first line with job keywords)
    const title = firstLine.match(/engineer|developer|manager|analyst|specialist|consultant|designer|architect/i)
      ? firstLine.trim()
      : 'Unknown Position';

    // Simple company detection (second line or look for "at Company")
    const companyMatch = text.match(/(?:at|@)\s+([A-Z][a-zA-Z0-9\s&]+(?:Inc|LLC|Ltd|GmbH|AG|Corp)?)/);
    const company = companyMatch ? companyMatch[1].trim() : secondLine.trim() || 'Unknown Company';

    // Simple location detection
    const locationMatch = text.match(/(?:location|office|based in):\s*([^\n]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : undefined;

    return {
      title,
      company,
      location,
      language: 'en', // Default fallback
      fullText: text, // Use entire text as fullText
    };
  }

  /**
   * List all job postings for a user with pagination
   * @param userId User ID from JWT token
   * @param page Page number (starts at 1)
   * @param limit Items per page
   * @returns Paginated job posting response DTOs
   */
  async listJobPostings(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: JobPostingResponseDto[]; pagination: any }> {
    const [jobPostings, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.jobPosting.count({
        where: { userId },
      }),
    ]);

    return {
      items: jobPostings.map((jp) => this.mapToResponseDto(jp)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single job posting by ID
   * @param userId User ID from JWT token
   * @param id Job posting ID
   * @returns Job posting response DTO
   */
  async getJobPostingById(userId: string, id: string): Promise<JobPostingResponseDto> {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: { id, userId },
    });

    if (!jobPosting) {
      throw new BadRequestException('Job posting not found');
    }

    return this.mapToResponseDto(jobPosting);
  }

  /**
   * Delete job posting
   * @param userId User ID from JWT token
   * @param id Job posting ID
   */
  async deleteJobPosting(userId: string, id: string): Promise<void> {
    const jobPosting = await this.prisma.jobPosting.findFirst({
      where: { id, userId },
    });

    if (!jobPosting) {
      throw new BadRequestException('Job posting not found');
    }

    await this.prisma.jobPosting.delete({
      where: { id },
    });

    this.logger.log(`Deleted job posting: ${id}`);
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
      language: jobPosting.language,
      fullText: jobPosting.fullText,
      rawText: jobPosting.rawText,
      sourceUrl: jobPosting.sourceUrl,
      fileId: jobPosting.fileId,
      createdAt: jobPosting.createdAt,
      updatedAt: jobPosting.updatedAt,
    };
  }
}
