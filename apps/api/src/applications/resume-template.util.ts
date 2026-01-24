import type {
  Certificate,
  Education,
  Experience,
  Language,
  Profile,
  Project,
  Skill,
  User,
  LanguageProficiency,
} from '../generated/prisma/client';
import type {
  ResumeTemplateData,
  SkillCategory as ResumeSkillCategory,
} from '../pdf/template-renderer.service';

export type ProfileWithRelations = Profile & {
  user: User;
  skills: Skill[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  certificates: Certificate[];
  languages: Language[];
  profileKeywords?: any; // AtsKeywordsOutputDto cached keywords
  lastKeywordsExtractedAt?: Date | null;
};

const DEFAULT_CATEGORY = '';

/**
 * Normalize proficiency level to translation key
 * Maps various user input formats (enum values or legacy strings) to standardized translation keys
 * @param level - LanguageProficiency enum value or legacy string
 * @returns Normalized translation key (e.g., "level.native") or original value if no match
 */
export function normalizeProficiencyLevel(level: LanguageProficiency | string | null | undefined): string | undefined {
  if (!level) return undefined;

  const normalized = level.toLowerCase().trim();

  // Native language variants (including enum value)
  if (
    normalized === 'native' ||
    normalized === 'muttersprache' ||
    normalized === 'native speaker' ||
    normalized === 'muttersprachlich' ||
    normalized === 'langue maternelle' ||
    normalized === 'madrelingua' ||
    normalized === 'nativo'
  ) {
    return 'level.native';
  }

  // Fluent variants
  if (
    normalized === 'fließend' ||
    normalized === 'fliessend' ||
    normalized === 'fluent' ||
    normalized === 'verhandlungssicher' ||
    normalized === 'courant' ||
    normalized === 'fluido' ||
    normalized === 'fluente'
  ) {
    return 'level.fluent';
  }

  // Advanced variants
  if (
    normalized === 'fortgeschritten' ||
    normalized === 'advanced' ||
    normalized === 'avancé' ||
    normalized === 'avanzado' ||
    normalized === 'avanzato'
  ) {
    return 'level.advanced';
  }

  // Good variants
  if (
    normalized === 'gut' ||
    normalized === 'good' ||
    normalized === 'sehr gut' ||
    normalized === 'very good' ||
    normalized === 'gute kenntnisse' ||
    normalized === 'bon' ||
    normalized === 'bueno' ||
    normalized === 'buono'
  ) {
    return 'level.good';
  }

  // Intermediate variants
  if (
    normalized === 'mittelstufe' ||
    normalized === 'intermediate' ||
    normalized === 'mittel' ||
    normalized === 'intermédiaire' ||
    normalized === 'intermedio'
  ) {
    return 'level.intermediate';
  }

  // Conversational variants
  if (
    normalized === 'konversationssicher' ||
    normalized === 'conversational' ||
    normalized === 'conversationnel' ||
    normalized === 'conversacional' ||
    normalized === 'conversazionale'
  ) {
    return 'level.conversational';
  }

  // Basic variants
  if (
    normalized === 'grundkenntnisse' ||
    normalized === 'basic' ||
    normalized === 'basics' ||
    normalized === 'notions de base' ||
    normalized === 'básico' ||
    normalized === 'base'
  ) {
    return 'level.basic';
  }

  // Beginner variants
  if (
    normalized === 'anfänger' ||
    normalized === 'beginner' ||
    normalized === 'débutant' ||
    normalized === 'principiante'
  ) {
    return 'level.beginner';
  }

  // Return original if no match found (allows custom levels)
  return level;
}

/**
 * Sanitize URL by removing duplicate protocol prefixes.
 * Handles cases like:
 * - "https://https://linkedin.com" → "https://linkedin.com"
 * - "https://https//linkedin.com" → "https://linkedin.com" (missing colon)
 */
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url || url.trim() === '') return undefined;

  let result = url.trim();

  // Remove duplicate protocol prefixes (with or without colon)
  // Matches: https://https://, https://https//, http://https//, etc.
  while (/^(https?:\/\/)(https?:?\/?\/?)/.test(result)) {
    result = result.replace(/^(https?:\/\/)(https?:?\/?\/?)/, '$2');
  }

  // Fix malformed protocol (https// → https://)
  result = result.replace(/^(https?)\/?\/+/, '$1://');

  // If URL doesn't start with protocol, add https://
  if (result && !/^https?:\/\//i.test(result)) {
    result = `https://${result}`;
  }

  return result || undefined;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRange(
  start?: Date | null,
  end?: Date | null,
  isCurrent?: boolean,
): string {
  const startLabel = formatDate(start) || 'Start';
  const endLabel = isCurrent ? 'Aktuell' : formatDate(end) || 'Heute';
  return `${startLabel} – ${endLabel}`;
}

/**
 * Build skill categories from database skills (fallback method)
 * Groups skills by their category field, or "Skills" if no category is set
 */
function buildSkillCategories(skills: Skill[]): ResumeSkillCategory[] {
  if (!skills.length) {
    return [];
  }

  const grouped = skills.reduce<Record<string, string[]>>((acc, skill) => {
    const key = skill.category?.trim() || DEFAULT_CATEGORY;
    acc[key] = acc[key] || [];
    acc[key].push(skill.name);
    return acc;
  }, {});

  return Object.entries(grouped).map(([type, values]) => ({
    type,
    skills: values.filter(Boolean),
  }));
}

/**
 * Build skill categories with provided categorization (from LLM or other source)
 * This allows external categorization logic to be injected
 */
export function buildSkillCategoriesWithCustom(
  skills: Skill[],
  customCategories?: ResumeSkillCategory[],
): ResumeSkillCategory[] {
  // If custom categories provided, use them
  if (customCategories && customCategories.length > 0) {
    return customCategories;
  }

  // Otherwise fall back to default grouping by category field
  return buildSkillCategories(skills);
}

export function buildResumeTemplateData(
  profile: ProfileWithRelations,
  customSkillCategories?: ResumeSkillCategory[],
): ResumeTemplateData {
  const candidateName =
    [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ').trim() ||
    profile.user.email;

  // Build full address string from address components
  const fullAddress = [
    profile.street,
    [profile.postalCode, profile.city].filter(Boolean).join(' '),
    profile.country,
  ].filter(Boolean).join(', ') || undefined;

  return {
    candidateName,
    email: profile.user.email,
    phone: profile.phone ?? undefined,
    linkedin: sanitizeUrl(profile.linkedinUrl),
    github: sanitizeUrl(profile.githubUrl),
    // Individual address fields
    street: profile.street ?? undefined,
    postalCode: profile.postalCode ?? undefined,
    city: profile.city ?? undefined,
    country: profile.country ?? undefined,
    fullAddress,
    summary: profile.summary ?? undefined,
    skillCategories: buildSkillCategoriesWithCustom(profile.skills, customSkillCategories),
    experiences: profile.experiences
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map((exp) => ({
        title: exp.title,
        company: exp.company,
        location: exp.location ?? undefined,
        dateRange: formatDateRange(exp.startDate, exp.endDate, exp.isCurrent),
        description: exp.description ?? undefined,
        achievements: exp.achievements?.length ? exp.achievements : undefined,
      })),
    projects: profile.projects.map((project) => ({
      name: project.name,
      description: project.description ?? undefined,
      date: project.startDate ? formatDate(project.startDate) : undefined,
      highlights: project.highlights?.length ? project.highlights : undefined,
    })),
    education: profile.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      fieldOfStudy: edu.fieldOfStudy ?? undefined,
      gpa: edu.gpa ?? undefined,
      description: edu.description ?? undefined,
      year: formatDateRange(edu.startYear, edu.endYear),
    })),
    certifications: profile.certificates.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.issueDate ? formatDate(cert.issueDate) : undefined,
    })),
    languages:
      profile.languages?.map((lang) => ({
        name: lang.name,
        level: normalizeProficiencyLevel(lang.level) ?? undefined,
      })) ?? [],
  };
}
