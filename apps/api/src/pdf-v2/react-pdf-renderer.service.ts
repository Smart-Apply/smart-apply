import { Injectable, Logger } from '@nestjs/common';
import { createElement } from 'react';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from './template-data';
import { loadReactPdf, type ReactPdfNamespace } from './react-pdf-loader';
import { resolveReactPdfTemplate } from './template-registry';
import type { ReactPdfTemplateMeta } from './types';

interface DbTemplateMeta {
  id: string;
  name: string;
  baseTemplateId: string | null;
  category: string;
  language: string;
  accentColor: string | null;
  colorVariantName: string | null;
}

/**
 * Renders PDFs using @react-pdf/renderer for templates that have a TSX
 * implementation registered in template-registry.ts.
 *
 * Returns `undefined` when the requested template has no react-pdf
 * implementation; `PdfService` then throws since there is no fallback
 * renderer (puppeteer was removed in v1.16).
 */
@Injectable()
export class ReactPdfRendererService {
  private readonly logger = new Logger(ReactPdfRendererService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true when `templateId` (or the system default for the type) maps
   * to a registered react-pdf component. Cheap — single DB lookup, no render.
   */
  async supports(templateId: string | undefined, kind: 'resume' | 'coverLetter'): Promise<boolean> {
    const meta = await this.loadTemplateMeta(templateId);
    if (!meta) return false;
    const registered = resolveReactPdfTemplate({
      baseTemplateId: meta.baseTemplateId,
      templateId: meta.id,
      name: meta.name,
      category: meta.category,
    });
    if (!registered) return false;
    return kind === 'resume'
      ? Boolean(registered.factory.resume)
      : Boolean(registered.factory.coverLetter);
  }

  async renderResume(
    data: ResumeTemplateData,
    templateId: string | undefined,
    options: { atsOptimized?: boolean } = {},
  ): Promise<Buffer | undefined> {
    const meta = await this.loadTemplateMeta(templateId);
    if (!meta) return undefined;

    const registered = resolveReactPdfTemplate({
      baseTemplateId: meta.baseTemplateId,
      templateId: meta.id,
      name: meta.name,
      category: meta.category,
    });
    if (!registered?.factory.resume) return undefined;

    const rp = await loadReactPdf();
    const Component = registered.factory.resume(rp);
    const componentMeta = this.buildMeta(meta, options);
    const element = createElement(Component, { data, meta: componentMeta });

    this.logger.debug(
      `Rendering resume via react-pdf (template=${meta.id}, key=${registered.key}, lang=${meta.language})`,
    );
    return rp.renderToBuffer(element);
  }

  async renderCoverLetter(
    data: CoverLetterTemplateData,
    templateId: string | undefined,
    options: { atsOptimized?: boolean } = {},
  ): Promise<Buffer | undefined> {
    const meta = await this.loadTemplateMeta(templateId);
    if (!meta) return undefined;

    const registered = resolveReactPdfTemplate({
      baseTemplateId: meta.baseTemplateId,
      templateId: meta.id,
      name: meta.name,
      category: meta.category,
    });
    if (!registered?.factory.coverLetter) return undefined;

    const rp = await loadReactPdf();
    const Component = registered.factory.coverLetter(rp);
    const componentMeta = this.buildMeta(meta, options);
    const element = createElement(Component, { data, meta: componentMeta });

    this.logger.debug(
      `Rendering cover letter via react-pdf (template=${meta.id}, key=${registered.key}, lang=${meta.language})`,
    );
    return rp.renderToBuffer(element);
  }

  private buildMeta(
    meta: DbTemplateMeta,
    options: { atsOptimized?: boolean },
  ): ReactPdfTemplateMeta {
    return {
      language: meta.language,
      accentColor: meta.accentColor ?? undefined,
      colorVariantName: meta.colorVariantName ?? undefined,
      atsOptimized: options.atsOptimized,
    };
  }

  private async loadTemplateMeta(templateId: string | undefined): Promise<DbTemplateMeta | null> {
    if (!templateId) return null;
    return this.prisma.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        baseTemplateId: true,
        category: true,
        language: true,
        accentColor: true,
        colorVariantName: true,
      },
    });
  }
}

// Suppress unused-warning for ReactPdfNamespace type re-exported nowhere.
export type { ReactPdfNamespace };
