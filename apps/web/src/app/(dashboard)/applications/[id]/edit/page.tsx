'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, MapPin, Sparkles, FileText, Save, RefreshCw, CheckCircle2, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CenteredLoader } from '@/components/shared/loading';
import { ResumeFormEditor } from '@/components/applications/resume-form-editor';
import { CoverLetterEditor } from '@/components/applications/cover-letter-editor';
import { ResumeTemplatePreview, CoverLetterTemplatePreview } from '@/components/applications/template-preview';
import { ATSScoreSidebar } from '@/components/applications/ats-score-sidebar';
import { useApplication, useExportApplication, useUpdateApplicationResume, useUpsertCoverLetter } from '@/hooks/use-applications';
import { parseResumeDraft, normalizeResumeForSave } from '@/lib/resume';
import type { ResumeData } from '@/types';
import { toast } from 'sonner';
import { stripHtml } from '@/lib/sanitize';
import { toTiptapHtml } from '@/lib/markdown';
import { cn } from '@/lib/utils';

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
  OFFER: 'Angebot',
  WITHDRAWN: 'Zurückgezogen',
  REJECTED: 'Abgelehnt',
  INTERVIEW: 'Interview',
  APPLIED: 'Beworben',
};

const STATUS_COLORS: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className?: string }> = {
  PENDING: { variant: 'secondary' },
  GENERATING: { variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  READY: { variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  FAILED: { variant: 'destructive' },
  OFFER: { variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  WITHDRAWN: { variant: 'outline', className: 'text-muted-foreground' },
  REJECTED: { variant: 'destructive' },
  INTERVIEW: { variant: 'secondary', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  APPLIED: { variant: 'default' },
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

  // Trigger ATS score refresh after saving
  const [atsRefreshTrigger, setAtsRefreshTrigger] = useState(0);

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
    const config = STATUS_COLORS[application.status] || { variant: 'outline' };

    return (
      <Badge variant={config.variant} className={cn("text-sm font-medium px-2.5 py-0.5", config.className)}>
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
      // Trigger ATS score refresh after saving
      setAtsRefreshTrigger((prev) => prev + 1);
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
        <Card className="shadow-soft border-border/50">
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/applications/${applicationId}`)} className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Button>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Unterlagen anpassen</h1>
              {statusBadge}
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Passe deinen Lebenslauf und dein Anschreiben an, bevor du die finalen PDFs exportierst.
            </p>
          </div>

          {application.jobPosting && (
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-foreground/80">
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{application.jobPosting.title}</span>
              </div>
              {application.jobPosting.company && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-foreground/80">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>{application.jobPosting.company}</span>
                </div>
              )}
              {application.jobPosting.location && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-foreground/80">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{application.jobPosting.location}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Card - Compact */}
        <Card className="w-full md:w-auto min-w-[300px] shadow-soft border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">PDF Export</p>
                <p className="text-xs text-muted-foreground">
                  {exportDisabledReason ? (
                    <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Aktion erforderlich
                    </span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Bereit zum Export
                    </span>
                  )}
                </p>
              </div>
              <Button onClick={handleExport} disabled={!canExport} size="sm" className="shadow-sm">
                {exportApplication.isPending || application.status === 'GENERATING' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exportieren
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'resume' | 'cover-letter')}
        defaultValue="resume"
        className="space-y-6"
      >
        <div className="border-b border-border/50">
          <TabsList className="bg-transparent p-0 h-auto gap-6">
            <TabsTrigger
              value="resume"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" />
              Lebenslauf
            </TabsTrigger>
            {coverLetterWasGenerated && (
              <TabsTrigger
                value="cover-letter"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-4 w-4 mr-2" />
                Anschreiben
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="resume" className="space-y-6 focus-visible:outline-none mt-0">
          <div className="flex flex-wrap items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={cn("h-2 w-2 rounded-full", hasResumeChanges ? "bg-orange-500" : "bg-green-500")} />
              {hasResumeChanges ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleResumeReset} disabled={!hasResumeChanges || updateResume.isPending}>
                Zurücksetzen
              </Button>
              <Button onClick={handleResumeSave} disabled={isSaveDisabled} size="sm" className="shadow-sm">
                {updateResume.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Speichern
              </Button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,580px)_280px] lg:grid-cols-[minmax(0,1fr)_minmax(380px,580px)]">
            {/* Form Editor - Scrollable independently */}
            <div className="h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin">
              <div className="space-y-6 pb-10">
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
              <Card className="h-full flex flex-col shadow-soft border-border/50 overflow-hidden bg-muted/30">
                <CardHeader className="flex-shrink-0 bg-card border-b border-border/50 py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-base">Vorschau</CardTitle>
                      <CardDescription className="text-xs">A4-Format</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-normal">
                      Live Preview
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-muted/30 scrollbar-thin">
                  {parsedResume && (
                    <div className="w-full shadow-lg mx-auto max-w-[210mm] bg-white min-h-[297mm]">
                      <ResumeTemplatePreview
                        resume={parsedResume}
                        templateId={application?.resumeTemplateId}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ATS Score Sidebar - Only visible on xl screens */}
            <div className="hidden xl:block sticky top-6 h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
              <ATSScoreSidebar
                applicationId={applicationId}
                refreshTrigger={atsRefreshTrigger}
              />
            </div>
          </div>

          {/* ATS Score Card - Visible on smaller screens (below xl) */}
          <div className="xl:hidden">
            <ATSScoreSidebar
              applicationId={applicationId}
              refreshTrigger={atsRefreshTrigger}
            />
          </div>
        </TabsContent>

        {coverLetterWasGenerated && (
          <TabsContent value="cover-letter" className="space-y-6 focus-visible:outline-none mt-0">
            <div className="flex flex-wrap items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={cn("h-2 w-2 rounded-full", hasCoverChanges ? "bg-orange-500" : "bg-green-500")} />
                {hasCoverChanges ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert"}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCoverReset} disabled={!hasCoverChanges || coverMutationPending}>
                  Zurücksetzen
                </Button>
                <Button onClick={handleCoverSave} disabled={isCoverSaveDisabled} size="sm" className="shadow-sm">
                  {coverMutationPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Speichern
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,580px)]">
              {/* Editor - Scrollable independently */}
              <div className="h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin">
                <Card className="shadow-soft border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Anschreiben bearbeiten</CardTitle>
                    <CardDescription>Bearbeite das Anschreiben direkt im Editor oder generiere es neu.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        KI-Generierung (Optional)
                      </label>
                      <Textarea
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        placeholder="Z.B.: Betone meine Erfahrung mit React und meinen Wunsch nach Remote-Arbeit..."
                        rows={3}
                        disabled={coverMutationPending}
                        className="resize-none bg-background"
                      />
                      <Button variant="secondary" size="sm" onClick={handleGenerateCoverLetter} disabled={coverMutationPending} className="w-full">
                        {coverMutationPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
                        Neu generieren
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Inhalt</label>
                      <CoverLetterEditor value={coverLetterValue} onChange={setCoverLetterValue} disabled={coverMutationPending} />
                      <p className="text-xs text-muted-foreground mt-2">
                        Der Editor enthält den kompletten Briefinhalt inkl. Anrede und Schlussformel. Dein Name wird automatisch als Unterschrift hinzugefügt.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview - Scrollable independently, sticky container */}
              <div className="sticky top-6 h-[calc(100vh-280px)]">
                <Card className="h-full flex flex-col shadow-soft border-border/50 overflow-hidden bg-muted/30">
                  <CardHeader className="flex-shrink-0 bg-card border-b border-border/50 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <CardTitle className="text-base">Vorschau</CardTitle>
                        <CardDescription className="text-xs">A4-Format</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        Live Preview
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-muted/30 scrollbar-thin">
                    <div className="w-full shadow-lg mx-auto max-w-[210mm] bg-white min-h-[297mm]">
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
    </div>
  );
}
