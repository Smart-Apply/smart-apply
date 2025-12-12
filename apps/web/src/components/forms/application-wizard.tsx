'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CenteredLoader } from '@/components/shared/loading';
import { useProfile } from '@/hooks/use-profile';
import { useJobPostings } from '@/hooks/use-job-postings';
import { useCreateApplicationWithGeneration } from '@/hooks/use-applications';
import { useCoverLetterTemplates, useResumeTemplates, getDefaultTemplate } from '@/hooks/use-templates';
import { TemplateCard } from '@/components/templates/template-card';
import { Check, ChevronLeft, ChevronRight, X, AlertCircle, Briefcase, User, FileText, Edit, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { JobPosting, Profile, Skill, Experience, Template } from '@/types';
import { toast } from 'sonner';
import { ApplicationLoading } from '@/components/applications/application-loading';
import { cn } from '@/lib/utils';

type WizardStep = 'profile' | 'job' | 'templates' | 'review';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: StepConfig[] = [
  {
    id: 'profile',
    title: 'Profil',
    description: 'Überprüfen',
    icon: User,
  },
  {
    id: 'job',
    title: 'Stelle',
    description: 'Auswählen',
    icon: Briefcase,
  },
  {
    id: 'templates',
    title: 'Vorlagen',
    description: 'Design',
    icon: FileText,
  },
  {
    id: 'review',
    title: 'Fertig',
    description: 'Generieren',
    icon: Sparkles,
  },
];

export function ApplicationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCoverLetterTemplateId, setSelectedCoverLetterTemplateId] = useState<string | null>(null);
  const [selectedResumeTemplateId, setSelectedResumeTemplateId] = useState<string | null>(null);
  const [generateCoverLetter, setGenerateCoverLetter] = useState<boolean>(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: jobPostings, isLoading: jobPostingsLoading } = useJobPostings();
  const createApplication = useCreateApplicationWithGeneration();

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const selectedJob = jobPostings?.find((job) => job.id === selectedJobId);

  const handleNext = () => {
    if (currentStep === 'profile') {
      if (!profile?.summary || !profile?.skills?.length) {
        toast.error('Bitte vervollständige dein Profil, bevor du fortfährst');
        return;
      }
      setCurrentStep('job');
    } else if (currentStep === 'job') {
      if (!selectedJobId) {
        toast.error('Bitte wähle eine Stellenanzeige aus');
        return;
      }
      setCurrentStep('templates');
    } else if (currentStep === 'templates') {
      // Templates are optional, we can proceed without selection (will use defaults)
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'job') {
      setCurrentStep('profile');
    } else if (currentStep === 'templates') {
      setCurrentStep('job');
    } else if (currentStep === 'review') {
      setCurrentStep('templates');
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  const handleSubmit = async () => {
    if (!selectedJobId) {
      toast.error('Keine Stellenanzeige ausgewählt');
      return;
    }

    try {
      // Create application with immediate LLM generation
      const application = await createApplication.mutateAsync({
        jobPostingId: selectedJobId,
        coverLetterTemplateId: generateCoverLetter ? (selectedCoverLetterTemplateId || undefined) : undefined,
        resumeTemplateId: selectedResumeTemplateId || undefined,
        generateCoverLetter,
      });

      // Success! Redirect to edit page
      setIsRedirecting(true);
      router.push(`/applications/${application.id}/edit`);
    } catch (error: any) {
      // Show compact toast with action button to navigate to existing application
      let message = 'Ein unbekannter Fehler ist aufgetreten';
      let applicationId: string | null = null;
      
      // Extract error message and application ID from backend
      if (error && typeof error === 'object') {
        if ('data' in error && error.data?.message) {
          message = error.data.message;
        } else if ('message' in error && error.message) {
          message = error.message;
        }
        
        // Check if backend provided the existing application ID
        if ('applicationId' in error) {
          applicationId = error.applicationId;
        } else if ('data' in error && error.data?.applicationId) {
          applicationId = error.data.applicationId;
        }
      }
      
      // Show toast with action button if we have the application ID
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
      
      console.error('Failed to create application:', error);
    }
  };

  const isProfileComplete = () => {
    return !!(profile?.summary && profile?.skills?.length);
  };

  // Show loading screen during profile/job loading
  if (profileLoading || jobPostingsLoading) {
    return <CenteredLoader message="Lädt..." />;
  }

  // Show loading screen during application creation + LLM generation
  if (createApplication.isPending || isRedirecting) {
    return <ApplicationLoading message="Bewerbung wird mit KI erstellt..." />;
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="relative mx-auto max-w-2xl">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
        <div className="relative z-10 flex justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center bg-background px-2">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground scale-110 shadow-glow"
                      : isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-xs font-semibold transition-colors duration-300",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {currentStep === 'profile' && (
          <ProfileStep profile={profile} isComplete={isProfileComplete()} />
        )}

        {currentStep === 'job' && (
          <JobStep
            jobPostings={jobPostings || []}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
        )}

        {currentStep === 'templates' && (
          <TemplateStep
            selectedCoverLetterTemplateId={selectedCoverLetterTemplateId}
            selectedResumeTemplateId={selectedResumeTemplateId}
            onSelectCoverLetterTemplate={setSelectedCoverLetterTemplateId}
            onSelectResumeTemplate={setSelectedResumeTemplateId}
            generateCoverLetter={generateCoverLetter}
            onGenerateCoverLetterChange={setGenerateCoverLetter}
          />
        )}

        {currentStep === 'review' && (
          <ReviewStep
            profile={profile}
            job={selectedJob}
            coverLetterTemplateId={selectedCoverLetterTemplateId}
            resumeTemplateId={selectedResumeTemplateId}
            generateCoverLetter={generateCoverLetter}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-border/50">
        <Button variant="ghost" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
          Abbrechen
        </Button>

        <div className="flex gap-3">
          {currentStep !== 'profile' && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
          )}

          {currentStep === 'review' ? (
            <SubmitButton
              onClick={handleSubmit}
              isLoading={createApplication.isPending}
              loadingText="Erstelle Bewerbung..."
              className="shadow-lg hover:shadow-xl transition-all"
            >
              Bewerbung erstellen
              <Sparkles className="ml-2 h-4 w-4" />
            </SubmitButton>
          ) : (
            <Button onClick={handleNext} className="shadow-md hover:shadow-lg transition-all">
              Weiter
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

interface ProfileStepProps {
  profile: Profile | undefined;
  isComplete: boolean;
}

function ProfileStep({ profile, isComplete }: ProfileStepProps) {
  const router = useRouter();
  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle>Dein Profil überprüfen</CardTitle>
        <CardDescription>
          Stelle sicher, dass dein Profil vollständig ist, um die besten Ergebnisse zu erzielen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isComplete && (
          <div className="flex items-start gap-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4 dark:bg-orange-950/20 dark:border-orange-900/50">
            <div className="rounded-full bg-orange-100 p-2 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-orange-900 dark:text-orange-300">Profil unvollständig</h4>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1 mb-3">
                Bitte vervollständige dein Profil, um fortzufahren. Füge mindestens eine
                Zusammenfassung und Skills hinzu.
              </p>
              <Button variant="outline" size="sm" onClick={() => router.push('/profile/edit')} className="border-orange-200 hover:bg-orange-100 hover:text-orange-900 dark:border-orange-800 dark:hover:bg-orange-900/50">
                <Edit className="mr-2 h-4 w-4" />
                Profil bearbeiten
              </Button>
            </div>
          </div>
        )}

        {profile && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Zusammenfassung</h3>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm leading-relaxed">
                  {profile.summary || <span className="text-muted-foreground italic">Keine Zusammenfassung vorhanden</span>}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Skills</h3>
              {profile.skills && profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill: Skill) => (
                    <Badge key={skill.id || skill.name} variant="secondary" className="px-2 py-1">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Keine Skills hinzugefügt</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Berufserfahrung</h3>
              {profile.experiences && profile.experiences.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.experiences.slice(0, 4).map((exp: Experience) => (
                    <div key={exp.id} className="p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors">
                      <p className="font-medium truncate">{exp.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{exp.company}</p>
                    </div>
                  ))}
                  {profile.experiences.length > 4 && (
                    <div className="flex items-center justify-center p-3 rounded-lg border border-dashed border-border/50 text-sm text-muted-foreground">
                      +{profile.experiences.length - 4} weitere
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Keine Berufserfahrung hinzugefügt</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface JobStepProps {
  jobPostings: JobPosting[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
}

function JobStep({ jobPostings, selectedJobId, onSelectJob }: JobStepProps) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle>Stellenanzeige wählen</CardTitle>
          <CardDescription>
            Wähle die Stelle aus, auf die du dich bewerben möchtest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/jobs')} className="shadow-sm">
              <Briefcase className="mr-2 h-4 w-4" />
              Neue Stellenanzeige hinzufügen
            </Button>
          </div>

          {jobPostings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border bg-muted/10">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Keine Stellenanzeigen gefunden</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Du hast noch keine Stellenanzeigen gespeichert.
              </p>
              <Button onClick={() => router.push('/jobs')}>
                Stellenanzeige erstellen
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {jobPostings.map((job) => (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={cn(
                    "relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                    selectedJobId === job.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border/50"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                    selectedJobId === job.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}>
                    {selectedJobId === job.id ? <Check className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground/80">{job.company}</span>
                      {job.location && (
                        <>
                          <span>•</span>
                          <span className="truncate">{job.location}</span>
                        </>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {job.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface TemplateStepProps {
  selectedCoverLetterTemplateId: string | null;
  selectedResumeTemplateId: string | null;
  onSelectCoverLetterTemplate: (id: string) => void;
  onSelectResumeTemplate: (id: string) => void;
  generateCoverLetter: boolean;
  onGenerateCoverLetterChange: (value: boolean) => void;
}

function TemplateStep({
  selectedCoverLetterTemplateId,
  selectedResumeTemplateId,
  onSelectCoverLetterTemplate,
  onSelectResumeTemplate,
  generateCoverLetter,
  onGenerateCoverLetterChange,
}: TemplateStepProps) {
  const { data: coverLetterTemplates, isLoading: coverLetterLoading } = useCoverLetterTemplates();
  const { data: resumeTemplates, isLoading: resumeLoading } = useResumeTemplates();

  // Auto-select matching cover letter template when resume template is selected
  useEffect(() => {
    if (selectedResumeTemplateId && resumeTemplates && coverLetterTemplates) {
      const selectedResume = resumeTemplates.find((t) => t.id === selectedResumeTemplateId);
      if (selectedResume) {
        // Find matching cover letter template by category
        const matchingCoverLetter = coverLetterTemplates.find(
          (t) => t.category.toLowerCase() === selectedResume.category.toLowerCase()
        );

        if (matchingCoverLetter) {
          onSelectCoverLetterTemplate(matchingCoverLetter.id);
        } else {
          // Fallback to default cover letter template
          const defaultCoverLetter = getDefaultTemplate(coverLetterTemplates);
          if (defaultCoverLetter) {
            onSelectCoverLetterTemplate(defaultCoverLetter.id);
          }
        }
      }
    }
  }, [selectedResumeTemplateId, resumeTemplates, coverLetterTemplates, onSelectCoverLetterTemplate]);

  // Auto-select default resume template on mount if nothing is selected
  useEffect(() => {
    if (!selectedResumeTemplateId && resumeTemplates) {
      const defaultTemplate = getDefaultTemplate(resumeTemplates);
      if (defaultTemplate) {
        onSelectResumeTemplate(defaultTemplate.id);
      }
    }
  }, [resumeTemplates, selectedResumeTemplateId, onSelectResumeTemplate]);

  if (coverLetterLoading || resumeLoading) {
    return <CenteredLoader message="Vorlagen werden geladen..." />;
  }

  return (
    <div className="space-y-6">
      {/* Cover Letter Generation Option */}
      <Card className="shadow-soft border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Umfang der Bewerbung</CardTitle>
          <CardDescription>
            Entscheide, welche Dokumente erstellt werden sollen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/30 border border-border/50">
            <Checkbox
              id="generateCoverLetter"
              checked={generateCoverLetter}
              onCheckedChange={(checked) => onGenerateCoverLetterChange(checked === true)}
              className="mt-1"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="generateCoverLetter"
                className="text-base font-medium cursor-pointer"
              >
                Anschreiben generieren
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Erstellt ein auf die Stelle zugeschnittenes Anschreiben. Deaktiviere dies, wenn du nur einen Lebenslauf benötigst.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume Templates */}
      <div>
        <div className="mb-4 px-1">
          <h3 className="text-lg font-semibold">Design auswählen</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Wähle eine Vorlage für deinen Lebenslauf.{generateCoverLetter && ' Das Anschreiben wird automatisch im passenden Design erstellt.'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resumeTemplates?.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedResumeTemplateId === template.id}
              onSelect={onSelectResumeTemplate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  profile: Profile | undefined;
  job?: JobPosting;
  coverLetterTemplateId: string | null;
  resumeTemplateId: string | null;
  generateCoverLetter: boolean;
}

function ReviewStep({ profile, job, coverLetterTemplateId, resumeTemplateId, generateCoverLetter }: ReviewStepProps) {
  const { data: coverLetterTemplates } = useCoverLetterTemplates();
  const { data: resumeTemplates } = useResumeTemplates();

  const selectedCoverLetterTemplate = coverLetterTemplates?.find((t) => t.id === coverLetterTemplateId);
  const selectedResumeTemplate = resumeTemplates?.find((t) => t.id === resumeTemplateId);

  return (
    <div className="space-y-6">
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
          <CardDescription>
            Überprüfe deine Angaben, bevor die Bewerbung erstellt wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Job Summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Stellenanzeige
            </h3>
            {job ? (
              <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
                <h4 className="font-semibold text-lg">{job.title}</h4>
                <div className="flex items-center gap-2 text-muted-foreground mt-1 mb-3">
                  <span className="font-medium text-foreground/80">{job.company}</span>
                  {job.location && (
                    <>
                      <span>•</span>
                      <span>{job.location}</span>
                    </>
                  )}
                </div>
                {job.description && (
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 line-clamp-3 italic">
                    &quot;{job.description}&quot;
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-sm font-medium">
                Keine Stellenanzeige ausgewählt
              </div>
            )}
          </div>

          <Separator />

          {/* Template Summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Ausgewählte Designs
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase">Lebenslauf</p>
                  <p className="font-semibold">{selectedResumeTemplate?.name || 'Standard'}</p>
                </div>
              </div>

              {generateCoverLetter ? (
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Anschreiben</p>
                    <p className="font-semibold">{selectedCoverLetterTemplate?.name || 'Automatisch'}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex items-center gap-3 opacity-60">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <X className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Anschreiben</p>
                    <p className="font-medium text-muted-foreground">Nicht ausgewählt</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:bg-blue-950/20 dark:border-blue-900/50">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-300">Bereit zur Generierung</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                Wir erstellen jetzt deine maßgeschneiderten Unterlagen. Die KI analysiert deine Erfahrungen und matcht sie mit den Anforderungen der Stelle.
                {generateCoverLetter
                  ? ' Es werden Anschreiben und Lebenslauf erstellt.'
                  : ' Es wird nur ein Lebenslauf erstellt.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

