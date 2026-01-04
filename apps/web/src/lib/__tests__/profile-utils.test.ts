import { calculateProfileStrength } from '../profile-utils';
import type { Profile, User } from '@/types';

describe('calculateProfileStrength', () => {
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockProfile: Profile = {
    id: 1,
    userId: 1,
    phone: '+1234567890',
    location: 'Berlin, Germany',
    summary: 'Experienced professional',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    skills: [{ name: 'JavaScript' }, { name: 'TypeScript' }],
    experiences: [
      {
        title: 'Software Engineer',
        company: 'Tech Corp',
        startDate: '2020-01-01',
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        institution: 'University',
      },
    ],
    certificates: [],
    projects: [],
    languages: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  it('should return 100% for a complete profile', () => {
    const result = calculateProfileStrength(mockProfile, mockUser);
    expect(result.score).toBe(100);
    expect(result.suggestions.every(s => s.completed)).toBe(true);
  });

  it('should return 0% for empty profile and no user', () => {
    const result = calculateProfileStrength(null, null);
    expect(result.score).toBe(0);
    expect(result.suggestions.every(s => !s.completed)).toBe(true);
  });

  it('should give 10 points for basic user info', () => {
    const result = calculateProfileStrength(null, mockUser);
    expect(result.score).toBe(10);
    expect(result.suggestions[0].completed).toBe(true);
    expect(result.suggestions[0].text).toContain('Kontaktdaten');
  });

  it('should not give points for missing phone', () => {
    const profileWithoutPhone = { ...mockProfile, phone: undefined };
    const result = calculateProfileStrength(profileWithoutPhone, mockUser);
    expect(result.score).toBe(90);
    const phoneSuggestion = result.suggestions.find(s => s.text.includes('Telefon'));
    expect(phoneSuggestion?.completed).toBe(false);
  });

  it('should not give points for missing LinkedIn', () => {
    const profileWithoutLinkedIn = { ...mockProfile, linkedinUrl: undefined };
    const result = calculateProfileStrength(profileWithoutLinkedIn, mockUser);
    expect(result.score).toBe(90);
    const linkedInSuggestion = result.suggestions.find(s => s.text.includes('LinkedIn'));
    expect(linkedInSuggestion?.completed).toBe(false);
  });

  it('should not give points for empty skills array', () => {
    const profileWithoutSkills = { ...mockProfile, skills: [] };
    const result = calculateProfileStrength(profileWithoutSkills, mockUser);
    expect(result.score).toBe(85);
    const skillsSuggestion = result.suggestions.find(s => s.text.includes('Fähigkeiten'));
    expect(skillsSuggestion?.completed).toBe(false);
  });

  it('should not give points for empty experience array', () => {
    const profileWithoutExperience = { ...mockProfile, experiences: [] };
    const result = calculateProfileStrength(profileWithoutExperience, mockUser);
    expect(result.score).toBe(85);
    const expSuggestion = result.suggestions.find(s => s.text.includes('Berufserfahrung'));
    expect(expSuggestion?.completed).toBe(false);
  });

  it('should not give points for empty education array', () => {
    const profileWithoutEducation = { ...mockProfile, education: [] };
    const result = calculateProfileStrength(profileWithoutEducation, mockUser);
    expect(result.score).toBe(85);
    const eduSuggestion = result.suggestions.find(s => s.text.includes('Ausbildung'));
    expect(eduSuggestion?.completed).toBe(false);
  });

  it('should handle partial profile completion', () => {
    const partialProfile: Profile = {
      ...mockProfile,
      phone: undefined,
      location: undefined,
      summary: undefined,
      linkedinUrl: undefined,
      experiences: [],
      education: [],
    };
    const result = calculateProfileStrength(partialProfile, mockUser);
    // Only: user info (10) + skills (15) = 25
    expect(result.score).toBe(25);
    expect(result.suggestions.filter(s => s.completed).length).toBe(2);
  });

  it('should return all 8 suggestions', () => {
    const result = calculateProfileStrength(mockProfile, mockUser);
    expect(result.suggestions).toHaveLength(8);
  });
});
