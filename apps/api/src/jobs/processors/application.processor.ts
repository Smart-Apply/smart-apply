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
          education: true,
        },
      });

      const jobPosting = await this.prisma.jobPosting.findUnique({
        where: { id: jobPostingId },
      });

      if (!profile || !jobPosting) {
        throw new Error('Profile or JobPosting not found');
      }

      // 3. Prepare context for LLM
      const candidateName =
        [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ') || 'Candidate';
      const skills = profile.skills.map((s) => s.name).join(', ');
      const experiences = profile.experiences
        .map(
          (e) =>
            `${e.title} at ${e.company} (${e.startDate.toLocaleDateString()} - ${e.endDate ? e.endDate.toLocaleDateString() : 'Present'})`,
        )
        .join('\n');
      const certificates = profile.certificates.map((c) => `${c.name} by ${c.issuer}`).join(', ');
      const projects = profile.projects.map((p) => `${p.name}: ${p.description || ''}`).join('\n');

      // Format education entries with proper date handling
      const education = profile.education
        .map((e) => {
          const startYear = e.startYear ? new Date(e.startYear).getFullYear() : '';
          const endYear = e.endYear ? new Date(e.endYear).getFullYear() : 'Present';
          const yearRange = startYear ? `${startYear} - ${endYear}` : '';

          let educationLine = `${e.degree} at ${e.institution}`;
          if (e.fieldOfStudy) {
            educationLine += ` (${e.fieldOfStudy})`;
          }
          if (yearRange) {
            educationLine += ` - ${yearRange}`;
          }
          if (e.gpa) {
            educationLine += ` | GPA: ${e.gpa}`;
          }

          return educationLine;
        })
        .join('\n');

      // 4. Generate Cover Letter
      this.logger.log('Generating cover letter...');
      const coverLetterContent = await this.llmService.generateCoverLetter({
        candidateName,
        jobTitle: jobPosting.title,
        companyName: jobPosting.company,
        skills,
        experiences,
        motivation: profile.summary || '',
      });

      // 5. Generate Resume
      this.logger.log('Generating resume...');
      const resumeContent = await this.llmService.generateResume({
        candidateName,
        contactInfo: `${profile.phone || ''} | ${profile.location || ''} | ${profile.linkedinUrl || ''}`,
        summary: profile.summary || '',
        skills,
        experiences,
        education,
        certificates,
        projects,
      });

      // 6. Prepare structured data for PDF templates
      this.logger.log('Preparing structured data for PDFs...');

      // Cover letter template data
      const coverLetterData = {
        candidateName,
        email: profile.user.email,
        phone: profile.phone || undefined,
        linkedin: profile.linkedinUrl || undefined,
        github: profile.githubUrl || undefined,
        location: profile.location || undefined,
        companyName: jobPosting.company,
        content: coverLetterContent, // HTML from LLM
      };

      // Parse resume JSON from LLM (with fallback to plain text)
      let resumeData;
      try {
        // Try to parse as JSON first
        const resumeJson = JSON.parse(resumeContent);

        // Format education data for template
        const educationData = profile.education.map((e) => {
          const startYear = e.startYear ? new Date(e.startYear).getFullYear() : '';
          const endYear = e.endYear ? new Date(e.endYear).getFullYear() : 'Present';
          const yearRange = startYear ? `${startYear} - ${endYear}` : '';

          return {
            degree: e.degree,
            institution: e.institution,
            year: yearRange,
            fieldOfStudy: e.fieldOfStudy,
            gpa: e.gpa,
            description: e.description,
          };
        });

        resumeData = {
          candidateName,
          email: profile.user.email,
          phone: profile.phone || undefined,
          linkedin: profile.linkedinUrl || undefined,
          github: profile.githubUrl || undefined,
          location: profile.location || undefined,
          education: educationData, // Add structured education data
          ...resumeJson,
        };
      } catch (parseError) {
        // Fallback: treat as plain text/HTML and use legacy method
        this.logger.warn('Resume content is not JSON, falling back to legacy HTML rendering');
        resumeData = null;
      }

      // 7. Convert to PDFs
      this.logger.log('Converting to PDFs...');
      const coverLetterPdf = await this.pdfService.generateCoverLetterPDF(coverLetterData);

      const resumePdf = resumeData
        ? await this.pdfService.generateResumePDF(resumeData)
        : await this.pdfService.generatePDF(resumeContent, { template: 'resume' });

      // Store the generated text for reference
      const coverLetterText = coverLetterContent;
      const resumeText = resumeData ? JSON.stringify(resumeData) : resumeContent;

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
