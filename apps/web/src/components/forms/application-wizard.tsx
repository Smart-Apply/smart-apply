'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProfile } from '@/hooks/use-profile';
import { useJobPostings } from '@/hooks/use-job-postings';
import { useCreateApplication } from '@/hooks/use-applications';
import { Check, ChevronLeft, ChevronRight, X, AlertCircle, Briefcase, User, FileText, Edit } from 'lucide-react';
import Link from 'next/link';
import type { JobPosting, Profile, Skill, Experience } from '@/types';
import { toast } from 'sonner';

type WizardStep = 'profile' | 'job' | 'review';

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
    id: 'review',
    title: 'Überprüfen & Generieren',
    description: 'Bestätige deine Bewerbung',
    icon: FileText,
  },
];

export function ApplicationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: jobPostings, isLoading: jobPostingsLoading } = useJobPostings();
  const createApplication = useCreateApplication();

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
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'job') {
      setCurrentStep('profile');
    } else if (currentStep === 'review') {
      setCurrentStep('job');
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
      const application = await createApplication.mutateAsync({
        jobPostingId: selectedJobId,
      });
      
      toast.success('Bewerbung wird erstellt!');
      router.push(`/applications/${application.id}`);
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Failed to create application:', error);
    }
  };

  const isProfileComplete = () => {
    return !!(profile?.summary && profile?.skills?.length);
  };

  if (profileLoading || jobPostingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Lädt...</p>
        </div>
      </div>
    );
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
        
        {currentStep === 'review' && (
          <ReviewStep profile={profile} job={selectedJob} />
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
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Erstelle...
                </>
              ) : (
                <>
                  Bewerbung erstellen
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
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
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/profile/edit">
                  <Edit className="mr-2 h-4 w-4" />
                  Profil bearbeiten
                </Link>
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
            <Button asChild variant="outline" size="sm">
              <Link href="/jobs">
                <Briefcase className="mr-2 h-4 w-4" />
                Neue Stellenanzeige hinzufügen
              </Link>
            </Button>
          </div>

          {jobPostings.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Keine Stellenanzeigen gefunden</p>
              <p className="text-sm text-gray-500 mb-4">
                Erstelle zuerst eine Stellenanzeige, um fortzufahren.
              </p>
              <Button asChild>
                <Link href="/jobs">
                  Stellenanzeige erstellen
                </Link>
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

interface ReviewStepProps {
  profile: Profile | undefined;
  job?: JobPosting;
}

function ReviewStep({ profile, job }: ReviewStepProps) {
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
                {profile?.skills?.length > 5 && (
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
