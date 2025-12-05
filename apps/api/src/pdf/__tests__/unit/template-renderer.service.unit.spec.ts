import { TemplateRendererService } from '../../template-renderer.service';
import { TemplatesService } from '../../../templates/templates.service';

describe('TemplateRendererService', () => {
  let service: TemplateRendererService;
  let mockTemplatesService: jest.Mocked<TemplatesService>;

  beforeEach(() => {
    const coverLetterTemplate = `<!DOCTYPE html>
<html>
<head>
  <style>
    {{cssStyles}}
  </style>
</head>
<body>
  <header>
    <h1>{{candidateName}}</h1>
    <p>{{email}} | {{phone}}</p>
    {{#if linkedin}}<p>LinkedIn: {{linkedin}}</p>{{/if}}
    {{#if github}}<p>GitHub: {{github}}</p>{{/if}}
    {{#if location}}<p>{{location}}</p>{{/if}}
  </header>
  <section class="cover-letter">
    <p>{{date}}</p>
    {{#if companyName}}<p>{{companyName}}</p>{{/if}}
    {{#if recipientName}}<p>Dear {{recipientName}},</p>{{/if}}
    {{{content}}}
    <p>{{closingPhrase}}</p>
  </section>
</body>
</html>`;

    const resumeTemplate = `<!DOCTYPE html>
<html>
<head>
  <style>
    {{cssStyles}}
  </style>
</head>
<body>
  <header>
    <h1>{{candidateName}}</h1>
    {{#if email}}<p>{{email}}</p>{{/if}}
    {{#if phone}}<p>{{phone}}</p>{{/if}}
    {{#if linkedin}}<p>LinkedIn: {{linkedin}}</p>{{/if}}
    {{#if github}}<p>GitHub: {{github}}</p>{{/if}}
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
      <h3>{{toLowerCase type}}</h3>
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
  {{#if projects}}
  <section class="projects">
    <h2>{{t "resume.projects" language}}</h2>
    {{#each projects}}
    <div class="project-item">
      <h3>{{name}}</h3>
      <p>{{description}}</p>
      {{#if highlights}}
      <ul>
        {{#each highlights}}
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
</html>`;

    const cssStyles = `
      body { 
        font-family: Arial, sans-serif; 
        margin: 20px; 
        color: #333; 
      }
      h1 { 
        color: #2c3e50; 
        font-size: 24px; 
        margin-bottom: 10px; 
      }
      .cover-letter { 
        margin-top: 20px; 
        line-height: 1.6; 
      }
      h2 {
        color: #2c3e50;
        font-size: 18px;
        border-bottom: 2px solid #3498db;
        padding-bottom: 5px;
        margin-top: 20px;
      }
      h3 {
        font-size: 16px;
        margin-top: 10px;
      }
    `;

    mockTemplatesService = {
      findDefault: jest.fn().mockImplementation((type) => {
        if (type === 'RESUME') {
          return Promise.resolve({
            id: 'template-resume',
            name: 'Resume Professional',
            htmlTemplate: resumeTemplate,
            cssStyles: cssStyles,
            language: 'en',
          });
        }
        return Promise.resolve({
          id: 'template-cover',
          name: 'Cover Letter Professional',
          htmlTemplate: coverLetterTemplate,
          cssStyles: cssStyles,
          language: 'en',
        });
      }),
      findOne: jest.fn().mockImplementation((id) => {
        if (id === 'resume-template') {
          return Promise.resolve({
            id: 'resume-template',
            name: 'Resume Professional',
            htmlTemplate: resumeTemplate,
            cssStyles: cssStyles,
            language: 'en',
          });
        }
        return Promise.resolve({
          id: 'cover-template',
          name: 'Cover Letter Professional',
          htmlTemplate: coverLetterTemplate,
          cssStyles: cssStyles,
          language: 'en',
        });
      }),
    } as any;
    service = new TemplateRendererService(mockTemplatesService);
  });

  describe('renderCoverLetter', () => {
    it('should render cover letter with basic data', async () => {
      const data = {
        candidateName: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1 555-0123',
        companyName: 'Tech Company',
        recipientName: 'Hiring Manager',
        content: '<p>Test cover letter content</p>',
      };

      const html = await service.renderCoverLetter(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('jane@example.com');
      expect(html).toContain('+1 555-0123');
      expect(html).toContain('Tech Company');
      expect(html).toContain('Hiring Manager');
      expect(html).toContain('<p>Test cover letter content</p>');
      expect(html).toContain('<style>');
      expect(html).toContain('font-family');
    });

    it('should include default date when not provided', async () => {
      const data = {
        candidateName: 'John Doe',
        content: '<p>Content</p>',
      };

      const html = await service.renderCoverLetter(data);

      expect(html).toContain('date-section');
      // Should have a date in format like "November 9, 2025"
      expect(html).toMatch(/\w+ \d{1,2}, \d{4}/);
    });

    it('should use custom closing phrase when provided', async () => {
      const data = {
        candidateName: 'Test User',
        content: '<p>Content</p>',
        closingPhrase: 'Best regards,',
      };

      const html = await service.renderCoverLetter(data);

      expect(html).toContain('Best regards,');
    });

    it('should include all contact information when provided', async () => {
      const data = {
        candidateName: 'Contact Test',
        email: 'test@example.com',
        phone: '123-456-7890',
        linkedin: 'https://linkedin.com/in/test',
        github: 'https://github.com/test',
        location: 'San Francisco, CA',
        content: '<p>Content</p>',
      };

      const html = await service.renderCoverLetter(data);

      expect(html).toContain('test@example.com');
      expect(html).toContain('123-456-7890');
      expect(html).toContain('https://linkedin.com/in/test');
      expect(html).toContain('https://github.com/test');
      expect(html).toContain('San Francisco, CA');
    });
  });

  describe('renderResume', () => {
    it('should render resume with complete data', async () => {
      const data = {
        candidateName: 'John Developer',
        email: 'john@example.com',
        phone: '+1 555-9876',
        summary: 'Experienced software engineer',
        skillCategories: [
          {
            type: 'Languages',
            skills: ['TypeScript', 'Python', 'Java'],
          },
          {
            type: 'Frameworks',
            skills: ['NestJS', 'React'],
          },
        ],
        experiences: [
          {
            title: 'Senior Engineer',
            company: 'Tech Corp',
            location: 'SF',
            dateRange: 'Jan 2020 - Present',
            achievements: ['Led team of 5 engineers', 'Improved performance by 40%'],
          },
        ],
        education: [
          {
            degree: 'BS Computer Science',
            institution: 'University',
            year: '2017',
          },
        ],
      };

      const html = await service.renderResume(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('John Developer');
      expect(html).toContain('john@example.com');
      expect(html).toContain('Experienced software engineer');
      expect(html).toContain('TypeScript');
      expect(html).toContain('NestJS');
      expect(html).toContain('Senior Engineer');
      expect(html).toContain('Tech Corp');
      expect(html).toContain('BS Computer Science');
      expect(html).toContain('<style>');
    });

    it('should handle resume without optional fields', async () => {
      const data = {
        candidateName: 'Minimal User',
        email: 'minimal@example.com',
      };

      const html = await service.renderResume(data);

      expect(html).toContain('Minimal User');
      expect(html).toContain('minimal@example.com');
      expect(html).toContain('<style>');
    });

    it('should render skill categories with proper formatting', async () => {
      const data = {
        candidateName: 'Skills Test',
        skillCategories: [
          {
            type: 'Languages',
            skills: ['TypeScript', 'Go'],
          },
          {
            type: 'Cloud',
            skills: ['Azure', 'AWS'],
          },
        ],
      };

      const html = await service.renderResume(data);

      expect(html).toContain('Languages');
      expect(html).toContain('TypeScript');
      expect(html).toContain('Cloud');
      expect(html).toContain('Azure');
      expect(html).toContain('skill-tag');
    });

    it('should render projects with highlights', async () => {
      const data = {
        candidateName: 'Project Test',
        projects: [
          {
            name: 'Cool Project',
            description: 'A really cool project',
            date: '2025',
            highlights: ['Built feature X', 'Achieved Y'],
          },
        ],
      };

      const html = await service.renderResume(data);

      expect(html).toContain('Cool Project');
      expect(html).toContain('A really cool project');
      expect(html).toContain('Built feature X');
      expect(html).toContain('Achieved Y');
    });

    it('should render certifications', async () => {
      const data = {
        candidateName: 'Cert Test',
        certifications: [
          {
            name: 'Azure Expert',
            issuer: 'Microsoft',
            date: '2024',
          },
        ],
      };

      const html = await service.renderResume(data);

      expect(html).toContain('Azure Expert');
      expect(html).toContain('Microsoft');
      expect(html).toContain('2024');
    });
  });

  describe('healthCheck', () => {
    it('should return true when templates are accessible', async () => {
      const result = await service.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe('Handlebars helpers', () => {
    it('should convert skill category types to lowercase', async () => {
      const data = {
        candidateName: 'Helper Test',
        skillCategories: [
          {
            type: 'Cloud Services',
            skills: ['Azure'],
          },
        ],
      };

      const html = await service.renderResume(data);

      // The toLowerCase helper should convert "Cloud Services" to "cloud-services"
      expect(html).toContain('cloud-services');
    });
  });
});
