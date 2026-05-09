'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Trash2, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFeatureGate } from '@/hooks/use-tier-gate';
import { useCoverLetterTemplates, useResumeTemplates } from '@/hooks/use-templates';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { LinkedInCountry, LinkedInRemoteFilter } from '@/types';

const COUNTRY_OPTIONS: { value: LinkedInCountry; label: string }[] = [
  { value: 'de', label: '🇩🇪 Deutschland' },
  { value: 'at', label: '🇦🇹 Österreich' },
  { value: 'ch', label: '🇨🇭 Schweiz' },
  { value: 'gb', label: '🇬🇧 Vereinigtes Königreich' },
  { value: 'us', label: '🇺🇸 USA' },
  { value: 'nl', label: '🇳🇱 Niederlande' },
  { value: 'ww', label: '🌍 Weltweit' },
];

const REMOTE_OPTIONS: { value: LinkedInRemoteFilter; label: string }[] = [
  { value: '1', label: 'Vor Ort' },
  { value: '2', label: 'Remote' },
  { value: '3', label: 'Hybrid' },
];

const SCHEDULE_OPTIONS: { value: string; label: string }[] = [
  { value: '0 9 * * *', label: 'Täglich um 09:00' },
  { value: '0 18 * * *', label: 'Täglich um 18:00' },
  { value: '0 9 * * 1,3,5', label: 'Mo / Mi / Fr um 09:00' },
  { value: '0 9 * * 1', label: 'Wöchentlich, Montag 09:00' },
];

interface FormState {
  keywords: string;
  location: string;
  country: LinkedInCountry;
  remote: LinkedInRemoteFilter[];
  maxSuggestionsPerDay: number;
  minAtsScore: number;
  requiredKeywords: string;
  blockedCompanies: string;
  cronSchedule: string;
  digestEnabled: boolean;
  isActive: boolean;
  // Generation preferences (used when the user approves a suggestion).
  // Empty string == "backend auto-pick by language" so a single Select
  // can model both states without juggling null/undefined.
  cvTemplateId: string;
  clTemplateId: string;
  generateCoverLetter: boolean;
}

/**
 * Sentinel value for the template <Select>. Radix's Select can't render
 * an item with an empty-string value, so we use this synthetic id and
 * translate it back to `undefined` (= backend auto-pick) before sending
 * the upsert payload.
 */
const AUTO_PICK = '__auto__';

const DEFAULTS: FormState = {
  keywords: '',
  location: '',
  country: 'de',
  remote: [],
  maxSuggestionsPerDay: 5,
  minAtsScore: 0,
  requiredKeywords: '',
  blockedCompanies: '',
  cronSchedule: '0 9 * * *',
  digestEnabled: true,
  isActive: true,
  cvTemplateId: '',
  clTemplateId: '',
  generateCoverLetter: true,
};

/**
 * Auto-Apply settings page.
 *
 * Loads current config (if any) and shows a single form to create / update
 * it. Falls back to DEFAULTS when no config exists yet.
 */
export default function AutoApplySettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasAccess, isLoading: gateLoading } = useFeatureGate('autoApplyAgent');

  const configQuery = useQuery({
    queryKey: ['auto-apply', 'config'],
    queryFn: () => api.autoApply.getConfig(),
    enabled: hasAccess,
    staleTime: 60_000,
  });

  // Templates are paid for in Premium, so it's cheap to always pull both
  // lists alongside the config. Backend filters out unavailable variants.
  const resumeTemplatesQuery = useResumeTemplates();
  const coverLetterTemplatesQuery = useCoverLetterTemplates();

  const [form, setForm] = useState<FormState>(DEFAULTS);

  // Hydrate form from existing config.
  //
  // The new react-hooks plugin (`react-hooks/set-state-in-effect`) flags
  // calling setState inside an effect as a cascading-render anti-pattern.
  // The "correct" alternative — derive state, or remount via `key` — would
  // require splitting this page into a fetcher + an inner form that
  // initialises state lazily from a prop, which is a much bigger refactor
  // for what is the canonical "load saved config into editable form"
  // pattern. We use the same inline-disable escape hatch that
  // `cookie-banner.tsx` uses for the same reason.
  useEffect(() => {
    const cfg = configQuery.data;
    if (!cfg) return;
    const filters = cfg.searchFilters as {
      keywords?: string;
      location?: string;
      country?: LinkedInCountry;
      remote?: LinkedInRemoteFilter[];
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      keywords: filters.keywords ?? '',
      location: filters.location ?? '',
      country: (filters.country as LinkedInCountry | undefined) ?? 'de',
      remote: filters.remote ?? [],
      maxSuggestionsPerDay: cfg.maxSuggestionsPerDay,
      minAtsScore: cfg.minAtsScore ?? 0,
      requiredKeywords: cfg.requiredKeywords.join(', '),
      blockedCompanies: cfg.blockedCompanies.join(', '),
      cronSchedule: cfg.cronSchedule,
      digestEnabled: cfg.digestEnabled,
      isActive: cfg.isActive,
      cvTemplateId: cfg.cvTemplateId ?? '',
      clTemplateId: cfg.clTemplateId ?? '',
      generateCoverLetter: cfg.generateCoverLetter,
    });
  }, [configQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      api.autoApply.upsertConfig({
        isActive: form.isActive,
        searchFilters: {
          keywords: form.keywords.trim() || undefined,
          location: form.location.trim() || undefined,
          country: form.country,
          remote: form.remote.length ? form.remote : undefined,
        },
        maxSuggestionsPerDay: form.maxSuggestionsPerDay,
        minAtsScore: form.minAtsScore > 0 ? form.minAtsScore : undefined,
        requiredKeywords: parseList(form.requiredKeywords),
        blockedCompanies: parseList(form.blockedCompanies),
        cronSchedule: form.cronSchedule,
        digestEnabled: form.digestEnabled,
        cvTemplateId: form.cvTemplateId || undefined,
        // Server ignores clTemplateId when generateCoverLetter=false,
        // but we still drop it client-side so the persisted config
        // matches what the user actually sees in the form.
        clTemplateId:
          form.generateCoverLetter && form.clTemplateId ? form.clTemplateId : undefined,
        generateCoverLetter: form.generateCoverLetter,
      }),
    onSuccess: () => {
      toast.success('Auto-Apply Konfiguration gespeichert');
      queryClient.invalidateQueries({ queryKey: ['auto-apply'] });
      router.push('/auto-apply');
    },
    onError: (err) => toast.error((err as Error).message ?? 'Speichern fehlgeschlagen'),
  });

  const remove = useMutation({
    mutationFn: () => api.autoApply.deleteConfig(),
    onSuccess: () => {
      toast.success('Auto-Apply deaktiviert');
      queryClient.invalidateQueries({ queryKey: ['auto-apply'] });
      router.push('/auto-apply');
    },
  });

  if (gateLoading || configQuery.isLoading) {
    return (
      <div className="container max-w-3xl py-6 space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container max-w-3xl py-12 text-center">
        <p>Premium-Feature.</p>
        <Button asChild className="mt-4">
          <Link href="/auto-apply">Zurück</Link>
        </Button>
      </div>
    );
  }

  const isEditing = !!configQuery.data;

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 gap-1">
            <Link href="/auto-apply">
              <ArrowLeft className="h-4 w-4" />
              Zurück zum Posteingang
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Auto-Apply einrichten
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sag uns, welche Stellen dich interessieren — der Agent sucht automatisch.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Suchkriterien</CardTitle>
          <CardDescription>
            Welche Stellen soll der Agent für dich finden?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keywords">Suchbegriffe</Label>
            <Input
              id="keywords"
              placeholder="z.B. Frontend Developer, React"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Standort</Label>
              <Input
                id="location"
                placeholder="z.B. Berlin, NRW"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Land</Label>
              <Select
                value={form.country}
                onValueChange={(v) => setForm({ ...form, country: v as LinkedInCountry })}
              >
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Arbeitsmodell</Label>
            <div className="flex flex-wrap gap-3">
              {REMOTE_OPTIONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={form.remote.includes(r.value)}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        remote: checked
                          ? [...form.remote, r.value]
                          : form.remote.filter((x) => x !== r.value),
                      })
                    }
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Verfeinere, welche Vorschläge angezeigt werden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxSuggestions">Max. Vorschläge pro Tag</Label>
              <Input
                id="maxSuggestions"
                type="number"
                min={1}
                max={20}
                value={form.maxSuggestionsPerDay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxSuggestionsPerDay: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minScore">Mindest-Match-Score (%)</Label>
              <Input
                id="minScore"
                type="number"
                min={0}
                max={100}
                value={form.minAtsScore}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minAtsScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">0 = kein Mindest-Score</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="required">Pflicht-Stichworte</Label>
            <Textarea
              id="required"
              placeholder="React, TypeScript, Remote"
              rows={2}
              value={form.requiredKeywords}
              onChange={(e) => setForm({ ...form, requiredKeywords: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Komma-getrennt. Eine Stelle wird nur vorgeschlagen, wenn ALLE Stichworte in der
              Beschreibung vorkommen.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blocked">Blockierte Unternehmen</Label>
            <Textarea
              id="blocked"
              placeholder="Acme Corp, Beispiel GmbH"
              rows={2}
              value={form.blockedCompanies}
              onChange={(e) => setForm({ ...form, blockedCompanies: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Komma-getrennt. Stellen dieser Firmen werden nie vorgeschlagen.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bewerbung generieren</CardTitle>
          <CardDescription>
            Diese Einstellungen werden verwendet, wenn du einen Vorschlag annimmst.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent">
            <Checkbox
              checked={form.generateCoverLetter}
              onCheckedChange={(checked) =>
                setForm({ ...form, generateCoverLetter: checked === true })
              }
              className="mt-0.5"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">Anschreiben mit generieren</p>
              <p className="text-xs text-muted-foreground">
                Aus, wenn du das Anschreiben lieber selbst schreiben möchtest. Ohne diese
                Option wird nur der Lebenslauf erstellt.
              </p>
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cvTemplate">Lebenslauf-Vorlage</Label>
              <Select
                value={form.cvTemplateId || AUTO_PICK}
                onValueChange={(v) =>
                  setForm({ ...form, cvTemplateId: v === AUTO_PICK ? '' : v })
                }
                disabled={resumeTemplatesQuery.isLoading}
              >
                <SelectTrigger id="cvTemplate">
                  <SelectValue placeholder="Automatisch wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PICK}>
                    Automatisch (Sprache des Job-Postings)
                  </SelectItem>
                  {(resumeTemplatesQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.colorVariantName ? ` · ${t.colorVariantName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Falls die gewählte Vorlage nicht zur Sprache des Job-Postings passt, sucht das
                Backend automatisch die passende Sprachvariante.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clTemplate">Anschreiben-Vorlage</Label>
              <Select
                value={form.clTemplateId || AUTO_PICK}
                onValueChange={(v) =>
                  setForm({ ...form, clTemplateId: v === AUTO_PICK ? '' : v })
                }
                disabled={!form.generateCoverLetter || coverLetterTemplatesQuery.isLoading}
              >
                <SelectTrigger id="clTemplate">
                  <SelectValue placeholder="Automatisch wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PICK}>
                    Automatisch (Sprache des Job-Postings)
                  </SelectItem>
                  {(coverLetterTemplatesQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.colorVariantName ? ` · ${t.colorVariantName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.generateCoverLetter && (
                <p className="text-xs text-muted-foreground">
                  Anschreiben-Generierung ist deaktiviert.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zeitplan & Benachrichtigungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule">Such-Frequenz</Label>
            <Select
              value={form.cronSchedule}
              onValueChange={(v) => setForm({ ...form, cronSchedule: v })}
            >
              <SelectTrigger id="schedule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent">
            <Checkbox
              checked={form.digestEnabled}
              onCheckedChange={(checked) =>
                setForm({ ...form, digestEnabled: checked === true })
              }
              className="mt-0.5"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">Tägliche E-Mail-Zusammenfassung</p>
              <p className="text-xs text-muted-foreground">
                Wir schicken dir um 18:00 eine kurze E-Mail mit den neuen Vorschlägen.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-accent">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">Auto-Apply aktiv</p>
              <p className="text-xs text-muted-foreground">
                Deaktivieren, um vorübergehend keine Suche durchzuführen.
              </p>
            </div>
          </label>
        </CardContent>
        <CardFooter className="flex justify-between flex-wrap gap-2">
          <div>
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Auto-Apply löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auto-Apply komplett deaktivieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deine Konfiguration und alle bisherigen Vorschläge werden gelöscht. Du
                      kannst Auto-Apply jederzeit wieder einrichten.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Endgültig löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.keywords.trim()}
            className="gap-2"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? 'Änderungen speichern' : 'Auto-Apply starten'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function parseList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
