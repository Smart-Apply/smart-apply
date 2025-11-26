import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { AtsValidatorService } from './ats-validator.service';
import { ConfigService } from '../config/config.service';
import { TemplatesService } from '../templates/templates.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ResumeTemplateData, CoverLetterTemplateData } from './template-renderer.service';

describe('ATS-Optimized PDF Generation Integration', () => {
  let pdfService: PdfService;
  let atsValidator: AtsValidatorService;
  let templateRenderer: TemplateRendererService;

  const mockConfigService = {
    puppeteerExecutablePath: undefined,
    isDevelopment: true,
    isProduction: false,
    isTest: false,
  };

  const mockPrismaService = {
    template: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockTemplatesService = {
    findOne: jest.fn(),
    findDefault: jest.fn().mockResolvedValue({
      id: 'default-template',
      name: 'Default Resume',
      htmlTemplate: '<html><body>{{candidateName}}</body></html>',
      cssStyles: 'body { font-family: Arial; }',
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        TemplateRendererService,
        AtsValidatorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    }).compile();

    pdfService = module.get<PdfService>(PdfService);
    atsValidator = module.get<AtsValidatorService>(AtsValidatorService);
    templateRenderer = module.get<TemplateRendererService>(TemplateRendererService);
  }, 30000);

  afterAll(async () => {
    await pdfService.onModuleDestroy();
  }, 10000);

  describe('ATS-Optimized Resume Generation', () => {
    const sampleResumeData: ResumeTemplateData = {
      candidateName: 'Jane Doe',
      email: 'jane.doe@email.com',
      phone: '+1 555-0123',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/janedoe',
      github: 'github.com/janedoe',
      summary: 'Experienced software engineer with 5+ years in full-stack development.',
      skillCategories: [
        {
          type: 'Languages',
          skills: ['JavaScript', 'TypeScript', 'Python', 'Java'],
        },
        {
          type: 'Frameworks',
          skills: ['React', 'Node.js', 'Express', 'NestJS'],
        },
        {
          type: 'Cloud',
          skills: ['AWS', 'Azure', 'Docker', 'Kubernetes'],
        },
      ],
      experiences: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco, CA',
          dateRange: 'Jan 2020 - Present',
          achievements: [
            'Led development of microservices architecture serving 1M+ users',
            'Improved system performance by 40% through optimization',
            'Mentored team of 5 junior engineers',
          ],
        },
        {
          title: 'Software Engineer',
          company: 'Startup Inc',
          location: 'Palo Alto, CA',
          dateRange: 'Jun 2018 - Dec 2019',
          achievements: [
            'Built RESTful APIs using Node.js and Express',
            'Implemented CI/CD pipeline reducing deployment time by 60%',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'Stanford University',
          year: '2018',
          fieldOfStudy: 'Computer Science',
          gpa: '3.8',
        },
      ],
      certifications: [
        {
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          date: '2021',
        },
      ],
      projects: [
        {
          name: 'Open Source Contributor',
          description: 'Active contributor to React and TypeScript projects',
          date: '2019 - Present',
          highlights: ['50+ merged pull requests', 'Improved documentation'],
        },
      ],
    };

    it('should generate ATS-optimized resume with high ATS score', async () => {
      const pdfBuffer = await pdfService.generateResumePDF(sampleResumeData, undefined, {
        atsOptimized: true,
        metadata: {
          title: 'Resume - Jane Doe',
          author: 'Jane Doe',
          subject: 'Software Engineer Application',
          keywords: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS'],
        },
      });

      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Validate ATS-friendliness
      const validation = await atsValidator.validatePdf(pdfBuffer);
      
      expect(validation.isTextBased).toBe(true);
      expect(validation.hasMetadata).toBe(true);
      expect(validation.score).toBeGreaterThanOrEqual(90); // Should be excellent ATS score
      expect(validation.warnings.length).toBeLessThanOrEqual(1); // Minimal warnings
    }, 30000);

    it('should use ATS-safe fonts in optimized resume', async () => {
      const pdfBuffer = await pdfService.generateResumePDF(sampleResumeData, undefined, {
        atsOptimized: true,
        metadata: {
          title: 'Resume - Jane Doe',
          author: 'Jane Doe',
        },
      });

      const validation = await atsValidator.validatePdf(pdfBuffer);
      
      expect(validation.usesSafeFonts).toBe(true);
    }, 30000);

    it('should not have complex layouts in ATS-optimized resume', async () => {
      const pdfBuffer = await pdfService.generateResumePDF(sampleResumeData, undefined, {
        atsOptimized: true,
      });

      const validation = await atsValidator.validatePdf(pdfBuffer);
      
      expect(validation.hasComplexLayouts).toBe(false);
      expect(validation.hasSingleColumn).toBe(true);
    }, 30000);

    it('should include proper metadata in ATS-optimized resume', async () => {
      const metadata = {
        title: 'Resume - Jane Doe',
        author: 'Jane Doe',
        subject: 'Software Engineer Position',
        keywords: ['JavaScript', 'TypeScript', 'React', 'AWS', 'Node.js'],
      };

      const pdfBuffer = await pdfService.generateResumePDF(sampleResumeData, undefined, {
        atsOptimized: true,
        metadata,
      });

      const report = await atsValidator.getDetailedReport(pdfBuffer);
      
      expect(report.checks.metadata.passed).toBe(true);
      expect(report.checks.metadata.title).toBe(metadata.title);
      expect(report.checks.metadata.author).toBe(metadata.author);
      expect(report.checks.metadata.keywords).toContain('JavaScript');
    }, 30000);
  });

  describe('ATS-Optimized Cover Letter Generation', () => {
    const sampleCoverLetterData: CoverLetterTemplateData = {
      candidateName: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1 555-0456',
      location: 'New York, NY',
      linkedin: 'linkedin.com/in/johnsmith',
      companyName: 'Innovative Tech Inc',
      recipientName: 'Sarah Johnson',
      content: `
        <p>I am writing to express my strong interest in the Senior Software Engineer position at Innovative Tech Inc. With over 7 years of experience in full-stack development and a proven track record of delivering scalable solutions, I am confident I would be a valuable addition to your team.</p>
        
        <p>In my current role at Tech Corp, I have:</p>
        <ul>
          <li>Led the development of a microservices architecture serving over 2 million users</li>
          <li>Improved system performance by 50% through strategic optimization</li>
          <li>Mentored a team of 8 junior developers</li>
        </ul>
        
        <p>I am particularly drawn to Innovative Tech Inc's commitment to cutting-edge technology and innovation. My experience with React, Node.js, and AWS aligns perfectly with the technical requirements outlined in your job posting.</p>
        
        <p>I would welcome the opportunity to discuss how my skills and experience can contribute to your team's success. Thank you for considering my application.</p>
      `,
    };

    it('should generate ATS-optimized cover letter with high score', async () => {
      const pdfBuffer = await pdfService.generateCoverLetterPDF(sampleCoverLetterData, undefined, {
        atsOptimized: true,
        metadata: {
          title: 'Cover Letter - John Smith',
          author: 'John Smith',
          subject: 'Senior Software Engineer Application',
          keywords: ['Software Engineer', 'React', 'Node.js', 'AWS'],
        },
      });

      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const validation = await atsValidator.validatePdf(pdfBuffer);
      
      expect(validation.isTextBased).toBe(true);
      expect(validation.hasMetadata).toBe(true);
      expect(validation.score).toBeGreaterThanOrEqual(85);
    }, 30000);

    it('should have selectable text in ATS-optimized cover letter', async () => {
      const pdfBuffer = await pdfService.generateCoverLetterPDF(sampleCoverLetterData, undefined, {
        atsOptimized: true,
      });

      const validation = await atsValidator.validatePdf(pdfBuffer);
      
      expect(validation.isTextBased).toBe(true);
      expect(validation.hasSelectableText).toBe(true);
    }, 30000);
  });

  describe('Standard vs ATS-Optimized Comparison', () => {
    const resumeData: ResumeTemplateData = {
      candidateName: 'Test User',
      email: 'test@example.com',
      summary: 'Software engineer with 3 years of experience',
      skillCategories: [
        { type: 'Languages', skills: ['JavaScript', 'Python'] },
      ],
      experiences: [
        {
          title: 'Software Engineer',
          company: 'Test Corp',
          dateRange: '2020 - Present',
          achievements: ['Built web applications'],
        },
      ],
      education: [
        {
          degree: 'BS Computer Science',
          institution: 'University',
          year: '2020',
        },
      ],
    };

    it('should generate both standard and ATS-optimized versions', async () => {
      // Generate standard PDF
      const standardPdf = await pdfService.generateResumePDF(resumeData, undefined, {
        atsOptimized: false,
      });

      // Generate ATS-optimized PDF
      const atsPdf = await pdfService.generateResumePDF(resumeData, undefined, {
        atsOptimized: true,
        metadata: {
          title: 'Resume - Test User',
          author: 'Test User',
        },
      });

      expect(standardPdf).toBeDefined();
      expect(atsPdf).toBeDefined();

      // Validate both
      const standardValidation = await atsValidator.validatePdf(standardPdf);
      const atsValidation = await atsValidator.validatePdf(atsPdf);

      // ATS-optimized should have better score
      expect(atsValidation.score).toBeGreaterThanOrEqual(standardValidation.score);
      expect(atsValidation.hasMetadata).toBe(true);
    }, 30000);
  });

  describe('Detailed ATS Report', () => {
    it('should provide detailed validation report for ATS-optimized PDF', async () => {
      const resumeData: ResumeTemplateData = {
        candidateName: 'Report Test User',
        email: 'report@test.com',
        skillCategories: [{ type: 'Skills', skills: ['Testing'] }],
      };

      const pdfBuffer = await pdfService.generateResumePDF(resumeData, undefined, {
        atsOptimized: true,
        metadata: {
          title: 'Resume - Report Test',
          author: 'Report Test User',
          keywords: ['Testing', 'QA', 'Automation'],
        },
      });

      const report = await atsValidator.getDetailedReport(pdfBuffer);

      expect(report).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.score).toBeGreaterThan(0);
      
      // Check all validation checks are present
      expect(report.checks.textBased).toBeDefined();
      expect(report.checks.complexLayouts).toBeDefined();
      expect(report.checks.safeFonts).toBeDefined();
      expect(report.checks.metadata).toBeDefined();
      expect(report.checks.singleColumn).toBeDefined();
      expect(report.checks.selectableText).toBeDefined();
    }, 30000);
  });
});
