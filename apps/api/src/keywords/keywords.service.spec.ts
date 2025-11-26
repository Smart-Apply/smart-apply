import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { PrismaService } from '../prisma/prisma.service';

describe('KeywordsService', () => {
  let service: KeywordsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    profile: {
      findUnique: jest.fn(),
    },
    jobPosting: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeywordsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<KeywordsService>(KeywordsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('extractKeywords', () => {
    it('should extract technical keywords from job posting', () => {
      const jobPosting = {
        title: 'Senior React Developer',
        company: 'TechCorp',
        description: 'We are looking for a React developer with TypeScript experience.',
        requirements: [
          '5+ years of JavaScript experience',
          'Proficiency in Node.js and Express',
          'Knowledge of PostgreSQL',
        ],
        responsibilities: [
          'Build scalable web applications',
          'Work with Docker and Kubernetes',
        ],
        niceToHave: ['AWS experience'],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.technical).toContain('react');
      expect(result.technical).toContain('typescript');
      expect(result.technical).toContain('javascript');
      expect(result.technical).toContain('nodejs');
      expect(result.technical).toContain('postgresql');
      expect(result.technical).toContain('docker');
      expect(result.technical).toContain('kubernetes');
      expect(result.technical).toContain('aws');
    });

    it('should extract soft skills from job posting', () => {
      const jobPosting = {
        title: 'Team Lead',
        company: 'ABC Corp',
        description: 'Looking for a leader with excellent communication skills.',
        requirements: [
          'Strong leadership and teamwork abilities',
          'Excellent problem-solving skills',
        ],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.soft).toContain('leadership');
      expect(result.soft).toContain('communication');
      expect(result.soft).toContain('teamwork');
      expect(result.soft).toContain('problem solving');
    });

    it('should extract experience level keywords', () => {
      const jobPosting = {
        title: 'Senior Developer',
        company: 'XYZ',
        description: 'We need a senior developer with 5+ years experience.',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.experience).toContain('senior');
    });

    it('should extract methodology keywords', () => {
      const jobPosting = {
        title: 'Scrum Master',
        company: 'AgileInc',
        description: 'Experience with Agile and Scrum required. Knowledge of CI/CD pipelines.',
        requirements: ['Agile methodologies', 'DevOps experience'],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.methodology).toContain('agile');
      expect(result.methodology).toContain('scrum');
      expect(result.methodology).toContain('devops');
    });

    it('should handle synonym variations', () => {
      const jobPosting = {
        title: 'JS Developer',
        company: 'Test',
        description: 'K8s experience required. Work with Node and TS.',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.extractKeywords(jobPosting);

      // 'js' should map to 'javascript'
      expect(result.technical).toContain('javascript');
      // 'k8s' should map to 'kubernetes'
      expect(result.technical).toContain('kubernetes');
      // 'ts' should map to 'typescript'
      expect(result.technical).toContain('typescript');
    });

    it('should extract education requirements', () => {
      const jobPosting = {
        title: 'Data Scientist',
        company: 'DataCorp',
        description: "Master's degree in Computer Science or related field.",
        requirements: ["Bachelor's or Master's in CS"],
        responsibilities: [],
        niceToHave: ['PhD preferred'],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.education).toContain('master');
      expect(result.education).toContain('bachelor');
      expect(result.education).toContain('computer science');
    });

    it('should extract certification requirements', () => {
      const jobPosting = {
        title: 'Cloud Engineer',
        company: 'CloudCo',
        description: 'AWS Certified Solutions Architect preferred.',
        requirements: ['Scrum Master certification a plus'],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.extractKeywords(jobPosting);

      expect(result.certifications).toContain('aws certified');
      expect(result.certifications).toContain('scrum master');
    });
  });

  describe('performAnalysis', () => {
    it('should calculate match percentage correctly', () => {
      const profile = {
        skills: [
          { name: 'JavaScript', level: 'Expert' },
          { name: 'React', level: 'Advanced' },
          { name: 'Node.js', level: 'Advanced' },
        ],
        experiences: [
          {
            title: 'Senior Frontend Developer',
            company: 'TechCorp',
            description: 'Built React applications with TypeScript',
          },
        ],
        education: [
          {
            degree: 'Bachelor of Science',
            institution: 'MIT',
            fieldOfStudy: 'Computer Science',
          },
        ],
        certificates: [],
        projects: [],
        languages: [],
        summary: 'Experienced React developer',
      };

      const jobPosting = {
        title: 'React Developer',
        company: 'StartupXYZ',
        description: 'Looking for a React developer',
        requirements: ['JavaScript', 'React', 'Node.js'],
        responsibilities: ['Build UI components'],
        niceToHave: ['TypeScript'],
      };

      const result = service.performAnalysis(profile, jobPosting);

      expect(result.matchPercentage).toBeGreaterThan(0);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
      expect(result.categoryBreakdown).toBeDefined();
    });

    it('should identify matched keywords correctly', () => {
      const profile = {
        skills: [{ name: 'React' }, { name: 'JavaScript' }],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      };

      const jobPosting = {
        title: 'Frontend Developer',
        company: 'Test',
        description: 'React and JavaScript required',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      const matchedKeywordNames = result.matchedKeywords.map((k) => k.keyword);
      expect(matchedKeywordNames).toContain('react');
      expect(matchedKeywordNames).toContain('javascript');
    });

    it('should identify missing keywords correctly', () => {
      const profile = {
        skills: [{ name: 'JavaScript' }],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      };

      const jobPosting = {
        title: 'Full Stack Developer',
        company: 'Test',
        description: 'JavaScript, Python, and AWS required',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      const missingKeywordNames = result.missingKeywords.map((k) => k.keyword);
      expect(missingKeywordNames).toContain('python');
      expect(missingKeywordNames).toContain('aws');
    });

    it('should generate improvement suggestions', () => {
      const profile = {
        skills: [{ name: 'JavaScript' }],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      };

      const jobPosting = {
        title: 'Full Stack Developer',
        company: 'Test',
        description: 'React, Node.js, and AWS experience required.',
        requirements: ['React', 'Node.js', 'AWS'],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should calculate category breakdown', () => {
      const profile = {
        skills: [{ name: 'React' }, { name: 'TypeScript' }],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      };

      const jobPosting = {
        title: 'Developer',
        company: 'Test',
        description: 'React, TypeScript, and good communication skills',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      expect(result.categoryBreakdown).toHaveProperty('technical');
      expect(result.categoryBreakdown).toHaveProperty('soft');
      expect(result.categoryBreakdown.technical).toHaveProperty('matched');
      expect(result.categoryBreakdown.technical).toHaveProperty('total');
      expect(result.categoryBreakdown.technical).toHaveProperty('percentage');
    });

    it('should handle empty profile gracefully', () => {
      const profile = {
        skills: [],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      };

      const jobPosting = {
        title: 'Developer',
        company: 'Test',
        description: 'React required',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      expect(result.matchPercentage).toBe(0);
      expect(result.matchedKeywords.length).toBe(0);
      expect(result.missingKeywords.length).toBeGreaterThan(0);
    });

    it('should find keywords in project technologies', () => {
      const profile = {
        skills: [],
        experiences: [],
        education: [],
        certificates: [],
        projects: [
          {
            name: 'E-commerce Platform',
            description: 'Built with modern tech stack',
            technologies: ['React', 'Node.js', 'PostgreSQL'],
          },
        ],
        languages: [],
      };

      const jobPosting = {
        title: 'Developer',
        company: 'Test',
        description: 'React and PostgreSQL required',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      };

      const result = service.performAnalysis(profile, jobPosting);

      const matchedKeywordNames = result.matchedKeywords.map((k) => k.keyword);
      expect(matchedKeywordNames).toContain('react');
      expect(matchedKeywordNames).toContain('postgresql');
    });
  });

  describe('analyzeMatch', () => {
    it('should throw NotFoundException if profile not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.analyzeMatch('user-123', 'job-456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if job posting not found', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue({
        id: 'profile-1',
        skills: [],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      });
      mockPrismaService.jobPosting.findUnique.mockResolvedValue(null);

      await expect(service.analyzeMatch('user-123', 'job-456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return analysis when profile and job posting exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue({
        id: 'profile-1',
        skills: [{ name: 'React' }],
        experiences: [],
        education: [],
        certificates: [],
        projects: [],
        languages: [],
      });
      mockPrismaService.jobPosting.findUnique.mockResolvedValue({
        id: 'job-1',
        title: 'React Developer',
        company: 'Test',
        description: 'React experience required',
        requirements: [],
        responsibilities: [],
        niceToHave: [],
      });

      const result = await service.analyzeMatch('user-123', 'job-456');

      expect(result).toHaveProperty('matchPercentage');
      expect(result).toHaveProperty('matchedKeywords');
      expect(result).toHaveProperty('missingKeywords');
      expect(result).toHaveProperty('suggestions');
    });
  });
});
