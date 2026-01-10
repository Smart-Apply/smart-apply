import type { Profile, ResumeData, ResumeExperience, ResumeSkillCategory } from '@/types';
import { isHtml } from './markdown';
import { htmlToPlainText, plainTextToHtml, sanitizeHtml } from './sanitize';

const DEFAULT_CATEGORY = '';

/**
 * Convert an achievements array to HTML bullet points
 * @param achievements - Array of achievement strings
 * @returns HTML string with <ul><li> structure, or empty string if no achievements
 */
function achievementsToHtml(achievements?: string[]): string {
  if (!achievements || achievements.length === 0) return '';
  const items = achievements
    .filter(Boolean)
    .map((a) => `<li>${a}</li>`)
    .join('');
  return items ? `<ul>${items}</ul>` : '';
}

/**
 * Merge achievements into description for editor display.
 * If description already contains bullet points (HTML or plain text with "- "),
 * we assume achievements are already included and skip merging.
 *
 * @param description - The description field (may be HTML or plain text)
 * @param achievements - Array of achievement strings
 * @returns Combined HTML with description (if any) followed by achievement bullets
 */
function mergeAchievementsIntoDescription(
  description?: string,
  achievements?: string[],
): string | undefined {
  const hasAchievements = achievements && achievements.filter(Boolean).length > 0;

  if (!description && !hasAchievements) {
    return undefined;
  }

  // If description is empty, just return achievements as bullet points
  if (!description || description.trim() === '') {
    return hasAchievements ? achievementsToHtml(achievements) : undefined;
  }

  // PRIORITY: If we have achievements (from LLM rewrite), use them as bullet points
  // The achievements array contains the NEW translated/tailored content and should
  // replace any existing bullet points in the description
  if (hasAchievements) {
    // Check if description already has bullet points (HTML or Markdown-style)
    const hasBulletPoints = /<(ul|ol|li)/i.test(description) || /^[\s]*[-•*]\s/m.test(description);

    if (hasBulletPoints) {
      // Description has old bullet points - replace them with new achievements
      // The achievements contain the LLM-generated (translated/tailored) content
      return achievementsToHtml(achievements);
    }

    // Description is a paragraph (no bullets) - combine with achievements
    const htmlDescription = isHtml(description) ? description : `<p>${description}</p>`;
    const htmlAchievements = achievementsToHtml(achievements);
    return `${htmlDescription}${htmlAchievements}`;
  }

  // No achievements - return description as-is
  return description;
}
const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'short',
  year: 'numeric',
});

export function createClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatRange(start?: string | number | null, end?: string | number | null) {
  if (!start && !end) {
    return 'Aktuell';
  }

  const parseDate = (value?: string | number | null): Date | undefined => {
    if (!value) return undefined;
    let date: Date;
    if (typeof value === 'number') {
      date = new Date(`${value}`);
    } else {
      date = new Date(value);
    }
    // Return undefined for invalid dates to prevent "-present" or "Invalid Date" output
    if (isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  };

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const startLabel = startDate ? monthFormatter.format(startDate) : 'Start';
  const endLabel = endDate ? monthFormatter.format(endDate) : 'Heute';
  return `${startLabel} – ${endLabel}`;
}

function buildSkillCategories(profile: Profile): ResumeSkillCategory[] {
  if (!profile.skills?.length) {
    return [];
  }

  return [
    {
      id: createClientId(),
      type: DEFAULT_CATEGORY,
      skills: profile.skills.map((skill) => skill.name),
    },
  ];
}

export function buildResumeFromProfile(
  profile: Profile,
  options?: { candidateName?: string; email?: string },
): ResumeData {
  // Build full address from components
  const addressParts: string[] = [];
  if (profile.street) addressParts.push(profile.street);
  if (profile.postalCode || profile.city) {
    addressParts.push([profile.postalCode, profile.city].filter(Boolean).join(' '));
  }
  if (profile.country) addressParts.push(profile.country);
  const fullAddress = addressParts.join(', ');

  return {
    candidateName: options?.candidateName || 'Vorname Nachname',
    email: options?.email || '',
    phone: profile.phone || '',
    street: profile.street || '',
    postalCode: profile.postalCode || '',
    city: profile.city || '',
    country: profile.country || '',
    fullAddress: fullAddress || '',
    linkedin: profile.linkedinUrl || '',
    github: profile.githubUrl || '',
    summary: profile.summary ? htmlToPlainText(profile.summary) : '',
    skillCategories: buildSkillCategories(profile),
    experiences: (profile.experiences || []).map((experience) => ({
      id: experience.id || createClientId(),
      title: experience.title,
      company: experience.company,
      location: experience.location || undefined,
      startDate: experience.startDate,
      endDate: experience.endDate || undefined,
      dateRange: formatRange(experience.startDate, experience.endDate),
      description: experience.description ? htmlToPlainText(experience.description) : undefined,
      achievements: [],
    })),
    projects: (profile.projects || []).map((project) => ({
      id: project.id || createClientId(),
      name: project.name,
      description: project.description ? htmlToPlainText(project.description) : undefined,
      date: project.startDate || undefined,
      highlights: project.technologies || [],
    })),
    education: (profile.education || []).map((education) => ({
      id: education.id || createClientId(),
      degree: education.degree,
      institution: education.institution,
      fieldOfStudy: education.fieldOfStudy || undefined,
      gpa: education.gpa || undefined,
      description: education.description ? htmlToPlainText(education.description) : undefined,
      year: formatRange(education.startYear, education.endYear),
    })),
    certifications: (profile.certificates || []).map((cert) => ({
      id: cert.id || createClientId(),
      name: cert.name,
      issuer: cert.issuer,
      date: cert.dateObtained || undefined,
    })),
    languages: (profile.languages || []).map((lang) => ({
      name: lang.name,
      level: lang.level || undefined,
    })),
  };
}

export function parseResumeDraft(resumeText?: string | null): ResumeData | null {
  if (!resumeText) {
    return null;
  }

  try {
    const data = JSON.parse(resumeText) as ResumeData;

    // Merge achievements into description for each experience
    // This allows users to edit bullet points in the description editor
    if (data.experiences && data.experiences.length > 0) {
      data.experiences = data.experiences.map((exp) => ({
        ...exp,
        description: mergeAchievementsIntoDescription(exp.description, exp.achievements),
        // Keep achievements for backward compatibility with preview,
        // but it will be empty since content is now in description
        achievements: [],
      }));
    }

    // Also merge highlights into description for projects
    if (data.projects && data.projects.length > 0) {
      data.projects = data.projects.map((proj) => ({
        ...proj,
        description: mergeAchievementsIntoDescription(proj.description, proj.highlights),
        highlights: [],
      }));
    }

    return data;
  } catch (error) {
    console.error('Failed to parse resume JSON', error);
    return null;
  }
}

/**
 * Normalize translated resume data for editor display.
 * Merges achievements/highlights into description so they're editable in the rich text editor.
 * Use this function when receiving translated content from the API.
 *
 * @param resume - The translated ResumeData object from the API
 * @returns Normalized ResumeData with achievements merged into description
 */
export function normalizeTranslatedResume(resume: ResumeData): ResumeData {
  const result = { ...resume };

  // Merge achievements into description for each experience
  if (result.experiences && result.experiences.length > 0) {
    result.experiences = result.experiences.map((exp) => ({
      ...exp,
      description: mergeAchievementsIntoDescription(exp.description, exp.achievements),
      // Clear achievements since they're now in description
      achievements: [],
    }));
  }

  // Also merge highlights into description for projects
  if (result.projects && result.projects.length > 0) {
    result.projects = result.projects.map((proj) => ({
      ...proj,
      description: mergeAchievementsIntoDescription(proj.description, proj.highlights),
      highlights: [],
    }));
  }

  return result;
}

/**
 * Check if HTML content is effectively empty
 * Detects: <p></p>, <p><br></p>, <p><br/></p>, whitespace-only HTML
 */
function isEmptyHtml(html: string): boolean {
  const stripped = html
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p>\s*<br\s*\/?\s*>\s*<\/p>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  return stripped === '';
}

/**
 * Convert value to HTML, handling both plain text and already-HTML content
 * - If already HTML: sanitize and return (no double-conversion)
 * - If plain text: convert using plainTextToHtml
 * - If empty/whitespace: return undefined
 */
function toHtmlSafe(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Check if already HTML
  if (isHtml(trimmed)) {
    // Check for empty HTML variants
    if (isEmptyHtml(trimmed)) return undefined;
    // Sanitize and return existing HTML
    return sanitizeHtml(trimmed);
  }

  // Plain text - convert to HTML
  return plainTextToHtml(trimmed);
}

function withDateRange(experience: ResumeExperience): ResumeExperience {
  const trimPreservingNewlines = (value?: string) => {
    if (!value) return undefined;
    // Trim each line individually but preserve newlines
    return (
      value
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim() || undefined
    );
  };
  const toHtml = (value?: string) => {
    if (!value) return undefined;
    const trimmed = trimPreservingNewlines(value);
    if (!trimmed) return undefined;
    // Use toHtmlSafe which handles both plain text and HTML
    return toHtmlSafe(trimmed);
  };
  return {
    ...experience,
    // Use ?? instead of || to preserve existing dateRange (even empty strings)
    // Only recalculate when dateRange is null/undefined
    dateRange: experience.dateRange ?? formatRange(experience.startDate, experience.endDate),
    description: toHtml(experience.description),
    achievements: experience.achievements?.filter(Boolean),
  };
}

export function normalizeResumeForSave(resume: ResumeData): ResumeData {
  const trim = (value?: string) => value?.trim() || undefined;

  // Compute fullAddress from components
  const street = trim(resume.street);
  const postalCode = trim(resume.postalCode);
  const city = trim(resume.city);
  const country = trim(resume.country);

  const addressParts: string[] = [];
  if (street) addressParts.push(street);
  if (postalCode || city) {
    addressParts.push([postalCode, city].filter(Boolean).join(' '));
  }
  if (country) addressParts.push(country);
  const fullAddress = addressParts.join(', ') || undefined;

  return {
    ...resume,
    candidateName: resume.candidateName.trim(),
    email: resume.email.trim(),
    phone: trim(resume.phone),
    street,
    postalCode,
    city,
    country,
    fullAddress,
    linkedin: trim(resume.linkedin),
    github: trim(resume.github),
    summary: toHtmlSafe(resume.summary),
    skillCategories: (resume.skillCategories || [])
      .map((category) => ({
        id: category.id,
        type: category.type.trim(),
        skills: category.skills.map((skill) => skill.trim()).filter(Boolean),
      }))
      .filter((category) => category.skills.length),
    experiences: (resume.experiences || [])
      .map((experience) => ({
        ...withDateRange(experience),
        title: experience.title.trim(),
        company: experience.company.trim(),
        location: trim(experience.location),
      }))
      .filter((experience) => experience.title && experience.company),
    projects: resume.projects
      ?.map((project) => ({
        ...project,
        name: project.name.trim(),
        description: toHtmlSafe(project.description),
        highlights: project.highlights?.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((project) => project.name),
    education: resume.education
      ?.map((education) => ({
        ...education,
        degree: education.degree.trim(),
        institution: education.institution.trim(),
        fieldOfStudy: trim(education.fieldOfStudy),
        gpa: trim(education.gpa),
        description: toHtmlSafe(education.description),
        year: education.year.trim(),
      }))
      .filter((education) => education.degree && education.institution),
    certifications: resume.certifications
      ?.map((certification) => ({
        ...certification,
        name: certification.name.trim(),
        issuer: certification.issuer.trim(),
        date: trim(certification.date),
      }))
      .filter((certification) => certification.name && certification.issuer),
    languages: resume.languages
      ?.map((language) => ({
        name: language.name.trim(),
        level: trim(language.level),
      }))
      .filter((language) => language.name),
  };
}
