'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useProfile } from '@/hooks/use-profile';
import { api } from '@/lib/api-client';
import { Application, ApplicationTrackingStatus } from '@/types';
import { calculateProfileStrength } from '@/lib/profile-utils';
import { UsageSummary } from '@/components/subscription';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Briefcase,
  ArrowRight,
  TrendingUp,
  Calendar,
  ChevronRight,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateSmart } from '@/lib/format-date';

const STATUS_CONFIG: Record<
  ApplicationTrackingStatus,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  CREATED: {
    label: 'Erstellt',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    icon: FileText,
  },
  APPLIED: {
    label: 'Beworben',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Clock,
  },
  INTERVIEW: {
    label: 'Interview',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: Calendar,
  },
  ACCEPTED: {
    label: 'Angenommen',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Abgesagt',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    interviews: 0,
    offers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Calculate profile strength using centralized utility
  const profileStrength = calculateProfileStrength(profile, user);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const response = await api.applications.list({ includeJobPosting: true });
        const apps = response.items; // Extract items from paginated response
        setApplications(apps);

        // Calculate stats
        const newStats = {
          total: apps.length,
          active: apps.filter(
            (a: Application) =>
              !['REJECTED', 'ACCEPTED'].includes(a.applicationStatus)
          ).length,
          interviews: apps.filter((a: Application) => a.applicationStatus === 'INTERVIEW')
            .length,
          offers: apps.filter((a: Application) => a.applicationStatus === 'ACCEPTED').length,
        };
        setStats(newStats);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary-soft p-8 shadow-medium">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {getGreeting()}, {user?.firstName || 'Nutzer'}!
          </h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl">
            Hier ist ein Überblick über deine aktuellen Bewerbungen. Du hast{' '}
            <span className="font-semibold text-primary">{stats.active}</span>{' '}
            aktive Bewerbungen am Laufen.
          </p>
          <div className="mt-6 flex gap-4">
            <Button
              className="rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:-translate-y-0.5"
              onClick={() => router.push('/applications/new')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Neue Bewerbung
            </Button>
            <Button
              variant="outline"
              className="rounded-xl bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-background/80"
              onClick={() => router.push('/jobs')}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Jobs finden
            </Button>
          </div>
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute right-20 bottom-0 -mb-10 h-40 w-40 rounded-full bg-blue-500/5 blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Gesamt"
          value={stats.total}
          icon={FileText}
          iconColor="#1B2A49"
          bgColor="#F5F6F8"
        />
        <StatsCard
          title="Aktiv"
          value={stats.active}
          icon={Clock}
          iconColor="#1B2A49"
          bgColor="#F5F6F8"
        />
        <StatsCard
          title="Interviews"
          value={stats.interviews}
          icon={Calendar}
          iconColor="#1B2A49"
          bgColor="#F5F6F8"
        />
        <StatsCard
          title="Angebote"
          value={stats.offers}
          icon={CheckCircle}
          iconColor="#1B2A49"
          bgColor="#F5F6F8"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Applications */}
          <Card className="border-border/50 shadow-soft overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/50 bg-muted/20">
              <div>
                <CardTitle className="text-xl font-bold">Aktuelle Bewerbungen</CardTitle>
                <CardDescription>Deine zuletzt bearbeiteten Bewerbungen</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/80 hover:bg-primary/5"
                onClick={() => router.push('/applications')}
              >
                Alle anzeigen <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Keine Bewerbungen"
                  description="Du hast noch keine Bewerbungen angelegt. Erstelle deine erste Bewerbung in nur 2 Schritten!"
                  action={{
                    label: 'Erste Bewerbung erstellen',
                    onClick: () => router.push('/applications/new'),
                  }}
                />
              ) : (
                <div className="divide-y divide-border/50">
                  {applications.slice(0, 5).map((app) => {
                    const status = STATUS_CONFIG[app.applicationStatus] || STATUS_CONFIG.CREATED;
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={app.id}
                        className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border/50 shadow-sm group-hover:border-primary/20 group-hover:shadow-md transition-all">
                            <Briefcase className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {app.title || 'Unbenannte Bewerbung'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {app.jobPosting?.company || app.jobPosting?.location || 'Keine Details'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {status.label}
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">Aktualisiert</p>
                            <p className="text-xs font-medium">
                              {formatDateSmart(app.updatedAt)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => router.push(`/applications/${app.id}`)}
                          >
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-8">
          {/* Profile Completion */}
          <Card className="border-border/50 shadow-soft bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="text-lg">Profilstatus</CardTitle>
              <CardDescription>Vervollständige dein Profil</CardDescription>
            </CardHeader>
            <CardContent>
              {isProfileLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-primary">{profileStrength.score}%</span>
                    <span className="text-sm text-muted-foreground mb-1">
                      {profileStrength.score === 100 ? 'Perfekt!' : 'Fast geschafft!'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${profileStrength.score}%` }}
                    />
                  </div>
                  <div className="space-y-2 pt-2">
                    {profileStrength.suggestions.slice(0, 3).map((suggestion, index) => (
                      <div 
                        key={index}
                        className={`flex items-center gap-2 text-sm ${
                          suggestion.completed ? 'text-muted-foreground' : 'text-foreground font-medium'
                        }`}
                      >
                        {suggestion.completed ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-primary/30" />
                        )}
                        <span>{suggestion.text}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => router.push('/profile')}
                  >
                    Profil bearbeiten
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Summary */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Kontingent
              </CardTitle>
              <CardDescription>Dein monatliches Kontingent</CardDescription>
            </CardHeader>
            <CardContent>
              <UsageSummary showPeriod />
            </CardContent>
          </Card>

          {/* Activity Notice */}
          <Card className="border-border/50 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Markttrends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Tipp:</span> Frontend-Entwickler werden aktuell stark gesucht. Aktualisiere deine Skills!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor,
  bgColor,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card className="border-border/50 shadow-soft hover:shadow-medium transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
            </div>
          </div>
          <div 
            className="rounded-xl p-3 group-hover:scale-110 transition-transform"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="h-6 w-6" style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
