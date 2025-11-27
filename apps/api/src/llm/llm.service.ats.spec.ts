import { Test, TestingModule } from '@nestjs/testing';
import { LLMService, ATSCoverLetterContext, ATSResumeContext, KeywordMatch } from './llm.service';

describe('LLMService - ATS Methods', () => {
  let service: LLMService;
  const mockProvider = {
    generateText: jest.fn(),
  };

  beforeEach(async () => {
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
    jest.clearAllMocks();
  });

  describe('generateCoverLetterATS', () => {
    const mockContext: ATSCoverLetterContext = {
      profile:
        'Name: John Doe\nSkills: React, TypeScript, Node.js\nExperience: Senior Developer at TechCorp',
      jobTitle: 'Senior Frontend Developer',
      companyName: 'InnovateTech',
      location: 'Berlin, Germany',
      jobDescription:
        'We are looking for a Senior Frontend Developer with React and TypeScript experience.',
      matchedKeywords: [
        { keyword: 'React', category: 'technical', found: true, confidence: 0.95 },
        { keyword: 'TypeScript', category: 'technical', found: true, confidence: 0.9 },
        { keyword: 'Frontend', category: 'technical', found: true, confidence: 0.85 },
      ],
      missingKeywords: [
        { keyword: 'Vue.js', category: 'technical', found: false, confidence: 0 },
        { keyword: 'GraphQL', category: 'tool', found: false, confidence: 0 },
      ],
    };

    it('should call provider with ATS-optimized prompt', async () => {
      mockProvider.generateText.mockResolvedValue('<p>Dear Hiring Manager...</p>');

      const result = await service.generateCoverLetterATS(mockContext);

      expect(mockProvider.generateText).toHaveBeenCalledTimes(1);
      expect(result).toBe('<p>Dear Hiring Manager...</p>');

      // Verify the prompt includes ATS keywords
      const [prompt, options] = mockProvider.generateText.mock.calls[0];
      expect(prompt).toContain('Senior Frontend Developer');
      expect(prompt).toContain('InnovateTech');
      expect(prompt).toContain('React');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Vue.js'); // Missing keyword
      expect(options.systemMessage).toContain('ATS');
    });

    it('should format matched keywords by category', async () => {
      mockProvider.generateText.mockResolvedValue('<p>Cover letter content</p>');

      await service.generateCoverLetterATS(mockContext);

      const [prompt] = mockProvider.generateText.mock.calls[0];
      // Should contain keywords grouped by category
      expect(prompt).toContain('Technical Skills:');
      expect(prompt).toContain('React, TypeScript, Frontend');
    });

    it('should handle empty keywords gracefully', async () => {
      const contextWithNoKeywords: ATSCoverLetterContext = {
        ...mockContext,
        matchedKeywords: [],
        missingKeywords: [],
      };

      mockProvider.generateText.mockResolvedValue('<p>Generated content</p>');

      const result = await service.generateCoverLetterATS(contextWithNoKeywords);

      expect(result).toBe('<p>Generated content</p>');
      const [prompt] = mockProvider.generateText.mock.calls[0];
      expect(prompt).toContain('None identified');
    });
  });

  describe('generateResumeATS', () => {
    const mockContext: ATSResumeContext = {
      profile: JSON.stringify({
        candidateName: 'John Doe',
        email: 'john@example.com',
        skillCategories: [
          { type: 'Languages', skills: ['TypeScript', 'JavaScript'] },
          { type: 'Frameworks', skills: ['React', 'Node.js'] },
        ],
        experiences: [
          {
            title: 'Senior Developer',
            company: 'TechCorp',
            dateRange: '2020 - Present',
            achievements: ['Led React team', 'Improved performance by 40%'],
          },
        ],
      }),
      jobTitle: 'Full Stack Developer',
      companyName: 'StartupXYZ',
      jobDescription:
        'Looking for an experienced Full Stack Developer with React and Node.js skills.',
      matchedKeywords: [
        { keyword: 'React', category: 'technical', found: true, confidence: 0.95 },
        { keyword: 'Node.js', category: 'technical', found: true, confidence: 0.9 },
        { keyword: 'TypeScript', category: 'technical', found: true, confidence: 0.85 },
      ],
      missingKeywords: [
        { keyword: 'Docker', category: 'tool', found: false, confidence: 0 },
        { keyword: 'AWS', category: 'tool', found: false, confidence: 0 },
      ],
    };

    it('should call provider with ATS-optimized resume prompt', async () => {
      mockProvider.generateText.mockResolvedValue('{"summary": "Professional summary..."}');

      const result = await service.generateResumeATS(mockContext);

      expect(mockProvider.generateText).toHaveBeenCalledTimes(1);
      expect(result).toBe('{"summary": "Professional summary..."}');

      const [prompt, options] = mockProvider.generateText.mock.calls[0];
      expect(prompt).toContain('Full Stack Developer');
      expect(prompt).toContain('StartupXYZ');
      expect(prompt).toContain('React');
      expect(prompt).toContain('Node.js');
      expect(options.systemMessage).toContain('ATS');
    });

    it('should include priority keywords in prompt', async () => {
      mockProvider.generateText.mockResolvedValue('{}');

      await service.generateResumeATS(mockContext);

      const [prompt] = mockProvider.generateText.mock.calls[0];
      // Priority keywords should be technical skills
      expect(prompt).toContain('Priority Keywords');
      expect(prompt).toContain('React, Node.js, TypeScript');
    });

    it('should handle missing keywords in prompt', async () => {
      mockProvider.generateText.mockResolvedValue('{}');

      await service.generateResumeATS(mockContext);

      const [prompt] = mockProvider.generateText.mock.calls[0];
      expect(prompt).toContain('Docker');
      expect(prompt).toContain('AWS');
    });
  });

  describe('KeywordMatch interface', () => {
    it('should support all category types', () => {
      const categories: KeywordMatch['category'][] = [
        'technical',
        'soft',
        'tool',
        'industry',
        'seniority',
        'requirement',
        'misc',
      ];

      categories.forEach((category) => {
        const keyword: KeywordMatch = {
          keyword: 'Test',
          category,
          found: true,
          confidence: 0.9,
        };
        expect(keyword.category).toBe(category);
      });
    });
  });
});
