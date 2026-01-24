import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider, GenerateOptions } from '../llm.interface';

@Injectable()
export class MockLLMProvider implements LLMProvider {
  private readonly logger = new Logger(MockLLMProvider.name);

  async generateText(prompt: string, _options?: GenerateOptions): Promise<string> {
    this.logger.log('Using mock LLM provider for testing');

    // Check if it's a cover letter or resume based on prompt content
    const isCoverLetter = prompt.toLowerCase().includes('cover letter');

    if (isCoverLetter) {
      return this.generateMockCoverLetter();
    }

    return this.generateMockResume();
  }

  private generateMockCoverLetter(): string {
    return `
# Cover Letter

[Your Name]  
[Your Address]  
[City, State ZIP]  
[Your Email]  
[Your Phone]  

[Date]

[Hiring Manager's Name]  
[Company Name]  
[Company Address]  
[City, State ZIP]  

Dear Hiring Manager,

I am writing to express my strong interest in the [Position Title] position at [Company Name]. With my extensive background in software development and proven track record of delivering high-quality solutions, I am confident that I would be a valuable addition to your team.

**Why I'm a Great Fit:**

- **Relevant Experience**: 5+ years of full-stack development with TypeScript, React, and Node.js
- **Technical Skills**: Proficient in cloud platforms (Azure, AWS), containerization (Docker, Kubernetes), and modern development practices
- **Problem Solving**: Demonstrated ability to architect scalable solutions and optimize system performance
- **Team Collaboration**: Strong communication skills and experience mentoring junior developers

I am particularly excited about this opportunity because [Company Name] is known for innovation and technical excellence. I am eager to contribute my skills and learn from your talented team.

Thank you for considering my application. I look forward to the opportunity to discuss how my experience and skills align with your needs.

Sincerely,
    `.trim();
  }

  private generateMockResume(): string {
    return `
# [Your Name]

**Full-Stack Software Engineer**

[Your Email] | [Your Phone] | [Your LinkedIn] | [Your Portfolio]

---

## Professional Summary

Results-driven Full-Stack Developer with 5+ years of experience building scalable web applications using modern technologies. Expertise in TypeScript, React, Node.js, and cloud platforms. Proven track record of delivering high-quality solutions and mentoring team members.

---

## Technical Skills

**Languages**: TypeScript, JavaScript, Python, SQL  
**Frontend**: React, Next.js, HTML5, CSS3  
**Backend**: Node.js, NestJS, Express, RESTful APIs  
**Databases**: PostgreSQL, MongoDB, Redis  
**Cloud & DevOps**: Azure, AWS, Docker, Kubernetes, CI/CD  
**Tools**: Git, VS Code, Jira, Postman

---

## Professional Experience

### Senior Full-Stack Developer | Tech Innovations Inc.
*March 2021 - Present | San Francisco, CA*

- Architected and developed microservices-based SaaS platform serving 10,000+ users
- Reduced deployment time by 60% through implementation of Azure DevOps CI/CD pipelines
- Led migration from monolithic architecture to containerized microservices
- Mentored team of 4 junior developers on TypeScript and React best practices

**Key Technologies**: TypeScript, React, Node.js, PostgreSQL, Azure, Docker

### Full-Stack Developer | StartupXYZ
*January 2019 - February 2021 | Remote*

- Built MVP and core features for B2B analytics platform from ground up
- Developed REST API handling 1M+ requests per day with 99.9% uptime
- Created real-time data visualization dashboard using React and WebSockets
- Optimized database queries reducing average response time by 40%

**Key Technologies**: JavaScript, React, Node.js, MongoDB, AWS

---

## Education

**Bachelor of Science in Computer Science**  
University of Technology | 2018

---

## Certifications

- Microsoft Certified: Azure Developer Associate (AZ-204)
- AWS Certified Developer - Associate

---

## Projects

**E-commerce Platform** | github.com/yourname/ecommerce  
Full-featured online store with Stripe payment integration, built with React, Node.js, and PostgreSQL

**Smart Apply** | github.com/yourname/smart-apply  
AI-powered job application assistant using NestJS and Azure OpenAI
    `.trim();
  }

  /**
   * Health check for the mock provider
   * Always returns true as it doesn't depend on external services
   */
  async healthCheck(): Promise<boolean> {
    this.logger.debug('Mock LLM provider health check: OK');
    return true;
  }
}
