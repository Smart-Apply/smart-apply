import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReactPdfRendererService } from './react-pdf-renderer.service';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from './template-data';
import { TemplateType } from '../generated/prisma/client';

/**
 * Generates A4-sized PNG previews of templates by rendering the template via
 * `@react-pdf/renderer` and rasterising page 1 with `pdfjs-dist` driven by a
 * `@napi-rs/canvas` backend. Replaces the puppeteer-based screenshot path
 * that used to live in the legacy `PdfService` (`generateScreenshot`).
 *
 * Both libraries are loaded lazily because:
 *   - `pdfjs-dist` ships only as ESM in modern releases and the api package
 *     is CommonJS (`tsconfig.json` sets `module: node16`). We use the same
 *     `new Function('m', 'return import(m)')` workaround as
 *     `react-pdf-loader.ts`.
 *   - `@napi-rs/canvas` is a native module — keeping it cold-loaded shaves
 *     ~50ms off boot for instances that never request a preview.
 *
 * Both `pdfjs-dist` and `@napi-rs/canvas` were added as runtime dependencies
 * as part of the puppeteer removal. Together they replace ~600MB of
 * Chromium + bundled Puppeteer.
 */
@Injectable()
export class PreviewRendererService {
  private readonly logger = new Logger(PreviewRendererService.name);
  private pdfjsModule: Promise<PdfjsNamespace> | null = null;
  private canvasModule: Promise<CanvasNamespace> | null = null;

  /** A4 at 72 DPI — matches the legacy puppeteer call signature. */
  private static readonly PAGE_WIDTH_PT = 595;
  private static readonly PAGE_HEIGHT_PT = 842;
  /**
   * Render scale. 2x produces ~1190x1684 thumbnails — sharp on Retina,
   * still <250 KB after PNG compression. Tune here if needed.
   */
  private static readonly RENDER_SCALE = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reactPdfRenderer: ReactPdfRendererService,
  ) {}

  /**
   * Render the first page of `templateId` as a PNG buffer using sample data.
   *
   * Throws when the template has no react-pdf implementation registered in
   * `template-registry.ts` — there is no fallback path now that puppeteer
   * is gone.
   */
  async renderPreviewPng(templateId: string): Promise<Buffer> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, type: true },
    });
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const pdfBuffer = await this.renderSamplePdf(templateId, template.type);
    return this.pdfPageToPng(pdfBuffer);
  }

  private async renderSamplePdf(templateId: string, type: TemplateType): Promise<Buffer> {
    if (type === TemplateType.COVER_LETTER) {
      const data = sampleCoverLetterData();
      const buf = await this.reactPdfRenderer.renderCoverLetter(data, templateId, {});
      if (!buf) {
        throw new Error(
          `Cover letter template "${templateId}" has no react-pdf implementation; cannot render preview.`,
        );
      }
      return buf;
    }

    // RESUME or BOTH → render the resume side (covers most of the design surface).
    const data = sampleResumeData();
    const buf = await this.reactPdfRenderer.renderResume(data, templateId, {});
    if (!buf) {
      throw new Error(
        `Resume template "${templateId}" has no react-pdf implementation; cannot render preview.`,
      );
    }
    return buf;
  }

  private async pdfPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
    const pdfjs = await this.loadPdfjs();
    const canvas = await this.loadCanvas();

    // Copy into a fresh Uint8Array — pdfjs detaches the underlying buffer.
    const data = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjs.getDocument({
      data,
      // Tell pdfjs we have no DOM. Disabling worker keeps everything on the
      // main thread, which is what we want server-side.
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    });
    const doc = await loadingTask.promise;
    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: PreviewRendererService.RENDER_SCALE });

      const c = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = c.getContext('2d');
      // White background so transparent PDF regions render cleanly.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        // Required by pdfjs >= 4 when using a non-DOM canvas.
        canvas: c as unknown as HTMLCanvasElement,
      }).promise;

      const pngBuffer = c.encode('png');
      this.logger.debug(
        `Preview PNG rendered (${c.width}x${c.height}, ${pngBuffer.length} bytes)`,
      );
      return Buffer.from(pngBuffer);
    } finally {
      await doc.cleanup();
      doc.destroy();
    }
  }

  private async loadPdfjs(): Promise<PdfjsNamespace> {
    if (!this.pdfjsModule) {
      // Same ESM workaround as react-pdf-loader.ts. `pdfjs-dist` exposes a
      // legacy CJS build at `pdfjs-dist/legacy/build/pdf.mjs` which still
      // requires the dynamic-import dance under TypeScript's `node16`
      // module resolution.
      const dynamicImport = new Function('m', 'return import(m)') as (
        m: string,
      ) => Promise<PdfjsNamespace>;
      this.pdfjsModule = dynamicImport('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return this.pdfjsModule;
  }

  private async loadCanvas(): Promise<CanvasNamespace> {
    if (!this.canvasModule) {
      const dynamicImport = new Function('m', 'return import(m)') as (
        m: string,
      ) => Promise<CanvasNamespace>;
      this.canvasModule = dynamicImport('@napi-rs/canvas');
    }
    return this.canvasModule;
  }
}

// ---------------------------------------------------------------------------
// Sample data — kept inline because it is preview-only and needs to exercise
// every section a real template might render. Mirrors the shape produced by
// `applications/resume-template.util.ts` but with synthetic strings.
// ---------------------------------------------------------------------------

function sampleResumeData(): ResumeTemplateData {
  return {
    candidateName: 'Max Mustermann',
    targetJobTitle: 'Senior Software Engineer',
    email: 'max.mustermann@example.com',
    phone: '+49 123 456789',
    linkedin: 'linkedin.com/in/maxmustermann',
    github: 'github.com/maxmustermann',
    street: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    fullAddress: 'Musterstraße 1, 10115 Berlin, Deutschland',
    summary:
      'Erfahrener Softwareentwickler mit 5+ Jahren Erfahrung in der Full-Stack-Entwicklung mit Schwerpunkt auf skalierbaren Cloud-Anwendungen.',
    skillCategories: [
      { type: 'Programmiersprachen', skills: ['TypeScript', 'JavaScript', 'Python', 'Go'] },
      { type: 'Frameworks', skills: ['React', 'Next.js', 'NestJS', 'Express'] },
      { type: 'Cloud & DevOps', skills: ['Azure', 'AWS', 'Docker', 'Kubernetes'] },
    ],
    experiences: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'Berlin',
        dateRange: '2022 – heute',
        achievements: [
          'Entwicklung einer microservice-basierten Plattform mit 99.99% Uptime',
          'Führung eines Teams von 5 Entwicklern',
          'Reduktion der API-Latenz um 60% durch Caching-Strategie',
        ],
      },
      {
        title: 'Software Engineer',
        company: 'Startup GmbH',
        location: 'Hamburg',
        dateRange: '2019 – 2022',
        achievements: [
          'Aufbau der initialen Cloud-Infrastruktur in Azure',
          'Implementierung der CI/CD-Pipeline mit GitHub Actions',
        ],
      },
    ],
    education: [
      {
        degree: 'M.Sc. Informatik',
        institution: 'Technische Universität Berlin',
        year: '2019',
        fieldOfStudy: 'Informatik',
      },
    ],
    certifications: [
      { name: 'Azure Solutions Architect Expert', issuer: 'Microsoft', date: '2023' },
    ],
    languages: [
      { name: 'Deutsch', level: 'Muttersprache' },
      { name: 'English', level: 'C1' },
    ],
    language: 'de',
  };
}

function sampleCoverLetterData(): CoverLetterTemplateData {
  return {
    candidateName: 'Max Mustermann',
    targetJobTitle: 'Senior Software Engineer',
    email: 'max.mustermann@example.com',
    phone: '+49 123 456789',
    linkedin: 'linkedin.com/in/maxmustermann',
    street: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    fullAddress: 'Musterstraße 1, 10115 Berlin, Deutschland',
    date: new Date().toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    companyName: 'Beispiel GmbH',
    recipientName: 'Frau Schmidt',
    content:
      '<p>Hiermit bewerbe ich mich für die Position als Senior Software Engineer in Ihrem Unternehmen.</p><p>Mit meiner mehrjährigen Erfahrung in der Softwareentwicklung und meiner Leidenschaft für skalierbare Systeme bin ich überzeugt, einen wertvollen Beitrag zu Ihrem Team leisten zu können.</p><p>Ich freue mich darauf, von Ihnen zu hören.</p>',
    closingPhrase: 'Mit freundlichen Grüßen',
    language: 'de',
  };
}

// ---------------------------------------------------------------------------
// Minimal type shims for the lazily-loaded ESM packages. We only declare the
// surface we actually call — full DefinitelyTyped packages would pull in DOM
// types which conflict with the rest of the api codebase.
// ---------------------------------------------------------------------------

interface PdfjsNamespace {
  getDocument(args: {
    data: Uint8Array;
    disableFontFace?: boolean;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
  }): { promise: Promise<PdfjsDocument> };
}

interface PdfjsDocument {
  getPage(n: number): Promise<PdfjsPage>;
  cleanup(): Promise<void>;
  destroy(): void;
}

interface PdfjsPage {
  getViewport(args: { scale: number }): { width: number; height: number };
  render(args: {
    canvasContext: unknown;
    viewport: { width: number; height: number };
    canvas: unknown;
  }): { promise: Promise<void> };
}

interface CanvasNamespace {
  createCanvas(width: number, height: number): NapiCanvas;
}

interface NapiCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): NapiCanvasContext;
  encode(format: 'png'): Uint8Array;
}

interface NapiCanvasContext {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
}
