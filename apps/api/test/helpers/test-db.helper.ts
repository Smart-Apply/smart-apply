import { PrismaService } from '@/prisma/prisma.service';

/**
 * Test Database Helper
 * Provides utilities for managing test database state
 */
export class TestDbHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clear all tables in the database
   * Order matters due to foreign key constraints
   */
  async clearDatabase(): Promise<void> {
    await this.prisma.$transaction([
      // Clear in correct order (child → parent)
      this.prisma.application.deleteMany(),
      this.prisma.jobPosting.deleteMany(),
      this.prisma.template.deleteMany(),
      this.prisma.language.deleteMany(),
      this.prisma.project.deleteMany(),
      this.prisma.certificate.deleteMany(),
      this.prisma.education.deleteMany(),
      this.prisma.experience.deleteMany(),
      this.prisma.skill.deleteMany(),
      this.prisma.profile.deleteMany(),
      this.prisma.refreshToken.deleteMany(),
      this.prisma.session.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
  }

  /**
   * Seed test data for common scenarios
   */
  async seedTestData(): Promise<TestData> {
    const user = await this.prisma.user.create({
      data: {
        email: 'test@smartapply.com',
        password: 'hashedPassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const profile = await this.prisma.profile.create({
      data: {
        userId: user.id,
        summary: 'Experienced software developer',
        skills: {
          create: [
            { name: 'TypeScript', level: 'EXPERT' },
            { name: 'React', level: 'ADVANCED' },
            { name: 'Node.js', level: 'EXPERT' },
          ],
        },
        experiences: {
          create: [
            {
              company: 'Tech Corp',
              title: 'Senior Developer',
              startDate: new Date('2020-01-01'),
              endDate: new Date('2023-12-31'),
              description: 'Built amazing things',
              isCurrent: false,
            },
          ],
        },
        education: {
          create: [
            {
              institution: 'University of Tech',
              degree: 'Bachelor of Science',
              fieldOfStudy: 'Computer Science',
              startYear: new Date('2015-09-01'),
              endYear: new Date('2019-06-30'),
            },
          ],
        },
      },
    });

    const jobPosting = await this.prisma.jobPosting.create({
      data: {
        userId: user.id,
        title: 'Senior TypeScript Developer',
        company: 'Example Inc',
        location: 'Remote',
        fullText: 'We are looking for a skilled TypeScript developer. Requirements: TypeScript, React, Node.js',
      },
    });

    const template = await this.prisma.template.create({
      data: {
        name: 'Modern Professional',
        description: 'ATS-optimized modern template',
        type: 'RESUME',
        category: 'professional',
        htmlTemplate: '<html></html>',
        cssStyles: 'body {}',
        isDefault: true,
        language: 'en',
      },
    });

    return { user, profile, jobPosting, template };
  }

  /**
   * Cleanup after tests
   */
  async cleanup(): Promise<void> {
    await this.clearDatabase();
    await this.prisma.$disconnect();
  }
}

export interface TestData {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  profile: {
    id: string;
    userId: string;
  };
  jobPosting: {
    id: string;
    userId: string;
  };
  template: {
    id: string;
    name: string;
  };
}
