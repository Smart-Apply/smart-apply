'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CenteredLoader } from '@/components/shared/loading';
import { TemplateCard } from '@/components/templates/template-card';
import { useProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth-store';
import { useCreateApplicationWithGeneration } from '@/hooks/use-applications';
import { useCoverLetterTemplates, useResumeTemplates, getDefaultTemplate } from '@/hooks/use-templates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  User,
  Briefcase,
  Loader2,
} from 'lucide-react';
import type { JobPosting, Template } from '@/types';

export type ApplicationLanguage = 'de' | 'en' | 'fr' | 'es' | 'it';

const LANGUAGE_OPTIONS: { value: ApplicationLanguage; label: string; flag: string }[] = [
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
];

// Helper to group templates by base template for color variants
interface TemplateGroup {
  baseTemplate: Template;
  colorVariants: { id: string; accentColor: string; colorVariantName: string }[];
}

function groupTemplatesByBase(templates: Template[]): TemplateGroup[] {
  const groups = new Map<string, TemplateGroup>();

  for (const template of templates) {
    const groupKey = template.baseTemplateId || template.id;

    if (!groups.has(groupKey)) {
      const baseTemplate = template.baseTemplateId
        ? templates.find(t => t.id === template.baseTemplateId) || template
        : template;
      groups.set(groupKey, { baseTemplate, colorVariants: [] });
    }

    if (template.accentColor) {
      const group = groups.get(groupKey)!;
      if (!group.colorVariants.find(v => v.id === template.id)) {
        group.colorVariants.push({
          id: template.id,
          accentColor: template.accentColor,
          colorVariantName: template.colorVariantName || '',
        });
      }
    }
  }

  for (const group of groups.values()) {
    group.colorVariants.sort((a, b) => {
      if (a.id === group.baseTemplate.id) return -1;
      if (b.id === group.baseTemplate.id) return 1;
      return a.colorVariantName.localeCompare(b.colorVariantName);
    });
  }

  return Array.from(groups.values());
}

interface GenerateStepProps {
  jobPosting: JobPosting;
}

export function GenerateStep({ jobPosting }: GenerateStepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const createApplication = useCreateApplicationWithGeneration();
  const { data: coverLetterTemplates, isLoading: clLoading } = useCoverLetterTemplates();
  const { data: resumeTemplates, isLoading: rtLoading } = useResumeTemplates();

  const [selectedResumeTemplateId, setSelectedResumeTemplateId] = useState<string | null>(null);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<ApplicationLanguage>('de');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const resumeTemplateGroups = resumeTemplates ? groupTemplatesByBase(resumeTemplates) : [];

  // Derive the effective resume template (user-selected or default)
  const effectiveResumeTemplateId = selectedResumeTemplateId ?? (() => {
    if (!resumeTemplates || resumeTemplates.length === 0) return null;
    const defaultTemplate = resumeTemplates.find(t => t.isDefault) || resumeTemplates[0];
    return defaultTemplate?.id ?? null;
  })();

  // Derive matching cover letter template from resume selection (no state needed)
  const effectiveCoverLetterTemplateId = (() => {
    if (!effectiveResumeTemplateId || !resumeTemplates || !coverLetterTemplates) return null;
    const selectedResume = resumeTemplates.find(t => t.id === effectiveResumeTemplateId);
    if (!selectedResume) return null;

    const resumeIdWithoutType = effectiveResumeTemplateId.replace(/-resume$/, '');
    const matchingId = `${resumeIdWithoutType}-cover-letter`;
    const exactMatch = coverLetterTemplates.find(t => t.id === matchingId);
    if (exactMatch) return exactMatch.id;

    const categoryMatch = coverLetterTemplates.find(
      t => t.category.toLowerCase() === selectedResume.category.toLowerCase()
    );
    if (categoryMatch) return categoryMatch.id;

    const defaultCL = getDefaultTemplate(coverLetterTemplates);
    return defaultCL?.id ?? null;
  })();

  // Language defaults handled by initial state
  // Could be enhanced to detect language from job text via backend

  const handleSubmit = async () => {
    try {
      const application = await createApplication.mutateAsync({
        jobPostingId: jobPosting.id,
        coverLetterTemplateId: generateCoverLetter ? (effectiveCoverLetterTemplateId || undefined) : undefined,
        resumeTemplateId: effectiveResumeTemplateId || undefined,
        generateCoverLetter,
        language: selectedLanguage,
      });

      // createWithGeneration completes synchronously (blocks until LLM is done),
      // so the application is already READY — redirect immediately
      setIsRedirecting(true);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      router.push(`/applications/${application.id}/edit`);
    } catch (error: unknown) {
      let message = 'Ein unbekannter Fehler ist aufgetreten';
      let applicationId: string | null = null;
      if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        const errData = err.data as Record<string, unknown> | undefined;
        if (errData?.message) message = String(errData.message);
        else if (err.message) message = String(err.message);
        if (errData?.applicationId) applicationId = String(errData.applicationId);
      }

      if (applicationId) {
        toast.error(message, {
          duration: 8000,
          action: {
            label: 'Zur Bewerbung',
            onClick: () => router.push(`/applications/${applicationId}`),
          },
        });
      } else {
        toast.error(message);
      }
    }
  };

  const isGroupSelected = (group: TemplateGroup) =>
    group.colorVariants.some(v => v.id === effectiveResumeTemplateId) ||
    group.baseTemplate.id === effectiveResumeTemplateId;

  const getSelectedVariantForGroup = (group: TemplateGroup) =>
    group.colorVariants.find(v => v.id === effectiveResumeTemplateId)?.id;

  if (clLoading || rtLoading) {
    return <CenteredLoader message="Vorlagen werden geladen..." />;
  }

  // ── Generating or redirecting: show loading UI ──
  if (createApplication.isPending || isRedirecting) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle>Bewerbung wird erstellt...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium">Deine Bewerbung wird mit KI erstellt...</p>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-progress" />
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Lebenslauf wird vorbereitet
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:200ms]" />
                Anschreiben wird mit KI generiert
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:400ms]" />
                Dokumente werden gespeichert
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Dies kann bis zu 30 Sekunden dauern...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Idle: show summary + templates + generate button ──
  return (
    <div className="space-y-6">
      {/* Summary Card: Profile ↔ Job */}
      <Card className="shadow-soft border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Profile Summary */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Dein Profil
              </div>
              <p className="font-semibold">{user?.firstName || ''} {user?.lastName || ''}</p>
              <div className="flex flex-wrap gap-1.5">
                {profile?.skills && profile.skills.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.skills.length} Skills
                  </Badge>
                )}
                {profile?.experiences && profile.experiences.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.experiences.length} Erfahrungen
                  </Badge>
                )}
                {profile?.education && profile.education.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.education.length} Bildung
                  </Badge>
                )}
              </div>
            </div>

            {/* Job Summary */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Diese Stelle
              </div>
              <p className="font-semibold">{jobPosting.title}</p>
              <p className="text-sm text-muted-foreground">{jobPosting.company}</p>
              {jobPosting.location && (
                <p className="text-xs text-muted-foreground">{jobPosting.location}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Options: Cover Letter + Language */}
      <Card className="shadow-soft border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Optionen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/30 border border-border/50">
            <Checkbox
              id="generateCoverLetter"
              checked={generateCoverLetter}
              onCheckedChange={checked => setGenerateCoverLetter(checked === true)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="generateCoverLetter" className="text-base font-medium cursor-pointer">
                Anschreiben generieren
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Erstellt ein auf die Stelle zugeschnittenes Anschreiben.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="grid gap-1.5 leading-none mb-3">
              <Label className="text-base font-medium">Sprache der Bewerbung</Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Wird automatisch erkannt. Hier kannst du sie anpassen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedLanguage(option.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium',
                    selectedLanguage === option.value
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-transparent bg-background hover:bg-muted/50 hover:border-border/50 text-muted-foreground'
                  )}
                >
                  <span className="text-base">{option.flag}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Picker */}
      <Card className="shadow-soft border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Design auswählen</CardTitle>
              <CardDescription>
                Wähle eine Vorlage für deinen Lebenslauf.
                {generateCoverLetter && ' Das Anschreiben wird automatisch im passenden Design erstellt.'}
              </CardDescription>
            </div>
            {resumeTemplateGroups.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllTemplates(!showAllTemplates)}>
                {showAllTemplates ? 'Weniger' : 'Alle anzeigen'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(showAllTemplates ? resumeTemplateGroups : resumeTemplateGroups.slice(0, 3)).map(group => (
              <TemplateCard
                key={group.baseTemplate.id}
                template={group.baseTemplate}
                isSelected={isGroupSelected(group)}
                onSelect={setSelectedResumeTemplateId}
                colorVariants={group.colorVariants.length > 1 ? group.colorVariants : undefined}
                selectedVariantId={getSelectedVariantForGroup(group)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <SubmitButton
          onClick={handleSubmit}
          isLoading={createApplication.isPending}
          loadingText="Erstelle Bewerbung..."
          size="lg"
          className="shadow-lg hover:shadow-xl transition-all"
        >
          Bewerbung erstellen
          <Sparkles className="ml-2 h-4 w-4" />
        </SubmitButton>
      </div>
    </div>
  );
}
