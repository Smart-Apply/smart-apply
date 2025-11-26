'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, MapPin, Sparkles, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CenteredLoader } from '@/components/shared/loading';
import { ResumeFormEditor } from '@/components/applications/resume-form-editor';
import { CoverLetterEditor } from '@/components/applications/cover-letter-editor';
import { ResumeTemplatePreview, CoverLetterTemplatePreview } from '@/components/applications/template-preview';
import { useApplication, useExportApplication, useUpdateApplicationResume, useUpsertCoverLetter } from '@/hooks/use-applications';
import { parseResumeDraft, normalizeResumeForSave } from '@/lib/resume';
import type { ResumeData } from '@/types';
import { toast } from 'sonner';
import { stripHtml } from '@/lib/sanitize';
import { toTiptapHtml } from '@/lib/markdown';

const EMPTY_RESUME: ResumeData = {
  candidateName: 'Vorname Nachname',
  email: 'du@example.com',
  phone: '',
  location: '',
  linkedin: '',
  github: '',
  summary: '',
  skillCategories: [],
  experiences: [],
  projects: [],
  education: [],
  certifications: [],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ausstehend',
  GENERATING: 'In Bearbeitung',
  READY: 'Fertig',
  FAILED: 'Fehlgeschlagen',
};

export default function ApplicationResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const { data: application, isLoading, error } = useApplication(applicationId);
  const updateResume = useUpdateApplicationResume(applicationId);

  const [parsedResume, setParsedResume] = useState<ResumeData | null>(null);
  const [lastSavedResume, setLastSavedResume] = useState<ResumeData | null>(null);
  const [resumeInitialized, setResumeInitialized] = useState(false);
  const [resumeVersion, setResumeVersion] = useState<string | null>(null);

  const [coverLetterValue, setCoverLetterValue] = useState('');
  const [lastSavedCoverLetter, setLastSavedCoverLetter] = useState('');
  const [coverInitialized, setCoverInitialized] = useState(false);
  const [coverVersion, setCoverVersion] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [activeTab, setActiveTab] = useState<'resume' | 'cover-letter'>('resume');

  const upsertCoverLetter = useUpsertCoverLetter(applicationId);
  const exportApplication = useExportApplication(applicationId);
  const resumeText = application?.resumeText ?? null;
  const coverLetterText = application ? application.coverLetterText ?? '' : null;

  const hasResumeChanges = JSON.stringify(parsedResume) !== JSON.stringify(lastSavedResume);
  const hasCoverChanges = coverLetterValue !== lastSavedCoverLetter;
  const coverHasContent = stripHtml(coverLetterValue).trim().length > 0;

  useEffect(() => {
    if (resumeText === null) {
      return;
    }

    const resumeSource = resumeText || JSON.stringify(EMPTY_RESUME);
    if (resumeInitialized && resumeVersion === resumeSource) {
      return;
    }
    if (resumeInitialized && hasResumeChanges && resumeVersion !== resumeSource) {
      return;
    }

    const draft = parseResumeDraft(resumeSource) || EMPTY_RESUME;
    const normalized = normalizeResumeForSave(draft);

    startTransition(() => {
      setParsedResume(normalized);
      setLastSavedResume(normalized);
      setResumeVersion(resumeSource);
      setResumeInitialized(true);
    });
  }, [resumeText, hasResumeChanges, resumeInitialized, resumeVersion]);

  useEffect(() => {
    if (coverLetterText === null) {
      return;
    }

    // Convert incoming content to Tiptap-compatible HTML
    // This handles both Markdown (from LLM) and HTML (from database)
    const incoming = toTiptapHtml(coverLetterText);
    if (coverInitialized && coverVersion === incoming) {
      return;
    }
    if (coverInitialized && hasCoverChanges && coverVersion !== incoming) {
      return;
    }

    startTransition(() => {
      setCoverLetterValue(incoming);
      setLastSavedCoverLetter(incoming);
      setCoverVersion(incoming);
      setCoverInitialized(true);
    });
  }, [coverLetterText, coverInitialized, coverVersion, hasCoverChanges]);

  const statusBadge = useMemo(() => {
    if (!application) return null;
    const label = STATUS_LABELS[application.status] || application.status;
    return (
      <Badge variant="outline" className="text-sm font-medium">
        {label}
      </Badge>
    );
  }, [application]);

  const handleResumeReset = () => {
    if (lastSavedResume) {
      setParsedResume({ ...lastSavedResume });
    }
  };

  const handleResumeSave = async () => {
    if (!parsedResume) return;
    
    try {
      const normalized = normalizeResumeForSave(parsedResume);
      await updateResume.mutateAsync(normalized);
      setLastSavedResume(normalized);
      setParsedResume(normalized);
      setResumeVersion(JSON.stringify(normalized));
      setResumeInitialized(true);
      toast.success('Lebenslauf gespeichert');
    } catch (err) {
      const message = (err as Error).message;
      toast.error('Lebenslauf konnte nicht gespeichert werden', {
        description: message,
      });
    }
  };

  const handleCoverReset = () => {
    setCoverLetterValue(lastSavedCoverLetter);
  };

  const handleCoverSave = async () => {
    if (!coverHasContent) {
      toast.error('Bitte fülle das Anschreiben aus oder nutze die Generierung.');
      return;
    }

    try {
      const updated = await upsertCoverLetter.mutateAsync({ content: coverLetterValue });
      const sanitized = updated.coverLetterText || '';
      
      // Use startTransition to batch state updates and prevent intermediate "changes detected" state
      startTransition(() => {
        setCoverLetterValue(sanitized);
        setLastSavedCoverLetter(sanitized);
        setCoverVersion(sanitized);
        setCoverInitialized(true);
      });
      
      toast.success('Anschreiben gespeichert');
    } catch (err) {
      console.error('Cover letter save failed', err);
      toast.error('Anschreiben konnte nicht gespeichert werden');
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      const trimmed = instructions.trim();
      const updated = await upsertCoverLetter.mutateAsync({
        instructions: trimmed ? trimmed : undefined,
        regenerate: true,
      });
      
      // Convert LLM output (Markdown) to Tiptap-compatible HTML
      const sanitized = toTiptapHtml(updated.coverLetterText || '');
      
      // Use startTransition to batch state updates
      startTransition(() => {
        setCoverLetterValue(sanitized);
        setLastSavedCoverLetter(sanitized);
        setCoverVersion(sanitized);
        setCoverInitialized(true);
      });
      
      toast.success('Anschreiben generiert');
    } catch (err) {
      console.error('Cover letter generation failed', err);
      toast.error('Anschreiben konnte nicht generiert werden');
    }
  };

  if (isLoading) {
    return <CenteredLoader message="Lädt Bewerbungsdaten..." />;
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Bewerbungen
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Editor nicht verfügbar</CardTitle>
            <CardDescription>Die Bewerbung konnte nicht geladen werden.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isSaveDisabled = !parsedResume || updateResume.isPending;
  const coverMutationPending = upsertCoverLetter.isPending;
  const isCoverSaveDisabled = !coverHasContent || coverMutationPending;
  
  // Check if data exists in the application (saved data), not just in editor state
  const hasSavedResume = application?.resumeText && application.resumeText.trim().length > 0;
  const hasSavedCoverLetter = application?.coverLetterText && stripHtml(application.coverLetterText).trim().length > 0;
  
  // Cover letter is only required if it was generated (coverLetterText exists)
  // If user opted out of cover letter generation, we don't require it for export
  const coverLetterWasGenerated = application?.coverLetterText !== null && application?.coverLetterText !== undefined;
  
  const exportDisabledReason = (() => {
    if (application.status === 'GENERATING') {
      return 'Export läuft bereits. Bitte warte auf den Abschluss.';
    }
    if (hasResumeChanges) {
      return 'Speichere deinen Lebenslauf, bevor du exportierst.';
    }
    if (coverLetterWasGenerated && hasCoverChanges) {
      return 'Speichere dein Anschreiben, bevor du exportierst.';
    }
    // Check if we have resume data saved in the database
    if (!hasSavedResume) {
      return 'Lebenslauf fehlt. Bitte fülle die Daten aus und speichere.';
    }
    // Only require cover letter if it was generated
    if (coverLetterWasGenerated && !hasSavedCoverLetter) {
      return 'Anschreiben fehlt. Bitte erstelle oder generiere ein Anschreiben.';
    }
    return null;
  })();
  const canExport = !exportDisabledReason && !exportApplication.isPending;

  const handleExport = async () => {
    if (!canExport) return;
    try {
      await exportApplication.mutateAsync();
      // Navigate to detail page after successful export initiation
      toast.success('Export gestartet! Du wirst zur Detailseite weitergeleitet...');
      setTimeout(() => {
        router.push(`/applications/${applicationId}`);
      }, 1500);
    } catch (err) {
      console.error('Export konnte nicht gestartet werden', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/applications/${applicationId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Bewerbung
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Unterlagen anpassen</h1>
            {statusBadge}
          </div>
          <p className="text-sm text-muted-foreground">
            Passe deinen Lebenslauf als JSON an, generiere das Anschreiben mit KI und exportiere danach beide PDFs.
          </p>
          {application.jobPosting && (
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {application.jobPosting.title}
              </span>
              {application.jobPosting.company && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  {application.jobPosting.company}
                </span>
              )}
              {application.jobPosting.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {application.jobPosting.location}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'resume' | 'cover-letter')}
        defaultValue="resume"
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="resume">Lebenslauf</TabsTrigger>
          {coverLetterWasGenerated && (
            <TabsTrigger value="cover-letter">Anschreiben</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="resume" className="space-y-6 focus-visible:outline-none">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleResumeReset} disabled={!hasResumeChanges || updateResume.isPending}>
              Änderungen verwerfen
            </Button>
            <Button onClick={handleResumeSave} disabled={isSaveDisabled}>
              {updateResume.isPending ? 'Speichert...' : 'Speichern'}
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,580px)]">
            {/* Form Editor - Scrollable independently */}
            <div className="h-[calc(100vh-280px)] overflow-y-auto pr-4">
              <div className="space-y-6">
                {parsedResume && (
                  <ResumeFormEditor
                    value={parsedResume}
                    onChange={(resume) => setParsedResume(resume)}
                    disabled={updateResume.isPending}
                  />
                )}
              </div>
            </div>

            {/* Live Preview - Scrollable independently, sticky container */}
            <div className="sticky top-6 h-[calc(100vh-280px)]">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Live-Vorschau</CardTitle>
                  <CardDescription>A4-Format Vorschau mit gewähltem Template</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto overflow-x-hidden">
                  {parsedResume && (
                    <div className="w-full">
                      <ResumeTemplatePreview 
                        resume={parsedResume} 
                        templateId={application?.resumeTemplateId}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {coverLetterWasGenerated && (
          <TabsContent value="cover-letter" className="space-y-6 focus-visible:outline-none">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCoverReset} disabled={!hasCoverChanges || coverMutationPending}>
                Änderungen verwerfen
              </Button>
              <Button onClick={handleCoverSave} disabled={isCoverSaveDisabled}>
                {coverMutationPending ? 'Speichert...' : 'Speichern'}
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,580px)]">
              {/* Editor - Scrollable independently */}
              <div className="h-[calc(100vh-280px)] overflow-y-auto pr-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Anschreiben bearbeiten</CardTitle>
                    <CardDescription>Bearbeite das Anschreiben direkt im Editor. Die Anrede und Schlussformel sind Teil des Textes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Hinweise für die Generierung (optional)</label>
                      <Textarea
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        placeholder="Betone Azure-Projekte, Wunsch nach Remote-Setup, gewünschter Ton etc."
                        rows={4}
                        disabled={coverMutationPending}
                      />
                      <Button variant="outline" size="sm" onClick={handleGenerateCoverLetter} disabled={coverMutationPending} className="w-full">
                        {coverMutationPending ? 'Generiere...' : 'Mit KI generieren'}
                      </Button>
                    </div>
                    <CoverLetterEditor value={coverLetterValue} onChange={setCoverLetterValue} disabled={coverMutationPending} />
                    <p className="text-xs text-muted-foreground">
                      Der Editor enthält den kompletten Briefinhalt inkl. Anrede und Schlussformel. Dein Name wird automatisch als Unterschrift hinzugefügt.
                    </p>
                  </CardContent>
              </Card>
            </div>

            {/* Live Preview - Scrollable independently, sticky container */}
            <div className="sticky top-6 h-[calc(100vh-280px)]">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Live-Vorschau</CardTitle>
                  <CardDescription>A4-Format Vorschau mit gewähltem Template</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="w-full">
                    <CoverLetterTemplatePreview 
                      html={coverLetterValue}
                      candidateName={parsedResume?.candidateName}
                      email={parsedResume?.email}
                      phone={parsedResume?.phone}
                      location={parsedResume?.location}
                      linkedin={parsedResume?.linkedin}
                      github={parsedResume?.github}
                      companyName={application?.jobPosting?.company}
                      templateId={application?.coverLetterTemplateId}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        )}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>PDF Export</CardTitle>
          <CardDescription>
            Starte die Generierung, sobald Lebenslauf und Anschreiben angepasst sind. Der Prozess lädt beide PDFs in den
            Hintergrund.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Aktueller Status:{' '}
              <span className="font-semibold text-slate-900">{STATUS_LABELS[application.status] || application.status}</span>
            </p>
            {exportDisabledReason ? (
              <p className="text-sm text-destructive">{exportDisabledReason}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Alle Voraussetzungen erfüllt – Export kann gestartet werden.</p>
            )}
            {application.status === 'READY' && (
              <p className="text-xs text-muted-foreground">
                Download verfügbar in der Detailansicht oder per Direktlink aus der Übersicht.
              </p>
            )}
          </div>
          <Button onClick={handleExport} disabled={!canExport} className="min-w-[220px]">
            {exportApplication.isPending || application.status === 'GENERATING' ? (
              'Export wird vorbereitet...'
            ) : (
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDF Export starten
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
