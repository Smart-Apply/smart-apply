/**
 * Harvard Classic — react-pdf port of apps/api/src/pdf/templates/harvard-classic/.
 *
 * Visual goal: pixel-equivalent (within react-pdf's flexbox-only layout
 * engine) to the Puppeteer/Handlebars version. Single-column traditional
 * academic layout: centered name, hr divider, dotted-row sections.
 *
 * Unit conversion
 * ---------------
 * Source CSS uses pt directly for most values (`font-size: 11pt`,
 * `margin-bottom: 8pt`) so no scaling is required. Where CSS uses inches
 * (page padding, list indent), we use the `inch()` helper.
 *
 * Fonts
 * -----
 * Source CSS uses `'Times New Roman', 'Georgia', serif`. Falls back to
 * react-pdf's built-in Times-Roman family. Bold/italic via the corresponding
 * built-in faces (Times-Bold, Times-Italic, Times-BoldItalic).
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

/** Source CSS uses pt directly — no conversion needed. */
const FS = {
  contact: 10,
  base: 11,
  section: 11,
  name: 14,
};

const SP = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 24, // closing-phrase margin = section-spacing * 2
};

const COLORS = {
  text: '#1a1a1a',
  textMuted: '#555555',
  border: '#1a1a1a',
};

/** CSS inches → PDF pt. */
const inch = (n: number) => n * 72;

const buildStyles = (rp: ReactPdfNamespace) =>
  rp.StyleSheet.create({
    // ── Page (CSS: padding 0.5in) ──
    page: {
      paddingTop: inch(0.5),
      paddingRight: inch(0.5),
      paddingBottom: inch(0.5),
      paddingLeft: inch(0.5),
      fontFamily: 'Times-Roman',
      fontSize: FS.base,
      color: COLORS.text,
      lineHeight: 1.4,
    },

    // ── Header (CSS: text-align center, margin-bottom 4pt) ──
    header: {
      textAlign: 'center',
      marginBottom: SP.xs,
    },
    candidateName: {
      fontSize: FS.name,
      fontFamily: 'Times-Bold',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      lineHeight: 1.15,
      marginBottom: SP.xxs,
    },
    headerDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      borderTopStyle: 'solid',
      marginTop: SP.xs,
      marginBottom: SP.xs,
    },

    // ── Contact info (CSS: text-align center, font-size 10pt, margin-bottom 12pt) ──
    contactInfo: {
      textAlign: 'center',
      fontSize: FS.contact,
      marginBottom: SP.lg,
      lineHeight: 1.4,
    },
    contactSeparator: {
      color: COLORS.textMuted,
    },
    contactLink: {
      color: COLORS.text,
      textDecoration: 'none',
    },

    // ── Section header (CSS: text-align center, font-weight bold, margin-top lg, margin-bottom 6pt) ──
    sectionHeader: {
      textAlign: 'center',
      fontFamily: 'Times-Bold',
      fontSize: FS.section,
      textTransform: 'uppercase',
      marginTop: SP.lg,
      marginBottom: SP.sm,
    },

    // ── Entry container ──
    entry: {
      marginBottom: SP.md,
    },

    // ── Item rows (CSS: flex justify-between, baseline aligned) ──
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    itemLeft: {
      flex: 1,
      paddingRight: SP.md,
    },
    itemRight: {
      textAlign: 'right',
    },

    organizationName: {
      fontFamily: 'Times-Bold',
      fontSize: FS.base,
    },
    positionTitle: {
      fontFamily: 'Times-Bold',
      fontSize: FS.base,
    },
    location: {
      fontSize: FS.base,
      color: COLORS.text,
    },
    date: {
      fontSize: FS.base,
      color: COLORS.text,
    },

    // ── Description (CSS: margin-top 2pt, color text-muted) ──
    description: {
      marginTop: SP.xxs,
      fontSize: FS.base,
      color: COLORS.textMuted,
      lineHeight: 1.4,
    },

    // ── Bullets (CSS: margin-left 0.2in, list-style disc, margin-top 4pt) ──
    bulletList: {
      marginLeft: inch(0.2),
      marginTop: SP.xs,
      marginBottom: SP.md,
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: SP.xxs,
    },
    bulletGlyph: {
      width: 10,
      fontSize: FS.base,
      color: COLORS.text,
    },
    bulletText: {
      flex: 1,
      fontSize: FS.base,
      lineHeight: 1.4,
      textAlign: 'justify',
    },

    // ── Skills (CSS: skill-line margin-bottom 4pt) ──
    skillLine: {
      flexDirection: 'row',
      marginBottom: SP.xs,
      fontSize: FS.base,
      lineHeight: 1.4,
    },
    skillType: {
      fontFamily: 'Times-Bold',
      marginRight: SP.xs,
    },
    skillItems: {
      flex: 1,
    },

    // ── Summary (CSS: text-align justify, line-height 1.5) ──
    summaryText: {
      fontSize: FS.base,
      textAlign: 'justify',
      lineHeight: 1.5,
    },

    // ── Cover letter ──
    coverLetterBody: {
      fontSize: FS.base,
      textAlign: 'justify',
      lineHeight: 1.6,
    },
    coverLetterParagraph: {
      marginBottom: SP.lg,
    },
    coverLetterDate: {
      marginBottom: SP.lg,
      fontSize: FS.base,
    },
    coverLetterSalutation: {
      marginBottom: SP.lg,
      fontSize: FS.base,
    },
    coverLetterClosing: {
      marginTop: SP.xl,
    },
    coverLetterClosingPhrase: {
      marginBottom: SP.xl,
      fontSize: FS.base,
    },
    coverLetterSignature: {
      fontSize: FS.base,
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
        children.push(
          createElement(Text, { key: `sep-${idx}`, style: separatorStyle }, '\u2007 \u2022 \u2007'),
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
  if (data.email) parts.push({ label: data.email, href: `mailto:${data.email}` });
  if (data.phone) parts.push({ label: data.phone });
  if (data.linkedin) parts.push({ label: 'LinkedIn', href: data.linkedin });
  if (data.github) parts.push({ label: 'GitHub', href: data.github });
  return parts;
}

function buildCoverLetterContactParts(data: ReactPdfCoverLetterProps['data']): ContactPart[] {
  const parts: ContactPart[] = [];
  if (data.fullAddress) parts.push({ label: data.fullAddress });
  if (data.email) parts.push({ label: data.email, href: `mailto:${data.email}` });
  if (data.phone) parts.push({ label: data.phone });
  return parts;
}

export const HarvardClassicFactory: ReactPdfTemplateFactory = {
  resume: (rp) => {
    const { Document, Page, View, Text } = rp;
    const renderRichText = createRichTextRenderer(rp);
    const ContactInfo = ContactInfoFactory(rp);

    return function HarvardClassicResume({ data, meta }: ReactPdfResumeProps): ReactElement {
      const styles = buildStyles(rp);
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
          { size: 'LETTER', style: styles.page },
          // Header
          createElement(
            View,
            { style: styles.header },
            createElement(Text, { style: styles.candidateName }, data.candidateName),
            createElement(View, { style: styles.headerDivider }),
          ),
          // Contact info
          createElement(ContactInfo, {
            parts: contactParts,
            style: styles.contactInfo,
            linkStyle: styles.contactLink,
            separatorStyle: styles.contactSeparator,
          }),
          // Summary
          data.summary &&
            createElement(
              View,
              { wrap: false },
              createElement(Text, { style: styles.sectionHeader }, tLabel('resume.summary', lang)),
              renderRichText(data.summary, { paragraph: styles.summaryText }),
            ),
          // Education (school first, like Harvard convention)
          data.education &&
            data.education.length > 0 &&
            createElement(
              View,
              null,
              createElement(
                Text,
                { style: styles.sectionHeader },
                tLabel('resume.education', lang),
              ),
              ...data.education.map((edu, idx) =>
                createElement(
                  View,
                  { key: `edu-${idx}`, style: styles.entry, wrap: false },
                  // Education has no location field on the source data model
                  // (see ResumeTemplateData.Education) — only institution.
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(Text, { style: styles.organizationName }, edu.institution),
                    ),
                  ),
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(
                        Text,
                        { style: styles.positionTitle },
                        `${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}${
                          edu.gpa ? `. GPA: ${edu.gpa}` : ''
                        }`,
                      ),
                    ),
                    createElement(
                      View,
                      { style: styles.itemRight },
                      createElement(Text, { style: styles.date }, edu.year),
                    ),
                  ),
                  edu.description &&
                    createElement(
                      View,
                      { style: styles.description },
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
              null,
              createElement(
                Text,
                { style: styles.sectionHeader },
                tLabel('resume.experience', lang),
              ),
              ...data.experiences.map((exp, idx) =>
                createElement(
                  View,
                  { key: `exp-${idx}`, style: styles.entry, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(Text, { style: styles.organizationName }, exp.company),
                    ),
                    exp.location &&
                      createElement(
                        View,
                        { style: styles.itemRight },
                        createElement(Text, { style: styles.location }, exp.location),
                      ),
                  ),
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(Text, { style: styles.positionTitle }, exp.title),
                    ),
                    createElement(
                      View,
                      { style: styles.itemRight },
                      createElement(Text, { style: styles.date }, exp.dateRange),
                    ),
                  ),
                  exp.description &&
                    createElement(
                      View,
                      { style: styles.description },
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
              null,
              createElement(Text, { style: styles.sectionHeader }, tLabel('resume.projects', lang)),
              ...data.projects.map((proj, idx) =>
                createElement(
                  View,
                  { key: `proj-${idx}`, style: styles.entry, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(Text, { style: styles.organizationName }, proj.name),
                    ),
                    proj.date &&
                      createElement(
                        View,
                        { style: styles.itemRight },
                        createElement(Text, { style: styles.date }, proj.date),
                      ),
                  ),
                  proj.description &&
                    createElement(
                      View,
                      { style: styles.description },
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
          // Certifications
          data.certifications &&
            data.certifications.length > 0 &&
            createElement(
              View,
              null,
              createElement(
                Text,
                { style: styles.sectionHeader },
                tLabel('resume.certifications', lang),
              ),
              ...data.certifications.map((cert, idx) =>
                createElement(
                  View,
                  { key: `cert-${idx}`, style: styles.entry, wrap: false },
                  createElement(
                    View,
                    { style: styles.itemRow },
                    createElement(
                      View,
                      { style: styles.itemLeft },
                      createElement(Text, { style: styles.organizationName }, cert.name),
                    ),
                    cert.date &&
                      createElement(
                        View,
                        { style: styles.itemRight },
                        createElement(Text, { style: styles.date }, cert.date),
                      ),
                  ),
                  cert.issuer &&
                    createElement(
                      View,
                      { style: styles.itemRow },
                      createElement(
                        View,
                        { style: styles.itemLeft },
                        createElement(Text, { style: styles.description }, cert.issuer),
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
              { wrap: false },
              createElement(Text, { style: styles.sectionHeader }, tLabel('resume.skills', lang)),
              ...data.skillCategories.map((cat, idx) =>
                createElement(
                  View,
                  { key: `sk-${idx}`, style: styles.skillLine },
                  cat.type &&
                    createElement(Text, { style: styles.skillType }, `${cat.type}:`),
                  createElement(Text, { style: styles.skillItems }, cat.skills.join(', ')),
                ),
              ),
            ),
          // Languages
          data.languages &&
            data.languages.length > 0 &&
            createElement(
              View,
              { wrap: false },
              createElement(
                Text,
                { style: styles.sectionHeader },
                tLabel('resume.languages', lang),
              ),
              createElement(
                View,
                { style: styles.skillLine },
                createElement(
                  Text,
                  { style: styles.skillType },
                  `${tLabel('resume.languages', lang)}:`,
                ),
                createElement(
                  Text,
                  { style: styles.skillItems },
                  data.languages
                    .map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`)
                    .join(', '),
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

    return function HarvardClassicCoverLetter({
      data,
      meta: _meta,
    }: ReactPdfCoverLetterProps): ReactElement {
      const styles = buildStyles(rp);
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
          { size: 'LETTER', style: styles.page },
          createElement(
            View,
            { style: styles.header },
            createElement(Text, { style: styles.candidateName }, data.candidateName),
            createElement(View, { style: styles.headerDivider }),
          ),
          createElement(ContactInfo, {
            parts: contactParts,
            style: styles.contactInfo,
            linkStyle: styles.contactLink,
            separatorStyle: styles.contactSeparator,
          }),
          data.date && createElement(Text, { style: styles.coverLetterDate }, data.date),
          // Note: salutation/recipient blocks are intentionally omitted —
          // the LLM emits them inline as the first paragraphs of `content`.
          createElement(
            View,
            { style: styles.coverLetterBody },
            renderRichText(data.content, {
              paragraph: styles.coverLetterParagraph,
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
