import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { ConfigService } from '../config/config.service';

describe('PDF Generation Integration', () => {
  let service: PdfService;

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
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
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
});
