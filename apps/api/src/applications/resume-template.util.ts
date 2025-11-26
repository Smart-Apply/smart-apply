import type {
  Certificate,
  Education,
  Experience,
  Language,
  Profile,
  Project,
  Skill,
  User,
} from '@prisma/client';
import type {
  ResumeTemplateData,
  SkillCategory as ResumeSkillCategory,
} from '../pdf/template-renderer.service';

export type ProfileWithRelations = Profile & {
  user: User;
  skills: Skill[];
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  certificates: Certificate[];
  languages: Language[];
};

const DEFAULT_CATEGORY = 'Skills';

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(start?: Date | null, end?: Date | null, isCurrent?: boolean): string {
  const startLabel = formatDate(start) || 'Start';
  const endLabel = isCurrent ? 'Aktuell' : formatDate(end) || 'Heute';
  return `${startLabel} – ${endLabel}`;
}

function buildSkillCategories(skills: Skill[]): ResumeSkillCategory[] {
  if (!skills.length) {
    return [];
  }

  const grouped = skills.reduce<Record<string, string[]>>((acc, skill) => {
    const key = skill.category?.trim() || DEFAULT_CATEGORY;
    acc[key] = acc[key] || [];
    acc[key].push(skill.name);
    return acc;
  }, {});

  return Object.entries(grouped).map(([type, values]) => ({
    type,
    skills: values.filter(Boolean),
  }));
}

export function buildResumeTemplateData(profile: ProfileWithRelations): ResumeTemplateData {
  const candidateName =
    [profile.user.firstName, profile.user.lastName].filter(Boolean).join(' ').trim() ||
    profile.user.email;

  return {
    candidateName,
    email: profile.user.email,
    phone: profile.phone ?? undefined,
    linkedin: profile.linkedinUrl ?? undefined,
    github: profile.githubUrl ?? undefined,
    location: profile.location ?? undefined,
    summary: profile.summary ?? undefined,
    skillCategories: buildSkillCategories(profile.skills),
    experiences: profile.experiences
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map((exp) => ({
        title: exp.title,
        company: exp.company,
        location: exp.location ?? undefined,
        dateRange: formatDateRange(exp.startDate, exp.endDate, exp.isCurrent),
        achievements: exp.achievements?.length ? exp.achievements : undefined,
      })),
    projects: profile.projects.map((project) => ({
      name: project.name,
      description: project.description ?? undefined,
      date: project.startDate ? formatDate(project.startDate) : undefined,
      highlights: project.highlights?.length ? project.highlights : undefined,
    })),
    education: profile.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      fieldOfStudy: edu.fieldOfStudy ?? undefined,
      gpa: edu.gpa ?? undefined,
      description: edu.description ?? undefined,
      year: formatDateRange(edu.startYear, edu.endYear),
    })),
    certifications: profile.certificates.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.issueDate ? formatDate(cert.issueDate) : undefined,
    })),
    languages: profile.languages?.map((lang) => ({
      name: lang.name,
      level: lang.level ?? undefined,
    })) ?? [],
  };
}
