import { Test, TestingModule } from '@nestjs/testing';
import { TemplateRendererService } from '../../template-renderer.service';
import { TemplatesService } from '../../../templates/templates.service';
import type { ResumeTemplateData } from '../../template-renderer.service';

describe('TemplateRendererService - Experience Description', () => {
  let service: TemplateRendererService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        {
          provide: TemplatesService,
          useValue: {
            findOne: jest.fn(),
            findDefault: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TemplateRendererService>(TemplateRendererService);
  });

  it('should render experience description in resume template', async () => {
    const resumeData: ResumeTemplateData = {
      candidateName: 'Max Mustermann',
      email: 'max@example.com',
      phone: '+49 123 456789',
      location: 'Berlin, Germany',
      summary: 'Experienced Full-Stack Developer with 5+ years of experience.',
      skillCategories: [
        {
          type: 'Programming Languages',
          skills: ['TypeScript', 'JavaScript', 'Python'],
        },
      ],
      experiences: [
        {
          title: 'Senior Full-Stack Developer',
          company: 'Tech Corp',
          location: 'Berlin',
          dateRange: 'Jan 2020 - Present',
          description:
            'Leading the development of microservices architecture for a SaaS platform. Working with React, Node.js, and AWS to deliver scalable solutions.',
          achievements: [
            'Reduced API response time by 40% through optimization',
            'Led a team of 4 developers in implementing CI/CD pipeline',
          ],
        },
        {
          title: 'Full-Stack Developer',
          company: 'Startup GmbH',
          location: 'Munich',
          dateRange: 'Jun 2018 - Dec 2019',
          description:
            'Developed and maintained customer-facing web applications using React and Node.js. Collaborated with UX designers to implement responsive designs.',
        },
      ],
      projects: [],
      education: [
        {
          degree: 'B.Sc. Computer Science',
          institution: 'Technical University of Berlin',
          year: '2014 - 2018',
        },
      ],
      certifications: [],
      languages: [
        { name: 'German', level: 'Native' },
        { name: 'English', level: 'Fluent' },
      ],
      language: 'en',
    };

    // Use renderResume with skipCss = true to test template rendering
    const html = await service.renderResume(resumeData, undefined, true);

    // Verify description is rendered
    expect(html).toContain('Leading the development of microservices architecture');
    expect(html).toContain('Working with React, Node.js, and AWS');
    expect(html).toContain('Developed and maintained customer-facing web applications');
    expect(html).toContain('Collaborated with UX designers');

    // Verify description is in its own paragraph with correct class
    expect(html).toContain('<p class="experience-description">');

    // Verify achievements are still rendered
    expect(html).toContain('Reduced API response time by 40%');
    expect(html).toContain('Led a team of 4 developers');
  });

  it('should handle experiences without description gracefully', async () => {
    const resumeData: ResumeTemplateData = {
      candidateName: 'Max Mustermann',
      email: 'max@example.com',
      experiences: [
        {
          title: 'Junior Developer',
          company: 'Small Company',
          dateRange: 'Jan 2016 - May 2018',
          // No description field
          achievements: ['Built internal tools', 'Improved code quality'],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      languages: [],
      skillCategories: [],
      language: 'en',
    };

    const html = await service.renderResume(resumeData, undefined, true);

    // Should not crash and should still render achievements
    expect(html).toContain('Built internal tools');
    expect(html).toContain('Improved code quality');
    // Description paragraph should not appear
    expect(html).not.toContain('<p class="experience-description">');
  });

  it('should render both description and achievements when both present', async () => {
    const resumeData: ResumeTemplateData = {
      candidateName: 'Max Mustermann',
      email: 'max@example.com',
      experiences: [
        {
          title: 'Tech Lead',
          company: 'Big Corp',
          dateRange: 'Jan 2021 - Present',
          description:
            'Responsible for technical direction of the platform team. Mentoring junior developers and conducting code reviews.',
          achievements: [
            'Increased team velocity by 50%',
            'Implemented automated testing strategy',
          ],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      languages: [],
      skillCategories: [],
      language: 'en',
    };

    const html = await service.renderResume(resumeData, undefined, true);

    // Both description and achievements should be present
    expect(html).toContain('Responsible for technical direction');
    expect(html).toContain('Mentoring junior developers');
    expect(html).toContain('Increased team velocity by 50%');
    expect(html).toContain('Implemented automated testing strategy');

    // Description should come before achievements
    const descriptionIndex = html.indexOf('Responsible for technical direction');
    const achievementsIndex = html.indexOf('Increased team velocity');
    expect(descriptionIndex).toBeLessThan(achievementsIndex);
  });

  it('should properly render HTML in description (for rich text)', async () => {
    const resumeData: ResumeTemplateData = {
      candidateName: 'Max Mustermann',
      email: 'max@example.com',
      experiences: [
        {
          title: 'Software Architect',
          company: 'Enterprise Inc',
          dateRange: 'Jan 2022 - Present',
          description:
            '<strong>Key Responsibilities:</strong><br/>- System design and architecture<br/>- Technical debt management<br/>- Performance optimization',
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      languages: [],
      skillCategories: [],
      language: 'en',
    };

    const html = await service.renderResume(resumeData, undefined, true);

    // HTML tags should be rendered (using {{{description}}} in template)
    expect(html).toContain('<strong>Key Responsibilities:</strong>');
    expect(html).toContain('<br/>');
    expect(html).toContain('- System design and architecture');
  });
});
