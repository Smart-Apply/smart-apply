/**
 * Classic ATS — react-pdf port of apps/api/src/pdf/templates/classic-ats/.
 *
 * Visual goal: equivalent (within react-pdf's flexbox-only layout) to the
 * Puppeteer/Handlebars version. Same section order + labels. Page-break
 * behavior is deterministic via `wrap={false}` on each item.
 *
 * Fonts: relies on react-pdf's built-in Helvetica family. Lato/Source Sans 3
 * (used by the HTML version) require Font.register() with downloaded TTFs;
 * deferred until we ship the font-bundling story.
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

const buildStyles = (rp: ReactPdfNamespace, accent: string) =>
  rp.StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 36,
      paddingHorizontal: 36,
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: '#1a1a1a',
      lineHeight: 1.45,
    },
    header: { textAlign: 'center', marginBottom: 12 },
    candidateName: {
      fontSize: 22,
      fontFamily: 'Helvetica-Bold',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: accent,
      marginBottom: 2,
    },
    jobTitle: { fontSize: 11, color: '#666666', marginBottom: 4 },
    contactInfo: { fontSize: 9, color: '#333333', textAlign: 'center' },
    contactLink: { color: '#333333', textDecoration: 'underline' },
    section: { marginBottom: 10 },
    sectionTitle: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: accent,
      borderBottomWidth: 1,
      borderBottomColor: accent,
      borderBottomStyle: 'solid',
      paddingBottom: 2,
      marginBottom: 4,
    },
    item: { marginBottom: 6 },
    itemHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    itemTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
    itemDate: { fontSize: 9, fontStyle: 'italic', color: '#666666' },
    itemSubRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 1,
    },
    itemSubtitle: { fontSize: 10, fontStyle: 'italic', color: '#333333' },
    itemLocation: { fontSize: 9, fontStyle: 'italic', color: '#666666' },
    itemBody: { marginTop: 3, fontSize: 10 },
    bulletRow: { flexDirection: 'row', marginTop: 2 },
    bulletGlyph: { width: 10, fontSize: 10, color: '#666666' },
    bulletText: { flex: 1, fontSize: 10 },
    skillRow: { flexDirection: 'row', marginBottom: 2 },
    skillCategoryLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4 },
    skillList: { flex: 1 },
    languagesRow: { flexDirection: 'row', flexWrap: 'wrap' },
    languageItem: { marginRight: 8 },
    coverLetterDate: {
      textAlign: 'right',
      marginBottom: 12,
      fontSize: 10,
      color: '#333333',
    },
    coverLetterBody: { fontSize: 11, lineHeight: 1.6 },
    coverLetterParagraph: { marginBottom: 8, textAlign: 'justify' },
    coverLetterClosing: { marginTop: 16, fontSize: 11 },
    coverLetterSignature: { marginTop: 16, fontFamily: 'Helvetica-Bold' },
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
  }: {
    parts: ContactPart[];
    style: any;
    linkStyle: any;
  }): ReactElement | null {
    const filtered = parts.filter((p) => p.label);
    if (filtered.length === 0) return null;
    const children: ReactElement[] = [];
    filtered.forEach((p, idx) => {
      if (idx > 0) children.push(createElement(Text, { key: `sep-${idx}` }, ' | '));
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
          { size: 'A4', style: styles.page },
          // Header
          createElement(
            View,
            { style: styles.header },
            createElement(Text, { style: styles.candidateName }, data.candidateName),
            data.targetJobTitle &&
              createElement(Text, { style: styles.jobTitle }, data.targetJobTitle),
            createElement(ContactInfo, {
              parts: contactParts,
              style: styles.contactInfo,
              linkStyle: styles.contactLink,
            }),
          ),
          // Summary
          data.summary &&
            createElement(
              View,
              { style: styles.section, wrap: false },
              createElement(Text, { style: styles.sectionTitle }, tLabel('resume.summary', lang)),
              renderRichText(data.summary, {
                paragraph: { fontSize: 10, lineHeight: 1.5 },
              }),
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
                      renderRichText(edu.description, { paragraph: { fontSize: 10 } }),
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
                      renderRichText(exp.description, { paragraph: { fontSize: 10 } }),
                    ),
                  ...(exp.achievements ?? []).map((ach, aidx) =>
                    createElement(
                      View,
                      { key: `ach-${aidx}`, style: styles.bulletRow },
                      createElement(Text, { style: styles.bulletGlyph }, '•'),
                      createElement(
                        View,
                        { style: styles.bulletText },
                        renderRichText(ach, { paragraph: { fontSize: 10 } }),
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
                      renderRichText(proj.description, { paragraph: { fontSize: 10 } }),
                    ),
                  ...(proj.highlights ?? []).map((h, hidx) =>
                    createElement(
                      View,
                      { key: `hl-${hidx}`, style: styles.bulletRow },
                      createElement(Text, { style: styles.bulletGlyph }, '•'),
                      createElement(
                        View,
                        { style: styles.bulletText },
                        renderRichText(h, { paragraph: { fontSize: 10 } }),
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
          { size: 'A4', style: styles.page },
          createElement(
            View,
            { style: styles.header },
            createElement(Text, { style: styles.candidateName }, data.candidateName),
            data.targetJobTitle &&
              createElement(Text, { style: styles.jobTitle }, data.targetJobTitle),
            createElement(ContactInfo, {
              parts: contactParts,
              style: styles.contactInfo,
              linkStyle: styles.contactLink,
            }),
          ),
          data.date && createElement(Text, { style: styles.coverLetterDate }, data.date),
          createElement(
            View,
            { style: styles.coverLetterBody },
            renderRichText(data.content, {
              paragraph: styles.coverLetterParagraph,
              list: { marginBottom: 8 },
              listItem: { fontSize: 11 },
            }),
          ),
          createElement(
            View,
            { style: styles.coverLetterClosing },
            data.closingPhrase && createElement(Text, null, data.closingPhrase),
            createElement(Text, { style: styles.coverLetterSignature }, data.candidateName),
          ),
        ),
      );
    };
  },
};
