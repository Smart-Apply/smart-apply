import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  MessageEvent,
} from '@nestjs/common';
import type { Application } from '@prisma/client';
import { ApplicationTrackingStatus } from '@prisma/client';
import { Observable, interval } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { JobType } from '../jobs/interfaces/queue.interface';
import { LLMService, KeywordMatch } from '../llm/llm.service';
import { TitleGeneratorService } from './title-generator.service';
import { KeywordsService } from '../keywords/keywords.service';
import { TemplatesService } from '../templates/templates.service';
import { ATSAgentOutput } from '../agents/agents.interface';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto, ApplicationStatus } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';
import { ApplicationStatusResponseDto } from './dto/application-status-response.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CoverLetterDto } from './dto/cover-letter.dto';
import { ApplicationKeywordsResponseDto } from './dto/application-keywords.dto';
import { buildResumeTemplateData, ProfileWithRelations } from './resume-template.util';
import { sanitizeRichText } from '../common/services/html-sanitizer';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);
  
  // In-memory cache for skill categorization (keyed by sorted skill names)
  private readonly skillCategorizationCache = new Map<string, { type: string; skills: string[] }[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService,
    private readonly llmService: LLMService,
    private readonly titleGenerator: TitleGeneratorService,
    private readonly keywordsService: KeywordsService,
    private readonly templatesService: TemplatesService,
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
      throw new BadRequestException('Bitte vervollständige dein Profil, bevor du fortfährst');
    }

    return profile;
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
        if (title.includes('software') || title.includes('developer') || title.includes('engineer')) {
          industry = 'IT/Software Development';
        } else if (title.includes('marketing') || title.includes('content')) {
          industry = 'Marketing';
        } else if (title.includes('sales') || title.includes('business development')) {
          industry = 'Sales';
        } else if (title.includes('finance') || title.includes('analyst')) {
          industry = 'Finance';
        } else if (title.includes('nurse') || title.includes('doctor') || title.includes('healthcare')) {
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
    return sanitizeRichText(content);
  }

  private parseResume(resumeText?: string | null) {
    if (!resumeText) {
      return null;
    }

    try {
      return JSON.parse(resumeText);
    } catch (error) {
      this.logger.error('Failed to parse stored resume JSON', error as Error);
      throw new BadRequestException(
        'Gespeicherter Lebenslauf ist beschädigt. Bitte aktualisieren.',
      );
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
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
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
      linkedin: trim(resume.linkedin),
      github: trim(resume.github),
      summary: trim(resume.summary),
      skillCategories: (resume.skillCategories || [])
        .map((category) => ({
          type: category.type.trim(),
          skills: (category.skills || []).map((skill) => skill.trim()).filter(Boolean),
        }))
        .filter((category) => category.type && category.skills.length),
      experiences: (resume.experiences || []).map((experience) => ({
        title: experience.title.trim(),
        company: experience.company.trim(),
        location: trim(experience.location),
        dateRange: experience.dateRange.trim(),
        achievements: (experience.achievements || []).map((item) => item.trim()).filter(Boolean),
      })),
      projects: (resume.projects || []).map((project) => ({
        name: project.name.trim(),
        description: trim(project.description),
        date: trim(project.date),
        highlights: (project.highlights || []).map((item) => item.trim()).filter(Boolean),
      })),
      education: (resume.education || []).map((edu) => ({
        degree: edu.degree.trim(),
        institution: edu.institution.trim(),
        year: edu.year.trim(),
        fieldOfStudy: trim(edu.fieldOfStudy),
        gpa: trim(edu.gpa),
        description: trim(edu.description),
      })),
      certifications: (resume.certifications || []).map((cert) => ({
        name: cert.name.trim(),
        issuer: cert.issuer.trim(),
        date: trim(cert.date),
      })),
      languages: (resume.languages || [])
        .map((lang) => ({
          name: lang.name.trim(),
          level: lang.level?.trim(),
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
    // Detect language from job posting
    const detectedLanguage = jobPosting.language || 
      (jobPosting.fullText ? this.detectLanguage(jobPosting.fullText) : null) || 
      'en';
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
    // Detect language from job posting
    const detectedLanguage = jobPosting.language || 
      (jobPosting.fullText ? this.detectLanguage(jobPosting.fullText) : null) || 
      'en';

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

    // Check all keyword categories from ATSAgentOutput
    keywords.technicalSkills.forEach((k) => checkKeyword(k, 'technical'));
    keywords.softSkills.forEach((k) => checkKeyword(k, 'soft'));
    keywords.toolsAndTechnologies.forEach((k) => checkKeyword(k, 'tool'));
    keywords.industryKeywords.forEach((k) => checkKeyword(k, 'industry'));
    keywords.senioritySignals.forEach((k) => checkKeyword(k, 'seniority'));
    keywords.requirementKeywords.forEach((k) => checkKeyword(k, 'requirement'));

    return { matchedKeywords: matched, missingKeywords: missing };
  }

  private ensureNotGenerating(application: Application) {
    if (application.status === ApplicationStatus.GENERATING) {
      throw new BadRequestException('Dokumente werden aktuell erstellt. Bitte warte einen Moment.');
    }
  }

  /**
   * Detect language from job posting text using simple heuristics
   * Returns 'de' for German, 'en' for English, or null if undetermined
   */
  private detectLanguage(text: string): 'de' | 'en' | null {
    const lowercase = text.toLowerCase();

    // Common German words (excluding ones that overlap with English)
    const germanWords = ['und', 'für', 'mit', 'von', 'bei', 'wir', 'sie', 'ihre', 'unser', 'durch', 'über', 'zum'];
    const englishWords = ['and', 'for', 'with', 'from', 'at', 'we', 'you', 'your', 'our', 'through', 'about', 'the'];

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

    // 2. Prefill resume data from profile
    const profile = await this.getProfileWithRelations(userId);
    
    // 2.1. Intelligently categorize skills using LLM
    const skillCategories = await this.categorizeSkillsWithLLM(profile);
    const resumeTemplate = buildResumeTemplateData(profile, skillCategories);

    // 2.2. Detect language from job posting for multilingual templates
    const detectedLanguage = jobPosting.language || this.detectLanguage(jobPosting.fullText) || 'en';
    resumeTemplate.language = detectedLanguage;

    // 2.3. Translate summary if job language differs from profile language (assume profile is in German)
    const profileLanguage = 'de'; // Assume profile is written in German
    if (resumeTemplate.summary && detectedLanguage !== profileLanguage) {
      this.logger.log(`Translating summary from ${profileLanguage} to ${detectedLanguage}`);
      try {
        resumeTemplate.summary = await this.llmService.translateSummary(
          resumeTemplate.summary,
          profileLanguage,
          detectedLanguage,
        );
      } catch (error) {
        this.logger.warn('Failed to translate summary, using original', error as Error);
      }
    }

    // 3. Generate title for application
    const title = await this.titleGenerator.generateTitle(jobPosting);

    // 4. Create application record (no automatic generation yet)
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
  }

  /**
   * Create application with immediate LLM generation (resume + cover letter)
   */
  async createWithGeneration(
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Creating application with immediate generation for user ${userId}`);

    // Check if cover letter should be generated (default: true)
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
    
    // 2.1. Intelligently categorize skills using LLM
    const skillCategories = await this.categorizeSkillsWithLLM(profile);
    const resumeTemplate = buildResumeTemplateData(profile, skillCategories);

    // 2.2. Detect language from job posting for multilingual templates
    const detectedLanguage = jobPosting.language || this.detectLanguage(jobPosting.fullText) || 'en';
    resumeTemplate.language = detectedLanguage;

    // 2.3. Translate summary if job language differs from profile language (assume profile is in German)
    const profileLanguage = 'de'; // Assume profile is written in German
    if (resumeTemplate.summary && detectedLanguage !== profileLanguage) {
      this.logger.log(`Translating summary from ${profileLanguage} to ${detectedLanguage}`);
      try {
        resumeTemplate.summary = await this.llmService.translateSummary(
          resumeTemplate.summary,
          profileLanguage,
          detectedLanguage,
        );
      } catch (error) {
        this.logger.warn('Failed to translate summary, using original', error as Error);
      }
    }

    // 3. Generate title for application
    const title = await this.titleGenerator.generateTitle(jobPosting);

    // 4. Extract keywords for ATS-optimized generation
    const profileKeywords = this.extractProfileKeywords(profile);
    const { matchedKeywords, missingKeywords } = await this.getKeywordsForGeneration(
      jobPosting,
      profileKeywords,
    );

    this.logger.log(
      `Keyword analysis: ${matchedKeywords.length} matched, ${missingKeywords.length} missing`,
    );

    // 5. Generate cover letter with LLM (only if requested)
    let sanitizedCoverLetter: string | null = null;
    if (shouldGenerateCoverLetter) {
      // Use ATS-optimized generation if we have keywords
      if (matchedKeywords.length > 0 || missingKeywords.length > 0) {
        this.logger.log('Generating ATS-optimized cover letter with keyword placement');
        const atsContext = this.buildATSCoverLetterContext(
          resumeTemplate,
          jobPosting,
          matchedKeywords,
          missingKeywords,
        );
        const coverLetterContent = await this.llmService.generateCoverLetterATS(atsContext);
        sanitizedCoverLetter = this.sanitizeCoverLetter(coverLetterContent);
      } else {
        // Fallback to standard generation
        this.logger.log('Generating cover letter with standard LLM (no keywords available)');
        const coverLetterContext = this.buildCoverLetterContext(resumeTemplate, jobPosting);
        const coverLetterContent = await this.llmService.generateCoverLetter(coverLetterContext);
        sanitizedCoverLetter = this.sanitizeCoverLetter(coverLetterContent);
      }
    } else {
      this.logger.log('Skipping cover letter generation (user opted out)');
    }

    // 6. Resolve templates to match detected language
    const resolvedResumeTemplateId = await this.resolveTemplateForLanguage(
      dto.resumeTemplateId,
      detectedLanguage,
      'RESUME',
    );
    const resolvedCoverLetterTemplateId = shouldGenerateCoverLetter
      ? await this.resolveTemplateForLanguage(dto.coverLetterTemplateId, detectedLanguage, 'COVER_LETTER')
      : null;

    // 7. Create application with generated content (status: READY for editing)
    const application = await this.prisma.application.create({
      data: {
        userId,
        jobPostingId: dto.jobPostingId,
        title,
        applicationStatus: ApplicationTrackingStatus.CREATED,
        status: ApplicationStatus.READY,
        notes: dto.notes,
        resumeText: JSON.stringify(resumeTemplate),
        coverLetterText: sanitizedCoverLetter,
        coverLetterTemplateId: resolvedCoverLetterTemplateId,
        resumeTemplateId: resolvedResumeTemplateId,
      },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(
      `Application ${application.id} created with generated content (coverLetter: ${shouldGenerateCoverLetter}, ATS-optimized: ${matchedKeywords.length > 0})`,
    );
    return this.mapToResponseDto(application);
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
      throw new BadRequestException('Bitte speichere zuerst deinen Lebenslauf.');
    }

    const jobPosting = application.jobPosting;
    if (!jobPosting) {
      throw new BadRequestException('Keine Stellenanzeige verknüpft.');
    }

    let content = dto.content;
    
    // If regenerate is true and instructions are provided, modify existing content
    if (dto.regenerate && dto.instructions && dto.content) {
      this.logger.log('Modifying cover letter with AI based on instructions');
      content = await this.llmService.modifyCoverLetterContent(
        dto.content,
        dto.instructions,
        {
          jobTitle: jobPosting.title,
          companyName: jobPosting.company || 'Unknown Company',
        },
      );
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
        // Keep existing status (READY), don't reset to PENDING
        // Keep existing PDFs, they'll be regenerated on next export
      },
      include: {
        jobPosting: true,
      },
    });

    return this.mapToResponseDto(updated);
  }

  async requestExport(userId: string, applicationId: string): Promise<ApplicationResponseDto> {
    this.logger.log(`Export requested for application ${applicationId}`);

    const application = await this.ensureApplicationOwnership(userId, applicationId, true);
    this.ensureNotGenerating(application);

    const resume = this.parseResume(application.resumeText);
    if (!resume) {
      throw new BadRequestException('Lebenslauf fehlt. Bitte speichere deine Änderungen.');
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
    });

    return this.mapToResponseDto(updated);
  }

  /**
   * Get a single application by ID
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
        jobPosting: includeJobPosting,
      },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
    }

    return this.mapToResponseDto(application);
  }

  /**
   * Get all applications for a user
   */
  async findAll(userId: string, includeJobPosting = false): Promise<ApplicationResponseDto[]> {
    const applications = await this.prisma.application.findMany({
      where: { userId },
      include: {
        jobPosting: includeJobPosting,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return applications.map((app) => this.mapToResponseDto(app));
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
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
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
    const expiresIn = 60 * 60; // 1 hour in seconds

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
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
    }

    if (application.status !== 'READY') {
      throw new BadRequestException(
        `Application is not ready. Current status: ${application.status}`,
      );
    }

    const fileKey =
      fileType === 'cover-letter' ? application.coverLetterFileKey : application.resumeFileKey;

    if (!fileKey) {
      throw new BadRequestException(`${fileType} file not found`);
    }

    // Get file from storage
    return this.storageService.getFile(fileKey);
  }

  /**
   * Delete an application and its associated files
   */
  async delete(userId: string, applicationId: string): Promise<void> {
    this.logger.log(`Deleting application ${applicationId} for user ${userId}`);

    // Find application (verify ownership)
    const application = await this.prisma.application.findFirst({
      where: {
        id: applicationId,
        userId,
      },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
    }

    await this.cleanupGeneratedFiles(application);

    // Delete application from database
    await this.prisma.application.delete({
      where: { id: applicationId },
    });

    this.logger.log(`Application ${applicationId} deleted successfully`);
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

    // Verify ownership
    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

    // Update status and timestamp
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        applicationStatus: status,
        statusUpdatedAt: new Date(),
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

    // Verify ownership
    const application = await this.ensureApplicationOwnership(userId, applicationId, true);

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
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
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
      applicationStatus: application.applicationStatus,
      statusUpdatedAt: application.statusUpdatedAt,
      status: application.status as ApplicationStatus,
      notes: application.notes,
      coverLetterText: application.coverLetterText,
      resumeText: application.resumeText,
      coverLetterFileKey: application.coverLetterFileKey,
      resumeFileKey: application.resumeFileKey,
      coverLetterTemplateId: application.coverLetterTemplateId,
      resumeTemplateId: application.resumeTemplateId,
      errorMessage: application.errorMessage,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
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
   * Polls the database every 2 seconds and streams updates until application reaches a final state
   * @param userId - User ID (for authorization)
   * @param applicationId - Application ID to stream status for
   * @returns Observable that emits SSE MessageEvents with status updates
   */
  async streamStatus(userId: string, applicationId: string): Promise<Observable<MessageEvent>> {
    // Verify application exists and belongs to user
    await this.ensureApplicationOwnership(userId, applicationId);

    this.logger.log(`SSE stream started for application ${applicationId} by user ${userId}`);

    // Create SSE stream that polls status every 2 seconds
    return interval(2000).pipe(
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
          throw new NotFoundException(`Application with ID ${applicationId} not found`);
        }

        this.logger.debug(`SSE emit: application ${applicationId} status=${application.status}`);
        return application;
      }),
      // Transform to SSE MessageEvent format
      map((application) => {
        const status = application.status;
        return {
          data: {
            id: application.id,
            status: status,
            updatedAt: application.updatedAt,
            errorMessage: application.errorMessage,
          },
        } as MessageEvent;
      }),
      // Stop streaming when status reaches a final state (READY or FAILED)
      // The `true` parameter ensures the final status is emitted before closing
      takeWhile((event: MessageEvent) => {
        const eventData = event.data as { status: ApplicationStatus };
        const status = eventData.status;
        const shouldContinue = status === 'PENDING' || status === 'GENERATING';

        if (!shouldContinue) {
          this.logger.log(
            `SSE stream closing for application ${applicationId} (final status: ${status})`,
          );
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

    // Check if we have cached keywords analysis
    if (application.keywordsData) {
      try {
        const cached = JSON.parse(application.keywordsData as string);
        return {
          applicationId,
          keywords: cached.keywords,
          matchAnalysis: cached.matchAnalysis,
          matchedKeywords: cached.matchedKeywords || [],
          missingKeywords: cached.missingKeywords || [],
          analyzedAt: cached.analyzedAt ? new Date(cached.analyzedAt) : new Date(),
        };
      } catch {
        this.logger.warn(`Failed to parse cached keywords for application ${applicationId}`);
      }
    }

    // No cached data, trigger new analysis
    return this.analyzeKeywords(userId, applicationId);
  }

  /**
   * Analyze keywords for an application using ATS Agent
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
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
    }

    if (!application.jobPosting) {
      throw new BadRequestException('Application has no associated job posting');
    }

    const jobPosting = application.jobPosting;

    // Extract keywords using ATS Agent (simplified with fullText)
    const keywords = await this.keywordsService.extractKeywords({
      title: jobPosting.title,
      company: jobPosting.company,
      location: jobPosting.location || undefined,
      language: jobPosting.language || undefined,
      fullText: jobPosting.fullText,
      rawText: jobPosting.rawText || undefined,
    });

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

      // Experience titles and achievements
      if (resume.experiences && Array.isArray(resume.experiences)) {
        resume.experiences.forEach(
          (exp: { title?: string; company?: string; achievements?: string[] }) => {
            if (exp.title) extractWords(exp.title);
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

      // Certifications
      if (resume.certifications && Array.isArray(resume.certifications)) {
        resume.certifications.forEach((cert: { name?: string; issuer?: string }) => {
          if (cert.name) extractWords(cert.name);
        });
      }

      // Education
      if (resume.education && Array.isArray(resume.education)) {
        resume.education.forEach((edu: { degree?: string; fieldOfStudy?: string }) => {
          if (edu.degree) extractWords(edu.degree);
          if (edu.fieldOfStudy) extractWords(edu.fieldOfStudy);
        });
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
   */
  private matchKeywords(
    keywords: any,
    profileKeywords: Set<string>,
  ): { matchedKeywords: any[]; missingKeywords: any[] } {
    const matched: any[] = [];
    const missing: any[] = [];

    const checkKeyword = (keyword: string, category: string) => {
      const normalized = keyword.toLowerCase();
      const found =
        profileKeywords.has(normalized) ||
        [...profileKeywords].some((pk) => pk.includes(normalized) || normalized.includes(pk));

      const match = {
        keyword,
        category,
        found,
        confidence: found ? 0.85 : 0,
        usedIn: found ? ['profile'] : [],
      };

      if (found) {
        matched.push(match);
      } else {
        missing.push(match);
      }
    };

    // Check all keyword categories
    keywords.technicalSkills?.forEach((k: string) => checkKeyword(k, 'technical'));
    keywords.softSkills?.forEach((k: string) => checkKeyword(k, 'soft'));
    keywords.toolsAndTechnologies?.forEach((k: string) => checkKeyword(k, 'tool'));
    keywords.industryKeywords?.forEach((k: string) => checkKeyword(k, 'industry'));
    keywords.senioritySignals?.forEach((k: string) => checkKeyword(k, 'seniority'));
    keywords.requirementKeywords?.forEach((k: string) => checkKeyword(k, 'requirement'));

    return { matchedKeywords: matched, missingKeywords: missing };
  }

  /**
   * Calculate match analysis from matched/missing keywords
   */
  private calculateMatchAnalysis(
    matchedKeywords: any[],
    missingKeywords: any[],
    keywords: any,
  ): any {
    const totalTechnical =
      (keywords.technicalSkills?.length || 0) + (keywords.toolsAndTechnologies?.length || 0);
    const totalSoft = keywords.softSkills?.length || 0;
    const totalExperience =
      (keywords.senioritySignals?.length || 0) + (keywords.requirementKeywords?.length || 0);
    const totalIndustry = keywords.industryKeywords?.length || 0;

    const matchedTechnical = matchedKeywords.filter(
      (k) => k.category === 'technical' || k.category === 'tool',
    ).length;
    const matchedSoft = matchedKeywords.filter((k) => k.category === 'soft').length;
    const matchedExperience = matchedKeywords.filter(
      (k) => k.category === 'seniority' || k.category === 'requirement',
    ).length;
    const matchedIndustry = matchedKeywords.filter((k) => k.category === 'industry').length;

    const technicalScore =
      totalTechnical > 0 ? Math.round((matchedTechnical / totalTechnical) * 100) : 0;
    const softScore = totalSoft > 0 ? Math.round((matchedSoft / totalSoft) * 100) : 0;
    const experienceScore =
      totalExperience > 0 ? Math.round((matchedExperience / totalExperience) * 100) : 0;
    const industryScore =
      totalIndustry > 0 ? Math.round((matchedIndustry / totalIndustry) * 100) : 0;

    // Weighted average
    const weights = { technical: 0.4, soft: 0.2, experience: 0.25, industry: 0.15 };
    const overallScore = Math.round(
      technicalScore * weights.technical +
        softScore * weights.soft +
        experienceScore * weights.experience +
        industryScore * weights.industry,
    );

    const suggestions: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (technicalScore >= 70) {
      strengths.push('Strong technical skill alignment');
    } else if (technicalScore < 50) {
      const missingTech = missingKeywords
        .filter((k) => k.category === 'technical' || k.category === 'tool')
        .slice(0, 3)
        .map((k) => k.keyword);
      if (missingTech.length > 0) {
        suggestions.push(`Consider adding: ${missingTech.join(', ')}`);
        weaknesses.push('Missing key technical skills');
      }
    }

    if (softScore >= 70) {
      strengths.push('Good soft skills match');
    }

    if (overallScore >= 75) {
      strengths.push('Profile well-aligned with job requirements');
    }

    return {
      overallScore,
      categoryScores: {
        technical: technicalScore,
        soft: softScore,
        experience: experienceScore,
        industry: industryScore,
      },
      suggestions,
      strengths,
      weaknesses,
    };
  }
}
