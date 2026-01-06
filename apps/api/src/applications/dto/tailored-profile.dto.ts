/**
 * Rewritten experience with professional descriptions
 */
export interface RewrittenExperience {
  /** Maps to Experience.id in DB (must match a selected_experience) */
  profileExperienceId: string;
  /** Professionally rewritten description with action verbs and metrics */
  rewritten_description: string;
  /** Rewritten achievements with quantified results */
  rewritten_achievements: string[];
}

/**
 * Rewritten project with professional descriptions
 */
export interface RewrittenProject {
  /** Maps to Project.id in DB (must match a selected_project) */
  profileProjectId: string;
  /** Professionally rewritten description emphasizing relevant technologies */
  rewritten_description: string;
  /** Key highlights with quantified impact */
  rewritten_highlights: string[];
}

/**
 * Output from resume-rewrite LLM call
 * Contains professionally rewritten profile content tailored to the job
 */
export interface RewrittenProfileDto {
  /** Summary rewritten to target the specific role and company */
  rewritten_summary: string;
  /** Professionally rewritten experiences with action verbs and metrics */
  rewritten_experiences: RewrittenExperience[];
  /** Professionally rewritten projects emphasizing job-relevant technologies */
  rewritten_projects: RewrittenProject[];
}

/**
 * Selected experience from candidate profile
 */
export interface SelectedExperience {
  /** Maps to Experience.id in DB (null if synthesized) */
  profileExperienceId: string | null;
  /** Job title */
  title: string;
  /** Company name */
  company: string;
  /** Brief summary (1-2 sentences) */
  summary: string;
  /** Why this experience is relevant for the target job */
  why_relevant: string;
}

/**
 * Selected project from candidate profile
 */
export interface SelectedProject {
  /** Maps to Project.id in DB (null if synthesized) */
  profileProjectId: string | null;
  /** Project name */
  name: string;
  /** Brief summary */
  summary: string;
  /** Why this project is relevant for the target job */
  why_relevant: string;
}

/**
 * Selected certificate from candidate profile
 */
export interface SelectedCertificate {
  /** Maps to Certificate.id in DB (null if synthesized) */
  profileCertificateId: string | null;
  /** Certificate name */
  name: string;
  /** Issuing organization */
  issuer: string;
  /** Date issued (ISO string or year) */
  issueDate?: string | null;
}

/**
 * Selected education from candidate profile
 */
export interface SelectedEducation {
  /** Maps to Education.id in DB (null if synthesized) */
  profileEducationId: string | null;
  /** Degree name */
  degree: string;
  /** Institution name */
  institution: string;
  /** Field of study */
  fieldOfStudy?: string | null;
  /** Start year */
  startYear?: string | null;
  /** End year or 'Present' */
  endYear?: string | null;
  /** GPA if notable */
  gpa?: string | null;
  /** Relevant coursework or achievements */
  description?: string | null;
}

/**
 * Selected language from candidate profile
 */
export interface SelectedLanguage {
  /** Language name (e.g., Deutsch, English) */
  name: string;
  /** Proficiency level (e.g., Native, Fluent, Advanced, Basic) */
  level?: string;
}

/**
 * Tailored profile output from skill-selector LLM
 * Contains only relevant profile data selected for a specific job posting
 */
export interface TailoredProfileDto {
  /** Target role inferred from job posting */
  target_role: string;
  /** Target company name */
  target_company: string;
  /** Brief reasoning for candidate-job fit (2-3 sentences) */
  reasoning_short: string;
  /** Selected hard skills/technologies (max 12) */
  selected_hard_skills: string[];
  /** Selected soft skills (max 6, only if explicitly required) */
  selected_soft_skills: string[];
  /** Selected tools/platforms (max 8) */
  selected_tools: string[];
  /** Selected relevant experiences (max 5) */
  selected_experiences: SelectedExperience[];
  /** Selected relevant projects (max 5) */
  selected_projects: SelectedProject[];
  /** Selected relevant certificates */
  selected_certificates: (string | SelectedCertificate)[];
  /** All education entries */
  selected_education: (string | SelectedEducation)[];
  /** Selected languages */
  selected_languages?: (string | SelectedLanguage)[];
}
