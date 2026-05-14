import type { ComponentType, ReactElement } from 'react';
import type {
  CoverLetterTemplateData,
  ResumeTemplateData,
} from './template-data';
import type { ReactPdfNamespace } from './react-pdf-loader';

/**
 * Template metadata passed to every TSX component. Mirrors the DB row's
 * design knobs (color variant, language, ATS flag) so the same component
 * file renders all variants of a base design.
 */
export interface ReactPdfTemplateMeta {
  /** ISO 639-1 language code: 'en', 'de', etc. Drives section labels + closing phrases. */
  language: string;
  /** Hex accent color for the variant, e.g. '#9c7a5b'. */
  accentColor?: string;
  /** Display name of the color variant, e.g. 'Original Brown'. */
  colorVariantName?: string;
  /** True when the template should suppress decorative chrome for ATS parsers. */
  atsOptimized?: boolean;
}

export interface ReactPdfResumeProps {
  data: ResumeTemplateData;
  meta: ReactPdfTemplateMeta;
}

export interface ReactPdfCoverLetterProps {
  data: CoverLetterTemplateData;
  meta: ReactPdfTemplateMeta;
}

export type ReactPdfResumeComponent = ComponentType<ReactPdfResumeProps>;
export type ReactPdfCoverLetterComponent = ComponentType<ReactPdfCoverLetterProps>;

/**
 * Factory that produces resume + cover-letter components for one base design,
 * given the lazily-loaded @react-pdf/renderer namespace. Factories are needed
 * because the package is ESM-only — see react-pdf-loader.ts.
 */
export interface ReactPdfTemplateFactory {
  resume?: (rp: ReactPdfNamespace) => (props: ReactPdfResumeProps) => ReactElement;
  coverLetter?: (rp: ReactPdfNamespace) => (props: ReactPdfCoverLetterProps) => ReactElement;
}

/**
 * A registered base design. `key` matches a DB template's `baseTemplateId` slug,
 * its raw `id`, or its kebab-cased `category` (in priority order).
 */
export interface RegisteredReactPdfTemplate {
  key: string;
  factory: ReactPdfTemplateFactory;
}
