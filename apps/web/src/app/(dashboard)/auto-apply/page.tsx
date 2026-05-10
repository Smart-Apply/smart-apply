'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  ExternalLink,
  Lock,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useFeatureGate } from '@/hooks/use-tier-gate';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/errors';
import { toast } from 'sonner';
import type { AutoApplySuggestion } from '@/types';

/**
 * Auto-Apply Agent inbox.
 *
 * Premium-only. Shows pending suggestions plus quick actions
 * (Approve / Skip / Block company). When the user has no config yet,
 * shows a CTA to `/auto-apply/settings` instead of an empty list.
 */
export default function AutoApplyPage() {
  const { hasAccess, isLoading: gateLoading } = useFeatureGate('autoApplyAgent');

  if (gateLoading) {
    return <PageSkeleton />;
  }
  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  return <InboxView />;
}

// ─── Inbox view ─────────────────────────────────────────────────────────

function InboxView() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<'PENDING' | 'APPROVED' | 'SKIPPED'>('PENDING');

  const configQuery = useQuery({
    queryKey: ['auto-apply', 'config'],
    queryFn: () => api.autoApply.getConfig(),
    staleTime: 60_000,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['auto-apply', 'suggestions', selectedTab],
    queryFn: () => api.autoApply.listSuggestions({ status: selectedTab, pageSize: 50 }),
    enabled: !!configQuery.data,
    staleTime: 30_000,
  });

  const runNow = useMutation({
    mutationFn: () => api.autoApply.runNow(),
    onSuccess: () => {
      // Backend dispatches the LinkedIn scrape in the background (returns 202).
      // Poll the suggestions list for ~3 minutes so new results surface
      // without forcing the user to refresh the page.
      toast.success('Suche läuft im Hintergrund — neue Vorschläge erscheinen in Kürze.');

      let attempts = 0;
      const maxAttempts = 6; // 6 × 30s ≈ 3 min
      const poll = (): void => {
        attempts += 1;
        queryClient.invalidateQueries({ queryKey: ['auto-apply', 'suggestions'] });
        if (attempts < maxAttempts) {
          setTimeout(poll, 30_000);
        }
      };
      setTimeout(poll, 15_000);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 429
          ? 'Bitte warte eine Stunde, bevor du erneut suchst.'
          : (err as Error).message;
      toast.error(msg);
    },
  });

  const togglePause = useMutation({
    mutationFn: () =>
      configQuery.data?.isActive ? api.autoApply.pause() : api.autoApply.resume(),
    onSuccess: (next) => {
      queryClient.setQueryData(['auto-apply', 'config'], next);
      toast.success(next.isActive ? 'Auto-Apply läuft wieder' : 'Auto-Apply pausiert');
    },
  });

  if (configQuery.isLoading) return <PageSkeleton />;

  if (!configQuery.data) return <NoConfigCTA />;

  const config = configQuery.data;
  const items = suggestionsQuery.data?.items ?? [];

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-amber-500" />
            Auto-Apply Agent
          </h1>
          <p className="text-muted-foreground">
            Wir suchen täglich passende Stellen für dich. Du entscheidest, welche du bewirbst.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="gap-2"
          >
            <RefreshCw className={runNow.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Jetzt suchen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => togglePause.mutate()}
            disabled={togglePause.isPending}
            className="gap-2"
          >
            {config.isActive ? (
              <>
                <Pause className="h-4 w-4" />
                Pausieren
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Aktivieren
              </>
            )}
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/auto-apply/settings">
              <Settings className="h-4 w-4" />
              Einstellungen
            </Link>
          </Button>
        </div>
      </header>

      {/* Status banner */}
      {!config.isActive && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Pause className="h-4 w-4" />
            <span>Auto-Apply ist aktuell pausiert — wir suchen keine neuen Stellen.</span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton
          active={selectedTab === 'PENDING'}
          onClick={() => setSelectedTab('PENDING')}
          label="Offen"
        />
        <TabButton
          active={selectedTab === 'APPROVED'}
          onClick={() => setSelectedTab('APPROVED')}
          label="Bewerbung erstellt"
        />
        <TabButton
          active={selectedTab === 'SKIPPED'}
          onClick={() => setSelectedTab('SKIPPED')}
          label="Übersprungen"
        />
      </div>

      {/* List */}
      {suggestionsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={
            selectedTab === 'PENDING'
              ? 'Noch keine neuen Vorschläge'
              : selectedTab === 'APPROVED'
                ? 'Du hast noch keine Vorschläge angenommen'
                : 'Keine übersprungenen Vorschläge'
          }
          description={
            selectedTab === 'PENDING'
              ? 'Sobald der Agent neue passende Stellen findet, erscheinen sie hier.'
              : 'Diese Liste füllt sich, sobald du Vorschläge bearbeitest.'
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Suggestion card ────────────────────────────────────────────────────

function SuggestionCard({ suggestion }: { suggestion: AutoApplySuggestion }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: () => api.autoApply.approve(suggestion.id),
    onSuccess: ({ applicationId }) => {
      toast.success('Bewerbung wird erstellt …');
      queryClient.invalidateQueries({ queryKey: ['auto-apply', 'suggestions'] });
      router.push(`/applications/${applicationId}`);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 403
          ? 'Du hast dein monatliches Auto-Apply Limit (50) erreicht.'
          : (err as Error).message;
      toast.error(msg);
    },
  });

  const skip = useMutation({
    mutationFn: () => api.autoApply.skip(suggestion.id),
    onSuccess: () => {
      toast.success('Übersprungen');
      queryClient.invalidateQueries({ queryKey: ['auto-apply', 'suggestions'] });
    },
  });

  const block = useMutation({
    mutationFn: () => api.autoApply.block(suggestion.id),
    onSuccess: () => {
      toast.success(`"${suggestion.company}" wird nicht mehr vorgeschlagen`);
      queryClient.invalidateQueries({ queryKey: ['auto-apply', 'suggestions'] });
    },
  });

  const isPending = approve.isPending || skip.isPending || block.isPending;

  return (
    <Card className="transition hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: job details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold text-base sm:text-lg leading-tight flex-1">
                {suggestion.jobTitle}
              </h3>
              {suggestion.matchScore !== undefined && (
                <Badge variant={suggestion.matchScore >= 70 ? 'default' : 'secondary'}>
                  {Math.round(suggestion.matchScore)}% Match
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {suggestion.company}
              </span>
              {suggestion.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {suggestion.location}
                </span>
              )}
              {suggestion.postedAt && (
                <span className="text-xs">{relativeDate(suggestion.postedAt)}</span>
              )}
            </div>
            {suggestion.matchReasons?.matchedTokens?.length ? (
              <p className="text-xs text-muted-foreground">
                Passt zu:{' '}
                <span className="font-medium text-foreground">
                  {suggestion.matchReasons.matchedTokens.slice(0, 5).join(', ')}
                </span>
              </p>
            ) : null}
            <a
              href={suggestion.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Stellenanzeige öffnen
            </a>
          </div>

          {/* Right: actions */}
          {suggestion.status === 'PENDING' ? (
            <div className="flex flex-row sm:flex-col gap-2 shrink-0">
              <Button
                size="sm"
                className="gap-1"
                disabled={isPending}
                onClick={() => approve.mutate()}
              >
                <CheckCircle2 className="h-4 w-4" />
                Bewerben
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={isPending}
                onClick={() => skip.mutate()}
              >
                <XCircle className="h-4 w-4" />
                Skippen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() => {
                  if (confirm(`"${suggestion.company}" dauerhaft blockieren?`)) {
                    block.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Blockieren
              </Button>
            </div>
          ) : (
            <div className="text-right">
              <Badge variant="outline">{statusLabel(suggestion.status)}</Badge>
              {suggestion.applicationId && (
                <Button asChild variant="link" size="sm" className="mt-1">
                  <Link href={`/applications/${suggestion.applicationId}`}>
                    Bewerbung öffnen
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function statusLabel(status: AutoApplySuggestion['status']): string {
  switch (status) {
    case 'APPROVED':
      return 'Bewerbung erstellt';
    case 'SKIPPED':
      return 'Übersprungen';
    case 'BLOCKED':
      return 'Blockiert';
    case 'EXPIRED':
      return 'Abgelaufen';
    case 'PENDING':
      return 'Offen';
  }
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'heute';
  if (diffDays === 1) return 'gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// ─── No-config CTA + upgrade prompt + skeleton ──────────────────────────

function NoConfigCTA() {
  return (
    <div className="container max-w-3xl py-12">
      <Card>
        <CardHeader className="text-center pt-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Zap className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Auto-Apply Agent einrichten</CardTitle>
          <CardDescription className="max-w-md mx-auto">
            Sag uns, welche Stellen dich interessieren — wir suchen täglich passende
            Angebote und legen sie als Vorschlag in deinen Posteingang.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-12">
          <Button asChild size="lg" className="gap-2">
            <Link href="/auto-apply/settings">
              <Settings className="h-4 w-4" />
              Jetzt einrichten
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
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
            Auto-Apply Agent
          </CardTitle>
          <CardDescription className="text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
            Lass den Agent täglich passende Stellen finden — du entscheidest mit einem Klick,
            welche du bewirbst. Bis zu 50 Bewerbungen pro Monat. Exklusiv für Premium.
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
            <Link href="/dashboard">Zurück</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
