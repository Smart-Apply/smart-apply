/**
 * Structured template data passed to every react-pdf renderer.
 *
 * Lives in `pdf-v2` because it is the contract between the LLM
 * pipeline (which produces the data) and the TSX templates (which
 * render it). Previously co-located with the legacy Handlebars
 * renderer in `pdf/template-renderer.service.ts` — moved here as
 * part of the puppeteer removal so consumers no longer need to
 * import from a deleted module.
 */

export interface CoverLetterTemplateData {
  candidateName: string;
  /** Target job title for CV/CL (displayed under name). */
  targetJobTitle?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  /** Street + house number (e.g., "Musterstraße 123"). */
  street?: string;
  /** Postal code / PLZ (e.g., "47057"). */
  postalCode?: string;
  /** City name (e.g., "Duisburg"). */
  city?: string;
  /** Country name (e.g., "Deutschland"). */
  country?: string;
  /** Pre-formatted full address for templates. */
  fullAddress?: string;
  date?: string;
  recipientName?: string;
  companyName?: string;
  companyAddress?: string;
  /** HTML content from LLM. */
  content: string;
  closingPhrase?: string;
  footer?: string;
  /** Language code ('de', 'en', etc.) for localized content. */
  language?: string;
}

export interface ResumeTemplateData {
  candidateName: string;
  targetJobTitle?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  fullAddress?: string;
  summary?: string;
  skillCategories?: SkillCategory[];
  experiences?: Experience[];
  projects?: Project[];
  education?: Education[];
  certifications?: Certification[];
  languages?: ResumeLanguage[];
  /** Language code ('de', 'en', etc.) for localized section headers. */
  language?: string;
}

export interface ResumeLanguage {
  name: string;
  level?: string;
}

export interface SkillCategory {
  /** Languages, Frameworks, Cloud, Databases, Tools, Other. */
  type: string;
  skills: string[];
}

export interface Experience {
  title: string;
  company: string;
  location?: string;
  /** e.g., "Jan 2020 - Present". */
  dateRange: string;
  description?: string;
  /** HTML strings. */
  achievements?: string[];
}

export interface Project {
  name: string;
  description?: string;
  date?: string;
  /** HTML strings. */
  highlights?: string[];
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
  fieldOfStudy?: string;
  gpa?: string;
  description?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
}
