import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfService } from '../../pdf/pdf.service';
import { StorageService } from '../../storage/storage.service';
import { TemplatesService } from '../../templates/templates.service';
import { Job } from '../interfaces/queue.interface';
import type { ResumeTemplateData } from '../../pdf-v2/template-data';

export interface ApplicationJobData {
  applicationId: string;
  userId: string;
  jobPostingId: string;
  language?: 'de' | 'en' | 'fr' | 'es' | 'it';
}

@Injectable()
export class ApplicationProcessor {
  private readonly logger = new Logger(ApplicationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
    private readonly templatesService: TemplatesService,
  ) {}

  async process(job: Job<ApplicationJobData>): Promise<void> {
    const { applicationId, userId: _userId, jobPostingId: _jobPostingId, language } = job.data;

    this.logger.log(
      `Processing application ${applicationId} with language: ${language || 'default'}`,
    );

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
        this.logger.log(
          `Application ${applicationId} has no cover letter - generating resume only`,
        );
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
        // Resolve template ID to match selected language
        let coverLetterTemplateId = application.coverLetterTemplateId;
        if (language && coverLetterTemplateId) {
          coverLetterTemplateId = await this.resolveTemplateForLanguage(
            coverLetterTemplateId,
            language,
            'COVER_LETTER',
          );
        }

        const coverLetterTemplateData = {
          candidateName: resumeData.candidateName,
          targetJobTitle: application.targetJobTitle || application.jobPosting.title,
          email: resumeData.email || application.user.email,
          phone: resumeData.phone,
          linkedin: resumeData.linkedin,
          github: resumeData.github,
          // Address fields
          street: resumeData.street,
          postalCode: resumeData.postalCode,
          city: resumeData.city,
          country: resumeData.country,
          fullAddress: resumeData.fullAddress,
          companyName: application.jobPosting.company,
          content: application.coverLetterText!, // Non-null assertion: hasCoverLetter ensures this is defined
          language: language || 'en', // Use selected language from export request
        };

        // Generate cover letter PDF using database template (which are already ATS-optimized)
        const coverLetterPdf = await this.pdfService.generateCoverLetterPDF(
          coverLetterTemplateData,
          coverLetterTemplateId || undefined,
          { atsOptimized: false }, // Use DB template instead of filesystem template
        );

        // Upload cover letter to storage
        coverLetterKey = await this.storageService.upload(
          `applications/${applicationId}/cover-letter.pdf`,
          coverLetterPdf,
          'application/pdf',
        );
      }

      // Resolve template ID to match selected language
      let resumeTemplateId = application.resumeTemplateId;
      if (language && resumeTemplateId) {
        resumeTemplateId = await this.resolveTemplateForLanguage(
          resumeTemplateId,
          language,
          'RESUME',
        );
      }

      // Add selected language and target job title to resume data
      const resumeDataWithLanguage = {
        ...resumeData,
        targetJobTitle: application.targetJobTitle || application.jobPosting.title,
        language: language || 'en', // Use selected language from export request
      };

      // Generate resume PDF using database template (which are already ATS-optimized)
      const resumePdf = await this.pdfService.generateResumePDF(
        resumeDataWithLanguage,
        resumeTemplateId || undefined,
        { atsOptimized: false }, // Use DB template instead of filesystem template
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

      this.logger.log(
        `Application ${applicationId} completed successfully (coverLetter: ${hasCoverLetter})`,
      );
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

  /**
   * Resolve template ID to language-specific variant
   */
  private async resolveTemplateForLanguage(
    templateId: string,
    language: string,
    type: 'COVER_LETTER' | 'RESUME',
  ): Promise<string | null> {
    try {
      // Get the selected template to find its category
      const selectedTemplate = await this.prisma.template.findUnique({
        where: { id: templateId },
        select: { category: true, language: true },
      });

      if (!selectedTemplate) {
        this.logger.warn(`Template ${templateId} not found, keeping original`);
        return templateId;
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
        type,
      );

      if (languageVariant) {
        this.logger.log(
          `Resolved template ${templateId} (${selectedTemplate.category}) to ${languageVariant.id} for language ${language}`,
        );
        return languageVariant.id;
      }

      // Fallback: keep original template
      this.logger.warn(
        `No ${language} variant found for ${selectedTemplate.category}, keeping original`,
      );
      return templateId;
    } catch (error) {
      this.logger.error(`Failed to resolve template: ${error.message}`);
      return templateId; // Fallback to original
    }
  }
}
