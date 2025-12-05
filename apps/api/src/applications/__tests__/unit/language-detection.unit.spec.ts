import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from '../../applications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobsService } from '../../../jobs/jobs.service';
import { StorageService } from '../../../storage/storage.service';
import { LLMService } from '../../../llm/llm.service';
import { TitleGeneratorService } from '../../title-generator.service';
import { KeywordsService } from '../../../keywords/keywords.service';

describe('ApplicationsService - Language Detection', () => {
  let service: ApplicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: JobsService,
          useValue: {},
        },
        {
          provide: StorageService,
          useValue: {},
        },
        {
          provide: LLMService,
          useValue: {},
        },
        {
          provide: TitleGeneratorService,
          useValue: {},
        },
        {
          provide: KeywordsService,
          useValue: {},
        },
        {
          provide: 'TemplatesService',
          useValue: {
            findDefault: jest.fn().mockResolvedValue({
              id: 'template-1',
              name: 'Modern Professional',
              htmlContent: '<html><body>{{candidateName}}</body></html>',
              cssContent: 'body { font-family: Arial; }',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
  });

  describe('detectLanguage', () => {
    it('should detect German from job posting with German keywords', () => {
      const germanText = `
        Wir suchen einen Senior Full-Stack Developer für unser Team in München.
        Sie werden mit modernen Technologien arbeiten und Teil eines agilen Teams sein.
        Ihre Aufgaben umfassen die Entwicklung von Microservices mit Docker und Kubernetes.
      `;

      // Access private method via any cast for testing
      const result = (service as any).detectLanguage(germanText);
      expect(result).toBe('de');
    });

    it('should detect English from job posting with English keywords', () => {
      const englishText = `
        We are looking for a Senior Full-Stack Developer to join our team in San Francisco.
        You will work with modern technologies and be part of an agile team.
        Your responsibilities include developing microservices using Docker and Kubernetes.
      `;

      const result = (service as any).detectLanguage(englishText);
      expect(result).toBe('en');
    });

    it('should return null for text with insufficient language markers', () => {
      const ambiguousText = 'React TypeScript Docker Kubernetes';
      const result = (service as any).detectLanguage(ambiguousText);
      expect(result).toBeNull();
    });

    it('should detect German even with technical terms in English', () => {
      const mixedText = `
        Wir suchen einen erfahrenen Entwickler für React und TypeScript.
        Sie werden in unserem agilen Team arbeiten und moderne Cloud-Lösungen mit AWS entwickeln.
        Ihre Aufgaben umfassen die Implementierung von REST APIs und die Optimierung der Performance.
      `;

      const result = (service as any).detectLanguage(mixedText);
      expect(result).toBe('de');
    });

    it('should detect English even with company names in other languages', () => {
      const mixedText = `
        We are looking for an experienced developer to work with React and TypeScript.
        You will join our agile team and develop modern cloud solutions using AWS.
        Your responsibilities include implementing REST APIs and optimizing performance.
      `;

      const result = (service as any).detectLanguage(mixedText);
      expect(result).toBe('en');
    });
  });
});
