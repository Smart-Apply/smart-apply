/**
 * Agent interfaces for the Smart Apply agent-based pipeline
 */

/**
 * Base interface for all agents
 */
export interface Agent<TInput, TOutput> {
  /**
   * Execute the agent with the given input
   */
  execute(input: TInput): Promise<TOutput>;

  /**
   * Get the agent's name for logging
   */
  getName(): string;
}

/**
 * Job posting input for ATS extraction
 */
export interface ATSAgentInput {
  jobPosting: {
    title: string;
    company: string;
    location: string | null;
    fullText: string; // Complete job posting text (description, requirements, responsibilities, benefits, etc.)
    language: 'de' | 'en' | null;
  };
}

/**
 * Extracted keywords from ATS Agent
 */
export interface ATSAgentOutput {
  coreCompetencies: string[];      // Core skills (profession-specific)
  softSkills: string[];
  responsibilityKeywords: string[];
  requirementKeywords: string[];
  methodologies: string[];         // Methods, tools, frameworks
  industryKeywords: string[];
  senioritySignals: string[];
  miscKeywords: string[];
}

/**
 * CV Agent input - receives keywords and profile data
 */
export interface CVAgentInput {
  keywords: ATSAgentOutput;
  profile: ProfileData;
  jobPosting: {
    title: string;
    company: string;
    fullText: string; // Complete job posting text
  };
  language: 'de' | 'en';
}

/**
 * CV Agent output - optimized resume content
 */
export interface CVAgentOutput {
  summary: string;
  selectedSkills: SelectedSkill[];
  selectedExperiences: SelectedExperience[];
  selectedProjects: SelectedProject[];
  selectedEducation: SelectedEducation[];
  selectedCertificates: string[];
  keywordMatches: KeywordMatch[];
  matchScore: number;
}

/**
 * Cover Letter Agent input
 */
export interface CLAgentInput {
  keywords: ATSAgentOutput;
  profile: ProfileData;
  jobPosting: {
    title: string;
    company: string;
    fullText: string; // Complete job posting text
  };
  language: 'de' | 'en';
}

/**
 * Cover Letter Agent output
 */
export interface CLAgentOutput {
  coverLetter: string;
  keyHighlights: string[];
  keywordUsage: KeywordMatch[];
  tone: 'formal' | 'semi-formal' | 'casual';
}

/**
 * Profile data structure
 */
export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  summary?: string;
  skills: {
    id: string;
    name: string;
    level?: string;
  }[];
  experiences: {
    id: string;
    title: string;
    company: string;
    location?: string;
    startDate: Date;
    endDate?: Date;
    current: boolean;
    description?: string;
  }[];
  education: {
    id: string;
    degree: string;
    institution: string;
    fieldOfStudy?: string;
    startDate?: Date;
    endDate?: Date;
  }[];
  certificates: {
    id: string;
    name: string;
    issuer: string;
    issueDate?: Date;
    expiryDate?: Date;
  }[];
  projects: {
    id: string;
    name: string;
    description?: string;
    url?: string;
    technologies: string[];
  }[];
  languages: {
    id: string;
    name: string;
    level: string;
  }[];
}

/**
 * Selected skill with relevance score
 */
export interface SelectedSkill {
  name: string;
  level?: string;
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Selected experience with highlights
 */
export interface SelectedExperience {
  title: string;
  company: string;
  duration: string;
  highlights: string[];
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Selected project with relevance
 */
export interface SelectedProject {
  name: string;
  description: string;
  technologies: string[];
  relevanceScore: number;
  matchedKeywords: string[];
}

/**
 * Selected education entry
 */
export interface SelectedEducation {
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  relevanceScore: number;
}

/**
 * Keyword match result
 */
export interface KeywordMatch {
  keyword: string;
  category:
    | 'core'
    | 'soft'
    | 'responsibility'
    | 'requirement'
    | 'methodology'
    | 'industry'
    | 'seniority'
    | 'misc';
  found: boolean;
  usedIn: (
    | 'summary'
    | 'skills'
    | 'experience'
    | 'projects'
    | 'education'
    | 'certificates'
    | 'cover-letter'
  )[];
  confidence: number;
}

/**
 * Pipeline status for SSE updates
 */
export interface PipelineStatus {
  stage:
    | 'pending'
    | 'extracting-keywords'
    | 'generating-cv'
    | 'generating-cl'
    | 'finalizing'
    | 'complete'
    | 'failed';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  error?: string;
}

/**
 * Complete pipeline result
 */
export interface PipelineResult {
  keywords: ATSAgentOutput;
  cv: CVAgentOutput;
  coverLetter: CLAgentOutput;
  matchAnalysis: {
    overallScore: number;
    categoryScores: {
      technical: number;
      soft: number;
      experience: number;
      industry: number;
    };
    suggestions: string[];
    strengths: string[];
    weaknesses: string[];
  };
  generatedAt: Date;
}
