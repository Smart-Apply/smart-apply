'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Sparkles,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CenteredLoader } from '@/components/shared/loading';
import {
  ResumeTemplatePreview,
  CoverLetterTemplatePreview,
} from '@/components/applications/template-preview';
import { ATSScoreSidebar } from '@/components/applications/ats-score-sidebar';
import { AiAssistantPopover } from '@/components/ui/ai-assistant-popover';
import { LanguageSelector } from '@/components/applications/language-selector';
import {
  useApplication,
  useExportApplication,
  useUpdateApplicationResume,
  useUpsertCoverLetter,
  useGenerateSummary,
  useGenerateExperienceDescription,
  useGenerateProjectDescription,
} from '@/hooks/use-applications';
import { parseResumeDraft, normalizeResumeForSave } from '@/lib/resume';
import type { ResumeData } from '@/types';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { stripHtml } from '@/lib/sanitize';
import { toTiptapHtml } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamic imports for heavy Tiptap-based editors (saves ~200KB)
// Only loaded when user navigates to edit page
const ResumeFormEditor = dynamic(
  () =>
    import('@/components/applications/resume-form-editor').then((mod) => ({
      default: mod.ResumeFormEditor,
    })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  },
);

const CoverLetterEditor = dynamic(
  () =>
    import('@/components/applications/cover-letter-editor').then((mod) => ({
      default: mod.CoverLetterEditor,
    })),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  },
);

/**
 * Normalize HTML to ensure consistent comparison.
 * Tiptap may format HTML differently than the input.
 */
function normalizeHtml(html: string): string {
  if (!html) return '';
  // Remove extra whitespace between tags and normalize
  return html.trim().replace(/>\s+</g, '><');
}

const EMPTY_RESUME: ResumeData = {
  candidateName: 'Vorname Nachname',
  email: 'du@example.com',
  phone: '',
  street: '',
  postalCode: '',
  city: '',
  country: '',
  fullAddress: '',
  linkedin: '',
  github: '',
  summary: '',
  skillCategories: [],
  experiences: [],
  projects: [],
  education: [],
  certifications: [],
};

export default function ApplicationResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const { data: application, isLoading, error } = useApplication(applicationId);
  const updateResume = useUpdateApplicationResume(applicationId);
  const generateSummary = useGenerateSummary(applicationId);
  const generateExperienceDescription = useGenerateExperienceDescription(applicationId);
  const generateProjectDescription = useGenerateProjectDescription(applicationId);

  // Track which experience entry is loading AI generation
  const [experienceAiLoadingIndex, setExperienceAiLoadingIndex] = useState<number>(-1);
  // Track which project entry is loading AI generation
  const [projectAiLoadingIndex, setProjectAiLoadingIndex] = useState<number>(-1);

  const [parsedResume, setParsedResume] = useState<ResumeData | null>(null);
  const [lastSavedResume, setLastSavedResume] = useState<ResumeData | null>(null);
  const [resumeInitialized, setResumeInitialized] = useState(false);
  const [resumeVersion, setResumeVersion] = useState<string | null>(null);

  const [coverLetterValue, setCoverLetterValue] = useState('');
  const [lastSavedCoverLetter, setLastSavedCoverLetter] = useState('');
  const [coverInitialized, setCoverInitialized] = useState(false);
  const [coverVersion, setCoverVersion] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [activeTab, setActiveTab] = useState<'resume' | 'cover-letter' | 'ats-score'>('resume');
  const [selectedLanguage, setSelectedLanguage] = useState<'de' | 'en' | 'fr' | 'es' | 'it'>('de');
  const [languageInitialized, setLanguageInitialized] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);

  // Trigger ATS score refresh after saving
  const [atsRefreshTrigger, setAtsRefreshTrigger] = useState(0);

  // Target job title state (for Stellendetails section)
  const [targetJobTitle, setTargetJobTitle] = useState<string>('');
  const [targetJobTitleInitialized, setTargetJobTitleInitialized] = useState(false);
  const queryClient = useQueryClient();

  const upsertCoverLetter = useUpsertCoverLetter(applicationId);
  const exportApplication = useExportApplication(applicationId);
  const resumeText = application?.resumeText ?? null;
  const coverLetterText = application ? (application.coverLetterText ?? '') : null;

  // Mutation for updating target job title
  const updateTargetJobTitleMutation = useMutation({
    mutationFn: (newTitle: string) => api.applications.updateTargetJobTitle(applicationId, newTitle),
    onSuccess: (updatedApp) => {
      queryClient.setQueryData(['applications', applicationId], updatedApp);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Zielposition aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  // Initialize target job title from application
  useEffect(() => {
    if (application && !targetJobTitleInitialized) {
      setTargetJobTitle(application.targetJobTitle || application.jobPosting?.title || '');
      setTargetJobTitleInitialized(true);
    }
  }, [application, targetJobTitleInitialized]);

  // Save target job title on blur
  const handleTargetJobTitleSave = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length >= 2 && trimmedTitle.length <= 100) {
      updateTargetJobTitleMutation.mutate(trimmedTitle);
    }
  }, [updateTargetJobTitleMutation]);

  // Initialize language from application when it loads
  useEffect(() => {
    if (application?.language && !languageInitialized) {
      const lang = application.language as 'de' | 'en' | 'fr' | 'es' | 'it';
      if (['de', 'en', 'fr', 'es', 'it'].includes(lang)) {
        setSelectedLanguage(lang);
      }
      setLanguageInitialized(true);
    }
  }, [application?.language, languageInitialized]);

  const hasResumeChanges = JSON.stringify(parsedResume) !== JSON.stringify(lastSavedResume);
  const hasCoverChanges = normalizeHtml(coverLetterValue) !== normalizeHtml(lastSavedCoverLetter);
  const coverHasContent = stripHtml(coverLetterValue).trim().length > 0;

  // Debug state to identify false positives
  useEffect(() => {
    console.log('📊 Resume State:', {
      hasResumeChanges,
      currentKeys: parsedResume ? Object.keys(parsedResume).length : 0,
      savedKeys: lastSavedResume ? Object.keys(lastSavedResume).length : 0,
      currentJSON: JSON.stringify(parsedResume)?.substring(0, 100),
      savedJSON: JSON.stringify(lastSavedResume)?.substring(0, 100),
    });
  }, [parsedResume, lastSavedResume, hasResumeChanges]);

  useEffect(() => {
    console.log('📊 Cover Letter State:', {
      hasCoverChanges,
      valueLength: coverLetterValue?.length || 0,
      savedLength: lastSavedCoverLetter?.length || 0,
      normalizedValueLength: normalizeHtml(coverLetterValue)?.length || 0,
      normalizedSavedLength: normalizeHtml(lastSavedCoverLetter)?.length || 0,
      areEqual: coverLetterValue === lastSavedCoverLetter,
      normalizedAreEqual: normalizeHtml(coverLetterValue) === normalizeHtml(lastSavedCoverLetter),
      valuePreview: coverLetterValue?.substring(0, 50),
      savedPreview: lastSavedCoverLetter?.substring(0, 50),
    });
  }, [coverLetterValue, lastSavedCoverLetter, hasCoverChanges]);

  // Handle tab switching with unsaved changes warning
  const handleTabChange = (newTab: 'resume' | 'cover-letter' | 'ats-score') => {
    // Allow free tab switching - no confirmation dialogs
    setActiveTab(newTab);
  };

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
      // CRITICAL: Set both to the exact same reference, not clones
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
      // CRITICAL: Set both to the exact same value
      setCoverLetterValue(incoming);
      setLastSavedCoverLetter(incoming);
      setCoverVersion(incoming);
      setCoverInitialized(true);
    });
  }, [coverLetterText, coverInitialized, coverVersion, hasCoverChanges]);

  const handleResumeReset = () => {
    if (lastSavedResume) {
      setParsedResume({ ...lastSavedResume });
    }
  };

  const handleResumeSave = async () => {
    if (!parsedResume) return;

    try {
      const normalized = normalizeResumeForSave(parsedResume);
      // Pass the current viewing language so backend knows what language the content is in
      await updateResume.mutateAsync({ resume: normalized, contentLanguage: selectedLanguage });

      // Simply mark the current state as saved - no complex re-parsing
      setLastSavedResume(normalized);
      setParsedResume(normalized);
      toast.success('Lebenslauf gespeichert');
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
      await upsertCoverLetter.mutateAsync({ content: coverLetterValue });

      // Simply mark current state as saved
      setLastSavedCoverLetter(coverLetterValue);
      toast.success('Anschreiben gespeichert');
      setAtsRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Cover letter save failed', err);
      toast.error('Anschreiben konnte nicht gespeichert werden');
    }
  };



  const handleApplyAIChanges = async () => {
    if (!instructions.trim()) {
      toast.error('Bitte gib Anweisungen für die AI ein');
      return;
    }

    console.log('🔵 Starting AI changes...');
    console.log('📝 Current editor content length:', coverLetterValue?.length || 0);
    console.log('💡 Instructions:', instructions.trim());

    try {
      // If there's existing content in editor, send it as base for modifications
      const currentContent =
        coverLetterValue && stripHtml(coverLetterValue).trim().length > 0
          ? coverLetterValue
          : undefined;

      console.log('📤 Sending to API:', {
        hasContent: !!currentContent,
        contentLength: currentContent?.length || 0,
        instructionsLength: instructions.trim().length,
      });

      const updated = await upsertCoverLetter.mutateAsync({
        instructions: instructions.trim(),
        content: currentContent,
        regenerate: true, // Always regenerate with instructions
      });

      console.log('📥 Received from API:', {
        hasCoverLetterText: !!updated.coverLetterText,
        coverLetterTextLength: updated.coverLetterText?.length || 0,
        coverLetterTextPreview: updated.coverLetterText?.substring(0, 100),
      });

      if (!updated.coverLetterText) {
        throw new Error('Keine Antwort vom Server erhalten');
      }

      // Convert LLM output (Markdown) to Tiptap-compatible HTML
      const sanitized = toTiptapHtml(updated.coverLetterText);

      console.log('🔄 Converted to HTML:', {
        sanitizedLength: sanitized.length,
        sanitizedPreview: sanitized.substring(0, 100),
      });

      // Clear instructions immediately
      setInstructions('');

      // Simulate streaming effect by gradually showing content
      // Split into words and display them progressively
      const words = sanitized.split(' ');
      const totalWords = words.length;
      const wordsPerUpdate = Math.max(5, Math.floor(totalWords / 20)); // Show 5-10 words at a time
      let currentIndex = 0;

      toast.info('AI generiert Änderungen...');

      const streamInterval = setInterval(() => {
        currentIndex += wordsPerUpdate;

        if (currentIndex >= totalWords) {
          // Final update with complete content
          setCoverLetterValue(sanitized);
          setCoverVersion(sanitized);
          setCoverInitialized(true);
          clearInterval(streamInterval);

          console.log('✅ Streaming complete');
          toast.success('AI-Änderungen angewendet. Bitte speichern.');
        } else {
          // Progressive update
          const partialContent = words.slice(0, currentIndex).join(' ');
          setCoverLetterValue(partialContent + '...');
        }
      }, 50); // Update every 50ms for smooth streaming effect

      // Close popover after successful AI generation
      setAiPopoverOpen(false);
    } catch (err) {
      console.error('❌ AI generation failed', err);
      toast.error('AI-Generierung fehlgeschlagen: ' + (err as Error).message);
    }
  };

  /**
   * Handle AI summary generation for resume
   * Calls the API and applies a streaming effect to the result
   */
  const handleAiSummaryRequest = useCallback(
    async (instructions: string, currentSummary: string): Promise<string> => {
      toast.info('AI generiert Zusammenfassung...');

      const result = await generateSummary.mutateAsync({
        instructions,
        currentSummary: currentSummary || undefined,
        regenerate: true,
      });

      if (!result.summary) {
        throw new Error('Keine Zusammenfassung vom Server erhalten');
      }

      // Convert to Tiptap HTML (handles markdown formatting)
      const sanitized = toTiptapHtml(result.summary);

      toast.success('Zusammenfassung generiert. Bitte speichern.');

      return sanitized;
    },
    [generateSummary],
  );

  /**
   * Handle AI experience description generation for resume
   * Calls the API and returns HTML-formatted bullet points
   */
  const handleAiExperienceRequest = useCallback(
    async (
      instructions: string,
      experienceIndex: number,
      currentDescription: string,
      experienceTitle: string,
      experienceCompany: string,
      experienceDateRange: string,
    ): Promise<string> => {
      setExperienceAiLoadingIndex(experienceIndex);
      toast.info('AI generiert Beschreibung...');

      try {
        const result = await generateExperienceDescription.mutateAsync({
          instructions,
          experienceIndex,
          currentDescription: currentDescription || undefined,
          experienceTitle,
          experienceCompany,
          experienceDateRange: experienceDateRange || undefined,
          regenerate: true,
        });

        if (!result.description) {
          throw new Error('Keine Beschreibung vom Server erhalten');
        }

        toast.success('Beschreibung generiert. Bitte speichern.');

        return result.description;
      } finally {
        setExperienceAiLoadingIndex(-1);
      }
    },
    [generateExperienceDescription],
  );

  /**
   * Handle AI project description generation for resume
   * Calls the API and returns HTML-formatted bullet points
   */
  const handleAiProjectRequest = useCallback(
    async (
      instructions: string,
      projectIndex: number,
      currentDescription: string,
      projectName: string,
      projectDate: string,
    ): Promise<string> => {
      setProjectAiLoadingIndex(projectIndex);
      toast.info('AI generiert Beschreibung...');

      try {
        const result = await generateProjectDescription.mutateAsync({
          instructions,
          projectIndex,
          currentDescription: currentDescription || undefined,
          projectName,
          projectDate: projectDate || undefined,
          regenerate: true,
        });

        if (!result.description) {
          throw new Error('Keine Beschreibung vom Server erhalten');
        }

        toast.success('Beschreibung generiert. Bitte speichern.');

        return result.description;
      } finally {
        setProjectAiLoadingIndex(-1);
      }
    },
    [generateProjectDescription],
  );

  // Keyboard shortcut: Cmd/Ctrl+S to save
  const handleKeyboardSave = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab === 'resume' && hasResumeChanges && !updateResume.isPending) {
          handleResumeSave();
        } else if (
          activeTab === 'cover-letter' &&
          hasCoverChanges &&
          !upsertCoverLetter.isPending
        ) {
          handleCoverSave();
        }
      }
    },
    [
      activeTab,
      hasResumeChanges,
      hasCoverChanges,
      updateResume.isPending,
      upsertCoverLetter.isPending,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardSave);
    return () => document.removeEventListener('keydown', handleKeyboardSave);
  }, [handleKeyboardSave]);

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

  const isSaveDisabled = !parsedResume || updateResume.isPending || !hasResumeChanges;
  const coverMutationPending = upsertCoverLetter.isPending;
  const isCoverSaveDisabled = !coverHasContent || coverMutationPending || !hasCoverChanges;

  // Check if data exists in the application (saved data), not just in editor state
  const hasSavedResume = application?.resumeText && application.resumeText.trim().length > 0;
  const hasSavedCoverLetter =
    application?.coverLetterText && stripHtml(application.coverLetterText).trim().length > 0;

  // Cover letter is only required if it was generated (coverLetterText exists)
  // If user opted out of cover letter generation, we don't require it for export
  const coverLetterWasGenerated =
    application?.coverLetterText !== null && application?.coverLetterText !== undefined;

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
      await exportApplication.mutateAsync(selectedLanguage);
      // Navigate to detail page after successful export initiation
      toast.success('Export gestartet! Du wirst zur Detailseite weitergeleitet...');
      setTimeout(() => {
        router.push(`/applications/${applicationId}`);
      }, 1500);
    } catch (err) {
      console.error('Export konnte nicht gestartet werden', err);
    }
  };

  // Determine current unsaved state based on active tab
  const hasCurrentTabChanges =
    activeTab === 'resume'
      ? hasResumeChanges
      : activeTab === 'cover-letter'
        ? hasCoverChanges
        : false;
  const isCurrentTabSaving =
    activeTab === 'resume'
      ? updateResume.isPending
      : activeTab === 'cover-letter'
        ? coverMutationPending
        : false;

  const handleCurrentTabSave = () => {
    if (activeTab === 'resume') {
      handleResumeSave();
    } else if (activeTab === 'cover-letter') {
      handleCoverSave();
    }
  };

  const handleCurrentTabReset = () => {
    if (activeTab === 'resume') {
      handleResumeReset();
    } else if (activeTab === 'cover-letter') {
      handleCoverReset();
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-2rem)] animate-in fade-in duration-300">
        {/* Compact Toolbar */}
        <div className="flex items-center justify-between gap-4 px-2 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
          {/* Left: Back */}
          <div className="flex items-center gap-4 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/applications/${applicationId}`)}
                  className="shrink-0 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zurück zur Übersicht</TooltipContent>
            </Tooltip>
          </div>

          {/* Center: Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              handleTabChange(value as 'resume' | 'cover-letter' | 'ats-score')
            }
            className="shrink-0"
          >
            <TabsList className="bg-muted/50 h-8">
              <TabsTrigger
                value="resume"
                className="text-xs px-3 h-7 data-[state=active]:bg-background"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Lebenslauf
              </TabsTrigger>
              {coverLetterWasGenerated && (
                <TabsTrigger
                  value="cover-letter"
                  className="text-xs px-3 h-7 data-[state=active]:bg-background"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Anschreiben
                </TabsTrigger>
              )}
              <TabsTrigger
                value="ats-score"
                className="text-xs px-3 h-7 data-[state=active]:bg-background"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                ATS Score
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right: Status + Language + Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Unsaved indicator */}
            {activeTab !== 'ats-score' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full transition-colors',
                        hasCurrentTabChanges ? 'bg-orange-500' : 'bg-green-500',
                      )}
                    />
                    <span className="hidden xl:inline">
                      {hasCurrentTabChanges ? 'Ungespeichert' : 'Gespeichert'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {hasCurrentTabChanges
                    ? 'Änderungen nicht gespeichert (⌘S)'
                    : 'Alle Änderungen gespeichert'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Language indicator (read-only) */}
            <LanguageSelector value={selectedLanguage} />

            <div className="h-5 w-px bg-border/50" />

            {/* Reset button */}
            {activeTab !== 'ats-score' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCurrentTabReset}
                    disabled={!hasCurrentTabChanges || isCurrentTabSaving}
                    className="h-8 px-2 text-xs"
                  >
                    Zurücksetzen
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Änderungen verwerfen</TooltipContent>
              </Tooltip>
            )}

            {/* Save button */}
            {activeTab !== 'ats-score' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <SubmitButton
                      onClick={handleCurrentTabSave}
                      isLoading={isCurrentTabSaving}
                      loadingText="..."
                      disabled={!hasCurrentTabChanges || isCurrentTabSaving}
                      size="sm"
                      className="h-8 px-3 text-xs"
                    >
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Speichern
                    </SubmitButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!hasCurrentTabChanges ? 'Keine Änderungen' : 'Speichern (⌘S)'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Export button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <SubmitButton
                    onClick={handleExport}
                    isLoading={exportApplication.isPending || application.status === 'GENERATING'}
                    loadingText="..."
                    disabled={!canExport}
                    size="sm"
                    variant={canExport ? 'default' : 'outline'}
                    className="h-8 px-3 text-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export
                  </SubmitButton>
                </span>
              </TooltipTrigger>
              <TooltipContent>{exportDisabledReason || 'PDFs exportieren'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Content Area - Full Height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Resume Tab */}
          {activeTab === 'resume' && (
            <div className="grid grid-cols-2 gap-4 h-full p-4">
              {/* Form Editor */}
              <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
                <div className="space-y-6 pb-6">
                  {parsedResume && (
                    <ResumeFormEditor
                      value={parsedResume}
                      onChange={(resume) => setParsedResume(resume)}
                      disabled={updateResume.isPending}
                      applicationId={applicationId}
                      targetJobTitle={targetJobTitle}
                      company={application?.jobPosting?.company}
                      onTargetJobTitleChange={setTargetJobTitle}
                      onTargetJobTitleBlur={handleTargetJobTitleSave}
                      isTargetJobTitleLoading={updateTargetJobTitleMutation.isPending}
                      onAiSummaryRequest={handleAiSummaryRequest}
                      isAiSummaryLoading={generateSummary.isPending}
                      onAiExperienceRequest={handleAiExperienceRequest}
                      experienceAiLoadingIndex={experienceAiLoadingIndex}
                      onAiProjectRequest={handleAiProjectRequest}
                      projectAiLoadingIndex={projectAiLoadingIndex}
                    />
                  )}
                </div>
              </div>

              {/* Live Preview */}
              <div className="h-full overflow-auto bg-gray-100 dark:bg-gray-900 rounded-lg shadow-inner">
                {parsedResume && (
                  <ResumeTemplatePreview
                    resume={{
                      ...parsedResume,
                      targetJobTitle: targetJobTitle || application?.jobPosting?.title,
                    }}
                    templateId={application?.resumeTemplateId}
                    language={selectedLanguage}
                  />
                )}
              </div>
            </div>
          )}

          {/* Cover Letter Tab */}
          {activeTab === 'cover-letter' && coverLetterWasGenerated && (
            <div className="grid grid-cols-2 gap-4 h-full p-4">
              {/* Editor */}
              <div className="h-full overflow-y-auto pr-2 scrollbar-thin">
                <Card className="shadow-soft border-border/50 h-full flex flex-col">
                  <CardHeader className="pb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Anschreiben bearbeiten</CardTitle>
                        <CardDescription className="text-xs">
                          Bearbeite den Text direkt oder nutze den AI-Assistenten.
                        </CardDescription>
                      </div>
                      {/* AI Assistant Popover Button */}
                      <AiAssistantPopover
                        open={aiPopoverOpen}
                        onOpenChange={setAiPopoverOpen}
                        instructions={instructions}
                        onInstructionsChange={setInstructions}
                        onApply={handleApplyAIChanges}
                        isLoading={coverMutationPending}
                        placeholder="Z.B.: Betone meine React-Erfahrung stärker..."
                        title="AI-Anweisungen"
                        description="Beschreibe, wie das Anschreiben angepasst werden soll."
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-auto">
                      <CoverLetterEditor
                        value={coverLetterValue}
                        onChange={setCoverLetterValue}
                        disabled={coverMutationPending}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pt-3 border-t mt-3">
                      Dein Name wird automatisch als Unterschrift hinzugefügt.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview */}
              <div className="h-full overflow-auto bg-gray-100 dark:bg-gray-900 rounded-lg shadow-inner">
                <CoverLetterTemplatePreview
                  html={coverLetterValue}
                  candidateName={parsedResume?.candidateName}
                  email={parsedResume?.email}
                  phone={parsedResume?.phone}
                  fullAddress={parsedResume?.fullAddress}
                  linkedin={parsedResume?.linkedin}
                  github={parsedResume?.github}
                  companyName={application?.jobPosting?.company}
                  templateId={application?.coverLetterTemplateId}
                  language={selectedLanguage}
                />
              </div>
            </div>
          )}

          {/* ATS Score Tab */}
          {activeTab === 'ats-score' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="max-w-4xl mx-auto">
                <ATSScoreSidebar applicationId={applicationId} refreshTrigger={atsRefreshTrigger} />
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
