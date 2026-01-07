import { Module } from '@nestjs/common';
import { ResumeParserService } from './resume-parser.service';
import { LLMModule } from '../llm/llm.module';
import { PdfParser } from '../job-postings/parsers/pdf.parser';
import { DocxParser } from '../job-postings/parsers/docx.parser';

@Module({
  imports: [LLMModule],
  providers: [ResumeParserService, PdfParser, DocxParser],
  exports: [ResumeParserService],
})
export class ResumeParserModule {}
