import type { Profile, User } from '@/types';

export interface ProfileStrengthResult {
  score: number;
  suggestions: ProfileSuggestion[];
}

export interface ProfileSuggestion {
  text: string;
  completed: boolean;
}

/**
 * Calculate profile strength/completeness based on filled fields
 * Returns a score from 0-100 and suggestions for completion
 * 
 * Scoring breakdown:
 * - Basic Info (firstName, lastName, email): 10 points
 * - Contact (phone): 10 points
 * - Location: 10 points
 * - Summary: 15 points
 * - Skills: 15 points
 * - Experience: 15 points
 * - Education: 15 points
 * - LinkedIn URL: 10 points
 * 
 * Total: 100 points
 */
export function calculateProfileStrength(
  profile: Profile | null | undefined,
  user: User | null | undefined
): ProfileStrengthResult {
  let score = 0;
  const suggestions: ProfileSuggestion[] = [];

  // Basic Info (10 points)
  const hasBasicInfo = user?.firstName && user?.lastName && user?.email;
  if (hasBasicInfo) {
    score += 10;
  }
  suggestions.push({
    text: 'Kontaktdaten vollständig',
    completed: !!hasBasicInfo,
  });

  // Phone (10 points)
  const hasPhone = !!profile?.phone;
  if (hasPhone) {
    score += 10;
  }
  suggestions.push({
    text: 'Telefonnummer hinzufügen',
    completed: hasPhone,
  });

  // Location (10 points)
  const hasLocation = !!profile?.location;
  if (hasLocation) {
    score += 10;
  }
  suggestions.push({
    text: 'Standort angeben',
    completed: hasLocation,
  });

  // Summary (15 points)
  const hasSummary = !!profile?.summary;
  if (hasSummary) {
    score += 15;
  }
  suggestions.push({
    text: 'Profil-Zusammenfassung schreiben',
    completed: hasSummary,
  });

  // Skills (15 points)
  const hasSkills = profile?.skills && profile.skills.length > 0;
  if (hasSkills) {
    score += 15;
  }
  suggestions.push({
    text: 'Fähigkeiten hinzufügen',
    completed: !!hasSkills,
  });

  // Experience (15 points)
  const hasExperience = profile?.experiences && profile.experiences.length > 0;
  if (hasExperience) {
    score += 15;
  }
  suggestions.push({
    text: 'Berufserfahrung hinzufügen',
    completed: !!hasExperience,
  });

  // Education (15 points)
  const hasEducation = profile?.education && profile.education.length > 0;
  if (hasEducation) {
    score += 15;
  }
  suggestions.push({
    text: 'Ausbildung hinzufügen',
    completed: !!hasEducation,
  });

  // LinkedIn (10 points)
  const hasLinkedIn = !!profile?.linkedinUrl;
  if (hasLinkedIn) {
    score += 10;
  }
  suggestions.push({
    text: 'LinkedIn verknüpfen',
    completed: hasLinkedIn,
  });

  return {
    score: Math.min(score, 100),
    suggestions,
  };
}
