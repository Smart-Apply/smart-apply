import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { AuditLoggerService } from '../common/audit-logger';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
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

  async updateProfile(userId: string, dto: UpdateProfileDto, req?: Request): Promise<ProfileResponseDto> {
    try {
      // Start transaction to update profile and nested relations
      const updatedProfile = await this.prisma.$transaction(async (tx) => {
        // Update user firstName/lastName if provided
        if (dto.firstName !== undefined || dto.lastName !== undefined) {
          await tx.user.update({
            where: { id: userId },
            data: {
              ...(dto.firstName !== undefined && { firstName: dto.firstName }),
              ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            },
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

        // Update skills (differential: upsert with IDs, delete orphaned)
        if (dto.skills !== undefined) {
          const providedIds = dto.skills.filter((s) => s.id).map((s) => s.id!);

          // Delete skills that were not included in the update
          if (dto.skills.length === 0) {
            // Delete all if empty array provided
            await tx.skill.deleteMany({ where: { profileId: profile.id } });
          } else if (providedIds.length > 0) {
            // Delete only orphaned skills (those not in the provided list)
            await tx.skill.deleteMany({
              where: {
                profileId: profile.id,
                id: { notIn: providedIds },
              },
            });
          }

          // Upsert each skill (update if ID exists, create if not)
          for (const skill of dto.skills) {
            if (skill.id) {
              // Update existing
              await tx.skill.update({
                where: { id: skill.id },
                data: {
                  name: skill.name,
                  level: skill.level,
                },
              });
            } else {
              // Create new
              await tx.skill.create({
                data: {
                  profileId: profile.id,
                  name: skill.name,
                  category: 'General',
                  level: skill.level,
                },
              });
            }
          }
        }

        // Update certificates (differential: upsert with IDs, delete orphaned)
        if (dto.certificates !== undefined) {
          const providedIds = dto.certificates.filter((c) => c.id).map((c) => c.id!);

          if (dto.certificates.length === 0) {
            await tx.certificate.deleteMany({ where: { profileId: profile.id } });
          } else if (providedIds.length > 0) {
            await tx.certificate.deleteMany({
              where: {
                profileId: profile.id,
                id: { notIn: providedIds },
              },
            });
          }

          for (const cert of dto.certificates) {
            if (cert.id) {
              await tx.certificate.update({
                where: { id: cert.id },
                data: {
                  name: cert.name,
                  issuer: cert.issuer,
                  issueDate: cert.dateObtained ? new Date(cert.dateObtained) : null,
                  credentialUrl: cert.url,
                },
              });
            } else {
              await tx.certificate.create({
                data: {
                  profileId: profile.id,
                  name: cert.name,
                  issuer: cert.issuer,
                  issueDate: cert.dateObtained ? new Date(cert.dateObtained) : null,
                  credentialUrl: cert.url,
                },
              });
            }
          }
        }

        // Update experiences (differential: upsert with IDs, delete orphaned)
        if (dto.experiences !== undefined) {
          const providedIds = dto.experiences.filter((e) => e.id).map((e) => e.id!);

          // Delete experiences that were not included in the update
          if (dto.experiences.length === 0) {
            await tx.experience.deleteMany({ where: { profileId: profile.id } });
          } else if (providedIds.length > 0) {
            await tx.experience.deleteMany({
              where: {
                profileId: profile.id,
                id: { notIn: providedIds },
              },
            });
          }

          // Upsert each experience
          for (const exp of dto.experiences) {
            if (exp.id) {
              // Update existing
              await tx.experience.update({
                where: { id: exp.id },
                data: {
                  title: exp.title,
                  company: exp.company,
                  location: exp.location,
                  startDate: new Date(exp.startDate),
                  endDate: exp.endDate ? new Date(exp.endDate) : null,
                  description: exp.description,
                  isCurrent: exp.current || false,
                },
              });
            } else {
              // Create new
              await tx.experience.create({
                data: {
                  profileId: profile.id,
                  title: exp.title,
                  company: exp.company,
                  location: exp.location,
                  startDate: new Date(exp.startDate),
                  endDate: exp.endDate ? new Date(exp.endDate) : null,
                  description: exp.description,
                  isCurrent: exp.current || false,
                },
              });
            }
          }
        }

        // Update projects (differential: upsert with IDs, delete orphaned)
        if (dto.projects !== undefined) {
          const providedIds = dto.projects.filter((p) => p.id).map((p) => p.id!);

          if (dto.projects.length === 0) {
            await tx.project.deleteMany({ where: { profileId: profile.id } });
          } else if (providedIds.length > 0) {
            await tx.project.deleteMany({
              where: {
                profileId: profile.id,
                id: { notIn: providedIds },
              },
            });
          }

          for (const proj of dto.projects) {
            if (proj.id) {
              await tx.project.update({
                where: { id: proj.id },
                data: {
                  name: proj.name,
                  description: proj.description,
                  technologies: proj.technologies || [],
                  url: proj.url,
                },
              });
            } else {
              await tx.project.create({
                data: {
                  profileId: profile.id,
                  name: proj.name,
                  description: proj.description,
                  technologies: proj.technologies || [],
                  url: proj.url,
                },
              });
            }
          }
        }

        // Update education (differential: upsert with IDs, delete orphaned)
        if (dto.education !== undefined) {
          const providedIds = dto.education.filter((e) => e.id).map((e) => e.id!);

          if (dto.education.length === 0) {
            await tx.education.deleteMany({ where: { profileId: profile.id } });
          } else if (providedIds.length > 0) {
            await tx.education.deleteMany({
              where: {
                profileId: profile.id,
                id: { notIn: providedIds },
              },
            });
          }

          for (const edu of dto.education) {
            if (edu.id) {
              await tx.education.update({
                where: { id: edu.id },
                data: {
                  degree: edu.degree,
                  institution: edu.institution,
                  fieldOfStudy: edu.fieldOfStudy,
                  startYear: edu.startYear ? new Date(edu.startYear) : null,
                  endYear: edu.endYear ? new Date(edu.endYear) : null,
                  gpa: edu.gpa,
                  description: edu.description,
                },
              });
            } else {
              await tx.education.create({
                data: {
                  profileId: profile.id,
                  degree: edu.degree,
                  institution: edu.institution,
                  fieldOfStudy: edu.fieldOfStudy,
                  startYear: edu.startYear ? new Date(edu.startYear) : null,
                  endYear: edu.endYear ? new Date(edu.endYear) : null,
                  gpa: edu.gpa,
                  description: edu.description,
                },
              });
            }
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

      // Log profile update event
      if (req) {
        const updatedFields = Object.keys(dto).filter(key => dto[key as keyof UpdateProfileDto] !== undefined);
        this.auditLogger.logProfileUpdate(userId, req, {
          updatedFields,
          hasSkills: dto.skills !== undefined,
          hasExperiences: dto.experiences !== undefined,
          hasCertificates: dto.certificates !== undefined,
          hasEducation: dto.education !== undefined,
          hasProjects: dto.projects !== undefined,
        });
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
      firstName: profile.user?.firstName,
      lastName: profile.user?.lastName,
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
