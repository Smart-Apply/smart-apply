import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../../llm/llm.service';
import { PdfService } from '../../pdf/pdf.service';
import { StorageService } from '../../storage/storage.service';
import { Job } from '../interfaces/queue.interface';

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
    private readonly llmService: LLMService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async process(job: Job<ApplicationJobData>): Promise<void> {
    const { applicationId, userId, jobPostingId } = job.data;

    this.logger.log(`Processing application ${applicationId}`);

    try {
      // 1. Update application status to GENERATING
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { status: 'GENERATING' },
      });

      // 2. Load Profile and JobPosting
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        include: {
          user: true,
          skills: true,
          certificates: true,
          experiences: true,
          projects: true,
        },
      });

      const jobPosting = await this.prisma.jobPosting.findUnique({
        where: { id: jobPostingId },
      });

      if (!profile || !jobPosting) {
        throw new Error('Profile or JobPosting not found');
      }

      // 3. Prepare context for LLM
      const candidateName = profile.user.fullName || 'Candidate';
      const skills = profile.skills.map((s) => s.name).join(', ');
      const experiences = profile.experiences
        .map(
          (e) =>
            `${e.title} at ${e.company} (${e.startDate.toLocaleDateString()} - ${e.endDate ? e.endDate.toLocaleDateString() : 'Present'})`,
        )
        .join('\n');
      const certificates = profile.certificates
        .map((c) => `${c.name} by ${c.issuer}`)
        .join(', ');
      const projects = profile.projects
        .map((p) => `${p.name}: ${p.description || ''}`)
        .join('\n');

      // 4. Generate Cover Letter
      this.logger.log('Generating cover letter...');
      const coverLetterText = await this.llmService.generateCoverLetter({
        candidateName,
        jobTitle: jobPosting.title,
        companyName: jobPosting.company,
        skills,
        experiences,
        motivation: profile.summary || '',
      });

      // 5. Generate Resume
      this.logger.log('Generating resume...');
      const resumeText = await this.llmService.generateResume({
        candidateName,
        contactInfo: `${profile.phone || ''} | ${profile.location || ''} | ${profile.linkedinUrl || ''}`,
        summary: profile.summary || '',
        skills,
        experiences,
        education: '', // TODO: Add education model
        certificates,
        projects,
      });

      // 6. Convert to PDFs
      this.logger.log('Converting to PDFs...');
      const coverLetterPdf = await this.pdfService.generatePDF(
        coverLetterText,
        { template: 'cover-letter' },
      );
      const resumePdf = await this.pdfService.generatePDF(resumeText, {
        template: 'resume',
      });

      // 7. Upload to Storage
      this.logger.log('Uploading to storage...');
      const coverLetterKey = await this.storageService.upload(
        `applications/${applicationId}/cover-letter.pdf`,
        coverLetterPdf,
        'application/pdf',
      );
      const resumeKey = await this.storageService.upload(
        `applications/${applicationId}/resume.pdf`,
        resumePdf,
        'application/pdf',
      );

      // 8. Update Application with results
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: 'READY',
          coverLetterText,
          resumeText,
          coverLetterFileKey: coverLetterKey,
          resumeFileKey: resumeKey,
        },
      });

      this.logger.log(`Application ${applicationId} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Application ${applicationId} failed: ${error.message}`,
        error.stack,
      );

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
