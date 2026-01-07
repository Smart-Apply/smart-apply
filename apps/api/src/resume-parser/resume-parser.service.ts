import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PdfParser } from '../job-postings/parsers/pdf.parser';
import { DocxParser } from '../job-postings/parsers/docx.parser';
import { LLMService } from '../llm/llm.service';
import { ExtractedProfileDto } from './dto/extracted-profile.dto';

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  constructor(
    private readonly pdfParser: PdfParser,
    private readonly docxParser: DocxParser,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Parse a resume file (PDF or DOCX) and extract structured profile data
   * @param buffer File buffer
   * @param mimeType MIME type of the file
   * @returns Extracted profile data
   */
  async parseResume(buffer: Buffer, mimeType: string): Promise<ExtractedProfileDto> {
    this.logger.log(`Parsing resume (${mimeType}, ${buffer.length} bytes)`);

    // Extract text based on file type
    let resumeText: string;

    if (mimeType === 'application/pdf') {
      resumeText = await this.pdfParser.parse(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      resumeText = await this.docxParser.parse(buffer);
    } else {
      throw new BadRequestException(
        `Unsupported file type: ${mimeType}. Please upload a PDF or DOCX file.`,
      );
    }

    this.logger.log(`Extracted ${resumeText.length} characters from resume`);
    
    // Debug: Log first 500 chars of extracted text
    this.logger.debug(`Resume text preview: ${resumeText.substring(0, 500)}...`);

    // Call LLM to extract structured data
    try {
      const extractedProfile = await this.llmService.callJson<ExtractedProfileDto>(
        'v1/extract-resume.md',
        { resumeText },
        {
          temperature: 0.3, // Lower temperature for more consistent extraction
          maxTokens: 4000,
          systemMessage:
            'You are an expert resume parser. Extract structured profile information from resume text accurately and completely. Return valid JSON only.',
        },
      );

      this.logger.log(
        `Successfully extracted profile data: ${JSON.stringify({
          firstName: extractedProfile.firstName,
          lastName: extractedProfile.lastName,
          skillsCount: extractedProfile.skills?.length || 0,
          experiencesCount: extractedProfile.experiences?.length || 0,
          educationCount: extractedProfile.education?.length || 0,
          certificatesCount: extractedProfile.certificates?.length || 0,
          projectsCount: extractedProfile.projects?.length || 0,
          languagesCount: extractedProfile.languages?.length || 0,
        })}`,
      );

      // Debug: Log the full extracted profile
      this.logger.debug(`Full extracted profile: ${JSON.stringify(extractedProfile, null, 2)}`);

      return extractedProfile;
    } catch (error) {
      this.logger.error(`Failed to extract profile from resume: ${error.message}`);
      throw new BadRequestException(
        'Could not extract profile information from resume. Please ensure the file contains readable text.',
      );
    }
  }
}
