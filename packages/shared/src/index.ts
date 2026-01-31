// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// OAuth Types
// ============================================

export type OAuthProviderType = 'GOOGLE' | 'MICROSOFT' | 'LINKEDIN' | 'APPLE' | 'FACEBOOK';

export interface OAuthProvider {
  provider: OAuthProviderType;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastUsedAt: string;
  createdAt: string;
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

// ============================================
// Interview Coach Types (Premium Feature)
// ============================================

export type InterviewType = 'BEHAVIORAL' | 'TECHNICAL' | 'CASE_STUDY' | 'MIXED';
export type InterviewDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type InterviewSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type InterviewQuestionType = 'OPEN' | 'SITUATIONAL' | 'TECHNICAL' | 'BEHAVIORAL' | 'FOLLOW_UP';

export interface InterviewQuestion {
  id: string;
  questionText: string;
  questionType: InterviewQuestionType;
  order: number;
  userAnswer?: string;
  answerDuration?: number;
  score?: number;
  feedback?: string;
  improvementTips?: string[];
  askedAt: string;
  answeredAt?: string;
}

export interface InterviewFeedback {
  id: string;
  overallScore: number;
  technicalScore?: number;
  communicationScore: number;
  presentationScore: number;
  problemSolvingScore?: number;
  cultureFitScore?: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  idealAnswers?: Record<string, string>;
  createdAt: string;
}

export interface InterviewSession {
  id: string;
  type: InterviewType;
  industry?: string;
  difficulty: InterviewDifficulty;
  language: string;
  jobTitle?: string;
  company?: string;
  applicationId?: string;
  maxQuestions: number;
  timeLimitMinutes?: number;
  status: InterviewSessionStatus;
  startedAt: string;
  completedAt?: string;
  overallScore?: number;
  questionsCount: number;
  answeredCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSessionDetail extends InterviewSession {
  questions: InterviewQuestion[];
  feedback?: InterviewFeedback;
}

export interface StartInterviewDto {
  applicationId?: string;
  type?: InterviewType;
  industry?: string;
  difficulty?: InterviewDifficulty;
  language?: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  maxQuestions?: number;
  timeLimitMinutes?: number;
}

export interface SubmitAnswerDto {
  answer: string;
  answerDuration?: number;
}

export interface NextQuestionResponse {
  question: InterviewQuestion;
  currentQuestion: number;
  totalQuestions: number;
  isLastQuestion: boolean;
}

export interface AnswerResponse {
  success: boolean;
  question: InterviewQuestion;
  hasMoreQuestions: boolean;
  message?: string;
}

export interface InterviewStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  bestScore: number;
  totalQuestionsAnswered: number;
  scoreImprovement: number;
  mostPracticedType: InterviewType;
  sessionsByType: Record<InterviewType, number>;
  averageCategoryScores: {
    technical?: number;
    communication: number;
    presentation: number;
    problemSolving?: number;
    cultureFit?: number;
  };
}

export interface InterviewSessionsResponse {
  sessions: InterviewSession[];
  total: number;
}

// ============================================
// Two-Factor Authentication Types
// ============================================

export interface TwoFactorStatus {
  isEnabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
  trustedDevicesCount: number;
}

export interface Setup2FAResponse {
  tempSecret: string;
  qrCodeDataUrl: string;
  otpAuthUrl: string;
}

export interface Verify2FASetupDto {
  code: string;
  tempSecret: string;
}

export interface Verify2FASetupResponse {
  backupCodes: string[];
}

export interface Verify2FALoginDto {
  challengeToken: string;
  code: string;
  trustDevice?: boolean;
}

export interface Disable2FADto {
  password: string;
}

export interface RegenerateBackupCodesDto {
  password: string;
}

export interface TwoFactorChallengeResponse {
  requiresTwoFactor: boolean;
  challengeToken: string;
  methods: string[];
}

export interface TrustedDevice {
  id: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface TrustedDevicesResponse {
  devices: TrustedDevice[];
}

