import type { Profile, ResumeData, ResumeExperience, ResumeSkillCategory } from '@/types';

const DEFAULT_CATEGORY = 'Kompetenzen';
const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'short',
  year: 'numeric',
});

export function createClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatRange(start?: string | number | null, end?: string | number | null) {
  if (!start && !end) {
    return 'Aktuell';
  }

  const parseDate = (value?: string | number | null) => {
    if (!value) return undefined;
    if (typeof value === 'number') {
      return new Date(`${value}`);
    }
    return new Date(value);
  };

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  const startLabel = startDate ? monthFormatter.format(startDate) : 'Start';
  const endLabel = endDate ? monthFormatter.format(endDate) : 'Heute';
  return `${startLabel} – ${endLabel}`;
}

function buildSkillCategories(profile: Profile): ResumeSkillCategory[] {
  if (!profile.skills?.length) {
    return [];
  }

  return [
    {
      id: createClientId(),
      type: DEFAULT_CATEGORY,
      skills: profile.skills.map((skill) => skill.name),
    },
  ];
}

export function buildResumeFromProfile(
  profile: Profile,
  options?: { candidateName?: string; email?: string },
): ResumeData {
  return {
    candidateName: options?.candidateName || 'Vorname Nachname',
    email: options?.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    linkedin: profile.linkedinUrl || '',
    github: profile.githubUrl || '',
    summary: profile.summary || '',
    skillCategories: buildSkillCategories(profile),
    experiences: (profile.experiences || []).map((experience) => ({
      id: experience.id || createClientId(),
      title: experience.title,
      company: experience.company,
      location: experience.location || undefined,
      startDate: experience.startDate,
      endDate: experience.endDate || undefined,
      dateRange: formatRange(experience.startDate, experience.endDate),
      achievements: experience.description
        ? experience.description.split('\n').filter(Boolean)
        : [],
    })),
    projects: (profile.projects || []).map((project) => ({
      id: project.id || createClientId(),
      name: project.name,
      description: project.description || undefined,
      date: project.startDate || undefined,
      highlights: project.technologies || [],
    })),
    education: (profile.education || []).map((education) => ({
      id: education.id || createClientId(),
      degree: education.degree,
      institution: education.institution,
      fieldOfStudy: education.fieldOfStudy || undefined,
      gpa: education.gpa || undefined,
      description: education.description || undefined,
      year: formatRange(education.startYear, education.endYear),
    })),
    certifications: (profile.certificates || []).map((cert) => ({
      id: cert.id || createClientId(),
      name: cert.name,
      issuer: cert.issuer,
      date: cert.dateObtained || undefined,
    })),
    languages: (profile.languages || []).map((lang) => ({
      name: lang.name,
      level: lang.level || undefined,
    })),
  };
}

export function parseResumeDraft(resumeText?: string | null): ResumeData | null {
  if (!resumeText) {
    return null;
  }

  try {
    return JSON.parse(resumeText) as ResumeData;
  } catch (error) {
    console.error('Failed to parse resume JSON', error);
    return null;
  }
}

function withDateRange(experience: ResumeExperience): ResumeExperience {
  return {
    ...experience,
    dateRange: experience.dateRange || formatRange(experience.startDate, experience.endDate),
    achievements: experience.achievements?.filter(Boolean),
  };
}

export function normalizeResumeForSave(resume: ResumeData): ResumeData {
  const trim = (value?: string) => value?.trim() || undefined;

  return {
    ...resume,
    candidateName: resume.candidateName.trim(),
    email: resume.email.trim(),
    phone: trim(resume.phone),
    location: trim(resume.location),
    linkedin: trim(resume.linkedin),
    github: trim(resume.github),
    summary: trim(resume.summary),
    skillCategories: (resume.skillCategories || [])
      .map((category) => ({
        id: category.id,
        type: category.type.trim(),
        skills: category.skills.map((skill) => skill.trim()).filter(Boolean),
      }))
      .filter((category) => category.type && category.skills.length),
    experiences: (resume.experiences || [])
      .map((experience) => ({
        ...withDateRange(experience),
        title: experience.title.trim(),
        company: experience.company.trim(),
        location: trim(experience.location),
      }))
      .filter((experience) => experience.title && experience.company),
    projects: resume.projects
      ?.map((project) => ({
        ...project,
        name: project.name.trim(),
        description: trim(project.description),
        highlights: project.highlights?.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((project) => project.name),
    education: resume.education
      ?.map((education) => ({
        ...education,
        degree: education.degree.trim(),
        institution: education.institution.trim(),
        fieldOfStudy: trim(education.fieldOfStudy),
        gpa: trim(education.gpa),
        description: trim(education.description),
        year: education.year.trim(),
      }))
      .filter((education) => education.degree && education.institution),
    certifications: resume.certifications
      ?.map((certification) => ({
        ...certification,
        name: certification.name.trim(),
        issuer: certification.issuer.trim(),
        date: trim(certification.date),
      }))
      .filter((certification) => certification.name && certification.issuer),
  };
}
