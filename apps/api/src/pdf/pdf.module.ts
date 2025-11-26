import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { AtsValidatorService } from './ats-validator.service';
import { ConfigModule } from '../config/config.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [ConfigModule, TemplatesModule],
  providers: [PdfService, TemplateRendererService, AtsValidatorService],
  exports: [PdfService, TemplateRendererService, AtsValidatorService],
})
export class PdfModule {}
