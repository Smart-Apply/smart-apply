import { Module, forwardRef } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { AtsValidatorService } from './ats-validator.service';
import { ConfigModule } from '../config/config.module';
import { TemplatesModule } from '../templates/templates.module';
import { PdfV2Module } from '../pdf-v2/pdf-v2.module';

@Module({
  imports: [ConfigModule, forwardRef(() => TemplatesModule), PdfV2Module],
  providers: [PdfService, TemplateRendererService, AtsValidatorService],
  exports: [PdfService, TemplateRendererService, AtsValidatorService],
})
export class PdfModule {}
