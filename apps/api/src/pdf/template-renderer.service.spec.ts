import { TemplateRendererService } from './template-renderer.service';

describe('TemplateRendererService', () => {
  let service: TemplateRendererService;

  beforeEach(() => {
    service = new TemplateRendererService();
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
            achievements: [
              'Led team of 5 engineers',
              'Improved performance by 40%',
            ],
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
