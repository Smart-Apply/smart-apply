import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
        skills: true,
        certificates: true,
        experiences: {
          orderBy: { startDate: 'desc' },
        },
        projects: true,
        education: {
          orderBy: { startYear: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return this.mapToResponseDto(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    try {
      // Start transaction to update profile and nested relations
      const updatedProfile = await this.prisma.$transaction(async (tx) => {
        // Update user fullName if provided
        if (dto.fullName !== undefined) {
          await tx.user.update({
            where: { id: userId },
            data: { fullName: dto.fullName },
          });
        }

        // Update base profile fields
        const profile = await tx.profile.upsert({
          where: { userId },
          create: {
            userId,
            phone: dto.phone,
            location: dto.location,
            linkedinUrl: dto.linkedinUrl,
            githubUrl: dto.githubUrl,
            portfolioUrl: dto.portfolioUrl,
            summary: dto.summary,
          },
          update: {
            phone: dto.phone,
            location: dto.location,
            linkedinUrl: dto.linkedinUrl,
            githubUrl: dto.githubUrl,
            portfolioUrl: dto.portfolioUrl,
            summary: dto.summary,
          },
        });

        // Update skills (delete all and recreate)
        if (dto.skills !== undefined) {
          await tx.skill.deleteMany({ where: { profileId: profile.id } });
          if (dto.skills.length > 0) {
            await tx.skill.createMany({
              data: dto.skills.map((skill) => ({
                profileId: profile.id,
                name: skill.name,
                category: 'General', // Default category since DTO doesn't have category
                level: skill.level,
              })),
            });
          }
        }

        // Update certificates
        if (dto.certificates !== undefined) {
          await tx.certificate.deleteMany({ where: { profileId: profile.id } });
          if (dto.certificates.length > 0) {
            await tx.certificate.createMany({
              data: dto.certificates.map((cert) => ({
                profileId: profile.id,
                name: cert.name,
                issuer: cert.issuer,
                issueDate: cert.dateObtained ? new Date(cert.dateObtained) : null,
                credentialUrl: cert.url,
              })),
            });
          }
        }

        // Update experiences
        if (dto.experiences !== undefined) {
          await tx.experience.deleteMany({ where: { profileId: profile.id } });
          if (dto.experiences.length > 0) {
            await tx.experience.createMany({
              data: dto.experiences.map((exp) => ({
                profileId: profile.id,
                title: exp.title,
                company: exp.company,
                startDate: new Date(exp.startDate),
                endDate: exp.endDate ? new Date(exp.endDate) : null,
                description: exp.description,
              })),
            });
          }
        }

        // Update projects
        if (dto.projects !== undefined) {
          await tx.project.deleteMany({ where: { profileId: profile.id } });
          if (dto.projects.length > 0) {
            await tx.project.createMany({
              data: dto.projects.map((proj) => ({
                profileId: profile.id,
                name: proj.name,
                description: proj.description,
                technologies: proj.technologies || [],
                url: proj.url,
              })),
            });
          }
        }

        // Update education
        if (dto.education !== undefined) {
          await tx.education.deleteMany({ where: { profileId: profile.id } });
          if (dto.education.length > 0) {
            await tx.education.createMany({
              data: dto.education.map((edu) => ({
                profileId: profile.id,
                degree: edu.degree,
                institution: edu.institution,
                fieldOfStudy: edu.fieldOfStudy,
                startYear: edu.startYear ? new Date(edu.startYear) : null,
                endYear: edu.endYear ? new Date(edu.endYear) : null,
                gpa: edu.gpa,
                description: edu.description,
              })),
            });
          }
        }

        // Fetch updated profile with all relations
        return tx.profile.findUnique({
          where: { id: profile.id },
          include: {
            skills: true,
            certificates: true,
            experiences: {
              orderBy: { startDate: 'desc' },
            },
            projects: true,
            education: {
              orderBy: { startYear: 'desc' },
            },
          },
        });
      });

      if (!updatedProfile) {
        throw new InternalServerErrorException('Failed to update profile');
      }

      return this.mapToResponseDto(updatedProfile);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update profile: ' + error.message);
    }
  }

  private mapToResponseDto(profile: any): ProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user?.fullName,
      phone: profile.phone,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      summary: profile.summary,
      skills: profile.skills.map((s: any) => ({
        id: s.id,
        name: s.name,
        level: s.level,
      })),
      certificates: profile.certificates.map((c: any) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
        dateObtained: c.issueDate?.toISOString(),
        url: c.credentialUrl,
      })),
      experiences: profile.experiences.map((e: any) => ({
        id: e.id,
        title: e.title,
        company: e.company,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate?.toISOString(),
        description: e.description,
      })),
      projects: profile.projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        technologies: p.technologies,
        url: p.url,
      })),
      education:
        profile.education?.map((e: any) => ({
          id: e.id,
          degree: e.degree,
          institution: e.institution,
          fieldOfStudy: e.fieldOfStudy,
          startYear: e.startYear?.toISOString(),
          endYear: e.endYear?.toISOString(),
          gpa: e.gpa,
          description: e.description,
        })) || [],
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
