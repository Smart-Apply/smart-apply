'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useImportUnifiedJob,
  useJobSearch,
  useJobSearchSources,
} from '@/hooks/use-job-search';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  JobSearchSource,
  JobSearchSourceStatus,
  JobSourceId,
  LinkedInCountry,
  UnifiedJob,
  UnifiedJobSearchRequest,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Source presentation — colors and German labels keyed by JobSourceId so the
// UI reads consistently across the picker, status block, and result badges.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<JobSourceId, string> = {
  linkedin: 'LinkedIn',
  arbeitnow: 'Arbeitnow',
};

/**
 * Tailwind classes for the result-card source badge. Distinct colors so a
 * dense result list visually separates the two sources at a glance.
 */
const SOURCE_BADGE_CLASSES: Record<JobSourceId, string> = {
  linkedin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  arbeitnow: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

const COUNTRY_OPTIONS: { value: LinkedInCountry; label: string }[] = [
  { value: 'de', label: '🇩🇪 Deutschland' },
  { value: 'at', label: '🇦🇹 Österreich' },
  { value: 'ch', label: '🇨🇭 Schweiz' },
  { value: 'gb', label: '🇬🇧 Vereinigtes Königreich' },
  { value: 'us', label: '🇺🇸 USA' },
  { value: 'nl', label: '🇳🇱 Niederlande' },
  { value: 'fr', label: '🇫🇷 Frankreich' },
  { value: 'es', label: '🇪🇸 Spanien' },
  { value: 'it', label: '🇮🇹 Italien' },
  { value: 'ww', label: '🌍 Weltweit' },
];

function formatPostedAt(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`;
  return date.toLocaleDateString('de-DE');
}

export default function JobSearchPage() {
  const router = useRouter();
  const sourcesQuery = useJobSearchSources();

  // Discover which sources are actually available for THIS user. The
  // backend already factors in tier + provider configuration, so we can
  // trust this list for picker disabled-state and Premium upsell logic.
  const availableSources = useMemo<JobSearchSource[]>(
    () => sourcesQuery.data?.sources ?? [],
    [sourcesQuery.data],
  );
  const hasAnySource = availableSources.some((s) => s.available);

  // Search form state.
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState<LinkedInCountry>('de');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [perSourceLimit, setPerSourceLimit] = useState<number>(15);
  // `null` = "all available" (default fan-out). Once the user clicks any chip,
  // we switch to an explicit set so subsequent toggles behave intuitively.
  const [selectedSources, setSelectedSources] = useState<JobSourceId[] | null>(null);

  const search = useJobSearch();
  const importJob = useImportUnifiedJob();
  const [importingId, setImportingId] = useState<string | null>(null);

  const toggleSource = (id: JobSourceId) => {
    setSelectedSources((current) => {
      // First toggle: seed from the full available set so unchecking one
      // chip doesn't accidentally search nothing.
      const base =
        current ?? availableSources.filter((s) => s.available).map((s) => s.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnySource) return;

    const sources = selectedSources && selectedSources.length > 0 ? selectedSources : undefined;
    const request: UnifiedJobSearchRequest = {
      keywords: keywords.trim() || undefined,
      location: location.trim() || undefined,
      country,
      remoteOnly: remoteOnly || undefined,
      sources,
      perSourceLimit,
    };
    search.mutate(request);
  };

  const handleImport = async (job: UnifiedJob) => {
    setImportingId(`${job.source}:${job.externalId}`);
    try {
      const created = await importJob.mutateAsync(job);
      router.push(`/applications/new?jobPostingId=${created.id}`);
    } finally {
      setImportingId(null);
    }
  };

  const results = search.data?.results ?? [];
  const sourceStatuses = search.data?.sources ?? [];

  // Premium upsell only if AT LEAST ONE source requires Premium AND the user
  // has none of those available. Avoids nagging users who are already paying.
  const showPremiumUpsell = availableSources.some(
    (s) => s.requiresPremium && !s.available,
  );

  return (
    <div className="container max-w-7xl py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Job-Suche
          </h1>
          <p className="text-muted-foreground">
            Finde passende Stellen quellenübergreifend (LinkedIn + Arbeitnow) und erstelle
            mit einem Klick eine maßgeschneiderte Bewerbung.
          </p>
        </div>
        {showPremiumUpsell && (
          <Button asChild className="gap-2">
            <Link href="/pricing">
              <Lock className="h-4 w-4" />
              Premium freischalten
            </Link>
          </Button>
        )}
      </div>

      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suchfilter</CardTitle>
          <CardDescription>
            Arbeitnow steht allen Nutzer:innen kostenlos zur Verfügung. LinkedIn ist
            Premium-Mitgliedern vorbehalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Source picker */}
            <SourcePicker
              available={availableSources}
              selected={
                selectedSources ?? availableSources.filter((s) => s.available).map((s) => s.id)
              }
              onToggle={toggleSource}
              isLoading={sourcesQuery.isLoading}
              disabled={search.isPending}
            />

            {/* Keywords + Location + Country row */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="keywords">Stichwörter</Label>
                <Input
                  id="keywords"
                  placeholder="z.B. Werkstudent Wirtschaftsinformatik"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  disabled={search.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  placeholder="z.B. NRW, Berlin, München"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={search.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Land (LinkedIn)</Label>
                <Select
                  value={country}
                  onValueChange={(v) => setCountry(v as LinkedInCountry)}
                  disabled={search.isPending}
                >
                  <SelectTrigger id="country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Remote toggle + per-source limit + submit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={remoteOnly}
                    onCheckedChange={(v) => setRemoteOnly(v === true)}
                    disabled={search.isPending}
                  />
                  <span className="text-sm">Nur Remote-Stellen</span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="count" className="text-xs text-muted-foreground">
                    Max. Treffer pro Quelle
                  </Label>
                  <Input
                    id="count"
                    type="number"
                    min={1}
                    max={50}
                    value={perSourceLimit}
                    onChange={(e) =>
                      setPerSourceLimit(
                        Math.min(50, Math.max(1, Number(e.target.value) || 15)),
                      )
                    }
                    disabled={search.isPending}
                    className="w-32"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={search.isPending || !hasAnySource}
                className="gap-2"
              >
                {search.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Suche läuft …
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Stellen suchen
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Source status block — surfaces partial failures so users know
          when LinkedIn was skipped without making them open the network tab. */}
      {sourceStatuses.length > 0 && <SourceStatusList statuses={sourceStatuses} />}

      {/* Results */}
      {search.isPending && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!search.isPending && search.isSuccess && results.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="Keine Stellen gefunden"
          description="Versuche andere Stichwörter, einen anderen Standort, oder aktiviere zusätzliche Quellen."
        />
      )}

      {!search.isPending && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'Treffer' : 'Treffer'} gefunden
          </p>
          <div className="space-y-3">
            {results.map((job) => {
              const importKey = `${job.source}:${job.externalId}`;
              return (
                <JobResultCard
                  key={importKey}
                  job={job}
                  onImport={() => handleImport(job)}
                  isImporting={importingId === importKey}
                  disabled={importJob.isPending}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-select chip group for picking which providers to query. Disabled
 * sources (Premium gate, missing token, …) render as faded chips with a
 * lock icon so the affordance is obvious but not clickable.
 */
function SourcePicker({
  available,
  selected,
  onToggle,
  isLoading,
  disabled,
}: {
  available: JobSearchSource[];
  selected: JobSourceId[];
  onToggle: (id: JobSourceId) => void;
  isLoading: boolean;
  disabled?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Quellen</Label>
        <Skeleton className="h-9 w-64" />
      </div>
    );
  }

  if (available.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>Quellen</Label>
      <div className="flex flex-wrap gap-2">
        {available.map((source) => {
          const isActive = selected.includes(source.id);
          const isDisabled = disabled || !source.available;
          return (
            <button
              type="button"
              key={source.id}
              disabled={isDisabled}
              onClick={() => onToggle(source.id)}
              title={
                source.available
                  ? undefined
                  : source.requiresPremium
                    ? 'Premium-Tier erforderlich'
                    : 'Quelle nicht konfiguriert'
              }
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition',
                isActive && source.available
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-muted',
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {!source.available && <Lock className="h-3 w-3" />}
              {SOURCE_LABELS[source.id] ?? source.name}
              {source.requiresPremium && (
                <span className="ml-1 text-[10px] uppercase opacity-70">Premium</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders the per-source bookkeeping returned by `/job-search`. We only
 * call attention to skipped/errored sources — successful ones are shown
 * inline as muted counts so the user always sees where results came from.
 */
function SourceStatusList({ statuses }: { statuses: JobSearchSourceStatus[] }) {
  const ok = statuses.filter((s) => s.status === 'ok');
  const skipped = statuses.filter((s) => s.status !== 'ok');

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {ok.map((s) => (
        <span key={s.source} className="text-muted-foreground">
          <span className="font-medium text-foreground">{SOURCE_LABELS[s.source]}</span>:{' '}
          {s.count} Treffer
        </span>
      ))}
      {skipped.map((s) => (
        <span
          key={s.source}
          className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">{SOURCE_LABELS[s.source]}</span>{' '}
          {s.status === 'skipped' ? 'übersprungen' : 'fehlgeschlagen'}
          {s.reason ? ` (${s.reason})` : ''}
        </span>
      ))}
    </div>
  );
}

function JobResultCard({
  job,
  onImport,
  isImporting,
  disabled,
}: {
  job: UnifiedJob;
  onImport: () => void;
  isImporting: boolean;
  disabled: boolean;
}) {
  const posted = formatPostedAt(job.postedAt);

  return (
    <Card className="transition hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base leading-snug">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline inline-flex items-center gap-1.5"
              >
                {job.title}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {job.company}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              {posted && <span className="text-muted-foreground">· {posted}</span>}
            </CardDescription>
          </div>
          <span
            className={[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              SOURCE_BADGE_CLASSES[job.source],
            ].join(' ')}
          >
            {SOURCE_LABELS[job.source]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {job.workType && (
            <Badge variant="secondary" className="gap-1">
              <Globe className="h-3 w-3" />
              {job.workType}
            </Badge>
          )}
          {job.employmentType && <Badge variant="outline">{job.employmentType}</Badge>}
          {job.salary && <Badge variant="outline">{job.salary}</Badge>}
          {job.applicantsCount !== undefined && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {job.applicantsCount} Bewerber
            </Badge>
          )}
          {job.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {job.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
        )}

        <div className="flex justify-end">
          <Button onClick={onImport} disabled={disabled || isImporting} className="gap-2">
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird importiert …
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Bewerbung erstellen
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
