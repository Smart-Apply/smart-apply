'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CenteredLoader } from '@/components/shared/loading';
import { useProfile } from '@/hooks/use-profile';
import { useJobPostings } from '@/hooks/use-job-postings';
import { useCreateApplicationWithGeneration } from '@/hooks/use-applications';
import { useCoverLetterTemplates, useResumeTemplates, getDefaultTemplate } from '@/hooks/use-templates';
import { TemplateCard } from '@/components/templates/template-card';
import { Check, ChevronLeft, ChevronRight, X, AlertCircle, Briefcase, User, FileText, Edit, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { JobPosting, Profile, Skill, Experience, Template } from '@/types';
import { toast } from 'sonner';
import { ApplicationLoading } from '@/components/applications/application-loading';

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
    title: 'Profil auswählen',
    description: 'Überprüfe dein Profil',
    icon: User,
  },
  {
    id: 'job',
    title: 'Stellenanzeige wählen',
    description: 'Wähle eine Stellenanzeige',
    icon: Briefcase,
  },
  {
    id: 'templates',
    title: 'Vorlagen wählen',
    description: 'Wähle Vorlagen für deine Bewerbung',
    icon: FileText,
  },
  {
    id: 'review',
    title: 'Überprüfen & Generieren',
    description: 'Bestätige deine Bewerbung',
    icon: Check,
  },
];

export function ApplicationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCoverLetterTemplateId, setSelectedCoverLetterTemplateId] = useState<string | null>(null);
  const [selectedResumeTemplateId, setSelectedResumeTemplateId] = useState<string | null>(null);
  
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
        coverLetterTemplateId: selectedCoverLetterTemplateId || undefined,
        resumeTemplateId: selectedResumeTemplateId || undefined,
      });
      
      // Success! Redirect to edit page
      router.push(`/applications/${application.id}/edit`);
    } catch (error) {
      // Error is handled by the mutation's onError
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
  if (createApplication.isPending) {
    return <ApplicationLoading message="Bewerbung wird mit KI erstellt..." />;
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex-1">
                <div className="flex items-center">
                  {index > 0 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors ${
                        isActive
                          ? 'border-blue-600 bg-blue-50'
                          : isCompleted
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-white" />
                      ) : (
                        <Icon
                          className={`w-6 h-6 ${
                            isActive ? 'text-blue-600' : 'text-gray-400'
                          }`}
                        />
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? 'text-blue-600' : 'text-gray-500'
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Step Content */}
      <div className="min-h-[400px]">
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
          />
        )}
        
        {currentStep === 'review' && (
          <ReviewStep 
            profile={profile} 
            job={selectedJob}
            coverLetterTemplateId={selectedCoverLetterTemplateId}
            resumeTemplateId={selectedResumeTemplateId}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button variant="ghost" onClick={handleCancel}>
          <X className="mr-2 h-4 w-4" />
          Abbrechen
        </Button>

        <div className="flex gap-2">
          {currentStep !== 'profile' && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
          )}

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              loading={createApplication.isPending}
            >
              Bewerbung erstellen
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Weiter
              <ChevronRight className="ml-2 h-4 w-4" />
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
    <Card>
      <CardHeader>
        <CardTitle>Dein Profil</CardTitle>
        <CardDescription>
          Überprüfe, ob dein Profil vollständig ist. Ein vollständiges Profil führt zu
          besseren Bewerbungsunterlagen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isComplete && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900">Profil unvollständig</p>
              <p className="text-sm text-orange-700 mt-1">
                Bitte vervollständige dein Profil, um fortzufahren. Füge mindestens eine
                Zusammenfassung und Skills hinzu.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/profile/edit')}>
                <Edit className="mr-2 h-4 w-4" />
                Profil bearbeiten
              </Button>
            </div>
          </div>
        )}

        {profile && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Zusammenfassung</h3>
              <p className="text-sm text-gray-600">
                {profile.summary || 'Keine Zusammenfassung vorhanden'}
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Skills</h3>
              {profile.skills && profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill: Skill) => (
                    <Badge key={skill.id || skill.name} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Keine Skills hinzugefügt</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Berufserfahrung</h3>
              {profile.experiences && profile.experiences.length > 0 ? (
                <div className="space-y-2">
                  {profile.experiences.slice(0, 3).map((exp: Experience) => (
                    <div key={exp.id} className="text-sm">
                      <p className="font-medium">{exp.title}</p>
                      <p className="text-gray-600">{exp.company}</p>
                    </div>
                  ))}
                  {profile.experiences.length > 3 && (
                    <p className="text-sm text-gray-500">
                      +{profile.experiences.length - 3} weitere
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Keine Berufserfahrung hinzugefügt</p>
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
      <Card>
        <CardHeader>
          <CardTitle>Stellenanzeige wählen</CardTitle>
          <CardDescription>
            Wähle eine gespeicherte Stellenanzeige aus oder erstelle eine neue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/jobs')}>
              <Briefcase className="mr-2 h-4 w-4" />
              Neue Stellenanzeige hinzufügen
            </Button>
          </div>

          {jobPostings.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Keine Stellenanzeigen gefunden</p>
              <p className="text-sm text-gray-500 mb-4">
                Erstelle zuerst eine Stellenanzeige, um fortzufahren.
              </p>
              <Button onClick={() => router.push('/jobs')}>
                Stellenanzeige erstellen
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {jobPostings.map((job) => (
                <button
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className={`text-left rounded-lg border-2 p-4 transition-all hover:border-blue-300 ${
                    selectedJobId === job.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{job.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{job.company}</p>
                      {job.location && (
                        <p className="text-sm text-gray-500 mt-1">{job.location}</p>
                      )}
                    </div>
                    {selectedJobId === job.id && (
                      <div className="flex-shrink-0 ml-4">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
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
}

function TemplateStep({
  selectedCoverLetterTemplateId,
  selectedResumeTemplateId,
  onSelectCoverLetterTemplate,
  onSelectResumeTemplate,
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
      {/* Resume Templates - Only visible section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Vorlagenauswahl</h3>
          <p className="text-sm text-gray-600 mt-1">
            Wähle eine Vorlage für deinen Lebenslauf. Das passende Anschreiben-Design wird automatisch ausgewählt.
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

      {/* Info box showing selected templates */}
      {selectedResumeTemplateId && selectedCoverLetterTemplateId && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-blue-900">Ausgewählte Vorlagen</p>
            <div className="mt-2 space-y-1 text-sm text-blue-700">
              <p>
                <span className="font-medium">Lebenslauf:</span>{' '}
                {resumeTemplates?.find((t) => t.id === selectedResumeTemplateId)?.name}
              </p>
              <p>
                <span className="font-medium">Anschreiben:</span>{' '}
                {coverLetterTemplates?.find((t) => t.id === selectedCoverLetterTemplateId)?.name}{' '}
                <span className="text-xs opacity-75">(automatisch zugeordnet)</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewStepProps {
  profile: Profile | undefined;
  job?: JobPosting;
  coverLetterTemplateId: string | null;
  resumeTemplateId: string | null;
}

function ReviewStep({ profile, job, coverLetterTemplateId, resumeTemplateId }: ReviewStepProps) {
  const { data: coverLetterTemplates } = useCoverLetterTemplates();
  const { data: resumeTemplates } = useResumeTemplates();
  
  const selectedCoverLetterTemplate = coverLetterTemplates?.find((t) => t.id === coverLetterTemplateId);
  const selectedResumeTemplate = resumeTemplates?.find((t) => t.id === resumeTemplateId);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Überprüfung</CardTitle>
          <CardDescription>
            Überprüfe deine Auswahl, bevor die Bewerbung erstellt wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Summary */}
          <div>
            <h3 className="font-medium text-sm text-gray-500 mb-2">DEIN PROFIL</h3>
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="font-medium mb-2">{profile?.summary?.slice(0, 100)}...</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile?.skills?.slice(0, 5).map((skill: Skill) => (
                  <Badge key={skill.id || skill.name} variant="secondary">
                    {skill.name}
                  </Badge>
                ))}
                {profile?.skills && profile.skills.length > 5 && (
                  <Badge variant="secondary">+{profile.skills.length - 5} mehr</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Job Summary */}
          <div>
            <h3 className="font-medium text-sm text-gray-500 mb-2">STELLENANZEIGE</h3>
            {job ? (
              <div className="rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium">{job.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{job.company}</p>
                {job.location && (
                  <p className="text-sm text-gray-500 mt-1">{job.location}</p>
                )}
                {job.description && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                    {job.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-600">Keine Stellenanzeige ausgewählt</p>
            )}
          </div>

          {/* Template Summary */}
          <div>
            <h3 className="font-medium text-sm text-gray-500 mb-2">AUSGEWÄHLTE VORLAGEN</h3>
            <div className="space-y-2">
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Anschreiben:</p>
                    <p className="text-sm text-gray-600">
                      {selectedCoverLetterTemplate?.name || 'Standard Vorlage'}
                    </p>
                  </div>
                  {selectedCoverLetterTemplate && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCoverLetterTemplate.category}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Lebenslauf:</p>
                    <p className="text-sm text-gray-600">
                      {selectedResumeTemplate?.name || 'Standard Vorlage'}
                    </p>
                  </div>
                  {selectedResumeTemplate && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedResumeTemplate.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Was passiert als nächstes?</p>
              <p className="text-sm text-blue-700 mt-1">
                Basierend auf deinem Profil und der ausgewählten Stellenanzeige werden
                automatisch ein individuelles Anschreiben und ein angepasster Lebenslauf
                erstellt. Dies kann einige Minuten dauern.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
