/**
 * Translation Utility Functions
 * Handles content hashing, cache management, and translation helpers
 * for the Smart Language Switching feature.
 */

// Singleton xxhash instance for performance
let xxhashInstance: any = null;

/**
 * Initialize xxhash WASM module
 * Called lazily on first hash calculation
 * Uses dynamic import for ESM/CJS compatibility
 */
async function getXxhash() {
  if (!xxhashInstance) {
    // Dynamic import for ESM module compatibility
    const xxhashModule = await import('xxhash-wasm');
    const xxhash = xxhashModule.default || xxhashModule;
    xxhashInstance = await xxhash();
  }
  return xxhashInstance;
}

/**
 * ResumeData type for caching
 */
export interface ResumeDataForCache {
  candidateName?: string;
  email?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  fullAddress?: string;
  linkedin?: string;
  github?: string;
  summary?: string;
  skillCategories?: Array<{ type: string; skills: string[] }>;
  experiences?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    technologies?: string[];
  }>;
  education?: Array<{
    degree: string;
    institution: string;
    fieldOfStudy?: string;
    startYear?: string;
    endYear?: string;
    gpa?: string;
    description?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
    credentialUrl?: string;
  }>;
  languages?: Array<{
    name: string;
    level?: string;
  }>;
}

/**
 * Cached translation structure per language
 */
export interface CachedLanguageContent {
  resume: ResumeDataForCache;
  coverLetter: string;
  hash: string; // xxHash-64 of source content when cached
  cachedAt: string; // ISO timestamp
  /**
   * Snapshot of the source content used to create this translation.
   * Used for partial translation: compare current source with this snapshot
   * to identify which sections actually changed.
   */
  sourceSnapshot?: {
    resume: ResumeDataForCache;
    coverLetter: string;
  };
}

/**
 * Full translation cache structure
 */
export interface TranslationCache {
  languages: Record<string, CachedLanguageContent>;
  lastUsed: string[]; // LRU tracking: most recent first
  prewarmFailures: Record<string, number>; // Track consecutive failures per language
}

/**
 * Section types that can be translated individually
 */
export type TranslatableSection =
  | 'summary'
  | 'coverLetter'
  | `experience.${number}`
  | `project.${number}`
  | `education.${number}`;

/**
 * Calculate xxHash-64 of resume and cover letter content
 * Used for cache invalidation detection
 *
 * @param resume - ResumeData JSON object
 * @param coverLetter - Cover letter HTML/Markdown string
 * @returns 64-bit hash as hex string
 */
export async function calculateContentHash(
  resume: ResumeDataForCache | string | null | undefined,
  coverLetter: string | null | undefined,
): Promise<string> {
  const hasher = await getXxhash();

  // Normalize inputs
  const resumeStr = typeof resume === 'string' ? resume : JSON.stringify(resume || {});
  const coverStr = coverLetter || '';

  // Concatenate with separator to avoid collision
  const content = `${resumeStr}|||${coverStr}`;

  // Use xxHash64 for fast, non-cryptographic hashing
  const hashBigInt = hasher.h64(content);
  return hashBigInt.toString(16);
}

/**
 * Identify which sections have changed between two resume versions
 * Compares section-by-section to enable partial translation
 *
 * @param oldResume - Previous resume state
 * @param newResume - Current resume state
 * @param oldCoverLetter - Previous cover letter
 * @param newCoverLetter - Current cover letter
 * @returns Array of changed section identifiers
 */
export function identifyChangedSections(
  oldResume: ResumeDataForCache | null,
  newResume: ResumeDataForCache | null,
  oldCoverLetter: string | null,
  newCoverLetter: string | null,
): TranslatableSection[] {
  const changedSections: TranslatableSection[] = [];

  // Cover letter check
  if (normalizeString(oldCoverLetter) !== normalizeString(newCoverLetter)) {
    changedSections.push('coverLetter');
  }

  // If no old resume, everything is new
  if (!oldResume && newResume) {
    changedSections.push('summary');
    newResume.experiences?.forEach((_, i) => changedSections.push(`experience.${i}`));
    newResume.projects?.forEach((_, i) => changedSections.push(`project.${i}`));
    newResume.education?.forEach((_, i) => changedSections.push(`education.${i}`));
    return changedSections;
  }

  if (!oldResume || !newResume) {
    return changedSections;
  }

  // Summary check
  if (normalizeString(oldResume.summary) !== normalizeString(newResume.summary)) {
    changedSections.push('summary');
  }

  // Experiences check (by index)
  const maxExp = Math.max(oldResume.experiences?.length || 0, newResume.experiences?.length || 0);
  for (let i = 0; i < maxExp; i++) {
    const oldExp = oldResume.experiences?.[i];
    const newExp = newResume.experiences?.[i];
    if (!experiencesEqual(oldExp, newExp)) {
      changedSections.push(`experience.${i}`);
    }
  }

  // Projects check (by index)
  const maxProj = Math.max(oldResume.projects?.length || 0, newResume.projects?.length || 0);
  for (let i = 0; i < maxProj; i++) {
    const oldProj = oldResume.projects?.[i];
    const newProj = newResume.projects?.[i];
    if (!projectsEqual(oldProj, newProj)) {
      changedSections.push(`project.${i}`);
    }
  }

  // Education check (by index)
  const maxEdu = Math.max(oldResume.education?.length || 0, newResume.education?.length || 0);
  for (let i = 0; i < maxEdu; i++) {
    const oldEdu = oldResume.education?.[i];
    const newEdu = newResume.education?.[i];
    if (!educationEqual(oldEdu, newEdu)) {
      changedSections.push(`education.${i}`);
    }
  }

  return changedSections;
}

/**
 * Merge fresh translations with existing cache
 * Only updates sections that were newly translated
 *
 * @param existingCache - Current cached translations for target language
 * @param freshTranslation - Newly translated content
 * @param translatedSections - Which sections were translated
 * @param newHash - Hash of current source content
 * @param sourceSnapshot - Current source content (to store for future change detection)
 * @returns Merged cache content
 */
export function mergeCachedTranslations(
  existingCache: CachedLanguageContent | null,
  freshTranslation: { resume: ResumeDataForCache; coverLetter: string },
  translatedSections: string[],
  newHash: string,
  sourceSnapshot?: { resume: ResumeDataForCache; coverLetter: string },
): CachedLanguageContent {
  // If no existing cache or all sections translated, use fresh translation
  if (!existingCache) {
    return {
      resume: freshTranslation.resume,
      coverLetter: freshTranslation.coverLetter,
      hash: newHash,
      cachedAt: new Date().toISOString(),
      sourceSnapshot: sourceSnapshot
        ? {
            resume: JSON.parse(JSON.stringify(sourceSnapshot.resume)),
            coverLetter: sourceSnapshot.coverLetter,
          }
        : undefined,
    };
  }

  // Start with existing cache, preserving sourceSnapshot
  const merged: CachedLanguageContent = {
    resume: { ...existingCache.resume },
    coverLetter: existingCache.coverLetter,
    hash: newHash,
    cachedAt: new Date().toISOString(),
    // Update sourceSnapshot with the new source for changed sections
    sourceSnapshot: sourceSnapshot
      ? {
          resume: mergeSourceSnapshots(
            existingCache.sourceSnapshot?.resume,
            sourceSnapshot.resume,
            translatedSections,
          ),
          coverLetter: translatedSections.includes('coverLetter')
            ? sourceSnapshot.coverLetter
            : existingCache.sourceSnapshot?.coverLetter || sourceSnapshot.coverLetter,
        }
      : existingCache.sourceSnapshot,
  };

  // Apply fresh translations for changed sections only
  for (const section of translatedSections) {
    if (section === 'coverLetter') {
      merged.coverLetter = freshTranslation.coverLetter;
    } else if (section === 'summary') {
      merged.resume.summary = freshTranslation.resume.summary;
    } else if (section.startsWith('experience.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.resume.experiences) {
        merged.resume.experiences = [];
      }
      if (freshTranslation.resume.experiences?.[index]) {
        merged.resume.experiences[index] = freshTranslation.resume.experiences[index];
      }
    } else if (section.startsWith('project.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.resume.projects) {
        merged.resume.projects = [];
      }
      if (freshTranslation.resume.projects?.[index]) {
        merged.resume.projects[index] = freshTranslation.resume.projects[index];
      }
    } else if (section.startsWith('education.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.resume.education) {
        merged.resume.education = [];
      }
      if (freshTranslation.resume.education?.[index]) {
        merged.resume.education[index] = freshTranslation.resume.education[index];
      }
    }
  }

  return merged;
}

/**
 * Merge source snapshots for partial updates
 * Keeps unchanged sections from old snapshot, updates changed sections from new source
 */
function mergeSourceSnapshots(
  oldSnapshot: ResumeDataForCache | undefined,
  newSource: ResumeDataForCache,
  changedSections: string[],
): ResumeDataForCache {
  if (!oldSnapshot) {
    return JSON.parse(JSON.stringify(newSource));
  }

  const merged = JSON.parse(JSON.stringify(oldSnapshot));

  for (const section of changedSections) {
    if (section === 'summary') {
      merged.summary = newSource.summary;
    } else if (section.startsWith('experience.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.experiences) merged.experiences = [];
      if (newSource.experiences?.[index]) {
        merged.experiences[index] = JSON.parse(JSON.stringify(newSource.experiences[index]));
      }
    } else if (section.startsWith('project.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.projects) merged.projects = [];
      if (newSource.projects?.[index]) {
        merged.projects[index] = JSON.parse(JSON.stringify(newSource.projects[index]));
      }
    } else if (section.startsWith('education.')) {
      const index = parseInt(section.split('.')[1], 10);
      if (!merged.education) merged.education = [];
      if (newSource.education?.[index]) {
        merged.education[index] = JSON.parse(JSON.stringify(newSource.education[index]));
      }
    }
  }

  return merged;
}

/**
 * Evict old languages from cache to maintain LRU limit
 * Keeps only the most recently used languages
 *
 * @param cache - Current translation cache
 * @param currentLanguage - Language being accessed now
 * @param maxLanguages - Maximum languages to keep (default: 2)
 * @returns Updated cache with evicted languages removed
 */
export function evictOldLanguages(
  cache: TranslationCache | null,
  currentLanguage: string,
  maxLanguages = 2,
): TranslationCache {
  if (!cache) {
    return {
      languages: {},
      lastUsed: [currentLanguage],
      prewarmFailures: {},
    };
  }

  // Ensure lastUsed is an array (handle legacy cache without lastUsed)
  const existingLastUsed = Array.isArray(cache.lastUsed) ? cache.lastUsed : Object.keys(cache.languages || {});

  // Update LRU list: move current language to front
  const lastUsed = [currentLanguage, ...existingLastUsed.filter((lang) => lang !== currentLanguage)];

  // Keep only maxLanguages in LRU list
  const keepLanguages = new Set(lastUsed.slice(0, maxLanguages));

  // Remove languages not in keep set
  const languages: Record<string, CachedLanguageContent> = {};
  for (const lang of Object.keys(cache.languages)) {
    if (keepLanguages.has(lang)) {
      languages[lang] = cache.languages[lang];
    }
  }

  // Clean up prewarmFailures for evicted languages
  const prewarmFailures: Record<string, number> = {};
  for (const lang of Object.keys(cache.prewarmFailures || {})) {
    if (keepLanguages.has(lang)) {
      prewarmFailures[lang] = cache.prewarmFailures[lang];
    }
  }

  return {
    languages,
    lastUsed: lastUsed.slice(0, maxLanguages),
    prewarmFailures,
  };
}

/**
 * Determine which languages to prewarm after content save
 * Only prewarming between DE and EN (bidirectional)
 *
 * @param sourceLanguage - Current content language
 * @returns Array of target languages to prewarm
 */
export function determinePrewarmTargets(sourceLanguage: string): string[] {
  // Only prewarm for DE <-> EN (bidirectional)
  if (sourceLanguage === 'de') {
    return ['en'];
  }
  if (sourceLanguage === 'en') {
    return ['de'];
  }
  // No prewarming for FR, ES, IT (can be extended later)
  return [];
}

/**
 * Check if a cached translation is valid for the current content
 *
 * @param cache - Cached translation for target language
 * @param currentHash - Current content hash
 * @returns True if cache can be used
 */
export function isCacheValid(
  cache: CachedLanguageContent | null | undefined,
  currentHash: string,
): boolean {
  if (!cache) {
    return false;
  }
  return cache.hash === currentHash;
}

/**
 * Get list of languages with valid cached translations
 * Used for UI to show cache status badges
 *
 * @param cache - Full translation cache
 * @param currentHash - Current content hash
 * @returns Array of language codes with valid cache
 */
export function getCachedLanguages(
  cache: TranslationCache | null | undefined,
  currentHash: string,
): string[] {
  if (!cache?.languages) {
    return [];
  }

  return Object.keys(cache.languages).filter((lang) =>
    isCacheValid(cache.languages[lang], currentHash),
  );
}

/**
 * Increment prewarm failure count for a language
 * Used to trigger alerts after 3 consecutive failures
 *
 * @param cache - Current translation cache
 * @param language - Failed language
 * @returns Updated cache with incremented failure count
 */
export function incrementPrewarmFailure(
  cache: TranslationCache | null,
  language: string,
): TranslationCache {
  const updatedCache = cache || {
    languages: {},
    lastUsed: [],
    prewarmFailures: {},
  };

  updatedCache.prewarmFailures = {
    ...updatedCache.prewarmFailures,
    [language]: (updatedCache.prewarmFailures[language] || 0) + 1,
  };

  return updatedCache;
}

/**
 * Reset prewarm failure count after successful prewarm
 *
 * @param cache - Current translation cache
 * @param language - Successfully prewarmed language
 * @returns Updated cache with reset failure count
 */
export function resetPrewarmFailure(
  cache: TranslationCache | null,
  language: string,
): TranslationCache {
  if (!cache) {
    return {
      languages: {},
      lastUsed: [],
      prewarmFailures: {},
    };
  }

  const { [language]: _, ...remainingFailures } = cache.prewarmFailures || {};

  return {
    ...cache,
    prewarmFailures: remainingFailures,
  };
}

/**
 * Check if we should alert on prewarm failures
 *
 * @param cache - Current translation cache
 * @param language - Language to check
 * @param threshold - Failure count threshold (default: 3)
 * @returns True if failures exceed threshold
 */
export function shouldAlertOnPrewarmFailure(
  cache: TranslationCache | null | undefined,
  language: string,
  threshold = 3,
): boolean {
  if (!cache?.prewarmFailures) {
    return false;
  }
  return (cache.prewarmFailures[language] || 0) >= threshold;
}

// ============ Helper Functions ============

function normalizeString(str: string | null | undefined): string {
  return (str || '').trim().toLowerCase();
}

type ExperienceItem = NonNullable<ResumeDataForCache['experiences']>[number];
type ProjectItem = NonNullable<ResumeDataForCache['projects']>[number];
type EducationItem = NonNullable<ResumeDataForCache['education']>[number];

function experiencesEqual(a: ExperienceItem | undefined, b: ExperienceItem | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    normalizeString(a.title) === normalizeString(b.title) &&
    normalizeString(a.company) === normalizeString(b.company) &&
    normalizeString(a.location) === normalizeString(b.location) &&
    normalizeString(a.description) === normalizeString(b.description) &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.isCurrent === b.isCurrent
  );
}

function projectsEqual(a: ProjectItem | undefined, b: ProjectItem | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    normalizeString(a.name) === normalizeString(b.name) &&
    normalizeString(a.description) === normalizeString(b.description) &&
    a.url === b.url &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    JSON.stringify(a.technologies) === JSON.stringify(b.technologies)
  );
}

function educationEqual(a: EducationItem | undefined, b: EducationItem | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    normalizeString(a.degree) === normalizeString(b.degree) &&
    normalizeString(a.institution) === normalizeString(b.institution) &&
    normalizeString(a.fieldOfStudy) === normalizeString(b.fieldOfStudy) &&
    normalizeString(a.description) === normalizeString(b.description) &&
    a.startYear === b.startYear &&
    a.endYear === b.endYear &&
    a.gpa === b.gpa
  );
}

/**
 * Supported languages for translation
 */
export const SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'es', 'it'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Language display names for UI
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, { native: string; english: string }> = {
  de: { native: 'Deutsch', english: 'German' },
  en: { native: 'English', english: 'English' },
  fr: { native: 'Français', english: 'French' },
  es: { native: 'Español', english: 'Spanish' },
  it: { native: 'Italiano', english: 'Italian' },
};
