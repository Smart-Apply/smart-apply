import { Test, TestingModule } from '@nestjs/testing';
import { TemplateRendererService } from '../../template-renderer.service';
import { TemplatesService } from '../../../templates/templates.service';
import { ResumeTemplateData } from '../../template-renderer.service';

describe('TemplateRendererService - Language Name Translation', () => {
  let service: TemplateRendererService;
  let templatesService: TemplatesService;

  const mockTemplate = {
    id: 'template-1',
    name: 'Modern Professional',
    htmlTemplate: `<!DOCTYPE html>
<html>
<body>
  {{#if languages}}
  <section class="languages">
    <h2>{{t "resume.languages" language}}</h2>
    <p class="languages-list">
      {{#each languages}}{{translateLang name @root.language}}{{#if level}} ({{t level @root.language}}){{/if}}{{#unless @last}}, {{/unless}}{{/each}}
    </p>
  </section>
  {{/if}}
</body>
</html>`,
    cssStyles: 'body { font-family: Arial; }',
    language: 'de',
  };

  beforeEach(async () => {
    const mockTemplatesService = {
      findOne: jest.fn().mockResolvedValue(mockTemplate),
      findDefault: jest.fn().mockResolvedValue(mockTemplate),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    }).compile();

    service = module.get<TemplateRendererService>(TemplateRendererService);
    templatesService = module.get<TemplatesService>(TemplatesService);
  });

  describe('translateLang helper - German output', () => {
    it('should translate English language names to German', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
          { name: 'German', level: 'level.native' },
          { name: 'French', level: 'level.advanced' },
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Check German translations
      expect(html).toContain('Englisch');
      expect(html).toContain('Deutsch');
      expect(html).toContain('Französisch');
      
      // Should NOT contain original English names
      expect(html).not.toContain('>English<');
      expect(html).not.toContain('>German<');
      expect(html).not.toContain('>French<');
    });

    it('should translate proficiency levels to German', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
          { name: 'German', level: 'level.native' },
          { name: 'French', level: 'level.intermediate' },
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Check proficiency level translations
      expect(html).toContain('Fließend');
      expect(html).toContain('Muttersprache');
      expect(html).toContain('Mittelstufe');
      
      // Should NOT contain English levels
      expect(html).not.toContain('Fluent');
      expect(html).not.toContain('Native');
      expect(html).not.toContain('Intermediate');
    });

    it('should handle various common language names', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'Spanish', level: 'level.good' },
          { name: 'Italian', level: 'level.basic' },
          { name: 'Portuguese', level: 'level.conversational' },
          { name: 'Russian', level: 'level.beginner' },
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Check translations for other languages
      expect(html).toContain('Spanisch');
      expect(html).toContain('Italienisch');
      expect(html).toContain('Portugiesisch');
      expect(html).toContain('Russisch');
    });

    it('should handle case-insensitive language names', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'english', level: 'level.fluent' }, // lowercase
          { name: 'GERMAN', level: 'level.native' }, // uppercase
          { name: 'French', level: 'level.advanced' }, // mixed case
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should still translate correctly
      expect(html).toContain('Englisch');
      expect(html).toContain('Deutsch');
      expect(html).toContain('Französisch');
    });

    it('should preserve unknown language names', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'Klingonisch', level: 'level.fluent' }, // fictional language
          { name: 'Elvish', level: 'level.intermediate' }, // not in mapping
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Unknown languages should remain unchanged
      expect(html).toContain('Klingonisch');
      expect(html).toContain('Elvish');
    });
  });

  describe('translateLang helper - English output', () => {
    it('should output English when template language is English', async () => {
      // Override mock to return English template
      jest.spyOn(templatesService, 'findDefault').mockResolvedValueOnce({
        ...mockTemplate,
        language: 'en',
      } as any);

      const resumeData: ResumeTemplateData = {
        candidateName: 'John Doe',
        email: 'john@example.com',
        languages: [
          { name: 'English', level: 'level.native' },
          { name: 'German', level: 'level.fluent' },
          { name: 'French', level: 'level.intermediate' },
        ],
        language: 'en',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should output in English
      expect(html).toContain('English');
      expect(html).toContain('German');
      expect(html).toContain('French');
      expect(html).toContain('Native');
      expect(html).toContain('Fluent');
      expect(html).toContain('Intermediate');
    });

    it('should translate German input to English', async () => {
      // Override mock to return English template
      jest.spyOn(templatesService, 'findDefault').mockResolvedValueOnce({
        ...mockTemplate,
        language: 'en',
      } as any);

      const resumeData: ResumeTemplateData = {
        candidateName: 'John Doe',
        email: 'john@example.com',
        languages: [
          { name: 'Deutsch', level: 'level.native' }, // German input
          { name: 'Englisch', level: 'level.fluent' }, // German input
          { name: 'Französisch', level: 'level.advanced' }, // German input
        ],
        language: 'en',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should translate to English
      expect(html).toContain('German');
      expect(html).toContain('English');
      expect(html).toContain('French');
    });
  });

  describe('translateLang helper - Other languages', () => {
    it('should translate to French when template language is French', async () => {
      jest.spyOn(templatesService, 'findDefault').mockResolvedValueOnce({
        ...mockTemplate,
        language: 'fr',
      } as any);

      const resumeData: ResumeTemplateData = {
        candidateName: 'Jean Dupont',
        email: 'jean@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
          { name: 'German', level: 'level.intermediate' },
        ],
        language: 'fr',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should output in French
      expect(html).toContain('Anglais'); // English in French
      expect(html).toContain('Allemand'); // German in French
    });

    it('should translate to Spanish when template language is Spanish', async () => {
      jest.spyOn(templatesService, 'findDefault').mockResolvedValueOnce({
        ...mockTemplate,
        language: 'es',
      } as any);

      const resumeData: ResumeTemplateData = {
        candidateName: 'Juan García',
        email: 'juan@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
          { name: 'German', level: 'level.basic' },
        ],
        language: 'es',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should output in Spanish
      expect(html).toContain('Inglés'); // English in Spanish
      expect(html).toContain('Alemán'); // German in Spanish
    });
  });

  describe('Combined translation', () => {
    it('should translate both language names and proficiency levels correctly', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
          { name: 'German', level: 'level.native' },
          { name: 'French', level: 'level.advanced' },
          { name: 'Spanish', level: 'level.intermediate' },
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Full output should be: "Englisch (Fließend), Deutsch (Muttersprache), Französisch (Fortgeschritten), Spanisch (Mittelstufe)"
      expect(html).toMatch(/Englisch.*\(Fließend\)/);
      expect(html).toMatch(/Deutsch.*\(Muttersprache\)/);
      expect(html).toMatch(/Französisch.*\(Fortgeschritten\)/);
      expect(html).toMatch(/Spanisch.*\(Mittelstufe\)/);
    });

    it('should render section header in German', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        languages: [
          { name: 'English', level: 'level.fluent' },
        ],
        language: 'de',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Section header should be translated
      expect(html).toContain('<h2>Sprachen</h2>');
      expect(html).not.toContain('<h2>Languages</h2>');
    });

    it('should translate Albanian and Balkan languages to Spanish', async () => {
      jest.spyOn(templatesService, 'findDefault').mockResolvedValueOnce({
        ...mockTemplate,
        language: 'es',
      } as any);

      const resumeData: ResumeTemplateData = {
        candidateName: 'Test User',
        email: 'test@example.com',
        languages: [
          { name: 'Albanisch', level: 'level.native' },
          { name: 'Deutsch', level: 'level.native' },
          { name: 'Englisch', level: 'level.fluent' },
          { name: 'Spanisch', level: 'level.good' },
        ],
        language: 'es',
      };

      const html = await service.renderResume(resumeData, undefined, false);

      // Should translate German language names to Spanish
      expect(html).toContain('Albanés'); // Albanian in Spanish
      expect(html).toContain('Alemán'); // German in Spanish
      expect(html).toContain('Inglés'); // English in Spanish
      expect(html).toContain('Español'); // Spanish in Spanish
      
      // Proficiency levels should also be in Spanish
      expect(html).toContain('Nativo'); // Native in Spanish
      expect(html).toContain('Fluido'); // Fluent in Spanish
      expect(html).toContain('Bueno'); // Good in Spanish
    });
  });
});
