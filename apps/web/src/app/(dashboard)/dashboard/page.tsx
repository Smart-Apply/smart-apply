'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApplications } from '@/hooks/use-applications';
import { useJobPostings } from '@/hooks/use-job-postings';
import { useProfile } from '@/hooks/use-profile';
import {
  FileText,
  Briefcase,
  User,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Calendar,
  Building2,
  ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ApplicationTrackingStatus } from '@/types';

// Status-Konfiguration
const STATUS_CONFIG: Record<ApplicationTrackingStatus, { label: string; color: string; bgColor: string }> = {
  CREATED: { label: 'Erstellt', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  APPLIED: { label: 'Beworben', color: 'text-accent', bgColor: 'bg-primary-soft' },
  INTERVIEW: { label: 'Interview', color: 'text-warning-foreground', bgColor: 'bg-warning' },
  ACCEPTED: { label: 'Angenommen', color: 'text-success-foreground', bgColor: 'bg-success' },
  REJECTED: { label: 'Abgelehnt', color: 'text-destructive-foreground', bgColor: 'bg-destructive' },
};

// Profil-Vollständigkeit berechnen
function calculateProfileCompletion(profile: {
  summary?: string | null;
  skills?: unknown[];
  experiences?: unknown[];
  education?: unknown[];
  certificates?: unknown[];
  projects?: unknown[];
} | null | undefined): number {
  if (!profile) return 0;

  const fields = [
    !!profile.summary,
    (profile.skills?.length ?? 0) > 0,
    (profile.experiences?.length ?? 0) > 0,
    (profile.education?.length ?? 0) > 0,
  ];

  const bonusFields = [
    (profile.certificates?.length ?? 0) > 0,
    (profile.projects?.length ?? 0) > 0,
  ];

  const baseScore = fields.filter(Boolean).length / fields.length * 80;
  const bonusScore = bonusFields.filter(Boolean).length / bonusFields.length * 20;

  return Math.round(baseScore + bonusScore);
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: applications, isLoading: applicationsLoading } = useApplications({ includeJobPosting: true });
  const { data: jobPostings, isLoading: jobsLoading } = useJobPostings();

  // Berechne Status-Statistiken
  const statusCounts: Partial<Record<ApplicationTrackingStatus, number>> = applications?.reduce((acc, app) => {
    acc[app.applicationStatus] = (acc[app.applicationStatus] || 0) + 1;
    return acc;
  }, {} as Partial<Record<ApplicationTrackingStatus, number>>) || {};

  const totalApplications = applications?.length || 0;
  const acceptedCount = statusCounts.ACCEPTED || 0;
  const rejectedCount = statusCounts.REJECTED || 0;
  const activeCount = (statusCounts.APPLIED || 0) + (statusCounts.INTERVIEW || 0);
  const successRate = totalApplications > 0 && (acceptedCount + rejectedCount) > 0
    ? Math.round((acceptedCount / (acceptedCount + rejectedCount)) * 100)
    : null;

  const profileCompletion = calculateProfileCompletion(profile);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Willkommen zurück! Hier ist eine Übersicht deiner Bewerbungen.
          </p>
        </div>
        <Button onClick={() => router.push('/applications/new')} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Neue Bewerbung
        </Button>
      </div>

      {/* Haupt-Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-border bg-card" onClick={() => router.push('/applications')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Bewerbungen</CardTitle>
            <FileText className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalApplications}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCount} aktiv · {statusCounts.CREATED || 0} in Bearbeitung
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-border bg-card" onClick={() => router.push('/jobs')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Stellenanzeigen</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{jobsLoading ? '...' : jobPostings?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gespeicherte Jobs
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow border-border bg-card" onClick={() => router.push('/profile')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Profil</CardTitle>
            <User className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{profileLoading ? '...' : `${profileCompletion}%`}</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className="bg-success h-1.5 rounded-full transition-all"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Erfolgsquote</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {successRate !== null ? `${successRate}%` : '–'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {acceptedCount} angenommen · {rejectedCount} abgelehnt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status-Übersicht */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Bewerbungs-Pipeline</CardTitle>
          <CardDescription className="text-muted-foreground">Übersicht deiner Bewerbungen nach Status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(STATUS_CONFIG) as [ApplicationTrackingStatus, typeof STATUS_CONFIG[ApplicationTrackingStatus]][]).map(([status, config]) => (
              <button
                key={status}
                onClick={() => router.push(`/applications?status=${status}`)}
                className={`${config.bgColor} rounded-lg p-4 text-center hover:opacity-80 transition-opacity border border-transparent`}
              >
                <div className={`text-2xl font-bold ${config.color}`}>
                  {statusCounts[status] || 0}
                </div>
                <div className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Zwei-Spalten-Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Letzte Bewerbungen */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Letzte Bewerbungen</CardTitle>
              <CardDescription className="text-muted-foreground">Deine neuesten Bewerbungen</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/applications')} className="text-muted-foreground hover:text-foreground">
              Alle anzeigen
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {applicationsLoading ? (
              <div className="text-center text-muted-foreground py-8">Lädt...</div>
            ) : applications && applications.length > 0 ? (
              <div className="space-y-3">
                {applications.slice(0, 5).map((app) => {
                  const statusConfig = STATUS_CONFIG[app.applicationStatus];
                  return (
                    <button
                      key={app.id}
                      onClick={() => router.push(`/applications/${app.id}`)}
                      className="w-full flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-foreground">
                            {app.jobPosting?.title || 'Unbekannte Stelle'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {app.jobPosting?.company || 'Unbekanntes Unternehmen'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">Noch keine Bewerbungen erstellt.</p>
                <Button variant="outline" onClick={() => router.push('/applications/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Bewerbung erstellen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Tipps */}
        <div className="space-y-6">
          {/* Profil-Hinweis wenn nicht vollständig */}
          {!profileLoading && profileCompletion < 100 && (
            <Card className="border-accent/20 bg-primary-soft/50">
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profil vervollständigen
                </CardTitle>
                <CardDescription className="text-primary/80">
                  Ein vollständiges Profil verbessert deine generierten Bewerbungen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-primary/80">Fortschritt</span>
                  <span className="text-sm font-medium text-primary">{profileCompletion}%</span>
                </div>
                <div className="w-full bg-primary/10 rounded-full h-2 mb-4">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => router.push('/profile/edit')}
                >
                  Profil bearbeiten
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Schnellzugriff</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-muted/50 hover:text-foreground"
                onClick={() => router.push('/applications/new')}
              >
                <Plus className="h-5 w-5 text-accent" />
                <span className="text-xs">Neue Bewerbung</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-muted/50 hover:text-foreground"
                onClick={() => router.push('/jobs')}
              >
                <Briefcase className="h-5 w-5 text-primary" />
                <span className="text-xs">Jobs durchsuchen</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-muted/50 hover:text-foreground"
                onClick={() => router.push('/profile/edit')}
              >
                <User className="h-5 w-5 text-success" />
                <span className="text-xs">Profil bearbeiten</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-muted/50 hover:text-foreground"
                onClick={() => router.push('/applications?status=APPLIED')}
              >
                <Send className="h-5 w-5 text-warning" />
                <span className="text-xs">Offene Bewerbungen</span>
              </Button>
            </CardContent>
          </Card>

          {/* Aktivitäts-Hinweis */}
          {applications && applications.length > 0 && (
            <Card className="bg-muted/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Letzte Aktivität: {new Date(applications[0].updatedAt || applications[0].createdAt).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
