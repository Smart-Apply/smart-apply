import { Test, TestingModule } from '@nestjs/testing';
import { LLMService } from '../../llm.service';
import { LLMProvider } from '../../llm.interface';

describe('LLMService - Summary Translation', () => {
  let service: LLMService;
  let mockProvider: jest.Mocked<LLMProvider>;

  beforeEach(async () => {
    mockProvider = {
      generateText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        {
          provide: 'LLM_PROVIDER',
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
  });

  describe('translateSummary', () => {
    it('should translate German summary to English', async () => {
      const germanSummary =
        'Erfahrener Full-Stack Developer mit 5+ Jahren Erfahrung in React, Node.js und TypeScript. Leitete Teams zur Steigerung der Performance um 45% und Reduzierung der Deployment-Zeit um 60%.';
      const englishTranslation =
        'Experienced Full-Stack Developer with 5+ years of experience in React, Node.js, and TypeScript. Led teams to increase performance by 45% and reduce deployment time by 60%.';

      mockProvider.generateText.mockResolvedValue(englishTranslation);

      const result = await service.translateSummary(germanSummary, 'de', 'en');

      expect(result).toBe(englishTranslation);
      expect(mockProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Translate the following professional summary from German to English'),
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 500,
        }),
      );
    });

    it('should translate English summary to German', async () => {
      const englishSummary =
        'Experienced Full-Stack Developer with 5+ years of experience in React, Node.js, and TypeScript. Led teams to increase performance by 45%.';
      const germanTranslation =
        'Erfahrener Full-Stack Developer mit 5+ Jahren Erfahrung in React, Node.js und TypeScript. Leitete Teams zur Steigerung der Performance um 45%.';

      mockProvider.generateText.mockResolvedValue(germanTranslation);

      const result = await service.translateSummary(englishSummary, 'en', 'de');

      expect(result).toBe(germanTranslation);
      expect(mockProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Translate the following professional summary from English to German'),
        expect.any(Object),
      );
    });

    it('should preserve technical terms in translation', async () => {
      const germanSummary = 'Expert in React, Docker, Kubernetes und AWS mit 7 Jahren Erfahrung.';
      const englishTranslation =
        'Expert in React, Docker, Kubernetes, and AWS with 7 years of experience.';

      mockProvider.generateText.mockResolvedValue(englishTranslation);

      const result = await service.translateSummary(germanSummary, 'de', 'en');

      // Technical terms should remain in English
      expect(result).toContain('React');
      expect(result).toContain('Docker');
      expect(result).toContain('Kubernetes');
      expect(result).toContain('AWS');
    });

    it('should return original summary if languages are the same', async () => {
      const summary = 'Experienced developer with 5 years of experience.';

      const result = await service.translateSummary(summary, 'en', 'en');

      expect(result).toBe(summary);
      expect(mockProvider.generateText).not.toHaveBeenCalled();
    });

    it('should return original summary if summary is empty', async () => {
      const result = await service.translateSummary('', 'de', 'en');

      expect(result).toBe('');
      expect(mockProvider.generateText).not.toHaveBeenCalled();
    });

    it('should handle null or undefined summary', async () => {
      const result1 = await service.translateSummary(null as any, 'de', 'en');
      const result2 = await service.translateSummary(undefined as any, 'de', 'en');

      expect(result1).toBeNull();
      expect(result2).toBeUndefined();
      expect(mockProvider.generateText).not.toHaveBeenCalled();
    });
  });
});
