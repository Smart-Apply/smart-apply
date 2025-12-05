import { buildResumeTemplateData } from '../../resume-template.util';
import type { ProfileWithRelations } from '../../resume-template.util';
import type { User } from '@prisma/client';

describe('Resume Template Util - Experience Description', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hash',
    firstName: 'Max',
    lastName: 'Mustermann',
    provider: null,
    providerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should include experience description from profile in resume template', () => {
    const profile: ProfileWithRelations = {
      id: 'profile-1',
      userId: 'user-1',
      summary: 'Experienced developer',
      phone: '+49 123 456789',
      location: 'Berlin',
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      skills: [
        {
          id: 'skill-1',
          profileId: 'profile-1',
          name: 'TypeScript',
          category: 'Programming Languages',
          level: 'Expert',
        },
      ],
      experiences: [
        {
          id: 'exp-1',
          profileId: 'profile-1',
          title: 'Senior Developer',
          company: 'Tech Corp',
          location: 'Berlin',
          startDate: new Date('2020-01-01'),
          endDate: null,
          isCurrent: true,
          description:
            'Verantwortlich für die Entwicklung von Cloud-nativen Anwendungen mit React und Node.js. Leitung des Teams bei der Migration zu Microservices-Architektur.',
          achievements: [
            'Implementierte CI/CD Pipeline',
            'Reduzierte Deployment-Zeit um 50%',
          ],
        },
        {
          id: 'exp-2',
          profileId: 'profile-1',
          title: 'Full-Stack Developer',
          company: 'Startup GmbH',
          location: 'Munich',
          startDate: new Date('2018-06-01'),
          endDate: new Date('2019-12-31'),
          isCurrent: false,
          description:
            'Entwicklung und Wartung von Webanwendungen. Zusammenarbeit mit UX-Designern zur Implementierung responsiver Designs.',
          achievements: ['Baute 5 Kundenprojekte'],
        },
      ],
      projects: [],
      education: [],
      certificates: [],
      languages: [],
    };

    const result = buildResumeTemplateData(profile);

    // Verify experiences are included
    expect(result.experiences).toHaveLength(2);

    // Verify first experience has description
    expect(result.experiences![0]).toMatchObject({
      title: 'Senior Developer',
      company: 'Tech Corp',
      location: 'Berlin',
      description:
        'Verantwortlich für die Entwicklung von Cloud-nativen Anwendungen mit React und Node.js. Leitung des Teams bei der Migration zu Microservices-Architektur.',
      achievements: ['Implementierte CI/CD Pipeline', 'Reduzierte Deployment-Zeit um 50%'],
    });

    // Verify second experience has description
    expect(result.experiences![1]).toMatchObject({
      title: 'Full-Stack Developer',
      company: 'Startup GmbH',
      location: 'Munich',
      description:
        'Entwicklung und Wartung von Webanwendungen. Zusammenarbeit mit UX-Designern zur Implementierung responsiver Designs.',
      achievements: ['Baute 5 Kundenprojekte'],
    });

    // Verify dateRange is formatted correctly
    expect(result.experiences![0].dateRange).toContain('Aktuell');
    expect(result.experiences![1].dateRange).toMatch(/\d{4}/); // Contains year
  });

  it('should handle experiences without description (optional field)', () => {
    const profile: ProfileWithRelations = {
      id: 'profile-1',
      userId: 'user-1',
      summary: null,
      phone: null,
      location: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      skills: [],
      experiences: [
        {
          id: 'exp-1',
          profileId: 'profile-1',
          title: 'Junior Developer',
          company: 'Small Company',
          location: null,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2021-12-31'),
          isCurrent: false,
          description: null, // No description
          achievements: ['Built internal tools'],
        },
      ],
      projects: [],
      education: [],
      certificates: [],
      languages: [],
    };

    const result = buildResumeTemplateData(profile);

    expect(result.experiences).toHaveLength(1);
    expect(result.experiences![0]).toMatchObject({
      title: 'Junior Developer',
      company: 'Small Company',
      description: undefined, // null becomes undefined
      achievements: ['Built internal tools'],
    });
  });

  it('should sort experiences by start date (newest first)', () => {
    const profile: ProfileWithRelations = {
      id: 'profile-1',
      userId: 'user-1',
      summary: null,
      phone: null,
      location: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: mockUser,
      skills: [],
      experiences: [
        {
          id: 'exp-1',
          profileId: 'profile-1',
          title: 'Junior Developer',
          company: 'Old Company',
          location: null,
          startDate: new Date('2018-01-01'),
          endDate: new Date('2019-12-31'),
          isCurrent: false,
          description: 'Old role',
          achievements: [],
        },
        {
          id: 'exp-2',
          profileId: 'profile-1',
          title: 'Senior Developer',
          company: 'Current Company',
          location: null,
          startDate: new Date('2020-01-01'),
          endDate: null,
          isCurrent: true,
          description: 'Current role',
          achievements: [],
        },
        {
          id: 'exp-3',
          profileId: 'profile-1',
          title: 'Mid-Level Developer',
          company: 'Middle Company',
          location: null,
          startDate: new Date('2019-06-01'),
          endDate: new Date('2019-12-31'),
          isCurrent: false,
          description: 'Middle role',
          achievements: [],
        },
      ],
      projects: [],
      education: [],
      certificates: [],
      languages: [],
    };

    const result = buildResumeTemplateData(profile);

    // Should be sorted by startDate descending (newest first)
    expect(result.experiences![0].title).toBe('Senior Developer'); // 2020
    expect(result.experiences![1].title).toBe('Mid-Level Developer'); // 2019-06
    expect(result.experiences![2].title).toBe('Junior Developer'); // 2018
  });
});
