import { Injectable, Logger, BadRequestException } from '@nestjs/common';

// pdf-parse has a non-standard module export, so we use require

const pdfParse = require('pdf-parse');

@Injectable()
export class PdfParser {
  private readonly logger = new Logger(PdfParser.name);

  /**
   * Parse PDF file and extract text
   * @param buffer PDF file buffer
   * @returns Extracted text content
   */
  async parse(buffer: Buffer): Promise<string> {
    try {
      this.logger.log(`Parsing PDF file (${buffer.length} bytes)`);

      const data = await pdfParse(buffer);
      const text = data.text.trim();

      if (!text || text.length < 50) {
        throw new BadRequestException('Could not extract meaningful text from PDF');
      }

      this.logger.log(
        `Successfully extracted ${text.length} characters from PDF (${data.numpages} pages)`,
      );
      return text;
    } catch (error) {
      this.logger.error(`Failed to parse PDF: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Failed to parse PDF: ${error.message}`);
    }
  }
}
