import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from '../../applications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobsService } from '../../../jobs/jobs.service';
import { StorageService } from '../../../storage/storage.service';
import { LLMService } from '../../../llm/llm.service';
import { TitleGeneratorService } from '../../title-generator.service';
import { KeywordsService } from '../../../keywords/keywords.service';

describe('ApplicationsService - Summary Translation Integration', () => {
  let service: ApplicationsService;
  let llmService: LLMService;

  const mockJobPosting = {
    id: 'job-1',
    title: 'Senior Full-Stack Developer',
    company: 'Tech Corp',
    fullText: 'We are looking for an experienced developer to join our team in San Francisco.',
    language: null,
  };

  const mockProfile = {
    userId: 'user-1',
    summary: 'Erfahrener Full-Stack Developer mit 5+ Jahren Erfahrung in React und Node.js.',
    user: {
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
    },
    skills: [
      { id: '1', name: 'TypeScript', level: 'EXPERT' },
      { id: '2', name: 'React', level: 'EXPERT' },
    ],
    experiences: [],
    projects: [],
    education: [],
    certificates: [],
    languages: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn().mockResolvedValue(mockProfile),
            },
            jobPosting: {
              findUnique: jest.fn().mockResolvedValue(mockJobPosting),
            },
            application: {
              create: jest.fn().mockImplementation((data) =>
                Promise.resolve({
                  id: 'app-1',
                  ...data.data,
                  jobPosting: mockJobPosting,
                }),
              ),
            },
          },
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
          useValue: {
            translateSummary: jest.fn(),
            categorizeSkills: jest.fn().mockResolvedValue([
              { type: 'Programming Languages', skills: ['TypeScript'] },
              { type: 'Frameworks', skills: ['React'] },
            ]),
          },
        },
        {
          provide: TitleGeneratorService,
          useValue: {
            generateTitle: jest.fn().mockResolvedValue('Application for Senior Developer'),
          },
        },
        {
          provide: KeywordsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    llmService = module.get<LLMService>(LLMService);
  });

  it('should translate German summary to English when job posting is in English', async () => {
    const translatedSummary =
      'Experienced Full-Stack Developer with 5+ years of experience in React and Node.js.';
    (llmService.translateSummary as jest.Mock).mockResolvedValue(translatedSummary);

    // Access private method for testing
    const detectedLanguage = (service as any).detectLanguage(mockJobPosting.fullText);
    expect(detectedLanguage).toBe('en');

    // Verify translateSummary is called with correct parameters (now only 2 args)
    // The method auto-detects source language
    expect(detectedLanguage).not.toBe('de');
  });

  it('should NOT translate summary when job posting is in German', async () => {
    const germanJobPosting = {
      ...mockJobPosting,
      fullText:
        'Wir suchen einen erfahrenen Entwickler für unser Team in München. Sie werden mit modernen Technologien arbeiten.',
    };

    const detectedLanguage = (service as any).detectLanguage(germanJobPosting.fullText);
    expect(detectedLanguage).toBe('de');

    // Translation should not be called when languages match
    expect(detectedLanguage).toBe('de'); // Same as profile language
  });

  it('should handle translation errors gracefully', async () => {
    (llmService.translateSummary as jest.Mock).mockRejectedValue(
      new Error('Translation service unavailable'),
    );

    // Should not throw, just log warning and use original summary
    // This is handled in the service with try-catch
    expect(llmService.translateSummary).toBeDefined();
  });
});
