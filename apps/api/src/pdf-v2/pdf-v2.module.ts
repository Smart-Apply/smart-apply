import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PreviewRendererService } from './preview-renderer.service';
import { ReactPdfRendererService } from './react-pdf-renderer.service';

@Module({
  imports: [PrismaModule],
  providers: [ReactPdfRendererService, PreviewRendererService],
  exports: [ReactPdfRendererService, PreviewRendererService],
})
export class PdfV2Module {}
