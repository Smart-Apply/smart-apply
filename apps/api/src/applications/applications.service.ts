import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  MessageEvent,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Application } from '../generated/prisma/client';
import { ApplicationTrackingStatus } from '../generated/prisma/client';
import { Observable, timer } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { JobType } from '../jobs/interfaces/queue.interface';
import { LLMService, KeywordMatch } from '../llm/llm.service';
import { TitleGeneratorService } from './title-generator.service';
import { KeywordsService } from '../keywords/keywords.service';
import { TemplatesService } from '../templates/templates.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ATSAgentOutput } from '../agents/agents.interface';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto, ApplicationStatus } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';
import { ApplicationStatusResponseDto } from './dto/application-status-response.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CoverLetterDto } from './dto/cover-letter.dto';
import { ApplicationKeywordsResponseDto } from './dto/application-keywords.dto';
import { TailoredProfileDto, RewrittenProfileDto } from './dto/tailored-profile.dto';
import { AtsKeywordsOutputDto } from '../keywords/dto/ats-keywords.dto';
import { ErrorCode } from '../common/constants/error-codes';
import {
  BadRequestWithCode,
  NotFoundWithCode,
  ConflictWithCode,
} from '../common/exceptions/coded-http.exception';
import {
  buildResumeTemplateData,
  ProfileWithRelations,
  sanitizeUrl,
  formatDateRange,
  normalizeProficiencyLevel,
} from './resume-template.util';
import { sanitizeRichText, stripLLMPlaceholders } from '../common/services/html-sanitizer';

// Type for progress callback function
export type ProgressCallback = (progress: number, message: string) => void;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  // In-memory cache for skill categorization (keyed by sorted skill names)
  private readonly skillCategorizationCache = new Map<
    string,
    { type: string; skills: string[] }[]
  >();

  // In-memory cache for progress callbacks (keyed by application ID)
  private readonly progressCallbacks = new Map<string, ProgressCallback>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService,
    private readonly llmService: LLMService,
    private readonly titleGenerator: TitleGeneratorService,
    private readonly keywordsService: KeywordsService,
    private readonly templatesService: TemplatesService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private async getProfileWithRelations(userId: string): Promise<ProfileWithRelations> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: true,
        skills: true,
        certificates: true,
        experiences: true,
        projects: true,
        education: true,
        languages: true,
      },
    });

    if (!profile) {
      throw new BadRequestWithCode(ErrorCode.PROFILE_INCOMPLETE);
    }

    return profile;
  }

  /**
   * Match job keywords against pre-extracted profile keywords (deterministic matching)
   * @param jobKeywords Keywords extracted from job posting
   * @param profileKeywords Pre-extracted keywords from profile (cached)
   * @returns Merged keywords with 'source' field indicating match status
   */
  private matchJobAndProfileKeywords(
    jobKeywords: any,
    profileKeywords: any,
  ): { matched: any; unmatched: any; matchCount: number } {
    if (!jobKeywords || !profileKeywords) {
      return { matched: jobKeywords || {}, unmatched: {}, matchCount: 0 };
    }

    const matched: any = {
      hard_skills: [],
      tools_and_tech: [],
      domains: [],
      methodologies: [],
    };

    const unmatched: any = {
      hard_skills: [],
      tools_and_tech: [],
      domains: [],
      methodologies: [],
    };

    let matchCount = 0;

    // Helper to normalize keywords for comparison
    const normalizeKeyword = (kw: string) => kw.toLowerCase().trim();

    // Build profile keyword sets for fast lookup
    const profileKeywordSets = {
      hard_skills: new Set(
        (profileKeywords.hard_skills || []).map((k: any) => normalizeKeyword(k.keyword)),
      ),
      tools_and_tech: new Set(
        (profileKeywords.tools_and_tech || []).map((k: any) => normalizeKeyword(k.keyword)),
      ),
      domains: new Set(
        (profileKeywords.domains || []).map((k: any) => normalizeKeyword(k.keyword)),
      ),
      methodologies: new Set(
        (profileKeywords.methodologies || []).map((k: any) => normalizeKeyword(k.keyword)),
      ),
    };

    // Match each category
    for (const category of ['hard_skills', 'tools_and_tech', 'domains', 'methodologies']) {
      const jobCategoryKeywords = jobKeywords[category] || [];
      const profileSet = profileKeywordSets[category as keyof typeof profileKeywordSets];

      for (const jobKw of jobCategoryKeywords) {
        const normalized = normalizeKeyword(jobKw.keyword);
        const isMatch = profileSet.has(normalized);

        if (isMatch) {
          matched[category].push({ ...jobKw, source: 'both' });
          matchCount++;
        } else {
          unmatched[category].push({ ...jobKw, source: 'job' });
        }
      }
    }

    return { matched, unmatched, matchCount };
  }

  /**
   * Intelligently categorize skills using LLM based on candidate profile
   * Uses in-memory cache to avoid re-categorizing the same skill set
   */
  private async categorizeSkillsWithLLM(
    profile: ProfileWithRelations,
  ): Promise<{ type: string; skills: string[] }[]> {
    // Skip if no skills
    if (!profile.skills || profile.skills.length === 0) {
      return [];
    }

    try {
      const skillNames = profile.skills.map((s) => s.name);

      // Create cache key from sorted skill names (order-independent)
      const cacheKey = [...skillNames].sort().join('|');

      // Check cache first
      const cached = this.skillCategorizationCache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Using cached skill categorization for ${skillNames.length} skills`);
        return cached;
      }

      // Build context for LLM
      const candidateName =
        [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ').trim() ||
        'Professional';

      // Infer industry/role from profile
      const latestExperience = profile.experiences
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
        .at(0);

      const candidateContext = latestExperience
        ? `${latestExperience.title} with experience in ${latestExperience.company}`
        : profile.summary
          ? profile.summary.substring(0, 200)
          : candidateName;

      // Attempt to infer industry from experiences or education
      let industry: string | undefined;
      if (latestExperience?.title) {
        const title = latestExperience.title.toLowerCase();
        if (
          title.includes('software') ||
          title.includes('developer') ||
          title.includes('engineer')
        ) {
          industry = 'IT/Software Development';
        } else if (title.includes('marketing') || title.includes('content')) {
          industry = 'Marketing';
        } else if (title.includes('sales') || title.includes('business development')) {
          industry = 'Sales';
        } else if (title.includes('finance') || title.includes('analyst')) {
          industry = 'Finance';
        } else if (
          title.includes('nurse') ||
          title.includes('doctor') ||
          title.includes('healthcare')
        ) {
          industry = 'Healthcare';
        }
      }

      this.logger.log(
        `Categorizing ${skillNames.length} skills for ${candidateContext} (Industry: ${industry || 'auto-detect'})`,
      );

      // Call LLM service
      const categories = await this.llmService.categorizeSkills({
        skills: skillNames,
        candidateContext,
        industry,
      });

      this.logger.log(`LLM categorized skills into ${categories.length} categories`);

      // Cache the result
      this.skillCategorizationCache.set(cacheKey, categories);

      // Prevent cache from growing too large (limit to 100 entries)
      if (this.skillCategorizationCache.size > 100) {
        const firstKey = this.skillCategorizationCache.keys().next().value;
        this.skillCategorizationCache.delete(firstKey);
      }

      return categories;
    } catch (error) {
      this.logger.error('Failed to categorize skills with LLM, using fallback', error);
      // Fallback: return empty to use default categorization
      return [];
    }
  }

  private sanitizeCoverLetter(content: string): string {
    // First strip any LLM placeholder patterns (e.g., "[Your Name]")
    const stripped = stripLLMPlaceholders(content);
    // Then sanitize HTML
    return sanitizeRichText(stripped);
  }

  /**
   * Convert Markdown cover letter to HTML
   * The LLM generates Markdown but the PDF template expects HTML with <p> tags
   */
  private convertCoverLetterToHtml(content: string | null): string | null {
    if (!content || content.trim() === '') {
      return content;
    }

    // If content already has <p> tags, it's already HTML (was edited and saved)
    if (/<p[^>]*>/i.test(content)) {
      return content;
    }

    // Simple Markdown to HTML conversion for paragraphs
    // Split by double newlines (paragraph breaks) and wrap each in <p> tags
    const paragraphs = content
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return '<p></p>';
    }

    // Convert each paragraph, preserving single newlines as <br> within paragraphs
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
  }

  private parseResume(resumeText?: string | null) {
    if (!resumeText) {
      return null;
    }

    try {
      return JSON.parse(resumeText);
    } catch (error) {
      this.logger.error('Failed to parse stored resume JSON', error as Error);
      throw new BadRequestWithCode(ErrorCode.APPLICATION_RESUME_CORRUPTED);
    }
  }

  private async ensureApplicationOwnership(
    userId: string,
    applicationId: string,
    includeJobPosting = false,
  ) {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
      include: {
        jobPosting: includeJobPosting,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    return application;
  }

  private async cleanupGeneratedFiles(application: Application): Promise<void> {
    const deletions: Promise<void>[] = [];

    if (application.coverLetterFileKey) {
      deletions.push(
        this.storageService.delete(application.coverLetterFileKey).catch((error) => {
          this.logger.warn(
            `Failed to delete cover letter file ${application.coverLetterFileKey}: ${error.message}`,
          );
        }),
      );
    }

    if (application.resumeFileKey) {
      deletions.push(
        this.storageService.delete(application.resumeFileKey).catch((error) => {
          this.logger.warn(
            `Failed to delete resume file ${application.resumeFileKey}: ${error.message}`,
          );
        }),
      );
    }

    await Promise.all(deletions);
  }

  private normalizeResumeData(resume: UpdateResumeDto['resume']) {
    const trim = (value?: string | null) => value?.trim() || undefined;

    return {
      candidateName: resume.candidateName.trim(),
      email: resume.email.trim(),
      phone: trim(resume.phone),
      location: trim(resume.location),
      linkedin: sanitizeUrl(resume.linkedin),
      github: sanitizeUrl(resume.github),
      summary: trim(resume.summary),
      skillCategories: (resume.skillCategories || [])
        .map((category) => ({
          type: category.type.trim(),
          skills: (category.skills || []).map((skill) => skill.trim()).filter(Boolean),
        }))
        .filter((category) => category.skills.length),
      experiences: (resume.experiences || []).map(
        ({ id: _id, startDate: _startDate, endDate: _endDate, ...experience }) => ({
          title: experience.title.trim(),
          company: experience.company.trim(),
          location: trim(experience.location),
          dateRange: experience.dateRange.trim(),
          description: trim(experience.description),
          achievements: (experience.achievements || []).map((item) => item.trim()).filter(Boolean),
        }),
      ),
      projects: (resume.projects || []).map(({ id: _id, ...project }) => ({
        name: project.name.trim(),
        description: trim(project.description),
        date: trim(project.date),
        highlights: (project.highlights || []).map((item) => item.trim()).filter(Boolean),
      })),
      education: (resume.education || []).map(({ id: _id, ...edu }) => ({
        degree: edu.degree.trim(),
        institution: edu.institution.trim(),
        year: edu.year.trim(),
        fieldOfStudy: trim(edu.fieldOfStudy),
        gpa: trim(edu.gpa),
        description: trim(edu.description),
      })),
      certifications: (resume.certifications || []).map(({ id: _id, ...cert }) => ({
        name: cert.name.trim(),
        issuer: cert.issuer.trim(),
        date: trim(cert.date),
      })),
      languages: (resume.languages || [])
        .map((lang) => ({
          name: lang.name.trim(),
          level: normalizeProficiencyLevel(lang.level?.trim()),
        }))
        .filter((lang) => lang.name),
    };
  }

  private buildCoverLetterContext(
    resume: any,
    jobPosting: { title: string; company: string },
    instructions?: string,
  ) {
    const skills = (resume.skillCategories || [])
      .flatMap((category: { skills: string[] }) => category.skills)
      .filter(Boolean)
      .join(', ');

    const experiences = (resume.experiences || [])
      .map(
        (experience: { title: string; company: string; dateRange: string }) =>
          `${experience.title} bei ${experience.company} (${experience.dateRange})`,
      )
      .join('\n');

    const motivationParts = [resume.summary, instructions].filter(Boolean);

    return {
      candidateName: resume.candidateName,
      jobTitle: jobPosting.title,
      companyName: jobPosting.company,
      skills,
      experiences,
      motivation: motivationParts.join('\n\n'),
    };
  }

  /**
   * Build context for ATS-optimized cover letter generation
   * Formats profile and keywords for strategic keyword placement
   */
  private buildATSCoverLetterContext(
    resume: any,
    jobPosting: {
      title: string;
      company: string;
      location?: string | null;
      description?: string | null;
      fullText?: string;
      language?: string | null;
    },
    matchedKeywords: KeywordMatch[],
    missingKeywords: KeywordMatch[],
  ) {
    // Detect language from job posting (fallback to German as default)
    const detectedLanguage =
      jobPosting.language ||
      (jobPosting.fullText ? this.detectLanguage(jobPosting.fullText) : null) ||
      'de';
    // Format profile information
    const skills = (resume.skillCategories || [])
      .flatMap((category: { skills: string[] }) => category.skills)
      .filter(Boolean)
      .join(', ');

    const experiences = (resume.experiences || [])
      .map(
        (experience: {
          title: string;
          company: string;
          dateRange: string;
          achievements?: string[];
        }) =>
          `${experience.title} at ${experience.company} (${experience.dateRange})${
            experience.achievements?.length
              ? ': ' + experience.achievements.slice(0, 2).join('; ')
              : ''
          }`,
      )
      .join('\n');

    const profileString = `
Name: ${resume.candidateName}
Skills: ${skills}
Experience: ${experiences}
Summary: ${resume.summary || 'Not provided'}
    `.trim();

    return {
      profile: profileString,
      jobTitle: jobPosting.title,
      companyName: jobPosting.company,
      location: jobPosting.location || undefined,
      jobDescription: jobPosting.description || undefined,
      matchedKeywords,
      missingKeywords,
      language: detectedLanguage,
    };
  }

  /**
   * Build context for ATS-optimized resume generation
   * Formats profile and keywords for strategic keyword placement
   */
  private buildATSResumeContext(
    resume: any,
    jobPosting: {
      title: string;
      company: string;
      description?: string | null;
      fullText?: string;
      language?: string | null;
    },
    matchedKeywords: KeywordMatch[],
    missingKeywords: KeywordMatch[],
  ) {
    // Detect language from job posting (fallback to German as default)
    const detectedLanguage =
      jobPosting.language ||
      (jobPosting.fullText ? this.detectLanguage(jobPosting.fullText) : null) ||
      'de';

    const profileString = JSON.stringify(resume, null, 2);

    return {
      profile: profileString,
      jobTitle: jobPosting.title,
      companyName: jobPosting.company,
      jobDescription: jobPosting.description || undefined,
      matchedKeywords,
      missingKeywords,
      language: detectedLanguage,
    };
  }

  /**
   * Extract keywords for a job posting and match against profile
   * Used for ATS-optimized content generation
   */
  private async getKeywordsForGeneration(
    jobPosting: {
      title: string;
      company: string;
      location?: string | null;
      language?: string | null;
      fullText: string;
      rawText?: string | null;
    },
    profileKeywords: Set<string>,
  ): Promise<{ matchedKeywords: KeywordMatch[]; missingKeywords: KeywordMatch[] }> {
    try {
      // Extract keywords using ATS Agent (simplified - only fullText needed)
      const keywords = await this.keywordsService.extractKeywords({
        title: jobPosting.title,
        company: jobPosting.company,
        location: jobPosting.location || undefined,
        language: jobPosting.language || undefined,
        fullText: jobPosting.fullText,
        rawText: jobPosting.rawText || undefined,
      });

      // Perform matching
      return this.matchKeywordsForLLM(keywords, profileKeywords);
    } catch (error) {
      this.logger.warn(
        'Failed to extract keywords for ATS generation, using fallback',
        error as Error,
      );
      return { matchedKeywords: [], missingKeywords: [] };
    }
  }

  /**
   * Match extracted keywords against profile for LLM context
   */
  private matchKeywordsForLLM(
    keywords: ATSAgentOutput,
    profileKeywords: Set<string>,
  ): { matchedKeywords: KeywordMatch[]; missingKeywords: KeywordMatch[] } {
    const matched: KeywordMatch[] = [];
    const missing: KeywordMatch[] = [];

    const checkKeyword = (keyword: string, category: KeywordMatch['category']) => {
      const normalized = keyword.toLowerCase();
      const found =
        profileKeywords.has(normalized) ||
        [...profileKeywords].some((pk) => pk.includes(normalized) || normalized.includes(pk));

      const match: KeywordMatch = {
        keyword,
        category,
        found,
        confidence: found ? 0.85 : 0,
      };

      if (found) {
        matched.push(match);
      } else {
        missing.push(match);
      }
    };

    // Check all keyword categories from ATSAgentOutput (using domain-neutral names)
    keywords.coreCompetencies.forEach((k) => checkKeyword(k, 'core'));
    keywords.softSkills.forEach((k) => checkKeyword(k, 'soft'));
    keywords.methodologies.forEach((k) => checkKeyword(k, 'methodology'));
    keywords.industryKeywords.forEach((k) => checkKeyword(k, 'industry'));
    keywords.senioritySignals.forEach((k) => checkKeyword(k, 'seniority'));
    keywords.requirementKeywords.forEach((k) => checkKeyword(k, 'requirement'));

    return { matchedKeywords: matched, missingKeywords: missing };
  }

  private ensureNotGenerating(application: Application) {
    if (application.status === ApplicationStatus.GENERATING) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_GENERATING);
    }
  }

  /**
   * Detect language from job posting text using simple heuristics
   * Returns 'de' for German, 'en' for English, or null if undetermined
   */
  private detectLanguage(text: string): 'de' | 'en' | null {
    const lowercase = text.toLowerCase();

    // Common German words (excluding ones that overlap with English)
    const germanWords = [
      'und',
      'für',
      'mit',
      'von',
      'bei',
      'wir',
      'sie',
      'ihre',
      'unser',
      'durch',
      'über',
      'zum',
    ];
    const englishWords = [
      'and',
      'for',
      'with',
      'from',
      'at',
      'we',
      'you',
      'your',
      'our',
      'through',
      'about',
      'the',
    ];

    let germanScore = 0;
    let englishScore = 0;

    for (const word of germanWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowercase.match(regex);
      if (matches) germanScore += matches.length;
    }
    for (const word of englishWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowercase.match(regex);
      if (matches) englishScore += matches.length;
    }

    this.logger.debug(`Language detection: German=${germanScore}, English=${englishScore}`);

    if (germanScore > englishScore && germanScore > 2) return 'de';
    if (englishScore > germanScore && englishScore > 2) return 'en';
    return null;
  }

  /**
   * Resolve template ID to language-specific variant based on detected language
   * If templateId is provided, find the matching language variant from the same design family
   */
  private async resolveTemplateForLanguage(
    templateId: string | null | undefined,
    language: string,
    type: 'COVER_LETTER' | 'RESUME',
  ): Promise<string | null> {
    if (!templateId) {
      return null;
    }

    try {
      // Get the selected template to find its category
      const selectedTemplate = await this.prisma.template.findUnique({
        where: { id: templateId },
        select: { category: true, language: true },
      });

      if (!selectedTemplate) {
        this.logger.warn(`Template ${templateId} not found, using default`);
        return null;
      }

      // If template already matches the language, use it
      if (selectedTemplate.language === language) {
        this.logger.debug(`Template ${templateId} already matches language ${language}`);
        return templateId;
      }

      // Find the same design in the target language
      const languageVariant = await this.templatesService.findByCategoryAndLanguage(
        selectedTemplate.category,
        language,
        type === 'COVER_LETTER' ? 'COVER_LETTER' : 'RESUME',
      );

      if (languageVariant) {
        this.logger.log(
          `Resolved template ${templateId} (${selectedTemplate.category}) to language variant ${languageVariant.id} (${language})`,
        );
        return languageVariant.id;
      }

      // Fallback: keep original template if no language variant found
      this.logger.warn(
        `No ${language} variant found for template ${templateId} (${selectedTemplate.category}), using original`,
      );
      return templateId;
    } catch (error) {
      this.logger.error(`Failed to resolve template for language ${language}:`, error);
      return templateId; // Fallback to original
    }
  }

  /**
   * Create a new application and trigger background processing
   */
  async create(userId: string, dto: CreateApplicationDto): Promise<ApplicationResponseDto> {
    this.logger.log(`Creating application for user ${userId}`);

    // 1. Verify job posting exists
    const jobPosting = await this.prisma.jobPosting.findUnique({
      where: { id: dto.jobPostingId },
    });

    if (!jobPosting) {
      throw new NotFoundException(`Job posting with ID ${dto.jobPostingId} not found`);
    }

    // 2. Check for existing application (prevent duplicates)
    // Note: Only check non-deleted applications (deletedAt: null)
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        userId,
        jobPostingId: dto.jobPostingId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (existingApplication) {
      throw new ConflictWithCode(ErrorCode.APPLICATION_DUPLICATE);
    }

    // 3. Prefill resume data from profile
    const profile = await this.getProfileWithRelations(userId);

    // 3.1. Intelligently categorize skills using LLM
    const skillCategories = await this.categorizeSkillsWithLLM(profile);
    const resumeTemplate = buildResumeTemplateData(profile, skillCategories);

    // 3.2. Detect language from job posting for multilingual templates
    const detectedLanguage =
      jobPosting.language || this.detectLanguage(jobPosting.fullText) || 'en';
    resumeTemplate.language = detectedLanguage;

    // 3.3. Translate summary if job language differs from profile language (assume profile is in German)
    const profileLanguage = 'de'; // Assume profile is written in German
    if (resumeTemplate.summary && detectedLanguage !== profileLanguage) {
      this.logger.log(`Translating summary to ${detectedLanguage}`);
      try {
        resumeTemplate.summary = await this.llmService.translateSummary(
          resumeTemplate.summary,
          detectedLanguage,
        );
      } catch (error) {
        this.logger.warn('Failed to translate summary, using original', error as Error);
      }
    }

    // 4. Generate title for application
    const title = await this.titleGenerator.generateTitle(jobPosting);

    // 5. Create application record (no automatic generation yet)
    try {
      const application = await this.prisma.application.create({
        data: {
          userId,
          jobPostingId: dto.jobPostingId,
          title,
          applicationStatus: ApplicationTrackingStatus.CREATED,
          status: ApplicationStatus.PENDING,
          notes: dto.notes,
          resumeText: JSON.stringify(resumeTemplate),
        },
        include: {
          jobPosting: true,
        },
      });

      return this.mapToResponseDto(application);
    } catch (error) {
      // Handle Prisma unique constraint violation (defense in depth)
      if (error.code === 'P2002') {
        throw new ConflictWithCode(ErrorCode.APPLICATION_DUPLICATE);
      }
      throw error;
    }
  }

  /**
   * Create application with immediate LLM generation (resume + cover letter)
   */
  async createWithGeneration(
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Creating application with single-LLM pipeline for user ${userId}`);

    const shouldGenerateCoverLetter = dto.generateCoverLetter !== false;

    // 1. Verify job posting exists
    const jobPosting = await this.prisma.jobPosting.findUnique({
      where: { id: dto.jobPostingId },
    });

    if (!jobPosting) {
      throw new NotFoundException(`Job posting with ID ${dto.jobPostingId} not found`);
    }

    // 2. Get profile data
    const profile = await this.getProfileWithRelations(userId);

    // 3. Detect language (prioritize user selection, then job posting, then auto-detect, default to German)
    const detectedLanguage =
      dto.language || jobPosting.language || this.detectLanguage(jobPosting.fullText) || 'de';
    this.logger.log(
      `Using language: ${detectedLanguage} (source: ${dto.language ? 'user selection' : jobPosting.language ? 'job posting' : 'auto-detected/default'})`,
    );

    // 4. Check if application already exists (prevent duplicates BEFORE generation)
    // Note: Only check non-deleted applications (deletedAt: null)
    const existingApplication = await this.prisma.application.findFirst({
      where: {
        userId,
        jobPostingId: dto.jobPostingId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (existingApplication) {
      // Provide application ID in error metadata for frontend to navigate to it
      const error: any = new ConflictException(
        'Du hast bereits eine Bewerbung für diese Stelle erstellt.',
      );
      error.applicationId = existingApplication.id;
      throw error;
    }

    // 5. Generate title
    const title = await this.titleGenerator.generateTitle(jobPosting);

    // 6. Resolve templates to match detected language
    const resolvedResumeTemplateId = await this.resolveTemplateForLanguage(
      dto.resumeTemplateId,
      detectedLanguage,
      'RESUME',
    );
    const resolvedCoverLetterTemplateId = shouldGenerateCoverLetter
      ? await this.resolveTemplateForLanguage(
          dto.coverLetterTemplateId,
          detectedLanguage,
          'COVER_LETTER',
        )
      : null;

    // 7. Create application (initially empty, will be populated by pipeline)
    let application: any;
    try {
      application = await this.prisma.application.create({
        data: {
          userId,
          jobPostingId: dto.jobPostingId,
          title,
          applicationStatus: ApplicationTrackingStatus.CREATED,
          status: ApplicationStatus.PENDING,
          notes: dto.notes,
          coverLetterTemplateId: resolvedCoverLetterTemplateId,
          resumeTemplateId: resolvedResumeTemplateId,
          language: detectedLanguage,
        },
        include: {
          jobPosting: true,
        },
      });
    } catch (error) {
      // Handle Prisma unique constraint violation (defense in depth)
      if (error.code === 'P2002') {
        throw new ConflictWithCode(ErrorCode.APPLICATION_DUPLICATE);
      }
      throw error;
    }

    this.logger.log(`Application ${application.id} created, starting generation pipeline`);

    // 8. Run single-LLM pipeline to generate everything
    try {
      const startTime = Date.now();

      // Step 1: Select relevant profile data
      this.logger.log('Step 1: Selecting relevant profile data...');
      const tailoredProfile = await this.llmService.callJson<TailoredProfileDto>(
        'v1/skill-selector.md',
        {
          profile: this.serializeProfile(profile),
          job: this.serializeJobPosting(jobPosting),
          language: detectedLanguage,
          userId,
          jobPostingId: jobPosting.id,
        },
        {
          temperature: 0.2, // Low temperature for deterministic skill matching
          maxTokens: 3000,
        },
      );
      this.logger.log(
        `Profile tailored: ${tailoredProfile.selected_hard_skills.length} hard skills, ${tailoredProfile.selected_experiences.length} experiences`,
      );

      // Step 2: Parallel generation - Cover letter + Resume rewrite + ATS keywords
      this.logger.log(
        'Step 2: Parallel generation (cover letter, resume rewrite, ATS keywords)...',
      );

      // Prepare parallel promises
      const coverLetterPromise = shouldGenerateCoverLetter
        ? this.llmService.callText('v1/cover-letter.md', {
            job: this.serializeJobPosting(jobPosting),
            tailoredProfile,
            language: detectedLanguage,
            userId,
            jobPostingId: jobPosting.id,
          })
        : Promise.resolve(null);

      const resumeRewritePromise = this.callResumeRewrite(
        tailoredProfile,
        jobPosting,
        detectedLanguage,
        userId,
      );

      const atsKeywordsPromise = this.llmService
        .callJson('v1/ats-keywords.md', {
          job: this.serializeJobPosting(jobPosting),
          userId,
          jobPostingId: jobPosting.id,
        })
        .then((extractedKeywords) => {
          this.logger.log('Step 2b: Matching keywords against profile (deterministic)...');
          return this.matchKeywordsAgainstProfile(extractedKeywords, profile);
        })
        .catch((error) => {
          this.logger.warn('Failed to extract ATS keywords, continuing without them', error);
          return null;
        });

      // Execute all in parallel
      const [coverLetterMarkdown, rewrittenProfile, atsKeywords] = await Promise.all([
        coverLetterPromise,
        resumeRewritePromise,
        atsKeywordsPromise,
      ]);

      // Log results
      if (rewrittenProfile) {
        this.logger.log(
          `Resume rewrite completed: ${rewrittenProfile.rewritten_experiences?.length || 0} experiences, ${rewrittenProfile.rewritten_projects?.length || 0} projects`,
        );
      }
      if (atsKeywords) {
        const totalKeywords =
          (atsKeywords.hard_skills?.length || 0) + (atsKeywords.soft_skills?.length || 0);
        const matchedCount = this.countMatchedKeywords(atsKeywords);
        this.logger.log(
          `Extracted ${totalKeywords} ATS keywords (${matchedCount} matched in profile)`,
        );
      }

      // Step 3: Convert tailoredProfile to JSON format for frontend editor
      this.logger.log('Step 3: Converting resume to JSON format for editor...');
      const resumeJson = this.convertTailoredProfileToResumeJson(
        profile,
        tailoredProfile,
        rewrittenProfile,
      );

      // Debug: Log the first experience achievements to verify German content is saved
      const firstExp = resumeJson.experiences?.[0];
      if (firstExp) {
        this.logger.debug(
          `Saving resumeJson - First experience "${firstExp.title}": achievements=[${firstExp.achievements
            ?.slice(0, 2)
            .map((a: string) => a.substring(0, 40) + '...')
            .join(' | ')}]`,
        );
      }

      // Step 4: Update application with generated content
      // Note: resumeText stores JSON for editor, Markdown can be regenerated from tailoredProfile
      // Convert cover letter Markdown to HTML for proper PDF rendering
      const coverLetterHtml = this.convertCoverLetterToHtml(coverLetterMarkdown);

      const updatedApplication = await this.prisma.application.update({
        where: { id: application.id },
        data: {
          resumeText: JSON.stringify(resumeJson), // Store JSON for editor
          coverLetterText: coverLetterHtml,
          atsKeywords: atsKeywords as any,
          tailoredProfile: tailoredProfile as any,
          status: ApplicationStatus.READY,
        },
        include: { jobPosting: true },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Application ${application.id} generated successfully in ${duration}ms (coverLetter: ${shouldGenerateCoverLetter})`,
      );

      // Record usage AFTER success so failed generations don't burn the cap.
      // Best-effort: a failure here must not break the user-facing response.
      try {
        await this.subscriptionService.recordUsage(userId, 'application');
      } catch (usageError) {
        this.logger.warn(
          `Failed to record usage for user ${userId} (application ${application.id})`,
          usageError,
        );
      }

      return this.mapToResponseDto(updatedApplication);
    } catch (error) {
      this.logger.error(`Failed to generate application ${application.id}`, error);

      // Update status to FAILED
      await this.prisma.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.FAILED,
          errorMessage: error.message || 'Generation failed',
        },
      });

      throw error;
    }
  }

  /**
   * NEW: Single-LLM pipeline for application generation
   * Replaces agent-based architecture with deterministic single-pass generation
   *
   * Pipeline: Profile Selection → Resume → Cover Letter → ATS Keywords
   */
  async generateWithSinglePipeline(
    applicationId: string,
    userId: string,
  ): Promise<ApplicationResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Starting single-LLM pipeline for application ${applicationId}`);

    // Get progress callback if one is registered
    const emitProgress = (progress: number, message: string) => {
      const callback = this.progressCallbacks.get(applicationId);
      if (callback) {
        callback(progress, message);
      }
    };

    // 0. Initial progress
    emitProgress(0, 'Starte Generierung...');

    // 1. Load data
    emitProgress(10, 'Lade Profil und Stellenanzeige...');
    const profile = await this.getProfileWithRelations(userId);
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { jobPosting: true },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    const jobPosting = application.jobPosting;
    const shouldGenerateCoverLetter = application.coverLetterText !== null; // Infer from initial state

    // 2. Detect language
    const language = jobPosting.language || this.detectLanguage(jobPosting.fullText) || 'en';
    this.logger.log(`Detected language: ${language}`);

    try {
      // 3. Call skill selector (ONCE per application)
      emitProgress(20, 'Wähle relevante Profildaten aus...');
      this.logger.log('Step 1: Selecting relevant profile data...');
      const tailoredProfile = await this.llmService.callJson<TailoredProfileDto>(
        'v1/skill-selector.md',
        {
          profile: this.serializeProfile(profile),
          job: this.serializeJobPosting(jobPosting),
          language,
          userId,
          jobPostingId: jobPosting.id,
        },
      );
      this.logger.log(
        `Profile tailored: ${tailoredProfile.selected_hard_skills.length} hard skills, ${tailoredProfile.selected_experiences.length} experiences`,
      );

      // 4. Generate resume (uses tailored profile)
      emitProgress(40, 'Generiere Lebenslauf mit KI...');
      this.logger.log('Step 2: Generating resume...');
      const resumeMarkdown = await this.llmService.callText('v1/resume.md', {
        job: this.serializeJobPosting(jobPosting),
        tailoredProfile,
        language,
        userId,
        jobPostingId: jobPosting.id,
      });

      // 5. Generate cover letter (if enabled)
      let coverLetterMarkdown: string | null = null;
      if (shouldGenerateCoverLetter) {
        emitProgress(60, 'Generiere Anschreiben mit KI...');
        this.logger.log('Step 3: Generating cover letter...');
        coverLetterMarkdown = await this.llmService.callText('v1/cover-letter.md', {
          job: this.serializeJobPosting(jobPosting),
          tailoredProfile,
          language,
          userId,
          jobPostingId: jobPosting.id,
        });
      } else {
        emitProgress(60, 'Überspringe Anschreiben-Generierung...');
        this.logger.log('Skipping cover letter generation');
      }

      // 6. Extract ATS keywords with optimized two-phase matching
      emitProgress(80, 'Extrahiere ATS-Keywords...');
      this.logger.log('Step 4: Extracting and matching ATS keywords...');
      let atsKeywords: AtsKeywordsOutputDto | null = null;
      try {
        // Phase 1: Extract job keywords using LLM
        const jobKeywords = await this.llmService.callJson<AtsKeywordsOutputDto>(
          'v1/ats-keywords.md',
          {
            job: this.serializeJobPosting(jobPosting),
            tailoredProfile,
            userId,
            jobPostingId: jobPosting.id,
          },
        );

        const jobKeywordCount =
          (jobKeywords.hard_skills?.length || 0) +
          (jobKeywords.tools_and_tech?.length || 0) +
          (jobKeywords.domains?.length || 0) +
          (jobKeywords.methodologies?.length || 0);
        this.logger.log(`Extracted ${jobKeywordCount} job keywords`);

        // Phase 2: Load cached profile keywords (pre-extracted on profile update)
        const cachedProfileKeywords = profile.profileKeywords as any;

        if (cachedProfileKeywords) {
          // Deterministic keyword matching (no LLM needed)
          const { matched, unmatched, matchCount } = this.matchJobAndProfileKeywords(
            jobKeywords,
            cachedProfileKeywords,
          );

          // Merge matched and unmatched keywords for final result
          atsKeywords = {
            hard_skills: [...matched.hard_skills, ...unmatched.hard_skills],
            tools_and_tech: [...matched.tools_and_tech, ...unmatched.tools_and_tech],
            domains: [...matched.domains, ...unmatched.domains],
            methodologies: [...matched.methodologies, ...unmatched.methodologies],
          };

          this.logger.log(
            `Matched ${matchCount}/${jobKeywordCount} keywords from cached profile keywords`,
          );
        } else {
          // Fallback: No cached profile keywords, use job keywords as-is
          this.logger.warn('No cached profile keywords found, skipping matching');
          atsKeywords = jobKeywords;
        }
      } catch (error) {
        this.logger.warn('Failed to extract ATS keywords, continuing without them', error);
      }

      // 7. Persist results
      // Convert cover letter Markdown to HTML for proper PDF rendering
      const coverLetterHtml = this.convertCoverLetterToHtml(coverLetterMarkdown);

      emitProgress(95, 'Speichere Ergebnisse...');
      const updated = await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          resumeText: resumeMarkdown,
          coverLetterText: coverLetterHtml,
          atsKeywords: atsKeywords as any,
          tailoredProfile: tailoredProfile as any,
          status: ApplicationStatus.READY,
        },
        include: { jobPosting: true },
      });

      emitProgress(100, 'Fertig!');

      const duration = Date.now() - startTime;
      this.logger.log(
        `Single-LLM pipeline completed in ${duration}ms for application ${applicationId}`,
      );

      return this.mapToResponseDto(updated);
    } catch (error) {
      this.logger.error(`Single-LLM pipeline failed for application ${applicationId}`, error);

      // Update status to FAILED with error message
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.FAILED,
          errorMessage: error.message || 'Pipeline failed',
        },
      });

      throw error;
    } finally {
      // Clean up progress callback
      this.progressCallbacks.delete(applicationId);
    }
  }

  /**
   * Convert new atsKeywords format (from single-LLM pipeline) to old ATSAgentOutput format
   * New format (SIMPLIFIED): { hard_skills: [{keyword, source, priority}] }
   * Old format: { coreCompetencies: [], softSkills: [], methodologies: [], ... }
   * IMPORTANT: Preserve metadata (keyword, source, priority) for proper matching
   * Note: Only hard_skills are extracted now, soft_skills removed
   */
  private convertAtsKeywordsToOldFormat(atsKeywords: any): ATSAgentOutput {
    this.logger.debug(
      `Converting ATS keywords to old format. Input keys: ${Object.keys(atsKeywords).join(', ')}`,
    );

    // Preserve full keyword objects with metadata (source, priority)
    const hardSkills = (atsKeywords.hard_skills || []).map((kw: any) => {
      if (typeof kw === 'string') {
        return { keyword: kw, source: 'job', priority: 2 };
      }
      return kw; // Already has { keyword, source, priority }
    });

    this.logger.debug(`Converted: ${hardSkills.length} hard skills`);
    this.logger.debug(
      `Hard skills: ${hardSkills
        .slice(0, 5)
        .map((k) => k.keyword)
        .join(', ')}${hardSkills.length > 5 ? '...' : ''}`,
    );

    return {
      coreCompetencies: hardSkills, // All hard skills go here with metadata
      softSkills: [], // No longer extracting soft skills
      responsibilityKeywords: [], // Empty to avoid duplicates
      requirementKeywords: [], // Empty to avoid duplicates
      methodologies: [], // Empty to avoid duplicates
      industryKeywords: [], // Empty to avoid duplicates
      senioritySignals: [], // Empty to avoid duplicates
      miscKeywords: [], // Empty to avoid duplicates
    };
  }

  /**
   * Deterministically match extracted keywords against profile data
   * Returns keywords with "source" field: "job" (missing) or "both" (matched)
   * Also deduplicates keywords (case-insensitive)
   * SIMPLIFIED: Only hard_skills now (soft skills removed)
   */
  private matchKeywordsAgainstProfile(extractedKeywords: any, profile: ProfileWithRelations): any {
    const matchKeyword = (kw: any): any => {
      const keyword = kw.keyword.toLowerCase();

      // Check if keyword exists in profile skills (exact or partial match)
      const inSkills = profile.skills.some((s) => {
        const skillName = s.name.toLowerCase();
        // Exact match or keyword is part of skill name
        return skillName === keyword || skillName.includes(keyword) || keyword.includes(skillName);
      });

      // Check if keyword exists in experience descriptions or titles
      const inExperiences = profile.experiences.some(
        (e) =>
          e.description?.toLowerCase().includes(keyword) || e.title.toLowerCase().includes(keyword),
      );

      // Check if keyword exists in project descriptions, technologies, or names
      const inProjects = profile.projects.some(
        (p) =>
          p.description?.toLowerCase().includes(keyword) ||
          p.technologies?.some((t) => t.toLowerCase().includes(keyword)) ||
          p.name.toLowerCase().includes(keyword),
      );

      // Check if keyword exists in certificates
      const inCertificates = profile.certificates.some(
        (c) => c.name.toLowerCase().includes(keyword) || c.issuer?.toLowerCase().includes(keyword),
      );

      const isMatched = inSkills || inExperiences || inProjects || inCertificates;

      return {
        ...kw,
        source: isMatched ? 'both' : 'job',
      };
    };

    // Deduplicate function (case-insensitive, preserves original casing, prefers "both" over "job")
    const deduplicateKeywords = (keywords: any[]): any[] => {
      const seen = new Map<string, any>();
      keywords.forEach((kw) => {
        const lowerKey = kw.keyword.toLowerCase();
        if (!seen.has(lowerKey)) {
          seen.set(lowerKey, kw);
        } else {
          // If duplicate found, prefer "both" over "job" for source
          const existing = seen.get(lowerKey)!;
          if (kw.source === 'both' && existing.source === 'job') {
            seen.set(lowerKey, kw);
          }
        }
      });
      return Array.from(seen.values());
    };

    // Match keywords against profile (only hard_skills now)
    const hard_skills = (extractedKeywords.hard_skills || []).map(matchKeyword);

    this.logger.debug(`Before deduplication: ${hard_skills.length} hard_skills`);
    this.logger.debug(`Hard skills: ${JSON.stringify(hard_skills.map((k) => k.keyword))}`);

    // Deduplicate (LLM might return duplicates)
    const deduplicatedHard = deduplicateKeywords(hard_skills);

    this.logger.debug(`After deduplication: ${deduplicatedHard.length} hard_skills`);

    return {
      hard_skills: deduplicatedHard,
      soft_skills: [], // No longer extracting soft skills
    };
  }

  /**
   * Count how many keywords are matched in profile
   * SIMPLIFIED: Only hard_skills now (soft skills removed)
   */
  private countMatchedKeywords(keywords: any): number {
    const allKeywords = keywords.hard_skills || [];
    return allKeywords.filter((kw) => kw.source === 'both').length;
  }

  /**
   * Serialize profile data for LLM consumption
   */
  private serializeProfile(profile: ProfileWithRelations): Record<string, any> {
    // Build full address from components
    const addressParts: string[] = [];
    if (profile.street) addressParts.push(profile.street);
    if (profile.postalCode || profile.city) {
      addressParts.push(`${profile.postalCode || ''} ${profile.city || ''}`.trim());
    }
    if (profile.country) addressParts.push(profile.country);
    const fullAddress = addressParts.join(', ');

    return {
      fullName:
        `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || 'Unknown',
      email: profile.user.email,
      phone: profile.phone || '',
      street: profile.street || '',
      postalCode: profile.postalCode || '',
      city: profile.city || '',
      country: profile.country || '',
      fullAddress: fullAddress || '',
      linkedinUrl: profile.linkedinUrl || '',
      githubUrl: profile.githubUrl || '',
      portfolioUrl: profile.portfolioUrl || '',
      summary: profile.summary || '',
      skills: profile.skills.map((s) => ({ id: s.id, name: s.name, level: s.level })),
      experiences: profile.experiences.map((e) => ({
        id: e.id,
        title: e.title,
        company: e.company,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        description: e.description || '',
        achievements: e.achievements || [],
      })),
      projects: profile.projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        technologies: p.technologies || [],
        highlights: p.highlights || [],
      })),
      education: profile.education.map((ed) => ({
        id: ed.id,
        degree: ed.degree,
        institution: ed.institution,
        startYear: ed.startYear?.toISOString(),
        endYear: ed.endYear?.toISOString(),
      })),
      certificates: profile.certificates.map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer || '',
        issueDate: c.issueDate?.toISOString(),
      })),
      languages: profile.languages.map((l) => ({
        id: l.id,
        name: l.name,
        level: l.level,
      })),
    };
  }

  /**
   * Call resume-rewrite LLM with graceful degradation
   * If the LLM call fails, returns null and the pipeline continues with original profile data
   */
  private async callResumeRewrite(
    tailoredProfile: TailoredProfileDto,
    jobPosting: any,
    language: string,
    userId: string,
  ): Promise<RewrittenProfileDto | null> {
    try {
      const rewrittenProfile = await this.llmService.callJson<RewrittenProfileDto>(
        'v1/resume-rewrite.md',
        {
          tailoredProfile,
          job: this.serializeJobPosting(jobPosting),
          language,
          userId,
          jobPostingId: jobPosting.id,
        },
        {
          temperature: 0.35, // Balanced: consistent but creative
          maxTokens: 2000,
        },
      );

      // Validate response structure
      if (!rewrittenProfile || typeof rewrittenProfile !== 'object') {
        this.logger.warn('Resume rewrite returned invalid structure, using original profile data');
        return null;
      }

      return rewrittenProfile;
    } catch (error) {
      // Graceful degradation: log warning and continue with original data
      this.logger.warn(
        `Resume rewrite LLM call failed, continuing with original profile data: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Serialize job posting for LLM consumption
   */
  private serializeJobPosting(job: any): Record<string, any> {
    return {
      title: job.title,
      company: job.company || '',
      location: job.location || '',
      fullText: job.fullText || '',
      language: job.language || 'en',
    };
  }

  /**
   * Convert tailoredProfile to JSON ResumeData format for frontend editor
   * Maps the selected/filtered profile data from LLM back to the expected JSON structure
   * @param profile - Full profile with relations
   * @param tailoredProfile - LLM-selected relevant profile data
   * @param rewrittenProfile - Optional LLM-rewritten professional content
   */
  private convertTailoredProfileToResumeJson(
    profile: ProfileWithRelations,
    tailoredProfile: any,
    rewrittenProfile?: RewrittenProfileDto | null,
  ): any {
    const candidateName =
      `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || profile.user.email;

    // Create lookup maps for rewritten content (by profileExperienceId/profileProjectId)
    const rewrittenExperienceMap = new Map(
      (rewrittenProfile?.rewritten_experiences || []).map((exp) => [exp.profileExperienceId, exp]),
    );
    const rewrittenProjectMap = new Map(
      (rewrittenProfile?.rewritten_projects || []).map((proj) => [proj.profileProjectId, proj]),
    );

    // Debug: Log the IDs to check if they match
    this.logger.debug(`Profile experience IDs: ${profile.experiences.map((e) => e.id).join(', ')}`);
    this.logger.debug(
      `Rewritten experience IDs: ${Array.from(rewrittenExperienceMap.keys()).join(', ')}`,
    );
    // Debug: Log what the LLM returned for each experience
    rewrittenExperienceMap.forEach((rewritten, id) => {
      const originalExp = profile.experiences.find((e) => e.id === id);
      this.logger.debug(
        `Experience "${originalExp?.title}" (${id}): ` +
          `desc="${(rewritten.rewritten_description || '').substring(0, 50)}...", ` +
          `achievements=[${rewritten.rewritten_achievements?.length || 0} items: ${(rewritten.rewritten_achievements || []).map((a) => a.substring(0, 30) + '...').join(' | ')}]`,
      );
    });

    // Build skill categories from selected hard skills AND tools
    const skillCategories: any[] = [];

    // Create a Set of valid profile skills for validation (case-insensitive)
    const validProfileSkills = new Set(profile.skills.map((s) => s.name.toLowerCase()));

    // Combine hard skills and tools into one array, removing duplicates
    const allSkills: string[] = [];

    if (tailoredProfile.selected_hard_skills?.length > 0) {
      allSkills.push(
        ...tailoredProfile.selected_hard_skills.map((s: any) =>
          typeof s === 'string' ? s : s.name || '',
        ),
      );
    }

    if (tailoredProfile.selected_tools?.length > 0) {
      allSkills.push(
        ...tailoredProfile.selected_tools.map((s: any) =>
          typeof s === 'string' ? s : s.name || '',
        ),
      );
    }

    // Filter skills to only include those that exist in the user's profile (prevents LLM hallucination)
    const validatedSkills = allSkills.filter((skill) => {
      const isValid = validProfileSkills.has(skill.toLowerCase());
      return isValid;
    });

    // Log warning for hallucinated skills (skills returned by LLM but not in profile)
    const hallucinatedSkills = allSkills.filter(
      (skill) => !validProfileSkills.has(skill.toLowerCase()),
    );
    if (hallucinatedSkills.length > 0) {
      this.logger.warn(
        `LLM returned ${hallucinatedSkills.length} skills not found in profile: ${hallucinatedSkills.join(', ')}`,
      );
    }

    // Remove duplicates (case-insensitive)
    const uniqueSkills = Array.from(new Set(validatedSkills.map((s) => s.toLowerCase()))).map(
      (lower) => validatedSkills.find((s) => s.toLowerCase() === lower) || lower,
    );

    if (uniqueSkills.length > 0) {
      skillCategories.push({
        id: 'skills-' + Date.now(),
        type: '',
        skills: uniqueSkills,
      });
    }

    // Include ALL profile experiences (not just LLM-selected ones)
    // Users can remove unwanted ones in the editor; sorted by start date (most recent first)
    // Use rewritten descriptions/achievements if available, with fallback to original
    const experiences = profile.experiences
      .slice() // Create copy to avoid mutating original
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map((exp) => {
        const rewritten = rewrittenExperienceMap.get(exp.id);
        if (!rewritten) {
          this.logger.warn(
            `No rewritten content found for experience "${exp.title}" (ID: ${exp.id}) - using original text`,
          );
        }
        // Determine if LLM provided rewritten content (achievements take priority)
        const hasRewrittenAchievements =
          rewritten?.rewritten_achievements && rewritten.rewritten_achievements.length > 0;
        const hasRewrittenDescription =
          rewritten?.rewritten_description && rewritten.rewritten_description.trim() !== '';

        // IMPORTANT: If LLM provided achievements but no description, use ONLY achievements
        // (don't mix English original description with German achievements)
        let description: string | undefined;
        if (hasRewrittenDescription) {
          // LLM provided a rewritten description - use it
          description = rewritten.rewritten_description;
        } else if (hasRewrittenAchievements) {
          // LLM provided achievements but no description - leave description empty
          // Frontend will display only the achievements
          description = undefined;
        } else {
          // No rewritten content at all - fallback to original
          description = exp.description || undefined;
        }

        return {
          id: exp.id,
          title: exp.title,
          company: exp.company,
          dateRange: formatDateRange(exp.startDate, exp.endDate, exp.isCurrent),
          startDate: exp.startDate?.toISOString() || undefined,
          endDate: exp.endDate?.toISOString() || undefined,
          location: exp.location || undefined,
          description,
          // Use rewritten achievements if available, fallback to original
          achievements: hasRewrittenAchievements
            ? rewritten.rewritten_achievements
            : exp.achievements || [],
        };
      });

    // Include ALL profile projects (not just LLM-selected ones)
    // Users can remove unwanted ones in the editor
    // Use rewritten descriptions/highlights if available, with fallback to original
    const projects = profile.projects.map((proj) => {
      const rewritten = rewrittenProjectMap.get(proj.id);

      // Determine if LLM provided rewritten content (highlights take priority)
      const hasRewrittenHighlights =
        rewritten?.rewritten_highlights && rewritten.rewritten_highlights.length > 0;
      const hasRewrittenDescription =
        rewritten?.rewritten_description && rewritten.rewritten_description.trim() !== '';

      // IMPORTANT: If LLM provided highlights but no description, use ONLY highlights
      // (don't mix English original description with German highlights)
      let description: string | undefined;
      if (hasRewrittenDescription) {
        description = rewritten.rewritten_description;
      } else if (hasRewrittenHighlights) {
        // LLM provided highlights but no description - leave description empty
        description = undefined;
      } else {
        description = proj.description || undefined;
      }

      return {
        id: proj.id,
        name: proj.name,
        description,
        date: proj.startDate?.toISOString() || undefined,
        highlights: hasRewrittenHighlights
          ? rewritten.rewritten_highlights
          : proj.technologies || [],
      };
    });

    // Map selected education - Handle both string[] (legacy) and object[] (new)
    let education = (tailoredProfile.selected_education || [])
      .map((edu: any) => {
        // Handle string format (legacy LLM output)
        if (typeof edu === 'string') {
          // Try to match with profile education by degree or institution name
          const matchedEdu = profile.education.find(
            (e) =>
              edu.toLowerCase().includes(e.degree.toLowerCase()) ||
              edu.toLowerCase().includes(e.institution.toLowerCase()),
          );
          if (matchedEdu) {
            return {
              id: matchedEdu.id,
              degree: matchedEdu.degree,
              institution: matchedEdu.institution,
              fieldOfStudy: matchedEdu.fieldOfStudy ?? undefined,
              year: matchedEdu.endYear?.getFullYear()?.toString() || '',
              gpa: matchedEdu.gpa ?? undefined,
              description: matchedEdu.description ?? undefined,
            };
          }
          // Fallback: parse "Degree at Institution" format
          const parts = edu.split(/\s+at\s+|\s+-\s+|\s+from\s+/i).map((s: string) => s.trim());
          return {
            id: 'edu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            degree: parts[0] || edu,
            institution: parts[1] || 'Unknown',
            year: new Date().getFullYear().toString(),
          };
        }
        // Handle object format (new LLM output)
        if (!edu.degree && !edu.institution) return null;
        // Find original education from profile by ID to enrich data
        const originalEdu = profile.education.find((e) => e.id === edu.profileEducationId);
        const year =
          edu.endYear ||
          edu.startYear ||
          originalEdu?.endYear?.getFullYear()?.toString() ||
          new Date().getFullYear().toString();
        return {
          id: edu.profileEducationId || 'edu-' + Date.now(),
          degree: originalEdu?.degree || edu.degree,
          institution: originalEdu?.institution || edu.institution,
          fieldOfStudy: originalEdu?.fieldOfStudy || edu.fieldOfStudy || undefined,
          year: year.toString(),
          gpa: originalEdu?.gpa || edu.gpa || undefined,
          description: originalEdu?.description || edu.description || undefined,
        };
      })
      .filter(Boolean);

    // Fallback: If no education from LLM, use all profile education
    if (education.length === 0 && profile.education.length > 0) {
      education = profile.education.map((edu) => ({
        id: edu.id,
        degree: edu.degree,
        institution: edu.institution,
        fieldOfStudy: edu.fieldOfStudy ?? undefined,
        year:
          edu.endYear?.getFullYear()?.toString() || edu.startYear?.getFullYear()?.toString() || '',
        gpa: edu.gpa ?? undefined,
        description: edu.description ?? undefined,
      }));
    }

    // Map selected certifications - Handle both string[] (legacy) and object[] (new)
    let certifications = (tailoredProfile.selected_certificates || [])
      .map((cert: any) => {
        // Handle string format (legacy LLM output)
        if (typeof cert === 'string') {
          // Find matching certificate in profile by name
          const matchedCert = profile.certificates.find(
            (c) => c.name.toLowerCase() === cert.toLowerCase(),
          );
          if (matchedCert) {
            return {
              id: matchedCert.id,
              name: matchedCert.name,
              issuer: matchedCert.issuer,
              date: matchedCert.issueDate?.toISOString() || undefined,
            };
          }
          // Fallback: use string as name with unknown issuer
          return {
            id: 'cert-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name: cert,
            issuer: 'Unknown',
          };
        }
        // Handle object format (new LLM output)
        if (!cert.name) return null;
        // Find original certificate from profile by ID to enrich data
        const originalCert = profile.certificates.find((c) => c.id === cert.profileCertificateId);
        return {
          id: cert.profileCertificateId || 'cert-' + Date.now(),
          name: originalCert?.name || cert.name,
          issuer: originalCert?.issuer || cert.issuer || 'Unknown',
          date: originalCert?.issueDate?.toISOString() || cert.issueDate || undefined,
        };
      })
      .filter(Boolean);

    // Fallback: If no certifications from LLM, use all profile certificates
    if (certifications.length === 0 && profile.certificates.length > 0) {
      certifications = profile.certificates.map((cert) => ({
        id: cert.id,
        name: cert.name,
        issuer: cert.issuer,
        date: cert.issueDate?.toISOString() || undefined,
      }));
    }

    // Map languages - ALWAYS use ALL profile languages (not LLM-filtered)
    // Normalize proficiency levels to translation keys for multilingual support
    const languages = profile.languages.map((lang) => ({
      name: lang.name,
      level: normalizeProficiencyLevel(lang.level),
    }));

    // Build full address from components
    const addressParts: string[] = [];
    if (profile.street) addressParts.push(profile.street);
    if (profile.postalCode || profile.city) {
      addressParts.push(`${profile.postalCode || ''} ${profile.city || ''}`.trim());
    }
    if (profile.country) addressParts.push(profile.country);
    const fullAddress = addressParts.join(', ');

    return {
      candidateName,
      email: profile.user.email,
      phone: profile.phone || undefined,
      street: profile.street || undefined,
      postalCode: profile.postalCode || undefined,
      city: profile.city || undefined,
      country: profile.country || undefined,
      fullAddress: fullAddress || undefined,
      linkedin: sanitizeUrl(profile.linkedinUrl),
      github: sanitizeUrl(profile.githubUrl),
      // Priority: rewritten_summary > customized_summary > profile.summary
      summary:
        rewrittenProfile?.rewritten_summary ||
        tailoredProfile.customized_summary ||
        profile.summary ||
        undefined,
      skillCategories,
      experiences,
      projects: projects.length > 0 ? projects : undefined,
      education: education.length > 0 ? education : undefined,
      certifications: certifications.length > 0 ? certifications : undefined,
      languages: languages.length > 0 ? languages : undefined,
    };
  }

  async updateResume(
    userId: string,
    applicationId: string,
    dto: UpdateResumeDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating resume for application ${applicationId}`);

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);
    this.ensureNotGenerating(application);

    const normalized = this.normalizeResumeData(dto.resume);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        resumeText: JSON.stringify(normalized),
      },
      include: {
        jobPosting: true,
      },
    });

    // IMPORTANT: After saving resume, automatically re-match keywords against updated resume
    // This ensures ATS score reflects the latest changes without requiring manual refresh
    if (application.atsKeywords) {
      this.logger.log(
        `Resume updated for application ${applicationId}, re-matching keywords against new resume`,
      );
      try {
        // Convert cached keywords to old format
        const keywords = this.convertAtsKeywordsToOldFormat(application.atsKeywords as any);

        // Extract keywords from the newly saved resume
        const resumeKeywords = this.extractResumeKeywords(JSON.stringify(normalized));

        // Match keywords
        const { matchedKeywords, missingKeywords } = this.matchKeywords(keywords, resumeKeywords);
        const matchAnalysis = this.calculateMatchAnalysis(
          matchedKeywords,
          missingKeywords,
          keywords,
        );

        // Update the cached analysis data
        const analysisData = {
          keywords,
          matchAnalysis,
          matchedKeywords,
          missingKeywords,
          analyzedAt: new Date(),
        };

        await this.prisma.application.update({
          where: { id: applicationId },
          data: { keywordsData: JSON.stringify(analysisData) },
        });

        this.logger.log(
          `ATS score updated for application ${applicationId}: ${matchAnalysis.overallScore}% match (${matchedKeywords.length}/${matchedKeywords.length + missingKeywords.length} keywords)`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to auto-update ATS score after resume save for application ${applicationId}`,
          error,
        );
      }
    }

    return this.mapToResponseDto(updated);
  }

  async upsertCoverLetter(
    userId: string,
    applicationId: string,
    dto: CoverLetterDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating cover letter for application ${applicationId}`);

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);
    this.ensureNotGenerating(application);

    const resume = this.parseResume(application.resumeText);
    if (!resume) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_RESUME);
    }

    const jobPosting = application.jobPosting;
    if (!jobPosting) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_JOB);
    }

    let content = dto.content;

    // If regenerate is true and instructions are provided, modify existing content
    if (dto.regenerate && dto.instructions && dto.content) {
      this.logger.log('Modifying cover letter with AI based on instructions');
      content = await this.llmService.modifyCoverLetterContent(dto.content, dto.instructions, {
        jobTitle: jobPosting.title,
        companyName: jobPosting.company || 'Unknown Company',
      });
    }
    // If no content or regenerate without existing content, generate new
    else if (!content || dto.regenerate) {
      // Extract keywords from resume for ATS-optimized generation
      const resumeKeywords = this.extractResumeKeywords(application.resumeText);

      // Get keyword analysis for ATS optimization
      const { matchedKeywords, missingKeywords } = await this.getKeywordsForGeneration(
        jobPosting,
        resumeKeywords,
      );

      // Use ATS-optimized generation if keywords are available
      if (matchedKeywords.length > 0 || missingKeywords.length > 0) {
        this.logger.log('Regenerating cover letter with ATS optimization');
        const atsContext = this.buildATSCoverLetterContext(
          resume,
          jobPosting,
          matchedKeywords,
          missingKeywords,
        );
        content = await this.llmService.generateCoverLetterATS(atsContext);
      } else {
        // Fallback to standard generation
        this.logger.log('Regenerating cover letter with standard LLM');
        const context = this.buildCoverLetterContext(resume, jobPosting, dto.instructions);
        content = await this.llmService.generateCoverLetter(context);
      }
    }

    const sanitizedContent = this.sanitizeCoverLetter(content);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        coverLetterText: sanitizedContent,
      },
      include: {
        jobPosting: true,
      },
    });

    return this.mapToResponseDto(updated);
  }

  /**
   * Generate or modify professional summary using AI
   * Uses job posting and profile context to tailor the summary
   * Returns generated summary (not persisted - user applies manually in editor)
   */
  async generateSummary(
    userId: string,
    applicationId: string,
    dto: { instructions: string; currentSummary?: string; regenerate?: boolean },
  ): Promise<{ summary: string }> {
    this.logger.log(`Generating summary for application ${applicationId}`);

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    const jobPosting = application.jobPosting;
    if (!jobPosting) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_JOB);
    }

    // Load profile with relations for context
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
        experiences: true,
      },
    });

    // Build context from profile
    const skills = profile?.skills?.map((s) => s.name) || [];
    const experiences =
      profile?.experiences?.map((exp) => ({
        title: exp.title,
        company: exp.company,
        description: exp.description || undefined,
      })) || [];

    // Generate/modify summary with LLM
    const summary = await this.llmService.modifySummaryContent(
      dto.currentSummary,
      dto.instructions,
      {
        jobTitle: jobPosting.title,
        companyName: jobPosting.company || 'Unknown Company',
        jobDescription: jobPosting.fullText || undefined,
        skills,
        experiences,
      },
    );

    return { summary };
  }

  /**
   * Generate or modify experience description using AI
   * Uses job posting context to tailor bullet points with action verbs and metrics
   * Returns generated HTML description (not persisted - user applies manually in editor)
   */
  async generateExperienceDescription(
    userId: string,
    applicationId: string,
    dto: {
      instructions: string;
      experienceIndex: number;
      currentDescription?: string;
      experienceTitle: string;
      experienceCompany: string;
      experienceDateRange?: string;
      regenerate?: boolean;
    },
  ): Promise<{ description: string }> {
    this.logger.log(
      `Generating experience description for application ${applicationId}, experience index ${dto.experienceIndex}`,
    );

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    const jobPosting = application.jobPosting;
    if (!jobPosting) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_JOB);
    }

    // Load profile for skills context
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
      },
    });

    const skills = profile?.skills?.map((s) => s.name) || [];

    // Generate/modify experience description with LLM
    const description = await this.llmService.modifyExperienceDescription(
      dto.currentDescription,
      dto.instructions,
      {
        experienceTitle: dto.experienceTitle,
        experienceCompany: dto.experienceCompany,
        experienceDateRange: dto.experienceDateRange,
        jobTitle: jobPosting.title,
        companyName: jobPosting.company || 'Unknown Company',
        jobDescription: jobPosting.fullText || undefined,
        skills,
      },
    );

    return { description };
  }

  /**
   * Generate or modify project description using AI
   * Uses job posting context to tailor bullet points with technologies and impact
   * Returns generated HTML description (not persisted - user applies manually in editor)
   */
  async generateProjectDescription(
    userId: string,
    applicationId: string,
    dto: {
      instructions: string;
      projectIndex: number;
      currentDescription?: string;
      projectName: string;
      projectDate?: string;
      regenerate?: boolean;
    },
  ): Promise<{ description: string }> {
    this.logger.log(
      `Generating project description for application ${applicationId}, project index ${dto.projectIndex}`,
    );

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    const jobPosting = application.jobPosting;
    if (!jobPosting) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_JOB);
    }

    // Load profile for skills context
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: true,
      },
    });

    const skills = profile?.skills?.map((s) => s.name) || [];

    // Generate/modify project description with LLM
    const description = await this.llmService.modifyProjectDescription(
      dto.currentDescription,
      dto.instructions,
      {
        projectName: dto.projectName,
        projectDate: dto.projectDate,
        jobTitle: jobPosting.title,
        companyName: jobPosting.company || 'Unknown Company',
        jobDescription: jobPosting.fullText || undefined,
        skills,
      },
    );

    return { description };
  }

  async requestExport(
    userId: string,
    applicationId: string,
    language?: 'de' | 'en' | 'fr' | 'es' | 'it',
  ): Promise<ApplicationResponseDto> {
    this.logger.log(
      `Export requested for application ${applicationId} with language: ${language || 'default'}`,
    );

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);
    this.ensureNotGenerating(application);

    const resume = this.parseResume(application.resumeText);
    if (!resume) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_RESUME);
    }

    // Cover letter is optional - user may have opted out during creation
    // Log whether we're exporting with or without cover letter
    if (!application.coverLetterText) {
      this.logger.log(
        `Exporting application ${applicationId} without cover letter (user opted out)`,
      );
    }

    await this.cleanupGeneratedFiles(application);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.GENERATING,
        coverLetterFileKey: null,
        resumeFileKey: null,
        errorMessage: null,
      },
      include: {
        jobPosting: true,
      },
    });

    await this.jobsService.publishJob(JobType.APPLICATION_GENERATE, {
      applicationId,
      userId,
      jobPostingId: application.jobPostingId,
      language, // Pass selected language to job worker
    });

    return this.mapToResponseDto(updated);
  }

  /**
   * Retry PDF generation for failed applications
   *
   * Only allows retry if application status is FAILED.
   * Resets application state and re-enqueues the generation job.
   */
  async regenerate(applicationId: string, userId: string): Promise<ApplicationResponseDto> {
    this.logger.log(`Regenerating failed application ${applicationId} for user ${userId}`);

    // 1. Verify ownership and get application
    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    // 2. Only allow retry if status is FAILED
    if (application.status !== ApplicationStatus.FAILED) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NOT_FAILED);
    }

    // 3. Verify we have resume data (required for export)
    const resume = this.parseResume(application.resumeText);
    if (!resume) {
      throw new BadRequestWithCode(ErrorCode.APPLICATION_NO_RESUME);
    }

    // 4. Clean up any old files from failed attempt
    await this.cleanupGeneratedFiles(application);

    // 5. Reset status to GENERATING and clear error message
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.GENERATING,
        coverLetterFileKey: null,
        resumeFileKey: null,
        errorMessage: null,
      },
      include: {
        jobPosting: true,
      },
    });

    // 6. Re-enqueue the generation job
    await this.jobsService.publishJob(JobType.APPLICATION_GENERATE, {
      applicationId,
      userId,
      jobPostingId: application.jobPostingId,
    });

    this.logger.log(`Application ${applicationId} re-enqueued for generation`);

    return this.mapToResponseDto(updated);
  }

  /**
   * Get a single application by ID
   *
   * Uses Prisma's `include` to prevent N+1 queries when job posting is requested
   */
  async findOne(
    userId: string,
    applicationId: string,
    includeJobPosting = false,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId, // Security: Only return user's own applications
      },
      include: {
        // Eagerly load job posting to prevent N+1 queries
        jobPosting: includeJobPosting,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    return this.mapToResponseDto(application);
  }

  /**
   * Get all applications for a user with pagination
   *
   * Uses Prisma's `include` to prevent N+1 query problems:
   * - Eager loads job posting when requested (single JOIN query)
   * - Uses Promise.all for parallel count query
   * - Results in 2 queries total (1 for data + 1 for count), not 1+N
   *
   * Supports soft delete filtering via includeDeleted parameter
   */
  async findAll(
    userId: string,
    includeJobPosting = false,
    page = 1,
    limit = 20,
    includeDeleted = false,
  ): Promise<{ items: ApplicationResponseDto[]; pagination: any }> {
    const whereClause = {
      userId,
      // Filter out soft-deleted items unless explicitly requested
      deletedAt: includeDeleted ? undefined : null,
    };

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where: whereClause,
        // Lean select for list view: skip the large generated text + JSON
        // blobs (coverLetterText, resumeText, keywordsData, matchDetails,
        // atsKeywords, tailoredProfile). Detail/edit pages re-fetch via
        // GET /applications/:id which still returns the full row.
        // Saves ~70–90% Neon egress per dashboard load.
        select: {
          id: true,
          userId: true,
          jobPostingId: true,
          title: true,
          targetJobTitle: true,
          applicationStatus: true,
          statusUpdatedAt: true,
          statusSource: true,
          status: true,
          notes: true,
          coverLetterFileKey: true,
          resumeFileKey: true,
          coverLetterTemplateId: true,
          resumeTemplateId: true,
          language: true,
          errorMessage: true,
          matchScore: true,
          createdAt: true,
          updatedAt: true,
          jobPosting: includeJobPosting
            ? {
                select: {
                  id: true,
                  title: true,
                  company: true,
                  location: true,
                },
              }
            : false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.application.count({
        where: whereClause,
      }),
    ]);

    return {
      items: applications.map((app) => this.mapToResponseDto(app)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get download URLs for application files
   */
  async getFiles(userId: string, applicationId: string): Promise<ApplicationFilesResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    if (application.status !== 'READY') {
      throw new BadRequestException(
        `Application is not ready. Current status: ${application.status}`,
      );
    }

    const response: ApplicationFilesResponseDto = {
      applicationId: application.id,
    };

    // Generate SAS URLs for files (1 hour expiry)
    const expiresIn = 15 * 60; // 15 minutes in seconds (was 1h — reduced
    // to limit the window of risk if a download URL leaks via chat,
    // browser history, or email forwarding. 15 min covers the
    // "click-download" use case comfortably.

    if (application.coverLetterFileKey) {
      const url = await this.storageService.getSignedUrl(application.coverLetterFileKey, expiresIn);

      response.coverLetter = {
        key: application.coverLetterFileKey,
        filename: `${application.id}-cover-letter.pdf`,
        mimeType: 'application/pdf',
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    }

    if (application.resumeFileKey) {
      const url = await this.storageService.getSignedUrl(application.resumeFileKey, expiresIn);

      response.resume = {
        key: application.resumeFileKey,
        filename: `${application.id}-resume.pdf`,
        mimeType: 'application/pdf',
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    }

    return response;
  }

  /**
   * Get file stream for download
   */
  async getFileStream(
    userId: string,
    applicationId: string,
    fileType: 'cover-letter' | 'resume',
  ): Promise<Buffer> {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    if (application.status !== 'READY') {
      throw new BadRequestException(
        `Application is not ready. Current status: ${application.status}`,
      );
    }

    const fileKey =
      fileType === 'cover-letter' ? application.coverLetterFileKey : application.resumeFileKey;

    if (!fileKey) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    // Get file from storage
    return this.storageService.getFile(fileKey);
  }

  /**
   * Soft delete an application (sets deletedAt timestamp)
   * The application can be restored within 30 days before permanent deletion
   */
  async delete(userId: string, applicationId: string): Promise<void> {
    this.logger.log(`Soft deleting application ${applicationId} for user ${userId}`);

    // Find application (verify ownership)
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
        deletedAt: null, // Can only soft delete non-deleted applications
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    // Soft delete by setting deletedAt timestamp
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Application ${applicationId} soft deleted successfully`);
  }

  /**
   * Restore a soft-deleted application (clears deletedAt timestamp)
   */
  async restore(userId: string, applicationId: string): Promise<ApplicationResponseDto> {
    this.logger.log(`Restoring application ${applicationId} for user ${userId}`);

    // Find soft-deleted application (verify ownership)
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
        deletedAt: { not: null }, // Can only restore deleted applications
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    // Restore by clearing deletedAt
    const restored = await this.prisma.application.update({
      where: { id: applicationId },
      data: { deletedAt: null },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(`Application ${applicationId} restored successfully`);
    return this.mapToResponseDto(restored);
  }

  /**
   * Permanently delete an application and its associated files
   * This is irreversible - only used by cleanup cron or admin actions
   */
  async hardDelete(userId: string, applicationId: string): Promise<void> {
    this.logger.log(`Permanently deleting application ${applicationId} for user ${userId}`);

    // Find application (verify ownership)
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    // Clean up generated files from storage
    await this.cleanupGeneratedFiles(application);

    // Permanently delete application from database
    await this.prisma.application.delete({
      where: { id: applicationId },
    });

    this.logger.log(`Application ${applicationId} permanently deleted`);
  }

  /**
   * Update the tracking status of an application (user-facing)
   */
  async updateStatus(
    userId: string,
    applicationId: string,
    status: ApplicationTrackingStatus,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating application ${applicationId} status to ${status} for user ${userId}`);

    // Update status and timestamp. We mark `statusSource = USER` so the
    // mailbox-sync notification logic knows NOT to send a "status changed"
    // email — the user already knows, they just clicked the dropdown.
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        applicationStatus: status,
        statusUpdatedAt: new Date(),
        statusSource: 'USER',
      },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(`Application ${applicationId} status updated to ${status}`);
    return this.mapToResponseDto(updated);
  }

  /**
   * Update the custom title of an application
   */
  async updateTitle(
    userId: string,
    applicationId: string,
    title: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating application ${applicationId} title for user ${userId}`);

    // Update title (validation already handled by DTO)
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        title,
      },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(`Application ${applicationId} title updated`);
    return this.mapToResponseDto(updated);
  }

  /**
   * Update the target job title of an application (displayed on CV/CL)
   */
  async updateTargetJobTitle(
    userId: string,
    applicationId: string,
    targetJobTitle: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating application ${applicationId} target job title for user ${userId}`);

    // Update targetJobTitle (validation already handled by DTO)
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        targetJobTitle,
      },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(`Application ${applicationId} target job title updated to: ${targetJobTitle}`);
    return this.mapToResponseDto(updated);
  }

  /**
   * Get only the status of an application (lightweight, for polling)
   */
  async getStatus(userId: string, applicationId: string): Promise<ApplicationStatusResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    return {
      id: application.id,
      status: application.status,
      errorMessage: application.errorMessage,
      updatedAt: application.updatedAt,
    };
  }

  /**
   * Map Prisma model to DTO
   */
  private mapToResponseDto(application: any): ApplicationResponseDto {
    return {
      id: application.id,
      userId: application.userId,
      jobPostingId: application.jobPostingId,
      title: application.title,
      targetJobTitle: application.targetJobTitle,
      applicationStatus: application.applicationStatus,
      statusUpdatedAt: application.statusUpdatedAt,
      statusSource: application.statusSource,
      status: application.status as ApplicationStatus,
      notes: application.notes,
      coverLetterText: application.coverLetterText,
      resumeText: application.resumeText,
      coverLetterFileKey: application.coverLetterFileKey,
      resumeFileKey: application.resumeFileKey,
      coverLetterTemplateId: application.coverLetterTemplateId,
      resumeTemplateId: application.resumeTemplateId,
      language: application.language,
      errorMessage: application.errorMessage,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      atsKeywords: application.atsKeywords,
      tailoredProfile: application.tailoredProfile,
      jobPosting: application.jobPosting
        ? {
            id: application.jobPosting.id,
            title: application.jobPosting.title,
            company: application.jobPosting.company,
            location: application.jobPosting.location,
            description: application.jobPosting.description,
          }
        : undefined,
    };
  }

  /**
   * Stream real-time status updates for an application via Server-Sent Events (SSE)
   * Polls the database every second and streams updates until application reaches a final state
   * @param userId - User ID (for authorization)
   * @param applicationId - Application ID to stream status for
   * @returns Observable that emits SSE MessageEvents with status updates
   */
  async streamStatus(userId: string, applicationId: string): Promise<Observable<MessageEvent>> {
    // Verify application exists and belongs to user
    await this.ensureApplicationOwnership(userId, applicationId);

    this.logger.log(`SSE stream started for application ${applicationId} by user ${userId}`);

    // Create a subject to emit progress updates
    let lastProgress = 0;
    let lastMessage = '';

    // Register progress callback for this application
    this.progressCallbacks.set(applicationId, (progress: number, message: string) => {
      lastProgress = progress;
      lastMessage = message;
    });

    // Create SSE stream that polls status every 5 seconds.
    // Was 1s but that produced ~60 DB round-trips per generation; combined
    // with hundreds of generations/day this dominated Neon egress (5GB/mo cap).
    // 5s is still snappy enough for the wizard UI — progress bar updates
    // come from the in-memory `progressCallbacks` closure between polls,
    // and the final READY/FAILED transition is bounded by one extra poll.
    return timer(0, 5000).pipe(
      // Fetch latest application status
      switchMap(async () => {
        const application = await this.prisma.application.findFirst({
          where: {
            id: applicationId,
            userId,
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            errorMessage: true,
          },
        });

        if (!application) {
          this.logger.error(`SSE stream error: Application ${applicationId} not found`);
          throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
        }

        this.logger.debug(
          `SSE emit: application ${applicationId} status=${application.status} progress=${lastProgress}%`,
        );
        return { application, progress: lastProgress, message: lastMessage };
      }),
      // Transform to SSE MessageEvent format
      map(({ application, progress, message }) => {
        const status = application.status;
        return {
          data: {
            id: application.id,
            status: status,
            updatedAt: application.updatedAt,
            errorMessage: application.errorMessage,
            progress: progress,
            message: message,
          },
        } as MessageEvent;
      }),
      // Stop streaming when status reaches a final state (READY or FAILED)
      // The `true` parameter ensures the final status is emitted before closing
      takeWhile((event: MessageEvent) => {
        const eventData = event.data as { status: ApplicationStatus; progress: number };
        const status = eventData.status;
        const shouldContinue = status === 'PENDING' || status === 'GENERATING';

        if (!shouldContinue) {
          this.logger.log(
            `SSE stream closing for application ${applicationId} (final status: ${status}, progress: ${eventData.progress}%)`,
          );
          // Clean up progress callback when stream closes
          this.progressCallbacks.delete(applicationId);
        }

        return shouldContinue;
      }, true),
    );
  }

  /**
   * Get keywords analysis for an application
   * Returns cached analysis if available, or triggers new analysis
   */
  async getKeywordsAnalysis(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationKeywordsResponseDto> {
    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    if (!application.jobPosting) {
      throw new BadRequestException('Application has no associated job posting');
    }

    // PRIORITY 1: Check cached keywords from resume updates (keywordsData field)
    // This ensures we use the most recent analysis after manual resume edits
    if (application.keywordsData) {
      try {
        const cached = JSON.parse(application.keywordsData as string);
        // Only use cache if it has the expected structure
        if (cached.keywords && cached.matchAnalysis) {
          this.logger.log(
            `Using cached keywords analysis for application ${applicationId} (score: ${cached.matchAnalysis.overallScore}%)`,
          );
          return {
            applicationId,
            keywords: cached.keywords,
            matchAnalysis: cached.matchAnalysis,
            matchedKeywords: cached.matchedKeywords || [],
            missingKeywords: cached.missingKeywords || [],
            analyzedAt: cached.analyzedAt ? new Date(cached.analyzedAt) : new Date(),
          };
        }
      } catch (error) {
        this.logger.warn(`Failed to parse cached keywords for application ${applicationId}`, error);
      }
    }

    // PRIORITY 2: Use new single-LLM pipeline keywords (atsKeywords field)
    // Only used if no cached keywordsData exists (e.g., fresh application)
    if (application.atsKeywords) {
      try {
        const atsKeywords = application.atsKeywords as any;

        // Convert new format to old format for UI compatibility
        const keywords = this.convertAtsKeywordsToOldFormat(atsKeywords);

        // Extract keywords from resume for matching
        const resumeKeywords = this.extractResumeKeywords(application.resumeText);

        // Fallback to profile if no resume
        let candidateKeywords: Set<string>;
        if (resumeKeywords.size > 0) {
          candidateKeywords = resumeKeywords;
        } else {
          const profile = await this.getProfileWithRelations(userId);
          candidateKeywords = this.extractProfileKeywords(profile);
        }

        // Match keywords
        const { matchedKeywords, missingKeywords } = this.matchKeywords(
          keywords,
          candidateKeywords,
        );
        const matchAnalysis = this.calculateMatchAnalysis(
          matchedKeywords,
          missingKeywords,
          keywords,
        );

        this.logger.log(
          `Calculated live keywords analysis for application ${applicationId} (score: ${matchAnalysis.overallScore}%)`,
        );

        return {
          applicationId,
          keywords,
          matchAnalysis,
          matchedKeywords,
          missingKeywords,
          analyzedAt: application.updatedAt,
        };
      } catch (error) {
        this.logger.warn(`Failed to use atsKeywords, falling back to old system`, error);
      }
    }

    // PRIORITY 3: No cached data (legacy fallback - should rarely happen)
    this.logger.warn(
      `No atsKeywords or keywordsData found for application ${applicationId}, using old ATS Agent system`,
    );
    return this.analyzeKeywords(userId, applicationId);
  }

  /**
   * Analyze keywords for an application
   * SMART: Uses cached keywords from atsKeywords field if available
   * Only re-extracts from job posting if no cached keywords exist
   */
  async analyzeKeywords(
    userId: string,
    applicationId: string,
  ): Promise<ApplicationKeywordsResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { jobPosting: true },
    });

    if (!application) {
      throw new NotFoundWithCode(ErrorCode.APPLICATION_NOT_FOUND);
    }

    if (!application.jobPosting) {
      throw new BadRequestException('Application has no associated job posting');
    }

    const jobPosting = application.jobPosting;

    // SMART: Check if we have cached keywords from single-LLM pipeline
    let keywords: any;
    if (application.atsKeywords) {
      this.logger.log(
        `Using cached keywords from atsKeywords for application ${applicationId}, re-matching against updated resume`,
      );
      // Convert new format to old format for matching
      keywords = this.convertAtsKeywordsToOldFormat(application.atsKeywords as any);
    } else {
      // No cached keywords - extract from job posting using LLM
      this.logger.log(
        `No cached keywords found for application ${applicationId}, extracting from job posting`,
      );
      keywords = await this.keywordsService.extractKeywords({
        title: jobPosting.title,
        company: jobPosting.company,
        location: jobPosting.location || undefined,
        language: jobPosting.language || undefined,
        fullText: jobPosting.fullText,
        rawText: jobPosting.rawText || undefined,
      });
    }

    // Extract keywords from application's resume (not profile!)
    // This allows ATS score to reflect edits made in the application
    const resumeKeywords = this.extractResumeKeywords(application.resumeText);

    // Fallback to profile if no resume exists yet
    let candidateKeywords: Set<string>;
    if (resumeKeywords.size > 0) {
      candidateKeywords = resumeKeywords;
      this.logger.debug(`Using resume keywords for matching (${resumeKeywords.size} keywords)`);
    } else {
      const profile = await this.getProfileWithRelations(userId);
      candidateKeywords = this.extractProfileKeywords(profile);
      this.logger.debug(`Using profile keywords for matching (${candidateKeywords.size} keywords)`);
    }

    // Perform matching
    const { matchedKeywords, missingKeywords } = this.matchKeywords(keywords, candidateKeywords);

    // Calculate match analysis
    const matchAnalysis = this.calculateMatchAnalysis(matchedKeywords, missingKeywords, keywords);

    // Cache the results
    const analysisData = {
      keywords,
      matchAnalysis,
      matchedKeywords,
      missingKeywords,
      analyzedAt: new Date(),
    };

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { keywordsData: JSON.stringify(analysisData) },
    });

    this.logger.log(
      `Keywords analysis complete for application ${applicationId}: ${matchAnalysis.overallScore}% match`,
    );

    return {
      applicationId,
      keywords,
      matchAnalysis,
      matchedKeywords,
      missingKeywords,
      analyzedAt: new Date(),
    };
  }

  /**
   * Extract keywords from profile for matching
   */
  private extractProfileKeywords(profile: ProfileWithRelations): Set<string> {
    const keywords = new Set<string>();

    // Skills
    profile.skills.forEach((s) => keywords.add(s.name.toLowerCase()));

    // Experience titles and descriptions
    profile.experiences.forEach((e) => {
      e.title
        .toLowerCase()
        .split(/\s+/)
        .forEach((w) => keywords.add(w));
      if (e.description) {
        e.description
          .toLowerCase()
          .split(/\s+/)
          .forEach((w) => {
            if (w.length > 3) keywords.add(w);
          });
      }
    });

    // Projects and technologies
    profile.projects.forEach((p) => {
      p.technologies.forEach((t) => keywords.add(t.toLowerCase()));
    });

    // Certificates
    profile.certificates.forEach((c) => {
      c.name
        .toLowerCase()
        .split(/\s+/)
        .forEach((w) => keywords.add(w));
    });

    return keywords;
  }

  /**
   * Extract keywords from application's saved resume JSON
   * This is used to match against the edited resume, not the profile
   */
  private extractResumeKeywords(resumeText: string | null): Set<string> {
    const keywords = new Set<string>();

    if (!resumeText) {
      this.logger.debug('extractResumeKeywords: No resumeText provided');
      return keywords;
    }

    try {
      const resume = JSON.parse(resumeText);
      this.logger.debug(
        `extractResumeKeywords: Parsing resume with keys: ${Object.keys(resume).join(', ')}`,
      );

      // Helper: Add keyword preserving tech terms (C++, .NET, AWS, etc.)
      const addKeyword = (word: string) => {
        const trimmed = word.trim().toLowerCase();
        if (trimmed.length >= 2) {
          keywords.add(trimmed);
        }
      };

      // Helper: Split text but preserve tech terms
      const extractWords = (text: string) => {
        if (!text) return;
        // Split on whitespace but keep special chars within words
        text.split(/\s+/).forEach((w) => {
          const cleaned = w.replace(/^[,;.:!?"'()\[\]{}]+|[,;.:!?"'()\[\]{}]+$/g, '');
          if (cleaned.length >= 2) {
            keywords.add(cleaned.toLowerCase());
          }
        });
      };

      // Summary
      if (resume.summary) {
        extractWords(resume.summary);
      }

      // Skills from all categories - MOST IMPORTANT for ATS matching
      if (resume.skillCategories && Array.isArray(resume.skillCategories)) {
        resume.skillCategories.forEach((category: { type?: string; skills?: string[] }) => {
          if (category.skills && Array.isArray(category.skills)) {
            this.logger.debug(
              `extractResumeKeywords: Category "${category.type}" has ${category.skills.length} skills: ${category.skills.join(', ')}`,
            );
            category.skills.forEach((skill: string) => {
              // Add full skill name (e.g., "React.js", "Node.js", "C++")
              addKeyword(skill);
              // Also add without common suffixes for fuzzy matching
              const simplified = skill.toLowerCase().replace(/\.js$|\.net$/i, '');
              if (simplified !== skill.toLowerCase()) {
                addKeyword(simplified);
              }
            });
          }
        });
      }

      // Experience titles, descriptions, and achievements
      if (resume.experiences && Array.isArray(resume.experiences)) {
        resume.experiences.forEach(
          (exp: {
            title?: string;
            company?: string;
            description?: string;
            achievements?: string[];
          }) => {
            if (exp.title) extractWords(exp.title);
            if (exp.description) extractWords(exp.description);
            if (exp.achievements && Array.isArray(exp.achievements)) {
              exp.achievements.forEach((achievement: string) => extractWords(achievement));
            }
          },
        );
      }

      // Projects and highlights
      if (resume.projects && Array.isArray(resume.projects)) {
        resume.projects.forEach(
          (project: { name?: string; description?: string; highlights?: string[] }) => {
            if (project.name) extractWords(project.name);
            if (project.description) extractWords(project.description);
            if (project.highlights && Array.isArray(project.highlights)) {
              project.highlights.forEach((h: string) => extractWords(h));
            }
          },
        );
      }

      // Certifications (name and issuer are both important for ATS)
      if (resume.certifications && Array.isArray(resume.certifications)) {
        resume.certifications.forEach((cert: { name?: string; issuer?: string }) => {
          if (cert.name) extractWords(cert.name);
          if (cert.issuer) extractWords(cert.issuer); // Include issuer (e.g., "Microsoft", "AWS")
        });
      }

      // Education (degree, field of study, and description)
      if (resume.education && Array.isArray(resume.education)) {
        resume.education.forEach(
          (edu: { degree?: string; fieldOfStudy?: string; description?: string }) => {
            if (edu.degree) extractWords(edu.degree);
            if (edu.fieldOfStudy) extractWords(edu.fieldOfStudy);
            if (edu.description) extractWords(edu.description); // Include education description
          },
        );
      }

      // Languages
      if (resume.languages && Array.isArray(resume.languages)) {
        resume.languages.forEach((lang: { name?: string }) => {
          if (lang.name) {
            addKeyword(lang.name);
          }
        });
      }

      this.logger.debug(
        `extractResumeKeywords: Extracted ${keywords.size} keywords: ${[...keywords].slice(0, 20).join(', ')}...`,
      );
      return keywords;
    } catch (error) {
      this.logger.warn('Failed to parse resume text for keyword extraction', error as Error);
      return keywords;
    }
  }

  /**
   * Match extracted keywords against profile
   * Handles both string[] (old format) and {keyword, source}[] (new format with metadata)
   */
  private matchKeywords(
    keywords: any,
    profileKeywords: Set<string>,
  ): { matchedKeywords: any[]; missingKeywords: any[] } {
    const matched: any[] = [];
    const missing: any[] = [];

    const checkKeyword = (kwInput: string | any, category: string) => {
      // Handle both string and object formats
      let keywordText: string;
      let precomputedSource: string | undefined;

      if (typeof kwInput === 'string') {
        keywordText = kwInput;
        precomputedSource = undefined;
      } else {
        keywordText = kwInput.keyword;
        precomputedSource = kwInput.source; // 'job', 'profile', or 'both'
      }

      const normalized = keywordText.toLowerCase().trim();

      // If we have precomputed source from matchKeywordsAgainstProfile, use it
      let found: boolean;
      let confidence: number;

      if (precomputedSource === 'both' || precomputedSource === 'profile') {
        // Keyword was already matched against profile during generation
        found = true;
        confidence = 1.0;
      } else {
        // For 'job' source or legacy path: compute match dynamically
        // This allows detecting keywords added to resume AFTER initial generation

        // Strategy 1: Exact match (case-insensitive)
        found = profileKeywords.has(normalized);
        confidence = 1.0;

        // Strategy 2: Partial match with word boundaries (e.g., "React" in "React.js")
        if (!found) {
          const wordPattern = new RegExp(`\\b${this.escapeRegex(normalized)}\\b`, 'i');
          found = [...profileKeywords].some((pk) => wordPattern.test(pk));
          confidence = 0.9;
        }

        // Strategy 3: Fuzzy match for common variations (e.g., "TypeScript" vs "Typescript")
        if (!found) {
          const withoutSpaces = normalized.replace(/[\s\-_.]/g, '');
          found = [...profileKeywords].some((pk) => {
            const pkNormalized = pk.toLowerCase().replace(/[\s\-_.]/g, '');
            return pkNormalized === withoutSpaces;
          });
          confidence = 0.85;
        }

        // Strategy 4: Substring match (avoid false positives with very short keywords)
        // Check if either keyword contains the other (e.g., "C++" matches "C++17/20")
        if (!found && (normalized.length > 2 || [...profileKeywords].some((pk) => pk.length > 2))) {
          found = [...profileKeywords].some((pk) => {
            // Check bidirectional: job keyword contains resume keyword OR vice versa
            // e.g., "c++17/20" contains "c++" OR "c++" is in "c++17/20"
            return pk.includes(normalized) || normalized.includes(pk);
          });
          confidence = 0.7;
        }
      }

      const match = {
        keyword: keywordText,
        category,
        found,
        confidence: found ? confidence : 0,
        usedIn: found ? ['profile'] : [],
      };

      if (found) {
        matched.push(match);
      } else {
        missing.push(match);
      }
    };

    // Check all keyword categories (support both old and new field names)
    // OLD format: technicalSkills, toolsAndTechnologies, etc.
    // NEW format: coreCompetencies, softSkills
    (keywords.technicalSkills || keywords.coreCompetencies || []).forEach((k: any) =>
      checkKeyword(k, 'technical'),
    );
    keywords.softSkills?.forEach((k: any) => checkKeyword(k, 'soft'));
    (keywords.toolsAndTechnologies || []).forEach((k: any) => checkKeyword(k, 'tool'));
    (keywords.industryKeywords || []).forEach((k: any) => checkKeyword(k, 'industry'));
    (keywords.senioritySignals || []).forEach((k: any) => checkKeyword(k, 'seniority'));
    (keywords.requirementKeywords || []).forEach((k: any) => checkKeyword(k, 'requirement'));
    (keywords.responsibilityKeywords || []).forEach((k: any) => checkKeyword(k, 'responsibility'));
    (keywords.methodologies || []).forEach((k: any) => checkKeyword(k, 'methodology'));

    return { matchedKeywords: matched, missingKeywords: missing };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate match analysis from matched/missing keywords
   */
  private calculateMatchAnalysis(
    matchedKeywords: any[],
    missingKeywords: any[],
    keywords: any,
  ): any {
    // Support both old and new field names for counting totals
    // Only count hard skills (technical) - soft skills removed
    const totalTechnical =
      (keywords.technicalSkills?.length || 0) +
      (keywords.toolsAndTechnologies?.length || 0) +
      (keywords.coreCompetencies?.length || 0); // NEW format
    const totalExperience =
      (keywords.senioritySignals?.length || 0) + (keywords.requirementKeywords?.length || 0);
    const totalIndustry = keywords.industryKeywords?.length || 0;

    // Count matched keywords by category (support both 'technical' and 'core')
    const matchedTechnical = matchedKeywords.filter(
      (k) =>
        k.category === 'core' ||
        k.category === 'methodology' ||
        k.category === 'technical' || // NEW format uses 'technical'
        k.category === 'tool',
    ).length;
    const matchedExperience = matchedKeywords.filter(
      (k) => k.category === 'seniority' || k.category === 'requirement',
    ).length;
    const matchedIndustry = matchedKeywords.filter((k) => k.category === 'industry').length;

    const technicalScore =
      totalTechnical > 0 ? Math.round((matchedTechnical / totalTechnical) * 100) : 0;
    const experienceScore =
      totalExperience > 0 ? Math.round((matchedExperience / totalExperience) * 100) : 0;
    const industryScore =
      totalIndustry > 0 ? Math.round((matchedIndustry / totalIndustry) * 100) : 0;

    // Overall score is now 100% based on technical score (hard skills only)
    // No more soft skills weighting
    const overallScore = technicalScore;

    const suggestions: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (technicalScore >= 70) {
      strengths.push('Gute Übereinstimmung bei Kernkompetenzen');
    } else if (technicalScore < 50) {
      const missingCore = missingKeywords
        .filter(
          (k) =>
            k.category === 'core' || k.category === 'methodology' || k.category === 'technical',
        )
        .slice(0, 3)
        .map((k) => k.keyword);
      if (missingCore.length > 0) {
        suggestions.push(
          `Relevante Qualifikationen könnten ergänzt werden: ${missingCore.join(', ')}`,
        );
        weaknesses.push('Einige Kernkompetenzen nicht gefunden');
      }
    }

    if (experienceScore >= 70) {
      strengths.push('Berufserfahrung entspricht den Anforderungen');
    }

    if (overallScore >= 75) {
      strengths.push('Profil passt gut zur Stellenausschreibung');
    } else if (overallScore < 50) {
      suggestions.push('Das Profil könnte detaillierter auf die Stelle zugeschnitten werden');
    }

    return {
      overallScore,
      categoryScores: {
        core: technicalScore,
        soft: 0, // Soft skills no longer extracted
        experience: experienceScore,
        industry: industryScore,
      },
      suggestions,
      strengths,
      weaknesses,
    };
  }
}
