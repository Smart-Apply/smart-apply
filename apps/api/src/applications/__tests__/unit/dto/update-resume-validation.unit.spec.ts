import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateResumeDto } from '../../../dto/update-resume.dto';

describe('UpdateResumeDto - Experience Description Validation', () => {
  it('should accept resume with experience description', async () => {
    const payload = {
      resume: {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        phone: '+49 123 456789',
        location: 'Berlin, Germany',
        summary: 'Experienced developer',
        skillCategories: [
          {
            type: 'Programming Languages',
            skills: ['TypeScript', 'JavaScript'],
          },
        ],
        experiences: [
          {
            title: 'Senior Developer',
            company: 'Tech Corp',
            location: 'Berlin',
            dateRange: 'Jan 2020 - Present',
            description: 'Led development of cloud-native applications using React and Node.js.',
            achievements: ['Built scalable microservices', 'Improved performance by 40%'],
          },
        ],
        education: [],
        certifications: [],
        languages: [],
        language: 'en', // This should also be accepted now
      },
    };

    const dto = plainToInstance(UpdateResumeDto, payload);
    const errors = await validate(dto as object);

    expect(errors.length).toBe(0);
  });

  it('should accept resume without experience description (optional)', async () => {
    const payload = {
      resume: {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        skillCategories: [
          {
            type: 'Skills',
            skills: ['TypeScript'],
          },
        ],
        experiences: [
          {
            title: 'Developer',
            company: 'Company',
            dateRange: 'Jan 2020 - Present',
            // No description - should be fine since it's optional
            achievements: ['Built features'],
          },
        ],
      },
    };

    const dto = plainToInstance(UpdateResumeDto, payload);
    const errors = await validate(dto as object);

    expect(errors.length).toBe(0);
  });

  it('should accept resume with language field', async () => {
    const payload = {
      resume: {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        skillCategories: [],
        experiences: [],
        language: 'de', // German language code
      },
    };

    const dto = plainToInstance(UpdateResumeDto, payload);
    const errors = await validate(dto as object);

    expect(errors.length).toBe(0);
  });

  it('should reject invalid experience description (non-string)', async () => {
    const payload = {
      resume: {
        candidateName: 'Max Mustermann',
        email: 'max@example.com',
        skillCategories: [],
        experiences: [
          {
            title: 'Developer',
            company: 'Company',
            dateRange: 'Jan 2020 - Present',
            description: 12345, // Invalid: should be string
          },
        ],
      },
    };

    const dto = plainToInstance(UpdateResumeDto, payload);
    const errors = await validate(dto as object);

    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('description');
  });
});
