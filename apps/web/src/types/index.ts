// User Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt?: string;
}

// Profile Types
export interface Skill {
  id?: string; // Optional: present for existing skills, absent for new ones
  name: string;
  level?: string;
}

export interface Experience {
  id?: string; // Optional: present for existing experiences, absent for new ones
  title: string;
  company: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  current?: boolean;
}

export interface Education {
  id?: string; // Optional: present for existing education, absent for new ones
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number | null;
  gpa?: string;
  description?: string;
}

export interface Certificate {
  id?: string; // Optional: present for existing certificates, absent for new ones
  name: string;
  issuer: string;
  dateObtained?: string; // Backend uses dateObtained instead of issueDate (maps to issueDate in DB)
  url?: string; // Backend uses url (maps to credentialUrl in DB)
  // Note: Backend doesn't currently support expiryDate and credentialId
  // These fields are for future compatibility
  expiryDate?: string | null;
  credentialId?: string;
}

export interface Project {
  id?: string; // Optional: present for existing projects, absent for new ones
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string | null;
}

export interface Language {
  id?: string; // Optional: present for existing languages, absent for new ones
  name: string;
  level?: string;
}

export interface Profile {
  id: number;
  userId: number;
  summary?: string;
  phone?: string;
  location?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  skills?: Skill[];
  experiences?: Experience[];
  education?: Education[];
  certificates?: Certificate[];
  projects?: Project[];
  languages?: Language[];
  createdAt: string;
  updatedAt: string;
}

// Resume Draft Types
export interface ResumeSkillCategory {
  id?: string;
  type: string;
  skills: string[];
  _key?: string; // Internal key for React rendering
}

export interface ResumeExperience {
  id?: string;
  title: string;
  company: string;
  location?: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  achievements?: string[];
}

export interface ResumeProject {
  id?: string;
  name: string;
  description?: string;
  date?: string;
  highlights?: string[];
}

export interface ResumeEducation {
  id?: string;
  degree: string;
  institution: string;
  year: string;
  fieldOfStudy?: string;
  gpa?: string;
  description?: string;
}

export interface ResumeCertification {
  id?: string;
  name: string;
  issuer: string;
  date?: string;
}

export interface ResumeData {
  candidateName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  summary?: string;
  skillCategories: ResumeSkillCategory[];
  experiences: ResumeExperience[];
  projects?: ResumeProject[];
  education?: ResumeEducation[];
  certifications?: ResumeCertification[];
  languages?: { name: string; level?: string }[];
}

// DTO types for backend API (dates as strings for API transport)
export interface EducationDto {
  id?: string;
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: string; // ISO date string for backend
  endYear?: string; // ISO date string for backend
  gpa?: string;
  description?: string;
}

// DTO for updating profile (matches backend UpdateProfileDto)
export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary?: string;
  skills?: Skill[];
  experiences?: Experience[];
  education?: EducationDto[]; // Use DTO type with string dates
  certificates?: Certificate[];
  projects?: Project[];
  languages?: Language[];
}

// Job Posting Types
export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  niceToHave?: string[];
  rawText?: string;
  sourceUrl?: string;
  fileId?: string;
  createdAt: string;
  updatedAt: string;
}

// Template Types
export type TemplateType = 'COVER_LETTER' | 'RESUME' | 'BOTH';

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: TemplateType;
  category: string;
  thumbnailUrl?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateWithContent extends Template {
  htmlTemplate: string;
  cssStyles: string;
}

// Application Types

// PDF Generation Status (system-facing)
export type ApplicationGenerationStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

// Application Tracking Status (user-facing)
export type ApplicationTrackingStatus = 'CREATED' | 'APPLIED' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED';

// Legacy alias for backward compatibility
export type ApplicationStatus = ApplicationGenerationStatus;

export interface Application {
  id: string;
  userId: string;
  jobPostingId: string;
  
  // Custom title (LLM-generated, user editable)
  title?: string;
  
  // Application tracking status (user-facing)
  applicationStatus: ApplicationTrackingStatus;
  statusUpdatedAt?: string;
  
  // PDF generation status (system-facing)
  status: ApplicationGenerationStatus;
  
  notes?: string;
  coverLetterText?: string;
  resumeText?: string;
  coverLetterBlobKey?: string;
  resumeBlobKey?: string;
  coverLetterUrl?: string;
  resumeUrl?: string;
  errorMessage?: string;
  
  // Template selection
  coverLetterTemplateId?: string;
  resumeTemplateId?: string;
  
  createdAt: string;
  updatedAt: string;
  jobPosting?: JobPosting;
}

// Application Status Response (lightweight for polling)
export interface ApplicationStatusResponse {
  id: string;
  status: ApplicationGenerationStatus;
  errorMessage: string | null;
  updatedAt: string;
}

// Application Files Types
export interface ApplicationFile {
  key: string;
  filename: string;
  mimeType: string;
  url: string;
  expiresAt: string;
}

export interface ApplicationFilesResponse {
  applicationId: string;
  coverLetter?: ApplicationFile;
  resume?: ApplicationFile;
}

// Session Types
export interface Session {
  id: string;
  userId: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface SessionsResponse {
  sessions: Session[];
  currentSessionId: string;
}

// API Response Types
export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ErrorResponse {
  message: string;
  error?: string;
  statusCode: number;
}

// ATS Keywords Types
export interface ATSKeywords {
  technicalSkills: string[];
  softSkills: string[];
  responsibilityKeywords: string[];
  requirementKeywords: string[];
  toolsAndTechnologies: string[];
  industryKeywords: string[];
  senioritySignals: string[];
  miscKeywords: string[];
}

export type KeywordCategory = 
  | 'technical' 
  | 'soft' 
  | 'responsibility' 
  | 'requirement' 
  | 'tool' 
  | 'industry' 
  | 'seniority' 
  | 'misc';

export interface KeywordMatch {
  keyword: string;
  category: KeywordCategory;
  found: boolean;
  usedIn?: string[];
  confidence: number;
}

export interface CategoryScores {
  technical: number;
  soft: number;
  experience: number;
  industry: number;
}

export interface MatchAnalysis {
  overallScore: number;
  categoryScores: CategoryScores;
  suggestions: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface ApplicationKeywordsResponse {
  applicationId: string;
  keywords: ATSKeywords;
  matchAnalysis: MatchAnalysis;
  matchedKeywords: KeywordMatch[];
  missingKeywords: KeywordMatch[];
  analyzedAt: string;
}

export type PipelineStage = 
  | 'pending' 
  | 'extracting-keywords' 
  | 'generating-cv' 
  | 'generating-cl' 
  | 'finalizing' 
  | 'complete' 
  | 'failed';

export interface PipelineStatus {
  stage: PipelineStage;
  progress: number;
  message: string;
  timestamp: string;
  error?: string;
}

// User Preferences Types
export interface UserPreferences {
  id: string;
  userId: string;
  applicationUpdates: boolean;
  newJobPostings: boolean;
  marketingEmails: boolean;
  language: string;
  theme: string;
  profilePublic: boolean;
  analyticsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserPreferencesDto {
  applicationUpdates?: boolean;
  newJobPostings?: boolean;
  marketingEmails?: boolean;
  language?: string;
  theme?: string;
  profilePublic?: boolean;
  analyticsEnabled?: boolean;
}
