import { Test, TestingModule } from '@nestjs/testing';
import { KeywordsService } from '../../keywords.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ATSKeywordAgent } from '../../../agents/ats/ats-keyword.agent';
import { ConfigService } from '@nestjs/config';
import { ATSAgentOutput } from '../../../agents/agents.interface';

describe('KeywordsService', () => {
  let service: KeywordsService;
  let atsAgent: jest.Mocked<ATSKeywordAgent>;
  let prisma: jest.Mocked<PrismaService>;

  const mockATSOutput: ATSAgentOutput = {
    technicalSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    softSkills: ['Teamarbeit', 'Kommunikation', 'Problemlösung'],
    responsibilityKeywords: ['entwickeln', 'implementieren', 'optimieren'],
    requirementKeywords: ['3+ Jahre Erfahrung', 'Agile Methoden'],
    toolsAndTechnologies: ['Git', 'Docker', 'AWS'],
    industryKeywords: ['SaaS', 'Fintech'],
    senioritySignals: ['Senior', 'Lead'],
    miscKeywords: ['Remote-friendly'],
  };

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@example.com',
    phone: null,
    location: 'Berlin',
    linkedInUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    summary: 'Erfahrener Full-Stack Entwickler',
    skills: [
      { id: '1', name: 'TypeScript', level: 'Expert', profileId: 'profile-1' },
      { id: '2', name: 'React', level: 'Advanced', profileId: 'profile-1' },
    ],
    experiences: [],
    education: [],
    certificates: [],
    projects: [],
    languages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJobPosting = {
    id: 'job-1',
    title: 'Senior Developer',
    company: 'TechCorp',
    location: 'Berlin',
    fullText: 'Looking for senior developer with TypeScript and React experience. Responsibilities include developing apps. AWS knowledge is a nice to have.',
    rawText: null,
    sourceUrl: null,
    fileId: null,
    language: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAtsAgent = {
      execute: jest.fn().mockResolvedValue(mockATSOutput),
    };

    const mockPrisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue(mockProfile),
      },
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue(mockJobPosting),
      },
      application: {
        update: jest.fn().mockResolvedValue({}),
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
    atsAgent = module.get(ATSKeywordAgent);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractKeywords', () => {
    it('should extract keywords using ATS Agent', async () => {
      const result = await service.extractKeywords(mockJobPosting);

      expect(atsAgent.execute).toHaveBeenCalled();
      expect(result).toEqual(mockATSOutput);
      expect(result.technicalSkills).toContain('TypeScript');
    });

    it('should handle empty arrays in job posting', async () => {
      atsAgent.execute.mockResolvedValueOnce({
        technicalSkills: [],
        softSkills: [],
        responsibilityKeywords: [],
        requirementKeywords: [],
        toolsAndTechnologies: [],
        industryKeywords: [],
        senioritySignals: [],
        miscKeywords: [],
      });

      const result = await service.extractKeywords(mockJobPosting);

      expect(result.technicalSkills).toHaveLength(0);
    });
  });

  describe('convertToLegacyFormat', () => {
    it('should convert ATSAgentOutput to legacy format', () => {
      const result = service.convertToLegacyFormat(mockATSOutput);

      expect(result).toHaveProperty('technical');
      expect(result).toHaveProperty('soft');
      expect(result).toHaveProperty('experience');
      expect(result.technical).toContain('TypeScript');
      expect(result.soft).toContain('Teamarbeit');
    });
  });

  describe('analyzeMatch', () => {
    it('should analyze match between profile and job posting', async () => {
      const result = await service.analyzeMatch('user-1', 'job-1');

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          skills: true,
          experiences: true,
          education: true,
          certificates: true,
          projects: true,
          languages: true,
        },
      });
      expect(prisma.jobPosting.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
      });

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('missing');
      expect(result).toHaveProperty('suggestions');
    });
  });
});
