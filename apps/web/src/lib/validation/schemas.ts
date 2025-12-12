import { z } from 'zod';

/**
 * Centralized Zod validation schemas matching backend DTOs
 * 
 * All schemas mirror backend class-validator rules to ensure
 * client-side validation catches errors before API calls.
 * 
 * Error messages are in German for consistency with the UI.
 */

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Password validation regex matching backend requirements
 * Must contain: lowercase, uppercase, number, special char (@$!%*?&#)
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[\w@$!%*?&#]{8,}$/;

export const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich').optional(),
  lastName: z.string().min(1, 'Nachname ist erforderlich').optional(),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
    .regex(
      PASSWORD_REGEX,
      'Passwort muss einen Großbuchstaben, einen Kleinbuchstaben, eine Zahl und ein Sonderzeichen (@$!%*?&#) enthalten'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z
    .string()
    .min(8, 'Neues Passwort muss mindestens 8 Zeichen lang sein')
    .regex(
      PASSWORD_REGEX,
      'Passwort muss einen Großbuchstaben, einen Kleinbuchstaben, eine Zahl und ein Sonderzeichen (@$!%*?&#) enthalten'
    ),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmNewPassword'],
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

/**
 * Phone number validation regex for E.164 international format
 * - Starts with optional + sign
 * - Followed by 1-15 digits
 * Examples: +49123456789, +1234567890, +441234567890
 */
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const profileSchema = z.object({
  firstName: z.string().min(1, 'Vorname ist erforderlich').optional(),
  lastName: z.string().min(1, 'Nachname ist erforderlich').optional(),
  email: z.string().email('Ungültige E-Mail-Adresse').optional(),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefonnummer muss im internationalen Format sein (z.B. +49123456789)')
    .optional()
    .or(z.literal('')),
  location: z.string().optional(),
  linkedinUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
  githubUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
  portfolioUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
  summary: z.string().optional(),
});

export const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Skill-Name ist erforderlich'),
  level: z.string().optional(),
});

export const certificateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name ist erforderlich'),
  issuer: z.string().min(1, 'Aussteller ist erforderlich'),
  dateObtained: z.string().optional(),
  url: z.string().url('Ungültige URL').optional().or(z.literal('')),
});

export const experienceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Jobtitel ist erforderlich'),
  company: z.string().min(1, 'Firma ist erforderlich'),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Startdatum ist erforderlich'),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
});

export const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Projektname ist erforderlich'),
  description: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  url: z.string().url('Ungültige URL').optional().or(z.literal('')),
});

export const educationSchema = z.object({
  id: z.string().optional(),
  degree: z.string().min(1, 'Abschluss ist erforderlich'),
  institution: z.string().min(1, 'Institution ist erforderlich'),
  fieldOfStudy: z.string().optional(),
  startYear: z.string().optional(), // DateString format
  endYear: z.string().optional(), // DateString format
  gpa: z.string().optional(),
  description: z.string().optional(),
});

export const languageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Sprachname ist erforderlich'),
  level: z.string().min(1, 'Sprachniveau ist erforderlich'),
});

// ============================================================================
// JOB POSTING SCHEMAS
// ============================================================================

export const jobPostingSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(200, 'Titel darf maximal 200 Zeichen haben'),
  company: z.string().min(1, 'Unternehmen ist erforderlich').max(200, 'Unternehmen darf maximal 200 Zeichen haben'),
  location: z.string().max(200, 'Standort darf maximal 200 Zeichen haben').optional(),
  language: z.string().max(10, 'Sprache darf maximal 10 Zeichen haben').optional(),
  url: z.string().url('Ungültige URL').optional().or(z.literal('')),
  fullText: z.string().min(1, 'Volltext ist erforderlich'),
  salary: z.string().max(100, 'Gehalt darf maximal 100 Zeichen haben').optional(),
  employmentType: z.string().max(50, 'Beschäftigungsart darf maximal 50 Zeichen haben').optional(),
});

export const jobPostingEditSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(200, 'Titel darf maximal 200 Zeichen haben'),
  company: z.string().min(1, 'Unternehmen ist erforderlich').max(200, 'Unternehmen darf maximal 200 Zeichen haben'),
  location: z.string().max(200, 'Standort darf maximal 200 Zeichen haben').optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
});

export const jobPostingUrlSchema = z.object({
  url: z.string().url('Bitte gebe eine gültige URL ein'),
});

export const jobPostingTextSchema = z.object({
  text: z.string().min(10, 'Text muss mindestens 10 Zeichen lang sein'),
});

// ============================================================================
// APPLICATION SCHEMAS
// ============================================================================

export const createApplicationSchema = z.object({
  jobPostingId: z.string().min(1, 'Job Posting ID ist erforderlich'),
  coverLetterTemplateId: z.string().optional(),
  resumeTemplateId: z.string().optional(),
  generateCoverLetter: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updateApplicationTitleSchema = z.object({
  title: z
    .string()
    .min(3, 'Titel muss mindestens 3 Zeichen lang sein')
    .max(200, 'Titel darf maximal 200 Zeichen haben'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type SkillFormValues = z.infer<typeof skillSchema>;
export type CertificateFormValues = z.infer<typeof certificateSchema>;
export type ExperienceFormValues = z.infer<typeof experienceSchema>;
export type ProjectFormValues = z.infer<typeof projectSchema>;
export type EducationFormValues = z.infer<typeof educationSchema>;
export type LanguageFormValues = z.infer<typeof languageSchema>;

export type JobPostingFormValues = z.infer<typeof jobPostingSchema>;
export type JobPostingEditFormValues = z.infer<typeof jobPostingEditSchema>;
export type JobPostingUrlFormValues = z.infer<typeof jobPostingUrlSchema>;
export type JobPostingTextFormValues = z.infer<typeof jobPostingTextSchema>;

export type CreateApplicationFormValues = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationTitleFormValues = z.infer<typeof updateApplicationTitleSchema>;
