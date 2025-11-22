import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Application } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { JobType } from '../jobs/interfaces/queue.interface';
import { LLMService } from '../llm/llm.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto, ApplicationStatus } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';
import { ApplicationStatusResponseDto } from './dto/application-status-response.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CoverLetterDto } from './dto/cover-letter.dto';
import { buildResumeTemplateData, ProfileWithRelations } from './resume-template.util';
import { sanitizeRichText } from '../common/services/html-sanitizer';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService,
    private readonly llmService: LLMService,
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
      },
    });

    if (!profile) {
      throw new BadRequestException('Bitte vervollständige dein Profil, bevor du fortfährst');
    }

    return profile;
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

  private ensureNotGenerating(application: Application) {
    if (application.status === ApplicationStatus.GENERATING) {
      throw new BadRequestException('Dokumente werden aktuell erstellt. Bitte warte einen Moment.');
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
    const resumeTemplate = buildResumeTemplateData(profile);

    // 3. Create application record (no automatic generation yet)
    const application = await this.prisma.application.create({
      data: {
        userId,
        jobPostingId: dto.jobPostingId,
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

    // 1. Verify job posting exists
    const jobPosting = await this.prisma.jobPosting.findUnique({
      where: { id: dto.jobPostingId },
    });

    if (!jobPosting) {
      throw new NotFoundException(`Job posting with ID ${dto.jobPostingId} not found`);
    }

    // 2. Get profile data
    const profile = await this.getProfileWithRelations(userId);
    const resumeTemplate = buildResumeTemplateData(profile);

    // 3. Generate cover letter with LLM
    this.logger.log('Generating cover letter with LLM');
    const coverLetterContext = this.buildCoverLetterContext(resumeTemplate, jobPosting);
    const coverLetterContent = await this.llmService.generateCoverLetter(coverLetterContext);
    const sanitizedCoverLetter = this.sanitizeCoverLetter(coverLetterContent);

    // 4. Create application with generated content (status: READY for editing)
    const application = await this.prisma.application.create({
      data: {
        userId,
        jobPostingId: dto.jobPostingId,
        status: ApplicationStatus.READY,
        notes: dto.notes,
        resumeText: JSON.stringify(resumeTemplate),
        coverLetterText: sanitizedCoverLetter,
      },
      include: {
        jobPosting: true,
      },
    });

    this.logger.log(`Application ${application.id} created with generated content`);
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
    if (!content || dto.regenerate) {
      const context = this.buildCoverLetterContext(resume, jobPosting, dto.instructions);
      content = await this.llmService.generateCoverLetter(context);
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

    if (!application.coverLetterText) {
      throw new BadRequestException(
        'Anschreiben fehlt. Bitte generiere oder speichere ein Anschreiben.',
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
      status: application.status as ApplicationStatus,
      notes: application.notes,
      coverLetterText: application.coverLetterText,
      resumeText: application.resumeText,
      coverLetterFileKey: application.coverLetterFileKey,
      resumeFileKey: application.resumeFileKey,
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
}
