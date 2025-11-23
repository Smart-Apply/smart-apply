import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { ConfigModule } from '../config/config.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [ConfigModule, TemplatesModule],
  providers: [PdfService, TemplateRendererService],
  exports: [PdfService, TemplateRendererService],
})
export class PdfModule {}
