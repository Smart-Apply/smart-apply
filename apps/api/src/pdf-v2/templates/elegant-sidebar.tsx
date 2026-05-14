/**
 * Elegant Sidebar — react-pdf port of apps/api/src/pdf/templates/elegant-sidebar/.
 *
 * Visual goal: warm two-column resume with a colored header bar across the
 * top, a tinted sidebar on the left (32%), and main content on the right.
 * The sidebar background extends through subsequent pages via a `fixed`
 * absolute View — react-pdf cannot reflow flex children across pages, so
 * the background is decoupled from the content flow.
 *
 * Color variants
 * --------------
 * The puppeteer version reads 5 hand-tuned palettes from config.json. Here
 * we derive the full palette from a single `meta.accentColor` via
 * deriveElegantSidebarPalette() — same ratios as the source CSS variants.
 * Adding a new color = setting `accentColor` on the DB row, no code change.
 *
 * Unit conversion
 * ---------------
 * Source CSS uses CSS pixels (`px`) at Chromium's 96 DPI. The PDF coordinate
 * system is points (pt) at 72 per inch:  1 CSS px = 0.75 pt.
 *
 * Fonts
 * -----
 * Source CSS uses Poppins / Montserrat. Falls back to react-pdf's built-in
 * Helvetica family — registering the real fonts is the deferred follow-up
 * tracked in REARCHITECTURE_PLAN.md.
 *
 * Page-break behavior
 * -------------------
 * Top header is non-fixed (page 1 only). Sidebar background is `fixed` so it
 * paints on every page. Sidebar content (contact, education, skills,
 * languages) lives on page 1 only — page 2 onwards shows the tinted sidebar
 * with the main content continuing in the right column.
 *
 * Factory pattern: receives the lazily-loaded @react-pdf/renderer namespace.
 */

import { createElement, type ReactElement } from 'react';
import { tLabel } from '../i18n';
import { createRichTextRenderer } from '../rich-text';
import { deriveElegantSidebarPalette } from '../color-utils';
import type { ReactPdfNamespace } from '../react-pdf-loader';
import type {
  ReactPdfCoverLetterProps,
  ReactPdfResumeProps,
  ReactPdfTemplateFactory,
} from '../types';

/** CSS px → PDF pt at 96 DPI. */
const px = (n: number) => n * 0.75;

const FS = {
  xxs: px(9),
  xs: px(10),
  sm: px(11),
  md: px(12),
  base: px(13),
  lg: px(14),
  xl: px(15),
  xxl: px(18),
  xxxl: px(22),
  xxxxl: px(26),
};

const SIDEBAR_WIDTH_PCT = '32%';
/** Header bar height in pt. CSS: `padding: 18px 25px` + ~ name+sub line height. */
const HEADER_HEIGHT_PT = px(85);

const buildResumeStyles = (rp: ReactPdfNamespace, palette: ReturnType<typeof deriveElegantSidebarPalette>) =>
  rp.StyleSheet.create({
    // ── Page (no padding — header/sidebar bleed to edges) ──
    page: {
      fontFamily: 'Helvetica',
      fontSize: FS.xs,
      color: palette.textPrimary,
      lineHeight: 1.6,
    },

    // ── Sidebar background — fixed so it repeats on every page. ──
    // Uses `fixed: true` to render once per page in the same position.
    // Top-aligned at 0 so it extends behind the header on page 2+.
    sidebarBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: SIDEBAR_WIDTH_PCT,
      bottom: 0,
      backgroundColor: palette.bgSidebar,
    },

    // ── Top header bar (page 1 only, non-fixed) ──
    headerBar: {
      backgroundColor: palette.headerBg,
      paddingTop: px(18),
      paddingBottom: px(18),
      paddingLeft: px(25),
      paddingRight: px(25),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: HEADER_HEIGHT_PT,
    },
    profileName: {
      fontSize: FS.xxxxl,
      fontFamily: 'Helvetica-Bold',
      letterSpacing: px(1.5),
      textTransform: 'uppercase',
      color: palette.textOnHeader,
      lineHeight: 1.15,
    },
    targetJobTitle: {
      fontSize: FS.base,
      color: palette.textOnHeader,
      letterSpacing: px(1),
      marginTop: px(4),
      lineHeight: 1.3,
    },

    // ── Two-column flex below the header. ──
    contentRow: {
      flexDirection: 'row',
    },

    // ── Sidebar (page 1 content; bg comes from sidebarBackground) ──
    sidebar: {
      width: SIDEBAR_WIDTH_PCT,
      paddingTop: px(15),
      paddingBottom: px(15),
      paddingLeft: px(18),
      paddingRight: px(18),
    },

    sidebarSection: {
      marginBottom: px(10),
    },
    sidebarSectionTitle: {
      fontSize: FS.base,
      fontFamily: 'Helvetica-Bold',
      color: palette.textAccent,
      textTransform: 'uppercase',
      letterSpacing: px(1),
      marginBottom: px(6),
    },

    contactItem: {
      fontSize: FS.sm,
      color: palette.textPrimary,
      marginBottom: px(6),
      lineHeight: 1.4,
    },
    contactItemLink: {
      color: palette.textPrimary,
      textDecoration: 'none',
    },

    eduSidebarItem: {
      marginBottom: px(8),
    },
    eduDegree: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.sm,
      color: palette.textPrimary,
      letterSpacing: px(0.5),
      lineHeight: 1.3,
    },
    eduInstitution: {
      fontSize: FS.sm,
      color: palette.textSecondary,
      lineHeight: 1.3,
    },
    eduPeriod: {
      fontSize: FS.xs,
      color: palette.textMuted,
      lineHeight: 1.3,
    },

    skillCategory: {
      marginBottom: px(10),
    },
    skillCategoryTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.xs,
      color: palette.textAccent,
      textTransform: 'uppercase',
      letterSpacing: px(0.5),
      marginBottom: px(6),
    },
    skillsList: {
      flexDirection: 'column',
    },
    skillItem: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.xs,
      color: palette.textPrimary,
      backgroundColor: palette.bgSecondary,
      paddingTop: px(4),
      paddingBottom: px(4),
      paddingLeft: px(10),
      paddingRight: px(10),
      borderRadius: px(15),
      marginBottom: px(5),
      // self-align to start so chip is content-width, not full-row width
      alignSelf: 'flex-start',
    },

    languageItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: palette.bgSecondary,
      paddingTop: px(4),
      paddingBottom: px(4),
      paddingLeft: px(10),
      paddingRight: px(10),
      borderRadius: px(15),
      marginBottom: px(5),
    },
    languageName: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.xs,
      color: palette.textPrimary,
    },
    languageLevel: {
      fontSize: FS.xs,
      color: palette.textSecondary,
    },

    // ── Main content (right column) ──
    main: {
      flex: 1,
      paddingTop: px(15),
      paddingBottom: px(15),
      paddingLeft: px(20),
      paddingRight: px(20),
      backgroundColor: palette.bgPrimary,
    },
    mainSection: {
      marginBottom: px(10),
    },
    mainSectionTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.lg,
      textTransform: 'uppercase',
      letterSpacing: px(1),
      color: palette.textPrimary,
      paddingLeft: px(8),
      marginBottom: px(6),
      // CSS: border-left 3px solid accent → use leftBorder
      borderLeftWidth: px(3),
      borderLeftColor: palette.accent,
      borderLeftStyle: 'solid',
    },

    summaryText: {
      fontSize: FS.xxs,
      color: palette.textSecondary,
      textAlign: 'justify',
      lineHeight: 1.7,
    },

    item: {
      marginBottom: px(8),
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: px(3),
    },
    itemTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.md,
      letterSpacing: px(1),
      color: palette.textAccent,
      flex: 1,
    },
    itemPeriod: {
      fontSize: FS.xs,
      color: palette.textMuted,
      fontFamily: 'Helvetica-Bold',
      backgroundColor: palette.bgSecondary,
      paddingTop: px(3),
      paddingBottom: px(3),
      paddingLeft: px(8),
      paddingRight: px(8),
      borderRadius: px(12),
    },
    itemCompany: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.sm,
      letterSpacing: px(0.5),
      marginBottom: px(3),
      color: palette.textPrimary,
    },
    itemDescription: {
      fontSize: FS.xxs,
      color: palette.textSecondary,
      lineHeight: 1.5,
      marginBottom: px(4),
    },
    achievementsList: {
      paddingLeft: px(14),
      marginBottom: px(4),
    },
    achievementRow: {
      flexDirection: 'row',
      marginBottom: px(3),
    },
    achievementGlyph: {
      width: px(10),
      fontSize: FS.xxs,
      color: palette.textSecondary,
    },
    achievementText: {
      flex: 1,
      fontSize: FS.xxs,
      color: palette.textSecondary,
      lineHeight: 1.5,
    },
  });

const buildCoverLetterStyles = (
  rp: ReactPdfNamespace,
  palette: ReturnType<typeof deriveElegantSidebarPalette>,
) =>
  rp.StyleSheet.create({
    page: {
      paddingTop: px(40),
      paddingBottom: px(40),
      paddingLeft: px(50),
      paddingRight: px(50),
      backgroundColor: palette.bgPrimary,
      fontFamily: 'Helvetica',
      fontSize: FS.sm,
      color: palette.textSecondary,
    },
    header: {
      marginBottom: px(20),
      paddingBottom: px(15),
      borderBottomWidth: px(2),
      borderBottomColor: palette.bgSecondary,
      borderBottomStyle: 'solid',
    },
    name: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.xxxl,
      letterSpacing: px(1.5),
      textTransform: 'uppercase',
      marginBottom: px(6),
      color: palette.textPrimary,
      lineHeight: 1.15,
    },
    jobTitle: {
      fontSize: FS.base,
      color: palette.accent,
      letterSpacing: px(1),
      marginBottom: px(12),
    },
    contactRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      fontSize: FS.sm,
      color: palette.textSecondary,
    },
    contactItem: {
      marginRight: px(15),
      fontSize: FS.sm,
      color: palette.textSecondary,
    },
    contactLink: {
      color: palette.textSecondary,
      textDecoration: 'none',
    },
    date: {
      fontSize: FS.sm,
      color: palette.textMuted,
      marginBottom: px(18),
      textAlign: 'right',
    },
    body: {
      fontSize: FS.sm,
      color: palette.textSecondary,
      lineHeight: 1.8,
      textAlign: 'justify',
    },
    paragraph: {
      marginBottom: px(12),
    },
    closing: {
      marginTop: px(25),
    },
    closingPhrase: {
      fontSize: FS.sm,
      color: palette.textPrimary,
      marginBottom: px(8),
    },
    signature: {
      fontFamily: 'Helvetica-Bold',
      fontSize: FS.lg,
      color: palette.textAccent,
      marginTop: px(15),
    },
  });

interface ContactPart {
  label: string;
  href?: string;
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
  if (data.linkedin) parts.push({ label: 'LinkedIn', href: data.linkedin });
  return parts;
}

export const ElegantSidebarFactory: ReactPdfTemplateFactory = {
  resume: (rp) => {
    const { Document, Page, View, Text, Link } = rp;
    const renderRichText = createRichTextRenderer(rp);

    return function ElegantSidebarResume({ data, meta }: ReactPdfResumeProps): ReactElement {
      const palette = deriveElegantSidebarPalette(meta.accentColor);
      const styles = buildResumeStyles(rp, palette);
      const lang = meta.language || data.language || 'en';
      const contactParts = buildResumeContactParts(data);

      // Render contact items with optional Links
      const renderContactItem = (part: ContactPart, idx: number): ReactElement => {
        if (part.href) {
          return createElement(
            Link,
            {
              key: `c-${idx}`,
              src: part.href,
              style: [styles.contactItem, styles.contactItemLink],
            },
            part.label,
          );
        }
        return createElement(Text, { key: `c-${idx}`, style: styles.contactItem }, part.label);
      };

      return createElement(
        Document,
        {
          title: `${data.candidateName} - Resume`,
          author: data.candidateName,
          creator: 'Smart Apply',
        },
        createElement(
          Page,
          { size: 'LETTER', style: styles.page, wrap: true },
          // Sidebar background — fixed so it repeats on every page.
          createElement(View, { fixed: true, style: styles.sidebarBackground }),
          // Header bar (page 1 only)
          createElement(
            View,
            { style: styles.headerBar },
            createElement(
              View,
              null,
              createElement(Text, { style: styles.profileName }, data.candidateName),
              data.targetJobTitle &&
                createElement(Text, { style: styles.targetJobTitle }, data.targetJobTitle),
            ),
          ),
          // Two-column content row
          createElement(
            View,
            { style: styles.contentRow },
            // Sidebar
            createElement(
              View,
              { style: styles.sidebar },
              // Contact
              createElement(
                View,
                { style: styles.sidebarSection, wrap: false },
                createElement(
                  Text,
                  { style: styles.sidebarSectionTitle },
                  tLabel('contact', lang),
                ),
                ...contactParts.map(renderContactItem),
              ),
              // Education
              data.education &&
                data.education.length > 0 &&
                createElement(
                  View,
                  { style: styles.sidebarSection, wrap: false },
                  createElement(
                    Text,
                    { style: styles.sidebarSectionTitle },
                    tLabel('resume.education', lang),
                  ),
                  ...data.education.map((edu, idx) =>
                    createElement(
                      View,
                      { key: `edu-${idx}`, style: styles.eduSidebarItem },
                      createElement(
                        Text,
                        { style: styles.eduDegree },
                        `${edu.degree}${edu.fieldOfStudy ? ` ${edu.fieldOfStudy}` : ''}`,
                      ),
                      createElement(Text, { style: styles.eduInstitution }, edu.institution),
                      createElement(Text, { style: styles.eduPeriod }, edu.year),
                    ),
                  ),
                ),
              // Skills
              data.skillCategories &&
                data.skillCategories.length > 0 &&
                createElement(
                  View,
                  { style: styles.sidebarSection, wrap: false },
                  createElement(
                    Text,
                    { style: styles.sidebarSectionTitle },
                    tLabel('resume.skills', lang),
                  ),
                  ...data.skillCategories.map((cat, cidx) =>
                    createElement(
                      View,
                      { key: `cat-${cidx}`, style: styles.skillCategory },
                      cat.type &&
                        createElement(Text, { style: styles.skillCategoryTitle }, cat.type),
                      createElement(
                        View,
                        { style: styles.skillsList },
                        ...cat.skills.map((s, sidx) =>
                          createElement(
                            Text,
                            { key: `s-${cidx}-${sidx}`, style: styles.skillItem },
                            s,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              // Languages
              data.languages &&
                data.languages.length > 0 &&
                createElement(
                  View,
                  { style: styles.sidebarSection, wrap: false },
                  createElement(
                    Text,
                    { style: styles.sidebarSectionTitle },
                    tLabel('resume.languages', lang),
                  ),
                  ...data.languages.map((l, lidx) =>
                    createElement(
                      View,
                      { key: `lng-${lidx}`, style: styles.languageItem },
                      createElement(Text, { style: styles.languageName }, l.name),
                      l.level && createElement(Text, { style: styles.languageLevel }, l.level),
                    ),
                  ),
                ),
            ),
            // Main column
            createElement(
              View,
              { style: styles.main },
              // Summary
              data.summary &&
                createElement(
                  View,
                  { style: styles.mainSection, wrap: false },
                  createElement(
                    Text,
                    { style: styles.mainSectionTitle },
                    tLabel('resume.summary', lang),
                  ),
                  renderRichText(data.summary, { paragraph: styles.summaryText }),
                ),
              // Experience
              data.experiences &&
                data.experiences.length > 0 &&
                createElement(
                  View,
                  { style: styles.mainSection },
                  createElement(
                    Text,
                    { style: styles.mainSectionTitle },
                    tLabel('resume.experience', lang),
                  ),
                  ...data.experiences.map((exp, idx) =>
                    createElement(
                      View,
                      { key: `exp-${idx}`, style: styles.item, wrap: false },
                      createElement(
                        View,
                        { style: styles.itemHeader },
                        createElement(Text, { style: styles.itemTitle }, exp.title),
                        createElement(Text, { style: styles.itemPeriod }, exp.dateRange),
                      ),
                      createElement(
                        Text,
                        { style: styles.itemCompany },
                        `${exp.company}${exp.location ? ` · ${exp.location}` : ''}`,
                      ),
                      exp.description &&
                        createElement(
                          View,
                          { style: styles.itemDescription },
                          renderRichText(exp.description, {
                            paragraph: { fontSize: FS.xxs, color: palette.textSecondary },
                          }),
                        ),
                      exp.achievements &&
                        exp.achievements.length > 0 &&
                        createElement(
                          View,
                          { style: styles.achievementsList },
                          ...exp.achievements.map((ach, aidx) =>
                            createElement(
                              View,
                              { key: `ach-${aidx}`, style: styles.achievementRow },
                              createElement(Text, { style: styles.achievementGlyph }, '•'),
                              createElement(
                                View,
                                { style: { flex: 1 } },
                                renderRichText(ach, { paragraph: styles.achievementText }),
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
                  { style: styles.mainSection },
                  createElement(
                    Text,
                    { style: styles.mainSectionTitle },
                    tLabel('resume.projects', lang),
                  ),
                  ...data.projects.map((proj, idx) =>
                    createElement(
                      View,
                      { key: `proj-${idx}`, style: styles.item, wrap: false },
                      createElement(
                        View,
                        { style: styles.itemHeader },
                        createElement(Text, { style: styles.itemTitle }, proj.name),
                        proj.date && createElement(Text, { style: styles.itemPeriod }, proj.date),
                      ),
                      proj.description &&
                        createElement(
                          View,
                          { style: styles.itemDescription },
                          renderRichText(proj.description, {
                            paragraph: { fontSize: FS.xxs, color: palette.textSecondary },
                          }),
                        ),
                      proj.highlights &&
                        proj.highlights.length > 0 &&
                        createElement(
                          View,
                          { style: styles.achievementsList },
                          ...proj.highlights.map((h, hidx) =>
                            createElement(
                              View,
                              { key: `hl-${hidx}`, style: styles.achievementRow },
                              createElement(Text, { style: styles.achievementGlyph }, '•'),
                              createElement(
                                View,
                                { style: { flex: 1 } },
                                renderRichText(h, { paragraph: styles.achievementText }),
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
                  { style: styles.mainSection },
                  createElement(
                    Text,
                    { style: styles.mainSectionTitle },
                    tLabel('resume.certifications', lang),
                  ),
                  ...data.certifications.map((cert, idx) =>
                    createElement(
                      View,
                      { key: `cert-${idx}`, style: styles.item, wrap: false },
                      createElement(
                        View,
                        { style: styles.itemHeader },
                        createElement(Text, { style: styles.itemTitle }, cert.name),
                        cert.date && createElement(Text, { style: styles.itemPeriod }, cert.date),
                      ),
                      cert.issuer &&
                        createElement(Text, { style: styles.itemCompany }, cert.issuer),
                    ),
                  ),
                ),
            ),
          ),
        ),
      );
    };
  },

  coverLetter: (rp) => {
    const { Document, Page, View, Text, Link } = rp;
    const renderRichText = createRichTextRenderer(rp);

    return function ElegantSidebarCoverLetter({
      data,
      meta,
    }: ReactPdfCoverLetterProps): ReactElement {
      const palette = deriveElegantSidebarPalette(meta.accentColor);
      const styles = buildCoverLetterStyles(rp, palette);
      const contactParts = buildCoverLetterContactParts(data);

      const renderContactItem = (part: ContactPart, idx: number): ReactElement => {
        if (part.href) {
          return createElement(
            Link,
            {
              key: `c-${idx}`,
              src: part.href,
              style: [styles.contactItem, styles.contactLink],
            },
            part.label,
          );
        }
        return createElement(Text, { key: `c-${idx}`, style: styles.contactItem }, part.label);
      };

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
            createElement(Text, { style: styles.name }, data.candidateName),
            data.targetJobTitle &&
              createElement(Text, { style: styles.jobTitle }, data.targetJobTitle),
            createElement(View, { style: styles.contactRow }, ...contactParts.map(renderContactItem)),
          ),
          data.date && createElement(Text, { style: styles.date }, data.date),
          createElement(
            View,
            { style: styles.body },
            renderRichText(data.content, { paragraph: styles.paragraph }),
          ),
          createElement(
            View,
            { style: styles.closing },
            data.closingPhrase &&
              createElement(Text, { style: styles.closingPhrase }, data.closingPhrase),
            createElement(Text, { style: styles.signature }, data.candidateName),
          ),
        ),
      );
    };
  },
};
