import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [PdfService, TemplateRendererService],
  exports: [PdfService, TemplateRendererService],
})
export class PdfModule {}
