import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from '../../pdf/pdf.service';
import { StorageService } from '../../storage/storage.service';
import { Job } from '../interfaces/queue.interface';
import type { ResumeTemplateData } from '../../pdf/template-renderer.service';

export interface ApplicationJobData {
  applicationId: string;
  userId: string;
  jobPostingId: string;
}

@Injectable()
export class ApplicationProcessor {
  private readonly logger = new Logger(ApplicationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async process(job: Job<ApplicationJobData>): Promise<void> {
    const { applicationId, userId, jobPostingId } = job.data;

    this.logger.log(`Processing application ${applicationId}`);

    try {
      // 1. Load current application state
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          jobPosting: true,
          user: true,
        },
      });

      if (!application || !application.jobPosting) {
        throw new Error('Application or job posting not found');
      }

      if (!application.resumeText) {
        throw new Error('Resume not provided');
      }

      // Cover letter is optional - user may have opted out during creation
      const hasCoverLetter = !!application.coverLetterText;
      if (!hasCoverLetter) {
        this.logger.log(`Application ${applicationId} has no cover letter - generating resume only`);
      }

      let resumeData: ResumeTemplateData;
      try {
        resumeData = JSON.parse(application.resumeText);
      } catch (error) {
        this.logger.error('Failed to parse resume JSON for application', error as Error);
        throw new Error('Stored resume data is invalid');
      }

      // 2. Convert to PDFs
      this.logger.log('Converting HTML templates to PDFs...');

      let coverLetterKey: string | null = null;
      
      // Only generate cover letter PDF if content exists
      if (hasCoverLetter) {
        const coverLetterTemplateData = {
          candidateName: resumeData.candidateName,
          email: resumeData.email || application.user.email,
          phone: resumeData.phone,
          linkedin: resumeData.linkedin,
          github: resumeData.github,
          location: resumeData.location,
          companyName: application.jobPosting.company,
          content: application.coverLetterText!, // Non-null assertion: hasCoverLetter ensures this is defined
        };

        // Always use ATS-optimized format for better parsing by applicant tracking systems
        const coverLetterPdf = await this.pdfService.generateCoverLetterPDF(
          coverLetterTemplateData,
          application.coverLetterTemplateId || undefined,
          { atsOptimized: true },
        );

        // Upload cover letter to storage
        coverLetterKey = await this.storageService.upload(
          `applications/${applicationId}/cover-letter.pdf`,
          coverLetterPdf,
          'application/pdf',
        );
      }

      // Always generate resume PDF with ATS optimization
      const resumePdf = await this.pdfService.generateResumePDF(
        resumeData,
        application.resumeTemplateId || undefined,
        { atsOptimized: true },
      );

      // 3. Upload resume to Storage
      this.logger.log('Uploading to storage...');
      const resumeKey = await this.storageService.upload(
        `applications/${applicationId}/resume.pdf`,
        resumePdf,
        'application/pdf',
      );

      // 4. Update Application with results
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: 'READY',
          coverLetterFileKey: coverLetterKey,
          resumeFileKey: resumeKey,
        },
      });

      this.logger.log(`Application ${applicationId} completed successfully (coverLetter: ${hasCoverLetter})`);
    } catch (error) {
      this.logger.error(`Application ${applicationId} failed: ${error.message}`, error.stack);

      // Update application status to FAILED
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      throw error; // Re-throw for retry logic
    }
  }
}
