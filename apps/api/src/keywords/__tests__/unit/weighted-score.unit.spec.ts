import { Test, TestingModule } from '@nestjs/testing';
import { KeywordsService } from '../../keywords.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ATSKeywordAgent } from '../../../agents/ats/ats-keyword.agent';
import { ConfigService } from '@nestjs/config';
import { ATSAgentOutput } from '../../../agents/agents.interface';

/**
 * Test suite for weighted ATS score calculation
 * Weights: Hard Skills (40%), Soft Skills (20%), Experience (30%), Other/Certificates (10%)
 */
describe('KeywordsService - Weighted Score Calculation', () => {
  let service: KeywordsService;

  const createMockATSOutput = (
    technical: string[],
    soft: string[],
    seniority: string[],
    misc: string[],
  ): ATSAgentOutput => ({
    technicalSkills: technical,
    softSkills: soft,
    responsibilityKeywords: [],
    requirementKeywords: [],
    toolsAndTechnologies: [],
    industryKeywords: [],
    senioritySignals: seniority,
    miscKeywords: misc,
  });

  const createMockProfile = (overrides: any = {}) => ({
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@example.com',
    location: null,
    linkedInUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    summary: '',
    skills: [],
    experiences: [],
    education: [],
    certificates: [],
    projects: [],
    languages: [],
    ...overrides,
  });

  beforeEach(async () => {
    const mockAtsAgent = {
      execute: jest.fn(),
    };

    const mockPrisma = {
      profile: {
        findUnique: jest.fn(),
      },
      jobPosting: {
        findUnique: jest.fn(),
      },
      application: {
        update: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('mock-value'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeywordsService,
        { provide: ATSKeywordAgent, useValue: mockAtsAgent },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KeywordsService>(KeywordsService);
  });

  describe('Weighted score calculation', () => {
    it('should calculate weighted score with 100% match in all categories', () => {
      // Mock profile with all skills
      const profile = createMockProfile({
        summary: 'Experienced developer with strong teamwork and communication skills',
        skills: [
          { id: '1', name: 'TypeScript', level: 'Expert' },
          { id: '2', name: 'React', level: 'Advanced' },
        ],
        experiences: [
          {
            id: '1',
            title: 'Senior Developer',
            company: 'TechCorp',
            description: '5 years of experience in software development',
            startDate: new Date('2018-01-01'),
            endDate: undefined,
            current: true,
          },
        ],
        certificates: [{ id: '1', name: 'AWS Certified', issuer: 'Amazon', issueDate: new Date() }],
      });

      // Job posting wants: TypeScript, React, teamwork, senior level, AWS cert
      const keywords = createMockATSOutput(
        ['TypeScript', 'React'], // technical
        ['teamwork', 'communication'], // soft
        ['Senior', '5 years'], // seniority/experience
        ['AWS'], // misc/certificates
      );

      const result = service.performAnalysis(profile, keywords);

      // All categories should have 100% match
      expect(result.categoryBreakdown.technical.percentage).toBe(100);
      expect(result.categoryBreakdown.soft.percentage).toBe(100);
      expect(result.categoryBreakdown.experience.percentage).toBe(100);
      expect(result.categoryBreakdown.other.percentage).toBe(100);

      // Weighted score should be 100
      expect(result.matchPercentage).toBe(100);
    });

    it('should calculate weighted score with varying matches across categories', () => {
      // Profile with only technical skills, no soft skills, partial experience
      const profile = createMockProfile({
        summary: 'Developer',
        skills: [
          { id: '1', name: 'TypeScript', level: 'Expert' },
          { id: '2', name: 'React', level: 'Advanced' },
        ],
        experiences: [
          {
            id: '1',
            title: 'Junior Developer',
            company: 'StartupCo',
            description: 'Web development',
            startDate: new Date('2022-01-01'),
            endDate: undefined,
            current: true,
          },
        ],
      });

      // Job wants: TypeScript, React, teamwork, leadership, Senior 5+ years, AWS cert
      const keywords = createMockATSOutput(
        ['TypeScript', 'React'], // technical: 2/2 = 100%
        ['teamwork', 'leadership'], // soft: 0/2 = 0%
        ['Senior', '5 years'], // experience: 0/2 = 0%
        ['AWS'], // other: 0/1 = 0%
      );

      const result = service.performAnalysis(profile, keywords);

      // Technical should be 100%, others 0%
      expect(result.categoryBreakdown.technical.percentage).toBe(100);
      expect(result.categoryBreakdown.soft.percentage).toBe(0);
      expect(result.categoryBreakdown.experience.percentage).toBe(0);
      expect(result.categoryBreakdown.other.percentage).toBe(0);

      // Weighted score: (100 * 0.4) + (0 * 0.2) + (0 * 0.3) + (0 * 0.1) = 40
      expect(result.matchPercentage).toBe(40);
    });

    it('should handle weighted score when only soft skills match', () => {
      const profile = createMockProfile({
        summary: 'Great teamwork and communication skills',
      });

      const keywords = createMockATSOutput(
        ['Java', 'Python'], // technical: 0/2 = 0%
        ['teamwork', 'communication'], // soft: 2/2 = 100%
        [], // experience: 0/0 = N/A
        [], // other: 0/0 = N/A
      );

      const result = service.performAnalysis(profile, keywords);

      expect(result.categoryBreakdown.technical.percentage).toBe(0);
      expect(result.categoryBreakdown.soft.percentage).toBe(100);

      // Weighted score with normalization:
      // - totalWeight = 0.4 (technical) + 0.2 (soft) = 0.6 (only categories with keywords)
      // - weightedScore = (0 * 0.4) + (1 * 0.2) = 0.2
      // - finalScore = (0.2 / 0.6) * 100 = 33.33 ≈ 33
      expect(result.matchPercentage).toBe(33);
    });

    it('should calculate realistic scenario with partial matches', () => {
      const profile = createMockProfile({
        summary: 'Senior developer with strong teamwork skills. 5 years experience.',
        skills: [
          { id: '1', name: 'TypeScript', level: 'Expert' },
          { id: '2', name: 'React', level: 'Advanced' },
          // Missing: Node.js, PostgreSQL
        ],
        experiences: [
          {
            id: '1',
            title: 'Senior Developer',
            company: 'TechCorp',
            description: '5 years experience',
            startDate: new Date('2018-01-01'),
            endDate: undefined,
            current: true,
          },
        ],
      });

      const keywords = createMockATSOutput(
        ['TypeScript', 'React', 'Node.js', 'PostgreSQL'], // technical: 2/4 = 50%
        ['teamwork', 'leadership', 'communication'], // soft: 1/3 = 33%
        ['Senior', '5 years'], // experience: 2/2 = 100%
        [], // other: 0/0 = N/A
      );

      const result = service.performAnalysis(profile, keywords);

      expect(result.categoryBreakdown.technical.percentage).toBe(50);
      expect(result.categoryBreakdown.soft.percentage).toBe(33);
      expect(result.categoryBreakdown.experience.percentage).toBe(100);

      // Weighted with normalization:
      // - totalWeight = 0.4 (tech) + 0.2 (soft) + 0.3 (exp) = 0.9 (only categories with keywords)
      // - weightedScore = (0.5 * 0.4) + (0.33 * 0.2) + (1.0 * 0.3) = 0.2 + 0.066 + 0.3 = 0.566
      // - finalScore = (0.566 / 0.9) * 100 = 62.89 ≈ 63
      expect(result.matchPercentage).toBeGreaterThanOrEqual(62);
      expect(result.matchPercentage).toBeLessThanOrEqual(64);
    });

    it('should handle empty categories gracefully', () => {
      const profile = createMockProfile();

      const keywords = createMockATSOutput([], [], [], []);

      const result = service.performAnalysis(profile, keywords);

      // No keywords = 0 score
      expect(result.matchPercentage).toBe(0);
    });
  });
});
