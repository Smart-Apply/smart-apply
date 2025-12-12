import { z } from 'zod';

/**
 * Phone number validation regex for E.164 international format
 * - Starts with optional + sign
 * - Followed by 1-15 digits
 * Examples: +49123456789, +1234567890, +441234567890
 */
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

/**
 * Validation schema for profile form
 * Matches backend UpdateProfileDto validation rules
 */
export const profileFormSchema = z.object({
  firstName: z.string().min(2, 'Vorname muss mindestens 2 Zeichen lang sein'),
  lastName: z.string().min(2, 'Nachname muss mindestens 2 Zeichen lang sein'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefonnummer muss im internationalen Format sein (z.B. +49123456789)')
    .optional()
    .or(z.literal('')),
  location: z.string().optional(),
  linkedIn: z.string().url('Ungültige URL').optional().or(z.literal('')),
  website: z.string().url('Ungültige URL').optional().or(z.literal('')),
  summary: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
