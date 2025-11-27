import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_TITLE_MAX_LENGTH, ELLIPSIS_LENGTH } from './constants';

export interface JobPostingForTitle {
  title: string;
  company: string;
  location?: string | null;
}

/**
 * Service for generating concise application titles.
 * Uses simple deterministic format: "[Job Title] @ [Company]"
 */
@Injectable()
export class TitleGeneratorService {
  private readonly logger = new Logger(TitleGeneratorService.name);

  /**
   * Generate a concise application title.
   * Format: "[Job Title] @ [Company]"
   */
  generateTitle(jobPosting: JobPostingForTitle): string {
    const title = jobPosting.title || 'Position';
    const company = jobPosting.company || 'Unknown Company';
    const result = `${title} @ ${company}`;

    // Truncate if too long (reserve space for ellipsis)
    const truncateAt = APPLICATION_TITLE_MAX_LENGTH - ELLIPSIS_LENGTH;
    const finalTitle =
      result.length > APPLICATION_TITLE_MAX_LENGTH
        ? result.substring(0, truncateAt) + '...'
        : result;

    this.logger.debug(`Generated title: ${finalTitle}`);
    return finalTitle;
  }
}
