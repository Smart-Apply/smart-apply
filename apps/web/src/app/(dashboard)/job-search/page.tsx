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
  LinkedInCountry,
  UnifiedJob,
  UnifiedJobSearchRequest,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Job-source providers are intentionally NOT surfaced in the UI — the user
// sees a single unified result list. The frontend just calls /job-search and
// trusts the backend to fan out across whichever providers are configured
// for the user's tier. We still query /job-search/sources internally to know
// whether the user has any source (search-button enable) and whether to show
// the Premium upsell, but never render source names.
// ─────────────────────────────────────────────────────────────────────────────

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

  const search = useJobSearch();
  const importJob = useImportUnifiedJob();
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnySource) return;

    // No `sources` filter — backend fans out across every provider that's
    // configured AND available for the user's tier. Hiding the picker means
    // we don't expose provider identities (LinkedIn/Arbeitnow/...) to users.
    const request: UnifiedJobSearchRequest = {
      keywords: keywords.trim() || undefined,
      location: location.trim() || undefined,
      country,
      remoteOnly: remoteOnly || undefined,
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
            Finde passende Stellen aus tausenden offenen Positionen und erstelle mit einem
            Klick eine maßgeschneiderte Bewerbung.
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
            Premium-Mitglieder profitieren von einer deutlich erweiterten Stellenauswahl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
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
                <Label htmlFor="country">Land</Label>
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
          description="Versuche andere Stichwörter oder einen anderen Standort."
        />
      )}

      {!search.isPending && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} Treffer gefunden
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
