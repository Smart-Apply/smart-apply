/**
 * Application Test Fixtures
 * Reusable test data for Application module testing
 */

export const mockJobPosting = {
  id: 'job-posting-123',
  userId: 'user-id-123',
  title: 'Senior TypeScript Developer',
  company: 'Tech Solutions GmbH',
  location: 'Berlin, Germany',
  type: 'Full-time',
  remote: true,
  description: `We are looking for an experienced TypeScript developer to join our team.
  
  Requirements:
  - 5+ years of experience with TypeScript
  - Strong knowledge of React and Node.js
  - Experience with Azure Cloud
  - Excellent communication skills in English and German
  
  What we offer:
  - Competitive salary (70-90k EUR)
  - Remote work options
  - Modern tech stack
  - Great team culture`,
  url: 'https://tech-solutions.de/jobs/senior-typescript-developer',
  salary: '70000-90000 EUR',
  applicationDeadline: new Date('2024-12-31'),
  source: 'url' as const,
  rawContent: 'Senior TypeScript Developer at Tech Solutions GmbH...',
  createdAt: new Date('2024-11-01'),
  updatedAt: new Date('2024-11-01'),
};

export const mockGermanJobPosting = {
  id: 'job-posting-456',
  userId: 'user-id-123',
  title: 'Senior Softwareentwickler (m/w/d)',
  company: 'Deutsche Software AG',
  location: 'München, Deutschland',
  type: 'Vollzeit',
  remote: false,
  description: `Wir suchen einen erfahrenen Softwareentwickler für unser Team.
  
  Anforderungen:
  - Mehrjährige Erfahrung mit TypeScript und React
  - Kenntnisse in Node.js und Azure
  - Sehr gute Deutschkenntnisse
  - Teamfähigkeit und Kommunikationsstärke
  
  Wir bieten:
  - Attraktives Gehalt
  - Flexible Arbeitszeiten
  - Moderne Technologien
  - Tolles Team`,
  url: 'https://deutsche-software.de/jobs/senior-entwickler',
  salary: '60000-80000 EUR',
  applicationDeadline: new Date('2024-12-15'),
  source: 'text' as const,
  rawContent: 'Senior Softwareentwickler bei Deutsche Software AG...',
  createdAt: new Date('2024-11-15'),
  updatedAt: new Date('2024-11-15'),
};

export const mockApplication = {
  id: 'application-123',
  userId: 'user-id-123',
  jobPostingId: 'job-posting-123',
  profileId: 'profile-id-123',
  status: 'READY' as const,
  coverLetterBlobKey: 'applications/cover-letter-123.pdf',
  resumeBlobKey: 'applications/resume-123.pdf',
  coverLetterContent: 'Dear Hiring Manager, I am writing to express my interest...',
  resumeContent: 'John Doe - Senior Full-Stack Developer...',
  notes: 'Applied via company website',
  atsScore: 92,
  matchedSkills: ['TypeScript', 'React', 'Node.js', 'Azure'],
  missingSkills: ['Kubernetes'],
  createdAt: new Date('2024-11-20'),
  updatedAt: new Date('2024-11-20'),
};

export const mockPendingApplication = {
  ...mockApplication,
  id: 'application-456',
  status: 'PENDING' as const,
  coverLetterBlobKey: null,
  resumeBlobKey: null,
  coverLetterContent: null,
  resumeContent: null,
  atsScore: null,
  matchedSkills: [],
  missingSkills: [],
};

export const mockGeneratingApplication = {
  ...mockApplication,
  id: 'application-789',
  status: 'GENERATING' as const,
  coverLetterBlobKey: null,
  resumeBlobKey: null,
  atsScore: null,
};

export const mockFailedApplication = {
  ...mockApplication,
  id: 'application-999',
  status: 'FAILED' as const,
  error: 'LLM service timeout',
};

export const mockCoverLetterContent = `Dear Hiring Manager,

I am writing to express my strong interest in the Senior TypeScript Developer position at Tech Solutions GmbH. With over 5 years of experience in full-stack development using TypeScript, React, and Node.js, I am confident that my skills and passion make me an excellent fit for your team.

Throughout my career at Tech Corp GmbH and Startup Inc, I have:
- Led development of cloud-native applications on Azure
- Implemented scalable microservices architectures
- Mentored junior developers and established best practices
- Successfully delivered multiple high-impact projects

I am particularly excited about this opportunity because of your focus on modern technologies and remote work culture. My experience with Azure Cloud and strong communication skills in both English and German align perfectly with your requirements.

I would welcome the opportunity to discuss how my background and skills can contribute to your team's success. Thank you for considering my application.

Best regards,
John Doe`;

export const mockResumeContent = `John Doe
Full-Stack Developer
john.doe@example.com | +49 123 456789 | Berlin, Germany
https://johndoe.dev | linkedin.com/in/johndoe | github.com/johndoe

SUMMARY
Experienced Full-Stack Developer with 5+ years of expertise in TypeScript, React, and Node.js. Specialized in cloud-native applications and microservices architecture.

SKILLS
Programming Languages: TypeScript (Expert), JavaScript (Expert)
Frontend: React (Advanced), Next.js (Advanced)
Backend: Node.js (Expert), NestJS (Advanced)
Cloud: Azure (Advanced), AWS (Intermediate)
DevOps: Docker (Intermediate), CI/CD (Advanced)

EXPERIENCE
Senior Full-Stack Developer | Tech Corp GmbH | Berlin, Germany | 01/2020 - 12/2023
- Led development of cloud-native applications using TypeScript, React, and Azure
- Mentored junior developers and implemented CI/CD pipelines
- Designed and implemented microservices architecture
- Improved application performance by 40% through optimization

Full-Stack Developer | Startup Inc | Munich, Germany | 06/2018 - 12/2019
- Built scalable web applications using Node.js, React, and PostgreSQL
- Implemented RESTful APIs and microservices architecture
- Collaborated with cross-functional teams in an agile environment

EDUCATION
Master of Science in Computer Science | Technical University of Munich | 10/2015 - 09/2017
Bachelor of Science in Computer Science | University of Stuttgart | 10/2012 - 09/2015

CERTIFICATIONS
Azure Solutions Architect Expert | Microsoft | 01/2023
AWS Certified Developer | Amazon Web Services | 06/2022

LANGUAGES
German (Native), English (Fluent), Spanish (Intermediate)`;

export const mockApplicationWithJobPosting = {
  ...mockApplication,
  jobPosting: mockJobPosting,
};

export const mockATSReport = {
  score: 92,
  passed: true,
  issues: [
    {
      type: 'warning',
      message: 'Missing skill: Kubernetes',
      severity: 'low',
    },
  ],
  suggestions: [
    'Consider adding Kubernetes experience to your profile',
    'Highlight your Azure expertise more prominently',
  ],
  matchedKeywords: ['TypeScript', 'React', 'Node.js', 'Azure', 'Full-Stack'],
  missingKeywords: ['Kubernetes', 'GraphQL'],
};

export const mockLowATSReport = {
  score: 65,
  passed: false,
  issues: [
    {
      type: 'error',
      message: 'Missing critical skills: TypeScript, React',
      severity: 'high',
    },
    {
      type: 'warning',
      message: 'Limited experience match',
      severity: 'medium',
    },
  ],
  suggestions: [
    'Ensure your profile includes all required skills',
    'Add more relevant experience entries',
    'Highlight technical achievements',
  ],
  matchedKeywords: ['JavaScript', 'Node.js'],
  missingKeywords: ['TypeScript', 'React', 'Azure', 'Cloud'],
};
