'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Crown,
  Lock,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFeatureGate } from '@/hooks/use-tier-gate';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/errors';
import type { AnalyticsOverview } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Premium analytics dashboard.
 *
 * Single-fetch page — `useQuery` hits `/analytics/overview` once and the
 * whole UI renders from that payload. Feature-gated client-side via
 * `useFeatureGate('advancedAnalytics')`; the API also enforces the gate
 * via `FeatureGuard`, so a free-tier user who URL-types here sees the
 * upgrade prompt instead of any data.
 */
export default function AnalyticsPage() {
  const { hasAccess, isLoading: gateLoading } = useFeatureGate('advancedAnalytics');

  const {
    data,
    isLoading,
    error,
  } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.analytics.getOverview(),
    enabled: hasAccess,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      // Don't retry 403s — the FeatureGuard rejected the request.
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
  });

  if (gateLoading) {
    return <AnalyticsSkeleton />;
  }

  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="container max-w-7xl py-6">
        <Card>
          <CardHeader>
            <CardTitle>Analytics konnte nicht geladen werden</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Unbekannter Fehler'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isEmpty = data.totals.applications === 0;

  return (
    <div className="container max-w-7xl py-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Wie läuft deine Bewerbungssuche? Trends, Konversionsraten und Template-Performance auf einen Blick.
        </p>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <ScorecardGrid data={data} />
          <FunnelCard funnel={data.funnel} />
          <div className="grid gap-6 lg:grid-cols-2">
            <TimeseriesCard timeseries={data.timeseries30d} />
            <ScoreBucketsCard buckets={data.scoreBuckets} />
          </div>
          <TopTemplatesCard templates={data.topTemplates} />
        </>
      )}
    </div>
  );
}

// ─── Scorecard grid ──────────────────────────────────────────────────

function ScorecardGrid({ data }: { data: AnalyticsOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Scorecard
        icon={Send}
        label="Beworben"
        value={data.totals.applied}
        sublabel={`${data.totals.applications} insgesamt erstellt`}
        accent="blue"
      />
      <Scorecard
        icon={Sparkles}
        label="Interview-Quote"
        value={`${data.interviewRate}%`}
        sublabel={`${data.totals.interviews} Interviews aus ${data.totals.applied} Bewerbungen`}
        accent="purple"
      />
      <Scorecard
        icon={Trophy}
        label="Angenommen"
        value={data.totals.accepted}
        sublabel={`${data.offerRate}% Erfolgsquote`}
        accent="green"
      />
      <Scorecard
        icon={Target}
        label="Ø ATS-Score"
        value={data.averageAtsScore !== null ? `${data.averageAtsScore}/100` : '—'}
        sublabel="Über alle bewerteten Bewerbungen"
        accent="amber"
      />
    </div>
  );
}

const ACCENT_STYLES: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-600 dark:text-purple-400' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
};

function Scorecard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel: string;
  accent: keyof typeof ACCENT_STYLES;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg p-2', styles.bg)}>
            <Icon className={cn('h-5 w-5', styles.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{sublabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Funnel card ─────────────────────────────────────────────────────

function FunnelCard({ funnel }: { funnel: AnalyticsOverview['funnel'] }) {
  const max = Math.max(...funnel.map((s) => s.count), 1);
  const stageLabels: Record<AnalyticsOverview['funnel'][number]['stage'], string> = {
    CREATED: 'Erstellt',
    APPLIED: 'Beworben',
    INTERVIEW: 'Interview',
    ACCEPTED: 'Angenommen',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Konversions-Funnel
        </CardTitle>
        <CardDescription>
          Wie viele deiner erstellten Bewerbungen schaffen es bis zum Job-Angebot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {funnel.map((stage) => {
          const widthPct = max > 0 ? Math.max((stage.count / max) * 100, 4) : 0;
          return (
            <div key={stage.stage} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{stageLabels[stage.stage]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {stage.count}
                  {stage.conversionFromPrevious !== null && (
                    <span className="ml-2 text-xs">({stage.conversionFromPrevious}%)</span>
                  )}
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Timeseries card ─────────────────────────────────────────────────

function TimeseriesCard({ timeseries }: { timeseries: AnalyticsOverview['timeseries30d'] }) {
  const max = Math.max(...timeseries.map((d) => d.created), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivität (letzte 30 Tage)</CardTitle>
        <CardDescription>Erstellte Bewerbungen pro Tag.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-px h-32">
          {timeseries.map((day) => {
            const total = day.created;
            const heightPct = max > 0 ? (total / max) * 100 : 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col justify-end group relative"
                title={`${day.date}: ${total} erstellt`}
              >
                <div
                  className={cn(
                    'rounded-sm transition-all',
                    total > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-muted',
                  )}
                  style={{ height: `${Math.max(heightPct, total > 0 ? 6 : 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{formatShortDate(timeseries[0]?.date)}</span>
          <span>{formatShortDate(timeseries[Math.floor(timeseries.length / 2)]?.date)}</span>
          <span>{formatShortDate(timeseries[timeseries.length - 1]?.date)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// ─── ATS score buckets ───────────────────────────────────────────────

function ScoreBucketsCard({ buckets }: { buckets: AnalyticsOverview['scoreBuckets'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS-Score vs. Interview-Quote</CardTitle>
        <CardDescription>
          Höhere Scores korrelieren typischerweise mit mehr Interview-Einladungen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Noch keine Bewerbungen mit ATS-Score erstellt.
          </p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => (
              <div key={b.bucket} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium tabular-nums">{b.bucket}</span>
                  <span className="text-muted-foreground">
                    {b.applications} Bewerbungen ·{' '}
                    <span className="font-medium text-foreground">{b.interviewRate}%</span> Interview
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${b.interviewRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top templates ───────────────────────────────────────────────────

function TopTemplatesCard({ templates }: { templates: AnalyticsOverview['topTemplates'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top-Templates</CardTitle>
        <CardDescription>
          Welche Lebenslauf-Templates du am häufigsten nutzt — und wie sie performen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Template-Daten verfügbar.
          </p>
        ) : (
          <div className="divide-y">
            {templates.map((t, idx) => (
              <div key={t.templateId} className="flex items-center gap-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.usageCount} {t.usageCount === 1 ? 'Bewerbung' : 'Bewerbungen'}
                  </p>
                </div>
                <Badge
                  variant={t.interviewRate >= 30 ? 'default' : 'secondary'}
                  className="tabular-nums"
                >
                  {t.interviewRate}% Interview
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty state + upgrade prompt + skeleton ────────────────────────

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-4">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Noch keine Daten</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sobald du deine erste Bewerbung erstellt hast, erscheinen hier deine Trends.
          </p>
        </div>
        <Button asChild>
          <Link href="/applications/new">
            Erste Bewerbung erstellen
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function UpgradePrompt() {
  return (
    <div className="container max-w-3xl py-12">
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader className="text-center pt-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl text-amber-900 dark:text-amber-200">
            Advanced Analytics & Trends
          </CardTitle>
          <CardDescription className="text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
            Erfolgsquoten, Konversions-Funnel, ATS-Score-Trends und Template-Performance — exklusiv
            für Premium-Mitglieder.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 justify-center pb-12">
          <Button asChild className="bg-amber-600 hover:bg-amber-700">
            <Link href="/#pricing">
              <Lock className="mr-2 h-4 w-4" />
              Mit Premium freischalten
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Zurück zum Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="container max-w-7xl py-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
