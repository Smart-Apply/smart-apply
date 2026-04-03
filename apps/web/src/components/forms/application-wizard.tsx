'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { CenteredLoader } from '@/components/shared/loading';
import { JobStep } from '@/components/forms/wizard/job-step';
import { GenerateStep } from '@/components/forms/wizard/generate-step';
import { Check, Briefcase, Sparkles, ChevronLeft, ArrowRight } from 'lucide-react';
import type { JobPosting } from '@/types';
import { cn } from '@/lib/utils';

type WizardStep = 'job' | 'generate';

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: StepConfig[] = [
  {
    id: 'job',
    title: 'Stelle',
    description: 'Hinzufügen',
    icon: Briefcase,
  },
  {
    id: 'generate',
    title: 'Erstellen',
    description: 'Generieren',
    icon: Sparkles,
  },
];

export type ApplicationLanguage = 'de' | 'en' | 'fr' | 'es' | 'it';

export function ApplicationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('job');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

  const { data: profile, isLoading: profileLoading } = useProfile();

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Redirect to onboarding if profile is empty
  useEffect(() => {
    if (!profileLoading && profile) {
      const hasMinimalProfile = profile.summary || (profile.skills && profile.skills.length > 0);
      if (!hasMinimalProfile) {
        router.replace('/onboarding');
      }
    }
  }, [profile, profileLoading, router]);

  const handleJobCreated = (jobPosting: JobPosting) => {
    setSelectedJob(jobPosting);
  };

  const handleNext = () => {
    if (currentStep === 'job' && selectedJob) {
      setCurrentStep('generate');
    }
  };

  const handleBack = () => {
    if (currentStep === 'generate') {
      setCurrentStep('job');
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  if (profileLoading) {
    return <CenteredLoader message="Lädt..." />;
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="relative mx-auto max-w-md">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
        <div className="relative z-10 flex justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center bg-background px-4">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-glow'
                      : isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-xs font-semibold transition-colors duration-300',
                      isActive ? 'text-primary' : 'text-muted-foreground'
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
        {currentStep === 'job' && (
          <JobStep onJobCreated={handleJobCreated} />
        )}

        {currentStep === 'generate' && selectedJob && (
          <GenerateStep jobPosting={selectedJob} />
        )}
      </div>

      {/* Navigation Buttons */}
      {currentStep === 'job' && (
        <div className="flex items-center justify-between pt-6 border-t border-border/50">
          <Button variant="ghost" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
            Abbrechen
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedJob}
            className="shadow-md hover:shadow-lg transition-all"
          >
            Weiter
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {currentStep === 'generate' && (
        <div className="flex items-center justify-start pt-6 border-t border-border/50">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
        </div>
      )}
    </div>
  );
}

