/**
 * Classic ATS — react-pdf port of apps/api/src/pdf/templates/classic-ats/.
 *
 * Visual goal: pixel-equivalent (within react-pdf's flexbox-only layout
 * engine) to the Puppeteer/Handlebars version. Page-break behavior is
 * deterministic via `wrap={false}` on each item.
 *
 * Unit conversion
 * ---------------
 * The HTML/CSS source uses CSS pixels (`px`) at Chromium's print default of
 * 96 DPI. The PDF coordinate system is points (pt), 72 per inch. So:
 *     1 CSS px = 72 / 96 = 0.75 pt
 * All numeric tokens below come from `templates/classic-ats/styles.css` with
 * `px` multiplied by 0.75. Inches stay direct: 0.5in = 36pt, 0.6in = 43.2pt.
 *
 * Fonts
 * -----
 * Falls back to react-pdf's built-in Helvetica family. The HTML version uses
 * Lato/Source Sans 3 — registering those via Font.register() is deferred to
 * the font-bundling follow-up (font-size cascade is matched here regardless).
 *
 * Factory pattern: receives the lazily-loaded @react-pdf/renderer namespace.
 * See react-pdf-loader.ts for why we don't import the package statically.
 */

import { createElement, type ReactElement } from 'react';
import { tLabel } from '../i18n';
import { createRichTextRenderer } from '../rich-text';
import type { ReactPdfNamespace } from '../react-pdf-loader';
import type {
  ReactPdfCoverLetterProps,
  ReactPdfResumeProps,
  ReactPdfTemplateFactory,
} from '../types';

const ACCENT_FALLBACK = '#1a1a1a';

/** CSS px → PDF pt at Chromium's print default (96 DPI). */
const px = (n: number) => n * 0.75;

/** CSS inches → PDF pt. */
const inch = (n: number) => n * 72;

// CSS custom-property mirrors. Names match `:root` block in styles.css.
const FS = {
  xs: px(9),
  sm: px(10),
  base: px(11),
  md: px(12),
  lg: px(14),
  xl: px(16),
  xxl: px(20),
  xxxl: px(28),
};

const SP = {
  xs: px(2),
  sm: px(4),
  md: px(8),
  lg: px(12),
  xl: px(16),
};

const COLORS = {
  text: '#1a1a1a',
  textSecondary: '#333333',
  textMuted: '#666666',
};

const buildStyles = (rp: ReactPdfNamespace, accent: string) =>
  rp.StyleSheet.create({
    // ── Resume page (CSS: .resume padding 0.5in 0.5in 0.4in 0.5in) ──
    resumePage: {
      paddingTop: inch(0.5),
      paddingRight: inch(0.5),
      paddingBottom: inch(0.4),
      paddingLeft: inch(0.5),
      fontFamily: 'Helvetica',
      fontSize: FS.base,
      color: COLORS.text,
      lineHeight: 1.5,
    },
    // ── Cover-letter page (CSS: .cover-letter padding 0.6in 0.6in 0.5in 0.6in) ──
    coverLetterPage: {
      paddingTop: inch(0.6),
      paddingRight: inch(0.6),
      paddingBottom: inch(0.5),
      paddingLeft: inch(0.6),
      fontFamily: 'Helvetica',
      fontSize: FS.md,
      color: COLORS.text,
      lineHeight: 1.7,
    },

    // ── Resume header (CSS: .resume-header text-align center, margin-bottom var(--spacing-lg)) ──
    resumeHeader: { textAlign: 'center', marginBottom: SP.lg },

    // ── Cover-letter header (CSS: text-align center, margin-bottom xl, padding-bottom lg, border-bottom 1px) ──
    coverLetterHeader: {
      textAlign: 'center',
      marginBottom: SP.xl,
      paddingBottom: SP.lg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.text,
      borderBottomStyle: 'solid',
    },

    // ── Candidate name — different size for resume vs CL (3xl vs 2xl) ──
    // Explicit lineHeight is required: react-pdf does not reliably inherit
    // the page-level lineHeight onto bold/uppercased Text, so without it the
    // line box collapses and the next sibling overlaps the descenders.
    candidateName: {
      fontSize: FS.xxxl,
      fontFamily: 'Helvetica-Bold',
      letterSpacing: px(0.5),
      textTransform: 'uppercase',
      color: accent,
      lineHeight: 1.15,
      marginBottom: SP.sm,
    },
    candidateNameCoverLetter: {
      fontSize: FS.xxl,
      fontFamily: 'Helvetica-Bold',
      letterSpacing: px(0.5),
      textTransform: 'uppercase',
      color: accent,
      lineHeight: 1.15,
      marginBottom: SP.sm,
    },

    jobTitle: {
      fontSize: FS.md,
      color: COLORS.textMuted,
      lineHeight: 1.3,
      marginBottom: SP.sm,
    },
    contactInfo: {
      fontSize: FS.sm,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 1.4,
    },
    // Separator pseudo-element in CSS gets `color: var(--text-muted)` and the
    // surrounding `gap: var(--spacing-sm)` produces ~3pt of whitespace on each
    // side of the pipe. We approximate with non-breaking thin spaces around
    // the glyph so the separator visually breathes the same way.
    contactSeparator: {
      color: COLORS.textMuted,
    },
    contactLink: {
      color: COLORS.textSecondary,
      textDecoration: 'underline',
    },

    // ── Section ──
    section: { marginBottom: SP.lg },
    sectionTitle: {
      fontSize: FS.lg,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: px(0.8),
      color: accent,
      borderBottomWidth: 1,
      borderBottomColor: accent,
      borderBottomStyle: 'solid',
      paddingBottom: SP.xs,
      marginBottom: SP.sm,
    },

    // ── Summary ──
    summaryText: { fontSize: FS.base, lineHeight: 1.6, color: COLORS.text },

    // ── Item (experience / education / project / certification) ──
    item: { marginBottom: SP.md },
    itemHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    itemTitle: {
      fontSize: FS.md,
      fontFamily: 'Helvetica-Bold',
      color: COLORS.text,
    },
    itemDate: {
      fontSize: FS.sm,
      fontStyle: 'italic',
      color: COLORS.textMuted,
    },
    itemSubRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SP.xs,
    },
    itemSubtitle: {
      fontSize: FS.base,
      fontStyle: 'italic',
      color: COLORS.textSecondary,
    },
    itemLocation: {
      fontSize: FS.sm,
      fontStyle: 'italic',
      color: COLORS.textMuted,
    },
    itemBody: {
      marginTop: SP.sm,
      fontSize: FS.base,
      lineHeight: 1.5,
      color: COLORS.text,
    },

    // ── Achievements / bullets (CSS: ul margin-left 0.15in) ──
    bulletList: {
      marginTop: SP.sm,
      marginLeft: inch(0.15),
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: SP.xs,
    },
    bulletGlyph: {
      width: px(10),
      fontSize: FS.xs,
      color: COLORS.textMuted,
      paddingTop: 1, // optical alignment with first text line
    },
    bulletText: {
      flex: 1,
      fontSize: FS.base,
      lineHeight: 1.5,
      color: COLORS.text,
    },

    // ── Skills (CSS: skills-container column gap sm; skill-row row gap sm) ──
    skillsContainer: { flexDirection: 'column' },
    skillRow: {
      flexDirection: 'row',
      marginBottom: SP.sm,
      fontSize: FS.base,
      lineHeight: 1.5,
    },
    skillCategoryLabel: {
      fontFamily: 'Helvetica-Bold',
      color: COLORS.text,
      marginRight: SP.sm,
    },
    skillList: { flex: 1, color: COLORS.text },

    // ── Languages ──
    languagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    languageItem: {
      marginRight: SP.sm,
      fontSize: FS.base,
      color: COLORS.text,
    },

    // ── Cover-letter date (CSS: text-align right, margin-bottom lg, font-size base) ──
    coverLetterDate: {
      textAlign: 'right',
      marginBottom: SP.lg,
      fontSize: FS.base,
      color: COLORS.textSecondary,
    },

    // ── Cover-letter body (CSS: font-size md, line-height 1.7) ──
    coverLetterBody: {
      fontSize: FS.md,
      lineHeight: 1.7,
      color: COLORS.text,
    },
    // CSS: .cover-letter-body p { margin-bottom: var(--spacing-lg); text-align: justify; }
    coverLetterParagraph: {
      marginBottom: SP.lg,
      textAlign: 'justify',
    },
    // CSS: .cover-letter-body ul { margin-left: 0.25in; margin-bottom: var(--spacing-lg); }
    coverLetterList: {
      marginLeft: inch(0.25),
      marginBottom: SP.lg,
    },
    coverLetterListItem: {
      marginBottom: SP.sm,
      fontSize: FS.md,
      lineHeight: 1.7,
    },

    // ── Cover-letter closing (CSS: margin-top xl, font-size md) ──
    coverLetterClosing: {
      marginTop: SP.xl,
      fontSize: FS.md,
    },
    coverLetterClosingPhrase: {
      marginBottom: SP.md,
    },
    coverLetterSignature: {
      marginTop: SP.xl,
      fontFamily: 'Helvetica-Bold',
    },
  });

interface ContactPart {
  label: string;
  href?: string;
}

function ContactInfoFactory(rp: ReactPdfNamespace) {
  const { Text, Link } = rp;
  return function ContactInfo({
    parts,
    style,
    linkStyle,
    separatorStyle,
  }: {
    parts: ContactPart[];
    style: unknown;
    linkStyle: unknown;
    separatorStyle: unknown;
  }): ReactElement | null {
    const filtered = parts.filter((p) => p.label);
    if (filtered.length === 0) return null;
    const children: ReactElement[] = [];
    filtered.forEach((p, idx) => {
      if (idx > 0) {
        // Use figure spaces (U+2007) on each side of the pipe to mimic the
        // `gap: var(--spacing-sm)` flexbox spacing in the source CSS.
        children.push(
          createElement(Text, { key: `sep-${idx}`, style: separatorStyle }, '\u2007 | \u2007'),
        );
      }
      if (p.href) {
        children.push(
          createElement(Link, { key: `lnk-${idx}`, src: p.href, style: linkStyle }, p.label),
        );
      } else {
        children.push(createElement(Text, { key: `txt-${idx}` }, p.label));
      }
    });
    return createElement(Text, { style }, children);
  };
}

function buildResumeContactParts(data: ReactPdfResumeProps['data']): ContactPart[] {
  const parts: ContactPart[] = [];
  if (data.fullAddress) parts.push({ label: data.fullAddress });
  if (data.phone) parts.push({ label: data.phone });
  if (data.email) parts.push({ label: data.email, href: `mailto:${data.email}` });
  if (data.linkedin) parts.push({ label: 'LinkedIn', href: data.linkedin });
  if (data.github) parts.push({ label: 'GitHub', href: data.github });
  return parts;
}

function buildCoverLetterContactParts(data: ReactPdfCoverLetterProps['data']): ContactPart[] {
  const parts: ContactPart[] = [];
  if (data.fullAddress) parts.push({ label: data.fullAddress });
  if (data.phone) parts.push({ label: data.phone });
  if (data.email) parts.push({ label: data.email, href: `mailto:${data.email}` });
  if (data.linkedin) parts.push({ label: 'LinkedIn', href: data.linkedin });
  return parts;
}

export const ClassicAtsFactory: ReactPdfTemplateFactory = {
  resume: (rp) => {
    const { Document, Page, View, Text } = rp;
    const renderRichText = createRichTextRenderer(rp);
    const ContactInfo = ContactInfoFactory(rp);

    return function ClassicAtsResume({ data, meta }: ReactPdfResumeProps): ReactElement {
      const accent = meta.accentColor || ACCENT_FALLBACK;
      const styles = buildStyles(rp, accent);
      const lang = meta.language || data.language || 'en';
      const contactParts = buildResumeContactParts(data);

      return createElement(
        Document,
        {
          title: `${data.candidateName} - Resume`,
          author: data.candidateName,
          creator: 'Smart Apply',
        },
        createElement(
          Page,
          { size: 'LETTER', style: styles.resumePage },
          // Header
          createElement(
            View,
            { style: styles.resumeHeader },
            createElement(Text, { style: styles.candidateName }, data.candidateName),
            data.targetJobTitle &&
              createElement(Text, { style: styles.jobTitle }, data.targetJobTitle),
            createElement(ContactInfo, {
              parts: contactParts,
              style: styles.contactInfo,
              linkStyle: styles.contactLink,
              separatorStyle: styles.contactSeparator,
            }),
          ),
          // Summary
          data.summary &&
            createElement(
              View,
              { style: styles.section, wrap: false },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.summary', lang)),
              renderRichText(data.summary, { paragraph: styles.summaryText }),
            ),
          // Education
          data.education &&
            data.education.length > 0 &&
            createElement(
              View,
              { style: styles.section },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.education', lang)),
              ...data.education.map((edu, idx) =>
                createElement(
                  View,
                  { key: `edu-${idx}`, style: styles.item, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemHeaderRow },
                    createElement(Text, { style: styles.itemTitle }, edu.institution),
                    createElement(Text, { style: styles.itemDate }, edu.year),
                  ),
                  createElement(
                    View,
                    { style: styles.itemSubRow },
                    createElement(
                      Text,
                      { style: styles.itemSubtitle },
                      `${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}`,
                    ),
                  ),
                  edu.gpa && createElement(Text, { style: styles.itemBody }, `GPA: ${edu.gpa}`),
                  edu.description &&
                    createElement(
                      View,
                      { style: styles.itemBody },
                      renderRichText(edu.description, { paragraph: { fontSize: FS.base } }),
                    ),
                ),
              ),
            ),
          // Experience
          data.experiences &&
            data.experiences.length > 0 &&
            createElement(
              View,
              { style: styles.section },
              createElement(
                Text,
                { style: styles.sectionTitle },
                tLabel('resume.experience', lang),
              ),
              ...data.experiences.map((exp, idx) =>
                createElement(
                  View,
                  { key: `exp-${idx}`, style: styles.item, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemHeaderRow },
                    createElement(Text, { style: styles.itemTitle }, exp.title),
                    createElement(Text, { style: styles.itemDate }, exp.dateRange),
                  ),
                  createElement(
                    View,
                    { style: styles.itemSubRow },
                    createElement(Text, { style: styles.itemSubtitle }, exp.company),
                    exp.location &&
                      createElement(Text, { style: styles.itemLocation }, exp.location),
                  ),
                  exp.description &&
                    createElement(
                      View,
                      { style: styles.itemBody },
                      renderRichText(exp.description, { paragraph: { fontSize: FS.base } }),
                    ),
                  exp.achievements &&
                    exp.achievements.length > 0 &&
                    createElement(
                      View,
                      { style: styles.bulletList },
                      ...exp.achievements.map((ach, aidx) =>
                        createElement(
                          View,
                          { key: `ach-${aidx}`, style: styles.bulletRow },
                          createElement(Text, { style: styles.bulletGlyph }, '•'),
                          createElement(
                            View,
                            { style: { flex: 1 } },
                            renderRichText(ach, { paragraph: styles.bulletText }),
                          ),
                        ),
                      ),
                    ),
                ),
              ),
            ),
          // Projects
          data.projects &&
            data.projects.length > 0 &&
            createElement(
              View,
              { style: styles.section },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.projects', lang)),
              ...data.projects.map((proj, idx) =>
                createElement(
                  View,
                  { key: `proj-${idx}`, style: styles.item, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemHeaderRow },
                    createElement(Text, { style: styles.itemTitle }, proj.name),
                    proj.date && createElement(Text, { style: styles.itemDate }, proj.date),
                  ),
                  proj.description &&
                    createElement(
                      View,
                      { style: styles.itemBody },
                      renderRichText(proj.description, { paragraph: { fontSize: FS.base } }),
                    ),
                  proj.highlights &&
                    proj.highlights.length > 0 &&
                    createElement(
                      View,
                      { style: styles.bulletList },
                      ...proj.highlights.map((h, hidx) =>
                        createElement(
                          View,
                          { key: `hl-${hidx}`, style: styles.bulletRow },
                          createElement(Text, { style: styles.bulletGlyph }, '•'),
                          createElement(
                            View,
                            { style: { flex: 1 } },
                            renderRichText(h, { paragraph: styles.bulletText }),
                          ),
                        ),
                      ),
                    ),
                ),
              ),
            ),
          // Skills
          data.skillCategories &&
            data.skillCategories.length > 0 &&
            createElement(
              View,
              { style: styles.section, wrap: false },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.skills', lang)),
              createElement(
                View,
                { style: styles.skillsContainer },
                ...data.skillCategories.map((cat, idx) =>
                  createElement(
                    View,
                    { key: `sk-${idx}`, style: styles.skillRow },
                    cat.type &&
                      createElement(Text, { style: styles.skillCategoryLabel }, `${cat.type}:`),
                    createElement(Text, { style: styles.skillList }, cat.skills.join(', ')),
                  ),
                ),
              ),
            ),
          // Certifications
          data.certifications &&
            data.certifications.length > 0 &&
            createElement(
              View,
              { style: styles.section },
              createElement(
                Text,
                { style: styles.sectionTitle },
                tLabel('resume.certifications', lang),
              ),
              ...data.certifications.map((cert, idx) =>
                createElement(
                  View,
                  { key: `cert-${idx}`, style: styles.item, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemHeaderRow },
                    createElement(Text, { style: styles.itemTitle }, cert.name),
                    cert.date && createElement(Text, { style: styles.itemDate }, cert.date),
                  ),
                  cert.issuer && createElement(Text, { style: styles.itemSubtitle }, cert.issuer),
                ),
              ),
            ),
          // Languages
          data.languages &&
            data.languages.length > 0 &&
            createElement(
              View,
              { style: styles.section, wrap: false },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.languages', lang)),
              createElement(
                View,
                { style: styles.languagesRow },
                ...data.languages.map((l, idx) =>
                  createElement(
                    Text,
                    { key: `lng-${idx}`, style: styles.languageItem },
                    `${l.name}${l.level ? ` (${l.level})` : ''}${
                      idx < (data.languages?.length ?? 0) - 1 ? ',' : ''
                    }`,
                  ),
                ),
              ),
            ),
        ),
      );
    };
  },

  coverLetter: (rp) => {
    const { Document, Page, View, Text } = rp;
    const renderRichText = createRichTextRenderer(rp);
    const ContactInfo = ContactInfoFactory(rp);

    return function ClassicAtsCoverLetter({
      data,
      meta,
    }: ReactPdfCoverLetterProps): ReactElement {
      const accent = meta.accentColor || ACCENT_FALLBACK;
      const styles = buildStyles(rp, accent);
      const contactParts = buildCoverLetterContactParts(data);

      return createElement(
        Document,
        {
          title: `${data.candidateName} - Cover Letter`,
          author: data.candidateName,
          creator: 'Smart Apply',
        },
        createElement(
          Page,
          { size: 'LETTER', style: styles.coverLetterPage },
          createElement(
            View,
            { style: styles.coverLetterHeader },
            createElement(Text, { style: styles.candidateNameCoverLetter }, data.candidateName),
            data.targetJobTitle &&
              createElement(Text, { style: styles.jobTitle }, data.targetJobTitle),
            createElement(ContactInfo, {
              parts: contactParts,
              style: styles.contactInfo,
              linkStyle: styles.contactLink,
              separatorStyle: styles.contactSeparator,
            }),
          ),
          data.date && createElement(Text, { style: styles.coverLetterDate }, data.date),
          createElement(
            View,
            { style: styles.coverLetterBody },
            renderRichText(data.content, {
              paragraph: styles.coverLetterParagraph,
              list: styles.coverLetterList,
              listItem: styles.coverLetterListItem,
            }),
          ),
          createElement(
            View,
            { style: styles.coverLetterClosing },
            data.closingPhrase &&
              createElement(Text, { style: styles.coverLetterClosingPhrase }, data.closingPhrase),
            createElement(Text, { style: styles.coverLetterSignature }, data.candidateName),
          ),
        ),
      );
    };
  },
};
