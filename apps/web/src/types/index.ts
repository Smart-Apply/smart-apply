// User Types
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  fullName?: string;
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

// Application Types
export type ApplicationStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

export interface Application {
  id: string;
  userId: string;
  jobPostingId: string;
  status: ApplicationStatus;
  coverLetterBlobKey?: string;
  resumeBlobKey?: string;
  coverLetterUrl?: string;
  resumeUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  jobPosting?: JobPosting;
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
