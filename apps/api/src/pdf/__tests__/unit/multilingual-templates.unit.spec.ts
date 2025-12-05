import { Test, TestingModule } from '@nestjs/testing';
import { TemplateRendererService } from '../../template-renderer.service';
import { TemplatesService } from '../../../templates/templates.service';
import { ResumeTemplateData } from '../../template-renderer.service';

describe('TemplateRendererService - Multilingual Support', () => {
  let service: TemplateRendererService;
  let templatesService: TemplatesService;

  const mockResumeData: ResumeTemplateData = {
    candidateName: 'Max Mustermann',
    email: 'max@example.com',
    phone: '+49 123 456789',
    location: 'Berlin, Germany',
    summary: 'Erfahrener Full-Stack Developer mit 5+ Jahren Erfahrung in React und Node.js.',
    skillCategories: [
      {
        type: 'Programmiersprachen',
        skills: ['TypeScript', 'JavaScript', 'Python'],
      },
      {
        type: 'Frameworks',
        skills: ['React', 'Node.js', 'NestJS'],
      },
    ],
    experiences: [
      {
        title: 'Senior Software Engineer',
        company: 'Tech GmbH',
        location: 'Berlin',
        dateRange: 'Jan 2020 - Heute',
        achievements: [
          'Entwickelte React-basiertes Dashboard mit TypeScript',
          'Leitete Team von 5 Entwicklern',
        ],
      },
    ],
    education: [
      {
        degree: 'Bachelor of Science',
        institution: 'TU Berlin',
        year: '2015 - 2019',
        fieldOfStudy: 'Informatik',
      },
    ],
    certifications: [
      {
        name: 'AWS Solutions Architect',
        issuer: 'Amazon Web Services',
        date: '2023',
      },
    ],
    languages: [
      { name: 'Deutsch', level: 'Muttersprache' },
      { name: 'Englisch', level: 'Fließend' },
    ],
    language: 'de', // German language
  };

  beforeEach(async () => {
    const mockTemplate = {
      id: 'template-1',
      name: 'Modern Professional',
      htmlTemplate: `<!DOCTYPE html>
<html>
<head><style>{{cssStyles}}</style></head>
<body>
  <header>
    <h1>{{candidateName}}</h1>
    {{#if email}}<p>{{email}}</p>{{/if}}
    {{#if phone}}<p>{{phone}}</p>{{/if}}
    {{#if location}}<p>{{location}}</p>{{/if}}
  </header>
  {{#if summary}}
  <section class="summary">
    <h2>{{t "resume.profile" language}}</h2>
    <p>{{summary}}</p>
  </section>
  {{/if}}
  {{#if skillCategories}}
  <section class="skills">
    <h2>{{t "resume.skills" language}}</h2>
    {{#each skillCategories}}
    <div class="skill-category">
      <h3>{{type}}</h3>
      <ul>
        {{#each skills}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    {{/each}}
  </section>
  {{/if}}
  {{#if experiences}}
  <section class="experience">
    <h2>{{t "resume.experience" language}}</h2>
    {{#each experiences}}
    <div class="experience-item">
      <h3>{{title}}</h3>
      <p><strong>{{company}}</strong>{{#if location}} - {{location}}{{/if}}</p>
      <p>{{dateRange}}</p>
      {{#if achievements}}
      <ul>
        {{#each achievements}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
      {{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}
  {{#if education}}
  <section class="education">
    <h2>{{t "resume.education" language}}</h2>
    {{#each education}}
    <div class="education-item">
      <h3>{{degree}}</h3>
      <p>{{institution}}{{#if year}} - {{year}}{{/if}}</p>
      {{#if fieldOfStudy}}<p>{{fieldOfStudy}}</p>{{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}
  {{#if certifications}}
  <section class="certifications">
    <h2>{{t "resume.certifications" language}}</h2>
    {{#each certifications}}
    <div class="cert-item">
      <h3>{{name}}</h3>
      {{#if issuer}}<p>{{issuer}}</p>{{/if}}
      {{#if date}}<p>{{date}}</p>{{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}
  {{#if languages}}
  <section class="languages">
    <h2>{{t "resume.languages" language}}</h2>
    <ul>
      {{#each languages}}
      <li>{{name}}{{#if level}} - {{level}}{{/if}}</li>
      {{/each}}
    </ul>
  </section>
  {{/if}}
</body>
</html>`,
      cssStyles: 'body { font-family: Arial; margin: 20px; }',
      language: 'de',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        {
          provide: TemplatesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockTemplate),
            findDefault: jest.fn().mockResolvedValue(mockTemplate),
          },
        },
      ],
    }).compile();

    service = module.get<TemplateRendererService>(TemplateRendererService);
    templatesService = module.get<TemplatesService>(TemplatesService);
  });

  describe('renderResume with German language', () => {
    it('should render German section headers when language is "de"', async () => {
      const html = await service.renderResume(mockResumeData, undefined, true);

      // Check for German section headers (using actual translations from template-renderer.service.ts)
      expect(html).toContain('<h2>Professionelles Profil</h2>'); // Professional Summary in German
      expect(html).toContain('<h2>Technische Fähigkeiten</h2>'); // Skills in German
      expect(html).toContain('<h2>Berufserfahrung</h2>'); // Experience in German
      expect(html).toContain('<h2>Ausbildung</h2>'); // Education in German
      expect(html).toContain('<h2>Zertifikate</h2>'); // Certifications in German
      expect(html).toContain('<h2>Sprachen</h2>'); // Languages in German

      // Should NOT contain English headers in H2 tags
      expect(html).not.toContain('<h2>Professional Summary</h2>');
      expect(html).not.toContain('<h2>Professional Experience</h2>');
    });

    it('should preserve German content from resume data', async () => {
      const html = await service.renderResume(mockResumeData, undefined, true);

      // Check German content is preserved
      expect(html).toContain('Max Mustermann');
      expect(html).toContain('Erfahrener Full-Stack Developer');
      expect(html).toContain('Programmiersprachen'); // German skill category
      expect(html).toContain('Entwickelte React-basiertes Dashboard'); // German achievement
      expect(html).toContain('TU Berlin');
    });
  });

  describe('renderResume with English language', () => {
    it('should render English section headers when language is "en"', async () => {
      const englishData: ResumeTemplateData = {
        ...mockResumeData,
        candidateName: 'John Doe',
        summary: 'Experienced Full-Stack Developer with 5+ years in React and Node.js.',
        skillCategories: [
          {
            type: 'Programming Languages',
            skills: ['TypeScript', 'JavaScript', 'Python'],
          },
        ],
        experiences: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            location: 'San Francisco',
            dateRange: 'Jan 2020 - Present',
            achievements: ['Developed React-based dashboard using TypeScript'],
          },
        ],
        language: 'en', // English language
      };

      const html = await service.renderResume(englishData, undefined, true);

      // Check for English section headers (using actual translations)
      expect(html).toContain('Professional Summary');
      expect(html).toContain('Technical Skills');
      expect(html).toContain('Professional Experience');
      expect(html).toContain('Education');

      // Should NOT contain German headers
      expect(html).not.toContain('Professionelles Profil');
      expect(html).not.toContain('Berufserfahrung');
    });
  });

  describe('renderResume without language (fallback)', () => {
    it('should default to English when language is not specified', async () => {
      const dataWithoutLanguage: ResumeTemplateData = {
        ...mockResumeData,
        language: undefined,
      };

      const html = await service.renderResume(dataWithoutLanguage, undefined, true);

      // Should default to English
      expect(html).toContain('Professional Summary');
      expect(html).toContain('Skills');
      expect(html).toContain('Professional Experience');
    });
  });
});
