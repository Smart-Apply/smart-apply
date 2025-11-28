'use client';

import { useProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ProfileSkeleton } from '@/components/shared/skeletons';
import { sanitizeUrl } from '@/lib/sanitize';
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
  Languages,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
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

  // Calculate Profile Strength
  const calculateStrength = () => {
    let score = 0;
    if (user?.firstName && user?.lastName) score += 10;
    if (user?.email) score += 10;
    if (profile?.phone) score += 10;
    if (profile?.location) score += 10;
    if (profile?.summary) score += 15;
    if (profile?.skills?.length && profile.skills.length > 0) score += 15;
    if (profile?.experiences?.length && profile.experiences.length > 0) score += 15;
    if (profile?.education?.length && profile.education.length > 0) score += 15;
    return Math.min(score, 100);
  };

  const profileStrength = calculateStrength();
  const hasSkills = profile?.skills && profile.skills.length > 0;
  const hasLanguages = profile?.languages && profile.languages.length > 0;
  const hasExperiences = profile?.experiences && profile.experiences.length > 0;
  const hasEducation = profile?.education && profile.education.length > 0;
  const hasCertificates = profile?.certificates && profile.certificates.length > 0;
  const hasProjects = profile?.projects && profile.projects.length > 0;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary-soft p-8 shadow-medium">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-white p-1 shadow-lg">
              <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {(user?.firstName || user?.email)?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="text-lg text-muted-foreground">
                Bewerber
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile?.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push('/profile/edit')}
            className="shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <Edit className="mr-2 h-4 w-4" />
            Profil bearbeiten
          </Button>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute right-20 bottom-0 -mb-10 h-40 w-40 rounded-full bg-blue-500/5 blur-2xl"></div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Sidebar */}
        <div className="space-y-8">
          {/* Profile Strength */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Profilstärke</CardTitle>
              <CardDescription>Vervollständige dein Profil für bessere Chancen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-primary">{profileStrength}%</span>
                  <span className="text-sm text-muted-foreground mb-1">
                    {profileStrength === 100 ? 'Perfekt!' : 'Fast geschafft!'}
                  </span>
                </div>
                <Progress value={profileStrength} className="h-2" />
                {profileStrength < 100 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Füge weitere Details hinzu, um Arbeitgeber zu überzeugen.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Kontakt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{user?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.location}</span>
                  </div>
                )}
              </div>

              {(profile?.linkedinUrl || profile?.portfolioUrl) && (
                <>
                  <Separator />
                  <div className="space-y-3 pt-1">
                    {profile?.linkedinUrl && sanitizeUrl(profile.linkedinUrl) && (
                      <a
                        href={sanitizeUrl(profile.linkedinUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <Linkedin className="h-4 w-4 text-[#0077b5]" />
                        <span>LinkedIn Profil</span>
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                      </a>
                    )}
                    {profile?.portfolioUrl && sanitizeUrl(profile.portfolioUrl) && (
                      <a
                        href={sanitizeUrl(profile.portfolioUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>Website / Portfolio</span>
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                      </a>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Fähigkeiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasSkills ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills?.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Keine Fähigkeiten angegeben</p>
                  <Button variant="outline" size="sm" onClick={() => router.push('/profile/edit')}>
                    <Plus className="mr-2 h-3 w-3" /> Hinzufügen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Languages */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                Sprachen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasLanguages ? (
                <div className="space-y-3">
                  {profile.languages?.map((lang, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{lang.name}</span>
                      <span className="text-muted-foreground text-xs">{lang.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Keine Sprachen angegeben</p>
                  <Button variant="outline" size="sm" onClick={() => router.push('/profile/edit')}>
                    <Plus className="mr-2 h-3 w-3" /> Hinzufügen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Summary */}
          {profile?.summary && (
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="text-xl">Über mich</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {profile.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Experience */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Berufserfahrung
              </CardTitle>
              {!hasExperiences && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/profile/edit')}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {hasExperiences ? (
                <div className="space-y-8">
                  {profile.experiences?.map((exp, index) => (
                    <div key={index} className="relative pl-6 border-l-2 border-border/50 last:border-0 pb-1">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-primary bg-background" />

                      <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <h3 className="text-lg font-semibold text-foreground">{exp.title}</h3>
                        <span className="text-sm text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                          {new Date(exp.startDate).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })} - {' '}
                          {exp.endDate ? new Date(exp.endDate).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) : 'Heute'}
                        </span>
                      </div>

                      <div className="mb-3 text-base font-medium text-primary">
                        {exp.company}
                        {exp.location && <span className="text-muted-foreground font-normal"> • {exp.location}</span>}
                      </div>

                      {exp.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                  <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">Füge deine Berufserfahrung hinzu, um dein Profil zu stärken.</p>
                  <Button onClick={() => router.push('/profile/edit')}>Erfahrung hinzufügen</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Ausbildung
              </CardTitle>
              {!hasEducation && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/profile/edit')}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {hasEducation ? (
                <div className="space-y-8">
                  {profile.education?.map((edu, index) => (
                    <div key={index} className="relative pl-6 border-l-2 border-border/50 last:border-0 pb-1">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-primary bg-background" />

                      <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <h3 className="text-lg font-semibold text-foreground">{edu.degree}</h3>
                        <span className="text-sm text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                          {edu.startYear} - {edu.endYear || 'Heute'}
                        </span>
                      </div>

                      <div className="mb-2 text-base text-muted-foreground">
                        <span className="font-medium text-foreground">{edu.institution}</span>
                        {edu.fieldOfStudy && <span> • {edu.fieldOfStudy}</span>}
                      </div>

                      {edu.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {edu.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                  <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">Füge deine Ausbildung hinzu.</p>
                  <Button variant="outline" onClick={() => router.push('/profile/edit')}>Ausbildung hinzufügen</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projects & Certificates Grid */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Projects */}
            <Card className="border-border/50 shadow-soft h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Projekte
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasProjects ? (
                  <div className="space-y-4">
                    {profile.projects?.map((project, index) => (
                      <div key={index} className="rounded-lg border border-border/50 bg-card p-4 hover:shadow-sm transition-shadow">
                        <h4 className="font-semibold text-foreground">{project.name}</h4>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        {project.url && (
                          <a
                            href={sanitizeUrl(project.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            Ansehen <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">Keine Projekte</p>
                    <Button variant="outline" size="sm" onClick={() => router.push('/profile/edit')}>
                      <Plus className="mr-2 h-3 w-3" /> Hinzufügen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Certificates */}
            <Card className="border-border/50 shadow-soft h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Zertifikate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasCertificates ? (
                  <div className="space-y-4">
                    {profile.certificates?.map((cert, index) => (
                      <div key={index} className="rounded-lg border border-border/50 bg-card p-4 hover:shadow-sm transition-shadow">
                        <h4 className="font-semibold text-foreground">{cert.name}</h4>
                        <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                        {cert.dateObtained && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(cert.dateObtained).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">Keine Zertifikate</p>
                    <Button variant="outline" size="sm" onClick={() => router.push('/profile/edit')}>
                      <Plus className="mr-2 h-3 w-3" /> Hinzufügen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
