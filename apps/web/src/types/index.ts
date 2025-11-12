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
  name: string;
  level?: string;
}

export interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  description?: string;
  current?: boolean;
}

export interface Education {
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number | null;
  gpa?: string;
  description?: string;
}

export interface Certificate {
  name: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string | null;
  credentialId?: string;
  url?: string;
}

export interface Project {
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
  skills: Skill[];
  experiences: Experience[];
  education: Education[];
  certificates: Certificate[];
  projects: Project[];
  createdAt: string;
  updatedAt: string;
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
}

// Job Posting Types
export interface JobPosting {
  id: number;
  userId: number;
  title: string;
  company: string;
  location?: string;
  description?: string;
  requirements?: string;
  salary?: string;
  url?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

// Application Types
export type ApplicationStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

export interface Application {
  id: number;
  userId: number;
  jobPostingId: number;
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
