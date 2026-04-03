'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link as LinkIcon, FileText, Check, Loader2 } from 'lucide-react';
import { useParseJobPosting, useCreateJobPosting } from '@/hooks/use-job-postings';
import type { JobPosting } from '@/types';
import {
  jobPostingUrlSchema,
  jobPostingSchema,
  type JobPostingUrlFormValues,
  type JobPostingFormValues,
} from '@/lib/validation/schemas';

interface JobStepProps {
  onJobCreated: (jobPosting: JobPosting) => void;
}

export function JobStep({ onJobCreated }: JobStepProps) {
  const [parsedData, setParsedData] = useState<JobPosting | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('url');

  const parseJobPosting = useParseJobPosting();
  const createJobPosting = useCreateJobPosting();

  // URL form
  const urlForm = useForm<JobPostingUrlFormValues>({
    resolver: zodResolver(jobPostingUrlSchema),
    mode: 'onBlur',
    defaultValues: { url: '' },
  });

  // Manual form
  const manualForm = useForm<JobPostingFormValues>({
    resolver: zodResolver(jobPostingSchema),
    mode: 'onBlur',
    defaultValues: {
      title: '',
      company: '',
      location: '',
      url: '',
      fullText: '',
      salary: '',
      employmentType: '',
    },
  });

  const handleUrlParse = async (data: JobPostingUrlFormValues) => {
    try {
      const result = await parseJobPosting.mutateAsync({ url: data.url });
      setParsedData(result);
      // The parse endpoint already saves the job posting
      onJobCreated(result);
    } catch {
      // Error handled by hook
    }
  };

  const handleManualSubmit = async (data: JobPostingFormValues) => {
    try {
      const payload = {
        title: data.title,
        company: data.company,
        location: data.location || undefined,
        url: data.url || undefined,
        description: data.fullText,
        fullText: data.fullText,
        salary: data.salary || undefined,
        employmentType: data.employmentType || undefined,
      };
      const result = await createJobPosting.mutateAsync(payload);
      setParsedData(result);
      onJobCreated(result);
    } catch {
      // Error handled by hook
    }
  };

  const handleReset = () => {
    setParsedData(null);
    setIsEditing(false);
    urlForm.reset();
    manualForm.reset();
  };

  // If we have parsed/created data, show success state
  if (parsedData && !isEditing) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900/50">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Stelle erfasst</CardTitle>
                <CardDescription>Die Stellenanzeige wurde erfolgreich gespeichert.</CardDescription>
              </div>
            </div>
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" />
              Gespeichert
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border/50 bg-card p-5 shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Titel</p>
              <p className="text-lg font-semibold">{parsedData.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Unternehmen</p>
              <p className="text-base">{parsedData.company}</p>
            </div>
            {parsedData.location && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Standort</p>
                <p className="text-base">{parsedData.location}</p>
              </div>
            )}
            {parsedData.description && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Beschreibung</p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {parsedData.description}
                </p>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleReset}>
            Andere Stelle verwenden
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle>Stelle hinzufügen</CardTitle>
        <CardDescription>
          Füge die Stellenanzeige per Link oder durch Einfügen des Textes hinzu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="url" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Link einfügen
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              Text einfügen
            </TabsTrigger>
          </TabsList>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-4">
            <form onSubmit={urlForm.handleSubmit(handleUrlParse)} className="space-y-4">
              <div>
                <Label htmlFor="url">Link zur Stellenanzeige</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Unterstützt LinkedIn, Indeed und weitere Jobportale.
                </p>
                <Input
                  id="url"
                  type="text"
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  {...urlForm.register('url')}
                  className={urlForm.formState.errors.url ? 'border-red-500' : ''}
                />
                {urlForm.formState.errors.url && (
                  <p className="text-sm text-red-500 mt-1">{urlForm.formState.errors.url.message}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={parseJobPosting.isPending}
                className="w-full"
                size="lg"
              >
                {parseJobPosting.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird analysiert...
                  </>
                ) : (
                  'Stellenanzeige analysieren'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Manual Text Tab */}
          <TabsContent value="text" className="space-y-4">
            <form onSubmit={manualForm.handleSubmit(handleManualSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manual-title">
                    Stellentitel <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="manual-title"
                    placeholder="z.B. Marketing Manager, Pflegefachkraft"
                    {...manualForm.register('title')}
                    className={manualForm.formState.errors.title ? 'border-red-500' : ''}
                  />
                  {manualForm.formState.errors.title && (
                    <p className="text-sm text-red-500 mt-1">{manualForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="manual-company">
                    Unternehmen <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="manual-company"
                    placeholder="z.B. Unternehmen GmbH"
                    {...manualForm.register('company')}
                    className={manualForm.formState.errors.company ? 'border-red-500' : ''}
                  />
                  {manualForm.formState.errors.company && (
                    <p className="text-sm text-red-500 mt-1">{manualForm.formState.errors.company.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="manual-location">Standort</Label>
                <Input
                  id="manual-location"
                  placeholder="z.B. Berlin, Deutschland"
                  {...manualForm.register('location')}
                />
              </div>

              <div>
                <Label htmlFor="manual-fullText">
                  Stellenbeschreibung <span className="text-red-500">*</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Kopiere den gesamten Text der Stellenanzeige und füge ihn hier ein.
                </p>
                <Textarea
                  id="manual-fullText"
                  placeholder="Füge hier den vollständigen Text der Stellenanzeige ein..."
                  rows={8}
                  {...manualForm.register('fullText')}
                  className={manualForm.formState.errors.fullText ? 'border-red-500' : ''}
                />
                {manualForm.formState.errors.fullText && (
                  <p className="text-sm text-red-500 mt-1">{manualForm.formState.errors.fullText.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={createJobPosting.isPending}
                className="w-full"
                size="lg"
              >
                {createJobPosting.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  'Stelle speichern'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
