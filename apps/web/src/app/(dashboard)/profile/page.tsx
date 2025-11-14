'use client';

import { useProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProfileSkeleton } from '@/components/shared/skeletons';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  Code,
  Calendar,
  Edit,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const user = useAuthStore((state) => state.user);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profil</h1>
            <p className="mt-1 text-gray-500">Dein persönliches Profil</p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Fehler beim Laden</CardTitle>
            <CardDescription className="text-red-700">
              Dein Profil konnte nicht geladen werden. Bitte versuche es später erneut.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasBasicInfo = profile?.phone || profile?.location || profile?.linkedinUrl || profile?.portfolioUrl;
  const hasSkills = profile?.skills && profile.skills.length > 0;
  const hasExperiences = profile?.experiences && profile.experiences.length > 0;
  const hasEducation = profile?.education && profile.education.length > 0;
  const hasCertificates = profile?.certificates && profile.certificates.length > 0;
  const hasProjects = profile?.projects && profile.projects.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profil</h1>
          <p className="mt-1 text-gray-500">Dein persönliches Profil</p>
        </div>
        <Button asChild>
          <Link href="/profile/edit">
            <Edit className="mr-2 h-4 w-4" />
            Profil bearbeiten
          </Link>
        </Button>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Grundinformationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-base">{user?.name || 'Nicht angegeben'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">E-Mail</p>
                <p className="text-base">{user?.email || 'Nicht angegeben'}</p>
              </div>
            </div>
            {profile?.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Telefon</p>
                  <p className="text-base">{profile.phone}</p>
                </div>
              </div>
            )}
            {profile?.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Standort</p>
                  <p className="text-base">{profile.location}</p>
                </div>
              </div>
            )}
            {profile?.linkedinUrl && (
              <div className="flex items-start gap-3">
                <Linkedin className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">LinkedIn</p>
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 hover:underline"
                  >
                    Profil ansehen
                  </a>
                </div>
              </div>
            )}
            {profile?.portfolioUrl && (
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Website</p>
                  <a
                    href={profile.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 hover:underline"
                  >
                    {profile.portfolioUrl}
                  </a>
                </div>
              </div>
            )}
          </div>

          {!hasBasicInfo && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Füge Kontaktinformationen hinzu, um dein Profil zu vervollständigen.
              </p>
            </div>
          )}

          {profile?.summary && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium text-gray-500">Zusammenfassung</p>
                <p className="text-base text-gray-700 whitespace-pre-wrap">{profile.summary}</p>
              </div>
            </>
          )}
          {!profile?.summary && (
            <>
              <Separator />
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  Füge eine Zusammenfassung hinzu, um potenzielle Arbeitgeber von dir zu überzeugen.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Fähigkeiten
          </CardTitle>
          <CardDescription>Deine technischen und fachlichen Kompetenzen</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSkills ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills?.map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {skill.name}
                  {skill.level && (
                    <span className="ml-1 text-xs opacity-70">({skill.level})</span>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Noch keine Fähigkeiten hinzugefügt. Füge deine Skills hinzu, um bessere Bewerbungen zu erstellen.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Plus className="mr-2 h-3 w-3" />
                  Skills hinzufügen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Berufserfahrung
          </CardTitle>
          <CardDescription>Dein beruflicher Werdegang</CardDescription>
        </CardHeader>
        <CardContent>
          {hasExperiences ? (
            <div className="space-y-6">
              {profile.experiences?.map((exp, index) => (
                <div key={index} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-blue-600 bg-white" />
                  {/* Timeline line */}
                  {index < (profile.experiences?.length ?? 0) - 1 && (
                    <div className="absolute left-1.5 top-5 h-full w-0.5 bg-gray-200" />
                  )}
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{exp.title}</h3>
                    <p className="text-base text-gray-700">{exp.company}</p>
                    {exp.location && (
                      <p className="text-sm text-gray-500">{exp.location}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(exp.startDate).toLocaleDateString('de-DE', {
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        -{' '}
                        {exp.endDate
                          ? new Date(exp.endDate).toLocaleDateString('de-DE', {
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Heute'}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {exp.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Noch keine Berufserfahrung hinzugefügt. Füge deine Arbeitsstellen hinzu.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Plus className="mr-2 h-3 w-3" />
                  Erfahrung hinzufügen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Bildung
          </CardTitle>
          <CardDescription>Deine akademische Ausbildung</CardDescription>
        </CardHeader>
        <CardContent>
          {hasEducation ? (
            <div className="space-y-6">
              {profile.education?.map((edu, index) => (
                <div key={index} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-green-600 bg-white" />
                  {/* Timeline line */}
                  {index < (profile.education?.length ?? 0) - 1 && (
                    <div className="absolute left-1.5 top-5 h-full w-0.5 bg-gray-200" />
                  )}
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{edu.degree}</h3>
                    <p className="text-base text-gray-700">{edu.institution}</p>
                    {edu.fieldOfStudy && (
                      <p className="text-sm text-gray-600">{edu.fieldOfStudy}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {edu.startYear} - {edu.endYear || 'Heute'}
                      </span>
                    </div>
                    {edu.gpa && (
                      <p className="mt-1 text-sm text-gray-600">GPA: {edu.gpa}</p>
                    )}
                    {edu.description && (
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {edu.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Noch keine Bildung hinzugefügt. Füge deine akademische Ausbildung hinzu.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Plus className="mr-2 h-3 w-3" />
                  Bildung hinzufügen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Zertifikate
          </CardTitle>
          <CardDescription>Deine professionellen Zertifizierungen</CardDescription>
        </CardHeader>
        <CardContent>
          {hasCertificates ? (
            <div className="space-y-4">
              {profile.certificates?.map((cert, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-900">{cert.name}</h3>
                  <p className="text-sm text-gray-700">{cert.issuer}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {cert.dateObtained && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Ausgestellt:{' '}
                          {new Date(cert.dateObtained).toLocaleDateString('de-DE', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {cert.expiryDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Gültig bis:{' '}
                          {new Date(cert.expiryDate).toLocaleDateString('de-DE', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  {cert.credentialId && (
                    <p className="mt-2 text-xs text-gray-500">ID: {cert.credentialId}</p>
                  )}
                  {cert.url && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                    >
                      Zertifikat ansehen
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Noch keine Zertifikate hinzugefügt. Füge deine professionellen Zertifizierungen hinzu.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Plus className="mr-2 h-3 w-3" />
                  Zertifikat hinzufügen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Projekte
          </CardTitle>
          <CardDescription>Deine relevanten Projekte und Arbeiten</CardDescription>
        </CardHeader>
        <CardContent>
          {hasProjects ? (
            <div className="space-y-4">
              {profile.projects?.map((project, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-900">{project.name}</h3>
                  {project.description && (
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {project.description}
                    </p>
                  )}
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.technologies.map((tech, techIndex) => (
                        <Badge key={techIndex} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {(project.startDate || project.endDate) && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {project.startDate &&
                            new Date(project.startDate).toLocaleDateString('de-DE', {
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                          {project.startDate && project.endDate && '-'}{' '}
                          {project.endDate
                            ? new Date(project.endDate).toLocaleDateString('de-DE', {
                                month: 'short',
                                year: 'numeric',
                              })
                            : project.startDate && 'Heute'}
                        </span>
                      </div>
                    )}
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Projekt ansehen
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Noch keine Projekte hinzugefügt. Zeige deine relevanten Arbeiten und Projekte.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Plus className="mr-2 h-3 w-3" />
                  Projekt hinzufügen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
