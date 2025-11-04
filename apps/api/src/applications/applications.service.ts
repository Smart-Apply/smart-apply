import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { JobType } from '../jobs/interfaces/queue.interface';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationResponseDto, ApplicationStatus } from './dto/application-response.dto';
import { ApplicationFilesResponseDto } from './dto/application-files-response.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService,
  ) {}

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

    // 2. Verify user has a profile
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException('Please complete your profile before creating an application');
    }

    // 3. Create application record
    const application = await this.prisma.application.create({
      data: {
        userId,
        jobPostingId: dto.jobPostingId,
        status: 'PENDING',
        notes: dto.notes,
      },
      include: {
        jobPosting: true,
      },
    });

    // 4. Publish job to queue (async processing)
    try {
      await this.jobsService.publishJob(JobType.APPLICATION_GENERATE, {
        applicationId: application.id,
        userId,
        jobPostingId: dto.jobPostingId,
      });

      this.logger.log(`Application ${application.id} queued for processing`);
    } catch (error) {
      this.logger.error(
        `Failed to queue application ${application.id}: ${error.message}`,
        error.stack,
      );

      // Update application status to FAILED
      await this.prisma.application.update({
        where: { id: application.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue application for processing',
        },
      });

      throw new BadRequestException('Failed to create application. Please try again.');
    }

    return this.mapToResponseDto(application);
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
