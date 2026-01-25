// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// Subscription Types
// ============================================

export type SubscriptionTier = 'FREE' | 'PREMIUM' | 'PREMIUM_PLUS';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE';

export interface TierFeatures {
  customTemplates: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  interviewCoach: boolean;
}

export interface TierLimits {
  applicationsPerMonth: number;
  interviewSessionsPerMonth: number;
  priority: 'low' | 'normal' | 'high';
  features: TierFeatures;
}

export interface UsageStat {
  used: number;
  limit: number;
  remaining: number;
}

export interface SubscriptionUsageStats {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  applications: UsageStat;
  interviewSessions: UsageStat;
  periodStart: string;
  periodEnd: string;
  features: TierFeatures;
}

export interface TierInfo {
  id: SubscriptionTier;
  name: string;
  price: number;
  features: string[];
  limits: TierLimits;
}

export interface TiersResponse {
  tiers: TierInfo[];
}

export interface CanPerformActionResult {
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
}

// ============================================
// Profile Types
// ============================================

export interface Skill {
  id?: string;
  name: string;
  level?: string;
}

export interface Experience {
  id?: string;
  title: string;
  company: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  current?: boolean;
}

export interface Education {
  id?: string;
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number | null;
  gpa?: string;
  description?: string;
}

export interface Certificate {
  id?: string;
  name: string;
  issuer: string;
  dateObtained?: string;
  url?: string;
  expiryDate?: string | null;
  credentialId?: string;
}

export interface Project {
  id?: string;
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string | null;
}

export interface Language {
  id?: string;
  name: string;
  level?: string;
}

export interface Profile {
  id: number;
  userId: number;
  summary?: string;
  phone?: string;
  street?: string; // Street and house number (e.g., "Musterstraße 123")
  postalCode?: string; // Postal code / PLZ (e.g., "47057")
  city?: string; // City name (e.g., "Duisburg")
  country?: string; // Country name (e.g., "Deutschland")
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  skills?: Skill[];
  experiences?: Experience[];
  education?: Education[];
  certificates?: Certificate[];
  projects?: Project[];
  languages?: Language[];
  profileKeywords?: ProfileKeywordsDto; // Cached ATS keywords
  lastKeywordsExtractedAt?: string; // Cache timestamp
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Profile Keywords Types (ATS Optimization)
// ============================================

export interface ProfileKeywordDto {
  keyword: string;
  source: 'job' | 'profile' | 'both';
  priority: 1 | 2 | 3;
}

export interface ProfileKeywordsDto {
  hard_skills: ProfileKeywordDto[];
  tools_and_tech: ProfileKeywordDto[];
  domains: ProfileKeywordDto[];
  methodologies: ProfileKeywordDto[];
}

// ============================================
// DTOs for API Communication
// ============================================

export interface EducationDto {
  id?: string;
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: string;
  endYear?: string;
  gpa?: string;
  description?: string;
}

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  street?: string; // Street and house number
  postalCode?: string; // Postal code / PLZ
  city?: string; // City name
  country?: string; // Country name
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary?: string;
  skills?: Skill[];
  experiences?: Experience[];
  education?: EducationDto[];
  certificates?: Certificate[];
  projects?: Project[];
  languages?: Language[];
}

// ============================================
// Job Posting Types
// ============================================

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

// ============================================
// Template Types
// ============================================

export type TemplateType = 'COVER_LETTER' | 'RESUME' | 'BOTH';

export interface Template {
  id: string;
  name: string;
  description?: string;
  type: TemplateType;
  category: string;
  language: string;
  baseTemplateId?: string;
  accentColor?: string; // Primary accent color hex (e.g., "#9c7a5b")
  colorVariantName?: string; // Display name for color variant (e.g., "Ocean Blue")
  thumbnailUrl?: string;
  previewImageKey?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateWithContent extends Template {
  htmlTemplate: string;
  cssStyles: string;
}

// ============================================
// Application Types
// ============================================

export type ApplicationGenerationStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type ApplicationTrackingStatus =
  | 'CREATED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'ACCEPTED'
  | 'REJECTED';
export type ApplicationStatus = ApplicationGenerationStatus;

export interface Application {
  id: string;
  userId: string;
  jobPostingId: string;
  title?: string;
  targetJobTitle?: string;
  applicationStatus: ApplicationTrackingStatus;
  statusUpdatedAt?: string;
  status: ApplicationGenerationStatus;
  notes?: string;
  coverLetterText?: string;
  resumeText?: string;
  coverLetterBlobKey?: string;
  resumeBlobKey?: string;
  coverLetterUrl?: string;
  resumeUrl?: string;
  errorMessage?: string;
  coverLetterTemplateId?: string;
  resumeTemplateId?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
  jobPosting?: JobPosting;
}

export interface ApplicationStatusResponse {
  id: string;
  status: ApplicationGenerationStatus;
  errorMessage: string | null;
  updatedAt: string;
}

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

// ============================================
// Resume Draft Types
// ============================================

export interface ResumeSkillCategory {
  id?: string;
  type: string;
  skills: string[];
  _key?: string;
}

export interface ResumeExperience {
  id?: string;
  title: string;
  company: string;
  location?: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  description?: string;
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
  targetJobTitle?: string;
  email: string;
  phone?: string;
  // Address fields (replaces old 'location' field)
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  fullAddress?: string; // Computed: "Straße, PLZ Stadt, Land"
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

// ============================================
// Session Types
// ============================================

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

// ============================================
// Authentication Types
// ============================================

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ErrorResponse {
  message: string;
  error?: string;
  statusCode: number;
}

// ============================================
// ATS Keywords Types
// ============================================

export interface ATSKeywords {
  coreCompetencies: string[]; // Core skills relevant to profession
  softSkills: string[];
  responsibilityKeywords: string[];
  requirementKeywords: string[];
  methodologies: string[]; // Methods, tools, frameworks
  industryKeywords: string[];
  senioritySignals: string[];
  miscKeywords: string[];
}

export type KeywordCategory =
  | 'core' // Core competencies (profession-specific skills)
  | 'soft' // Soft skills
  | 'responsibility' // Job responsibilities
  | 'requirement' // Job requirements
  | 'methodology' // Methods, tools, techniques
  | 'industry' // Industry/domain knowledge
  | 'seniority' // Experience level
  | 'misc'; // Miscellaneous

export interface KeywordMatch {
  keyword: string;
  category: KeywordCategory;
  found: boolean;
  usedIn?: string[];
  confidence: number;
}

export interface CategoryScores {
  core: number; // Core competencies (hard skills only)
  soft: number; // Deprecated - no longer extracted (always 0)
  experience: number; // Professional experience
  industry: number; // Domain/sector knowledge
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

// ============================================
// User Preferences Types
// ============================================

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

// ============================================
// API Response Types
// ============================================

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated list response format
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  code?: string;
  errors?: any[];
  meta: {
    timestamp: string;
    path: string;
    method: string;
  };
}

// ============================================
// Resume Parser Types
// ============================================

/**
 * Extracted profile data from resume parsing
 */
export interface ExtractedProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary?: string;
  skills?: Array<{ name: string; level?: string }>;
  experiences?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string;
    current?: boolean;
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
  certificates?: Array<{
    name: string;
    issuer: string;
    dateObtained?: string;
    url?: string;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    url?: string;
  }>;
  languages?: Array<{
    name: string;
    level: string;
  }>;
}

