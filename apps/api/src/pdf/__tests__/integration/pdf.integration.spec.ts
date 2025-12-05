import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { TemplateRendererService } from './template-renderer.service';
import { ConfigService } from '../config/config.service';

describe('PDF Generation Integration', () => {
  let service: PdfService;
  let templateRenderer: TemplateRendererService;

  const mockConfigService = {
    puppeteerExecutablePath: undefined,
    isDevelopment: true,
    isProduction: false,
    isTest: false,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        TemplateRendererService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
    templateRenderer = module.get<TemplateRendererService>(TemplateRendererService);
  }, 30000);

  afterAll(async () => {
    await service.onModuleDestroy();
  }, 10000);

  it('should generate cover letter PDF', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <div class="header">
            <h1>Jane Smith</h1>
            <div class="contact">
              jane.smith@email.com | +1 555-0123 | linkedin.com/in/janesmith
            </div>
          </div>
          
          <div class="date">November 4, 2025</div>
          
          <div class="recipient">
            <strong>Hiring Manager</strong><br>
            Tech Company Inc.<br>
            123 Tech Street<br>
            San Francisco, CA 94105
          </div>
          
          <div class="salutation">Dear Hiring Manager,</div>
          
          <div class="body-text">
            <p>I am writing to express my strong interest in the Senior Software Engineer position at Tech Company Inc. With over 8 years of experience in full-stack development, I am confident that my skills and experience make me an ideal candidate for this role.</p>
            <p>Throughout my career, I have demonstrated expertise in:</p>
            <ul>
              <li>Building scalable microservices architectures using NestJS and Node.js</li>
              <li>Leading cross-functional teams in Agile environments</li>
              <li>Implementing CI/CD pipelines and improving deployment efficiency by 40%</li>
              <li>Mentoring junior developers and conducting code reviews</li>
              <li>Optimizing database performance and reducing query times by 60%</li>
            </ul>
            <p>I am particularly excited about Tech Company Inc.'s innovative approach to cloud-native applications and your commitment to engineering excellence. I believe my experience with Azure, containerization, and modern JavaScript frameworks aligns perfectly with your team's needs.</p>
            <p>I would welcome the opportunity to discuss how my experience and skills can contribute to your team's success. Thank you for considering my application.</p>
          </div>
          
          <div class="closing">
            <p>Sincerely,</p>
            <p><strong>Jane Smith</strong></p>
          </div>
        </body>
      </html>
    `;

    const pdf = await service.generatePDF(html, { template: 'cover-letter' });

    // Verify PDF is valid
    expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(5000); // Reasonable size

    // Optional: Write to file for manual inspection during development
    // const fs = require('fs');
    // fs.writeFileSync('/tmp/cover-letter-test.pdf', pdf);
  }, 30000);

  it('should generate resume PDF', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <div class="header">
            <h1>John Developer</h1>
            <div class="contact">john.dev@email.com | GitHub: github.com/johndev | +1 555-9876</div>
          </div>
          
          <div class="section">
            <div class="section-title">Skills</div>
            <div class="skills-list">
              <div class="skill-category">
                <strong>Languages:</strong>
                TypeScript, Python, Java
              </div>
              <div class="skill-category">
                <strong>Frameworks:</strong>
                NestJS, React, Spring Boot
              </div>
              <div class="skill-category">
                <strong>Cloud:</strong>
                Azure, AWS, Docker
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Experience</div>
            <div class="experience-item">
              <div class="item-header">
                <span class="item-title">Senior Software Engineer</span>
                <span class="item-date">2020 - Present</span>
              </div>
              <div class="item-company">Tech Corp, San Francisco</div>
              <ul>
                <li>Led development of microservices architecture serving 1M+ daily users</li>
                <li>Improved API performance by 40% through optimization and caching strategies</li>
                <li>Mentored team of 5 junior developers and conducted technical interviews</li>
                <li>Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes</li>
              </ul>
            </div>
            <div class="experience-item">
              <div class="item-header">
                <span class="item-title">Software Engineer</span>
                <span class="item-date">2017 - 2020</span>
              </div>
              <div class="item-company">StartUp Inc, Palo Alto</div>
              <ul>
                <li>Built REST APIs using Node.js and Express serving 100K+ requests/day</li>
                <li>Developed React frontend components with TypeScript</li>
                <li>Collaborated with product team to define technical requirements</li>
              </ul>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Projects</div>
            <div class="project-item">
              <div class="item-header">
                <span class="item-title">Smart Apply - AI Job Application Assistant</span>
                <span class="item-date">2025</span>
              </div>
              <ul>
                <li>Developed NestJS backend with Azure integration for AI-powered job applications</li>
                <li>Implemented PDF generation using Puppeteer for dynamic document creation</li>
                <li>Integrated Azure OpenAI for personalized cover letter generation</li>
              </ul>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Education</div>
            <div class="experience-item">
              <div class="item-header">
                <span class="item-title">Bachelor of Science in Computer Science</span>
                <span class="item-date">2013 - 2017</span>
              </div>
              <div class="item-company">Stanford University</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const pdf = await service.generatePDF(html, { template: 'resume' });

    expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(5000);

    // Optional: Write to file for manual inspection
    // const fs = require('fs');
    // fs.writeFileSync('/tmp/resume-test.pdf', pdf);
  }, 30000);

  it('should generate PDF with no template (base CSS only)', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Simple Document</h1>
          <p>This is a simple document with base styling only.</p>
          <h2>Section 1</h2>
          <p>Some content here.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        </body>
      </html>
    `;

    const pdf = await service.generatePDF(html);

    expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30000);

  it('should generate professional cover letter PDF from structured data', async () => {
    const coverLetterData = {
      candidateName: 'Jane Smith',
      email: 'jane.smith@email.com',
      phone: '+1 555-0123',
      linkedin: 'https://linkedin.com/in/janesmith',
      location: 'San Francisco, CA',
      companyName: 'Tech Company Inc.',
      recipientName: 'Hiring Manager',
      content: `
        <p>I am writing to express my strong interest in the Senior Software Engineer position at Tech Company Inc. With over 8 years of experience in full-stack development, I am confident that my skills and experience make me an ideal candidate for this role.</p>
        
        <div class="key-qualifications">
          <h3>Why I'm an Excellent Fit</h3>
          <ul>
            <li class="achievement">Built and scaled microservices architecture serving <span class="metric">1M+ daily users</span></li>
            <li class="achievement">Led cross-functional teams of 5+ engineers in Agile environments</li>
            <li class="metric">Implemented CI/CD pipelines, improving deployment efficiency by <span class="metric">40%</span></li>
            <li>Mentored junior developers and established code review best practices</li>
            <li class="metric">Optimized database performance, reducing query times by <span class="metric">60%</span></li>
          </ul>
        </div>
        
        <div class="motivation-section">
          <p>I am particularly excited about Tech Company Inc.'s innovative approach to cloud-native applications and your commitment to engineering excellence. I believe my experience with Azure, containerization, and modern JavaScript frameworks aligns perfectly with your team's needs.</p>
        </div>
        
        <p>I would welcome the opportunity to discuss how my experience and skills can contribute to your team's success. Thank you for considering my application.</p>
      `,
    };

    const pdf = await service.generateCoverLetterPDF(coverLetterData);

    expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(10000); // Should be substantial with styling

    // Optional: Write to file for manual inspection
    // const fs = require('fs');
    // fs.writeFileSync('/tmp/professional-cover-letter.pdf', pdf);
  }, 30000);

  it('should generate professional resume PDF from structured data', async () => {
    const resumeData = {
      candidateName: 'John Developer',
      email: 'john.dev@email.com',
      phone: '+1 555-9876',
      github: 'https://github.com/johndev',
      linkedin: 'https://linkedin.com/in/johndev',
      location: 'San Francisco, CA',
      summary:
        'Full-stack software engineer with 8+ years of experience building scalable web applications. Specialized in cloud-native architectures, microservices, and modern JavaScript frameworks. Proven track record of leading teams and delivering high-impact projects.',
      skillCategories: [
        {
          type: 'Languages',
          skills: ['TypeScript', 'Python', 'Java', 'Go'],
        },
        {
          type: 'Frameworks',
          skills: ['NestJS', 'React', 'Spring Boot', 'FastAPI'],
        },
        {
          type: 'Cloud',
          skills: ['Azure', 'AWS', 'Docker', 'Kubernetes'],
        },
        {
          type: 'Databases',
          skills: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch'],
        },
        {
          type: 'Tools',
          skills: ['Git', 'CI/CD', 'Terraform', 'Jenkins'],
        },
      ],
      experiences: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco, CA',
          dateRange: 'Jan 2020 - Present',
          achievements: [
            'Led development of microservices architecture serving <span class="metric">1M+ daily users</span>',
            'Improved API performance by <span class="metric">40%</span> through optimization and caching strategies',
            'Mentored team of 5 junior developers and conducted technical interviews',
            'Implemented CI/CD pipeline reducing deployment time from 2 hours to <span class="metric">15 minutes</span>',
          ],
        },
        {
          title: 'Software Engineer',
          company: 'StartUp Inc',
          location: 'Palo Alto, CA',
          dateRange: 'Jun 2017 - Dec 2019',
          achievements: [
            'Built REST APIs using Node.js and Express serving <span class="metric">100K+ requests/day</span>',
            'Developed React frontend components with TypeScript',
            'Collaborated with product team to define technical requirements',
          ],
        },
      ],
      projects: [
        {
          name: 'Smart Apply - AI Job Application Assistant',
          date: '2025',
          description: 'NestJS backend with Azure integration for AI-powered job applications',
          highlights: [
            'Developed backend API with Azure OpenAI integration',
            'Implemented PDF generation using Puppeteer for dynamic documents',
            'Integrated Azure Blob Storage for file management',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'Stanford University',
          year: '2017',
        },
      ],
      certifications: [
        {
          name: 'Azure Solutions Architect Expert',
          issuer: 'Microsoft',
          date: '2024',
        },
        {
          name: 'AWS Certified Developer',
          issuer: 'Amazon',
          date: '2023',
        },
      ],
    };

    const pdf = await service.generateResumePDF(resumeData);

    expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(15000); // Should be substantial with all sections

    // Optional: Write to file for manual inspection
    // const fs = require('fs');
    // fs.writeFileSync('/tmp/professional-resume.pdf', pdf);
  }, 30000);

  it('should render cover letter template correctly', async () => {
    const data = {
      candidateName: 'Test Candidate',
      email: 'test@example.com',
      companyName: 'Test Company',
      content: '<p>Test content</p>',
    };

    const html = await templateRenderer.renderCoverLetter(data);

    expect(html).toContain('Test Candidate');
    expect(html).toContain('test@example.com');
    expect(html).toContain('Test Company');
    expect(html).toContain('<p>Test content</p>');
    expect(html).toContain('<style>');
  });

  it('should render resume template correctly', async () => {
    const data = {
      candidateName: 'Test Developer',
      email: 'dev@example.com',
      summary: 'Experienced developer',
      skillCategories: [
        {
          type: 'Languages',
          skills: ['TypeScript', 'Python'],
        },
      ],
    };

    const html = await templateRenderer.renderResume(data);

    expect(html).toContain('Test Developer');
    expect(html).toContain('dev@example.com');
    expect(html).toContain('Experienced developer');
    expect(html).toContain('TypeScript');
    expect(html).toContain('<style>');
  });
});
