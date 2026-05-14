import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReactPdfRendererService } from './react-pdf-renderer.service';

@Module({
  imports: [PrismaModule],
  providers: [ReactPdfRendererService],
  exports: [ReactPdfRendererService],
})
export class PdfV2Module {}
