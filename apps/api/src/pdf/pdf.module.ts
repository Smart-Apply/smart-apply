import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfV2Module } from '../pdf-v2/pdf-v2.module';

/**
 * Thin module that re-exports `PdfService` (now a façade over the
 * `@react-pdf/renderer` pipeline in `PdfV2Module`). Kept as a separate
 * module so existing consumers (`JobsModule`, etc.) don't need to be
 * rewired — they import `PdfModule` and get the same `PdfService` symbol.
 */
@Module({
  imports: [PdfV2Module],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
