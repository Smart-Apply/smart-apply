'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFeatureGate } from '@/hooks/use-tier-gate';
import {
  useLinkedInJobSearch,
  useImportLinkedInJob,
} from '@/hooks/use-linkedin-jobs';
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
  LinkedInCountry,
  LinkedInDatePosted,
  LinkedInExperienceLevel,
  LinkedInJob,
  LinkedInJobSearchFilters,
  LinkedInJobType,
  LinkedInRemoteFilter,
  LinkedInSortBy,
} from '@/types';

// LinkedIn URL parameter values mapped to user-facing German labels.
const EXPERIENCE_LEVELS: { value: LinkedInExperienceLevel; label: string }[] = [
  { value: '1', label: 'Praktikum' },
  { value: '2', label: 'Berufseinsteiger' },
  { value: '3', label: 'Associate' },
  { value: '4', label: 'Mid-Senior' },
  { value: '5', label: 'Direktor' },
  { value: '6', label: 'Executive' },
];

const JOB_TYPES: { value: LinkedInJobType; label: string }[] = [
  { value: 'F', label: 'Vollzeit' },
  { value: 'P', label: 'Teilzeit' },
  { value: 'C', label: 'Vertrag' },
  { value: 'T', label: 'Befristet' },
  { value: 'I', label: 'Praktikum' },
];

const REMOTE_OPTIONS: { value: LinkedInRemoteFilter; label: string }[] = [
  { value: '1', label: 'Vor Ort' },
  { value: '2', label: 'Remote' },
  { value: '3', label: 'Hybrid' },
];

const DATE_POSTED_OPTIONS: { value: LinkedInDatePosted | 'any'; label: string }[] = [
  { value: 'any', label: 'Beliebig' },
  { value: 'r86400', label: 'Letzte 24 Stunden' },
  { value: 'r604800', label: 'Letzte Woche' },
  { value: 'r2592000', label: 'Letzter Monat' },
];

const SORT_OPTIONS: { value: LinkedInSortBy; label: string }[] = [
  { value: 'DD', label: 'Neueste zuerst' },
  { value: 'R', label: 'Relevanteste zuerst' },
];

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
  const { hasAccess, isLoading: isLoadingTier } = useFeatureGate('linkedinImport');
  const isLocked = !isLoadingTier && !hasAccess;

  // Search form state.
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState<LinkedInCountry>('de');
  const [experience, setExperience] = useState<LinkedInExperienceLevel[]>([]);
  const [jobTypes, setJobTypes] = useState<LinkedInJobType[]>([]);
  const [remoteOpts, setRemoteOpts] = useState<LinkedInRemoteFilter[]>([]);
  const [datePosted, setDatePosted] = useState<LinkedInDatePosted | 'any'>('any');
  const [sortBy, setSortBy] = useState<LinkedInSortBy>('DD');
  const [easyApply, setEasyApply] = useState(false);
  const [count, setCount] = useState<number>(15);

  const search = useLinkedInJobSearch();
  const importJob = useImportLinkedInJob();
  const [importingId, setImportingId] = useState<string | null>(null);

  const toggle = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const filters: LinkedInJobSearchFilters = {
      keywords: keywords.trim() || undefined,
      location: location.trim() || undefined,
      country,
      experienceLevel: experience.length ? experience : undefined,
      jobType: jobTypes.length ? jobTypes : undefined,
      remote: remoteOpts.length ? remoteOpts : undefined,
      datePosted: datePosted === 'any' ? undefined : datePosted,
      sortBy,
      easyApply: easyApply || undefined,
      count,
    };
    search.mutate(filters);
  };

  const handleImport = async (job: LinkedInJob) => {
    setImportingId(job.id);
    try {
      const created = await importJob.mutateAsync(job);
      router.push(`/applications/new?jobPostingId=${created.id}`);
    } finally {
      setImportingId(null);
    }
  };

  const results = search.data?.results ?? [];

  return (
    <div className="container max-w-7xl py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            LinkedIn Job-Suche
          </h1>
          <p className="text-muted-foreground">
            Finde passende Stellen direkt auf LinkedIn und erstelle mit einem Klick eine
            maßgeschneiderte Bewerbung.
          </p>
        </div>
        {isLocked && (
          <Button asChild className="gap-2">
            <Link href="/pricing">
              <Lock className="h-4 w-4" />
              Premium freischalten
            </Link>
          </Button>
        )}
      </div>

      {/* Search form */}
      <Card className={isLocked ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="text-lg">Suchfilter</CardTitle>
          <CardDescription>
            Premium-Mitglieder können bis zu 10 Suchanfragen pro Stunde durchführen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Keywords + Location row */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="keywords">Stichwörter</Label>
                <Input
                  id="keywords"
                  placeholder="z.B. Projektmanager, Krankenpfleger, Vertriebsleiter"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  disabled={isLocked || search.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  placeholder="z.B. NRW, Berlin, München"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isLocked || search.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Select
                  value={country}
                  onValueChange={(v) => setCountry(v as LinkedInCountry)}
                  disabled={isLocked || search.isPending}
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

            {/* Selects row */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Veröffentlicht</Label>
                <Select
                  value={datePosted}
                  onValueChange={(v) => setDatePosted(v as LinkedInDatePosted | 'any')}
                  disabled={isLocked || search.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_POSTED_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sortierung</Label>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as LinkedInSortBy)}
                  disabled={isLocked || search.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Max. Ergebnisse</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 15)))}
                  disabled={isLocked || search.isPending}
                />
              </div>
            </div>

            {/* Multi-select chip groups */}
            <div className="grid gap-6 md:grid-cols-3">
              <ChipGroup
                label="Erfahrungslevel"
                options={EXPERIENCE_LEVELS}
                selected={experience}
                onToggle={(v) => setExperience(toggle(experience, v))}
                disabled={isLocked || search.isPending}
              />
              <ChipGroup
                label="Beschäftigungsart"
                options={JOB_TYPES}
                selected={jobTypes}
                onToggle={(v) => setJobTypes(toggle(jobTypes, v))}
                disabled={isLocked || search.isPending}
              />
              <ChipGroup
                label="Arbeitsmodell"
                options={REMOTE_OPTIONS}
                selected={remoteOpts}
                onToggle={(v) => setRemoteOpts(toggle(remoteOpts, v))}
                disabled={isLocked || search.isPending}
              />
            </div>

            {/* Easy apply + submit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={easyApply}
                  onCheckedChange={(v) => setEasyApply(v === true)}
                  disabled={isLocked || search.isPending}
                />
                <span className="text-sm">Nur Easy-Apply Stellen</span>
              </label>

              <Button type="submit" disabled={isLocked || search.isPending} className="gap-2">
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
          description="Versuche andere Stichwörter, einen anderen Standort oder weniger Filter."
        />
      )}

      {!search.isPending && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'Treffer' : 'Treffer'} gefunden
          </p>
          <div className="space-y-3">
            {results.map((job) => (
              <JobResultCard
                key={job.id}
                job={job}
                onImport={() => handleImport(job)}
                isImporting={importingId === job.id}
                disabled={importJob.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              type="button"
              key={opt.value}
              disabled={disabled}
              onClick={() => onToggle(opt.value)}
              className={[
                'rounded-full border px-3 py-1 text-xs transition',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-muted',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JobResultCard({
  job,
  onImport,
  isImporting,
  disabled,
}: {
  job: LinkedInJob;
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
          {job.seniority && <Badge variant="outline">{job.seniority}</Badge>}
          {job.salary && <Badge variant="outline">{job.salary}</Badge>}
          {job.applicantsCount !== undefined && (
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {job.applicantsCount} Bewerber
            </Badge>
          )}
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
