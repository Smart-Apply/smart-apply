/**
 * Profile Test Fixtures
 * Reusable test data for Profile module testing
 */

export const mockProfile = {
  id: 'profile-id-123',
  userId: 'user-id-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+49 123 456789',
  location: 'Berlin, Germany',
  summary:
    'Experienced Full-Stack Developer with 5+ years of expertise in TypeScript, React, and Node.js.',
  website: 'https://johndoe.dev',
  linkedin: 'https://linkedin.com/in/johndoe',
  github: 'https://github.com/johndoe',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockSkills = [
  {
    id: 'skill-1',
    name: 'TypeScript',
    level: 'Expert',
    category: 'Programming Languages',
    profileId: 'profile-id-123',
  },
  {
    id: 'skill-2',
    name: 'React',
    level: 'Advanced',
    category: 'Frontend',
    profileId: 'profile-id-123',
  },
  {
    id: 'skill-3',
    name: 'Node.js',
    level: 'Expert',
    category: 'Backend',
    profileId: 'profile-id-123',
  },
  {
    id: 'skill-4',
    name: 'Docker',
    level: 'Intermediate',
    category: 'DevOps',
    profileId: 'profile-id-123',
  },
  {
    id: 'skill-5',
    name: 'Azure',
    level: 'Advanced',
    category: 'Cloud',
    profileId: 'profile-id-123',
  },
];

export const mockExperiences = [
  {
    id: 'exp-1',
    company: 'Tech Corp GmbH',
    title: 'Senior Full-Stack Developer',
    location: 'Berlin, Germany',
    startDate: new Date('2020-01-01'),
    endDate: new Date('2023-12-31'),
    current: false,
    description:
      'Led development of cloud-native applications using TypeScript, React, and Azure. Mentored junior developers and implemented CI/CD pipelines.',
    profileId: 'profile-id-123',
  },
  {
    id: 'exp-2',
    company: 'Startup Inc',
    title: 'Full-Stack Developer',
    location: 'Munich, Germany',
    startDate: new Date('2018-06-01'),
    endDate: new Date('2019-12-31'),
    current: false,
    description:
      'Built scalable web applications using Node.js, React, and PostgreSQL. Implemented RESTful APIs and microservices architecture.',
    profileId: 'profile-id-123',
  },
];

export const mockEducation = [
  {
    id: 'edu-1',
    institution: 'Technical University of Munich',
    degree: 'Master of Science',
    field: 'Computer Science',
    startYear: new Date('2015-10-01'),
    endYear: new Date('2017-09-30'),
    grade: '1.5',
    description: 'Specialized in Software Engineering and Distributed Systems',
    profileId: 'profile-id-123',
  },
  {
    id: 'edu-2',
    institution: 'University of Stuttgart',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startYear: new Date('2012-10-01'),
    endYear: new Date('2015-09-30'),
    grade: '2.0',
    description: 'Focus on Algorithms and Data Structures',
    profileId: 'profile-id-123',
  },
];

export const mockCertificates = [
  {
    id: 'cert-1',
    name: 'Azure Solutions Architect Expert',
    issuer: 'Microsoft',
    issueDate: new Date('2023-01-15'),
    expiryDate: new Date('2025-01-15'),
    credentialId: 'AZ-305-123456',
    credentialUrl: 'https://learn.microsoft.com/credentials/123456',
    profileId: 'profile-id-123',
  },
  {
    id: 'cert-2',
    name: 'AWS Certified Developer',
    issuer: 'Amazon Web Services',
    issueDate: new Date('2022-06-20'),
    expiryDate: null,
    credentialId: 'AWS-DEV-789012',
    credentialUrl: 'https://aws.amazon.com/certification/789012',
    profileId: 'profile-id-123',
  },
];

export const mockProjects = [
  {
    id: 'proj-1',
    name: 'Smart Apply - Job Application Platform',
    description:
      'Full-stack platform for automated job applications with AI-powered cover letter and resume generation',
    url: 'https://github.com/smartapply/platform',
    startDate: new Date('2024-01-01'),
    endDate: null,
    current: true,
    technologies: ['TypeScript', 'React', 'NestJS', 'Azure', 'OpenAI'],
    profileId: 'profile-id-123',
  },
  {
    id: 'proj-2',
    name: 'E-Commerce Microservices',
    description: 'Scalable microservices architecture for e-commerce platform',
    url: 'https://github.com/johndoe/ecommerce',
    startDate: new Date('2022-03-01'),
    endDate: new Date('2023-11-30'),
    current: false,
    technologies: ['Node.js', 'Docker', 'Kubernetes', 'MongoDB'],
    profileId: 'profile-id-123',
  },
];

export const mockLanguages = [
  {
    id: 'lang-1',
    name: 'German',
    proficiency: 'Native',
    profileId: 'profile-id-123',
  },
  {
    id: 'lang-2',
    name: 'English',
    proficiency: 'Fluent',
    profileId: 'profile-id-123',
  },
  {
    id: 'lang-3',
    name: 'Spanish',
    proficiency: 'Intermediate',
    profileId: 'profile-id-123',
  },
];

export const mockCompleteProfile = {
  ...mockProfile,
  skills: mockSkills,
  experiences: mockExperiences,
  education: mockEducation,
  certificates: mockCertificates,
  projects: mockProjects,
  languages: mockLanguages,
};

export const mockMinimalProfile = {
  id: 'profile-id-456',
  userId: 'user-id-456',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  summary: 'Junior Developer looking for opportunities',
  skills: [{ id: 'skill-6', name: 'JavaScript', level: 'Intermediate' }],
  experiences: [],
  education: [],
  certificates: [],
  projects: [],
  languages: [],
  createdAt: new Date('2024-02-01'),
  updatedAt: new Date('2024-02-01'),
};

export const mockGermanProfile = {
  ...mockProfile,
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max.mustermann@example.de',
  location: 'München, Deutschland',
  summary:
    'Erfahrener Full-Stack Entwickler mit 5+ Jahren Expertise in TypeScript, React und Node.js.',
  languages: [
    { id: 'lang-de-1', name: 'Deutsch', proficiency: 'Muttersprache' },
    { id: 'lang-de-2', name: 'Englisch', proficiency: 'Fließend' },
  ],
};
