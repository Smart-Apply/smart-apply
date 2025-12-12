'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { useCreateJobPosting } from '@/hooks/use-job-postings';
import { jobPostingSchema, type JobPostingFormValues } from '@/lib/validation/schemas';

interface JobPostingFormProps {
  onSave?: () => void;
  onCancel?: () => void;
}

/**
 * JobPostingForm Component
 * 
 * Manual job posting form for creating job postings
 * - Title, Company (required)
 * - Location, URL, Salary, Employment Type (optional)
 * - Full Text (required) - complete job posting text including description, requirements, responsibilities
 * - Validation with Zod
 * - Error handling and user feedback
 */
export function JobPostingForm({ onSave, onCancel }: JobPostingFormProps) {
  const createJobPosting = useCreateJobPosting();

  const form = useForm<JobPostingFormValues>({
    resolver: zodResolver(jobPostingSchema),
    mode: 'onBlur', // Validate on blur
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

  const handleSubmit = async (data: JobPostingFormValues) => {
    try {
      const payload = {
        title: data.title,
        company: data.company,
        location: data.location || undefined,
        url: data.url || undefined,
        description: data.fullText, // Use fullText as description
        fullText: data.fullText,
        salary: data.salary || undefined,
        employmentType: data.employmentType || undefined,
      };

      await createJobPosting.mutateAsync(payload);
      
      // Reset form on success
      form.reset();
      
      // Call onSave callback if provided
      if (onSave) {
        onSave();
      }
    } catch (error) {
      // Error toast is handled by the hook
      console.error('Create error:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stellenanzeige manuell erstellen</CardTitle>
        <CardDescription>
          Fülle alle relevanten Felder aus, um eine neue Stellenanzeige zu erstellen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Grundinformationen</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">
                  Stellentitel <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="z.B. Marketing Manager, Pflegefachkraft, Vertriebsmitarbeiter"
                  {...form.register('title')}
                  className={form.formState.errors.title ? 'border-red-500' : ''}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="company">
                  Unternehmen <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="z.B. Unternehmen GmbH"
                  {...form.register('company')}
                  className={form.formState.errors.company ? 'border-red-500' : ''}
                />
                {form.formState.errors.company && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.company.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="z.B. Berlin, Deutschland"
                  {...form.register('location')}
                  className={form.formState.errors.location ? 'border-red-500' : ''}
                />
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.location.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="url">URL zur Stellenanzeige</Label>
                <Input
                  id="url"
                  type="text"
                  placeholder="https://example.com/jobs/123"
                  {...form.register('url')}
                  className={form.formState.errors.url ? 'border-red-500' : ''}
                />
                {form.formState.errors.url && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.url.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salary">Gehalt</Label>
                <Input
                  id="salary"
                  type="text"
                  placeholder="z.B. 60,000 - 80,000 EUR"
                  {...form.register('salary')}
                  className={form.formState.errors.salary ? 'border-red-500' : ''}
                />
                {form.formState.errors.salary && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.salary.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="employmentType">Beschäftigungsart</Label>
                <Input
                  id="employmentType"
                  type="text"
                  placeholder="z.B. Vollzeit, Teilzeit, Freelance"
                  {...form.register('employmentType')}
                  className={form.formState.errors.employmentType ? 'border-red-500' : ''}
                />
                {form.formState.errors.employmentType && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.employmentType.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Full Text Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Stellenbeschreibung</h3>
            
            <div>
              <Label htmlFor="fullText">
                Beschreibung <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Allgemeine Beschreibung der Stelle und des Unternehmens
              </p>
              <Textarea
                id="fullText"
                rows={12}
                placeholder="Beschreibe die Stelle, das Team und was das Unternehmen ausmacht..."
                {...form.register('fullText')}
                className={form.formState.errors.fullText ? 'border-red-500' : ''}
              />
              {form.formState.errors.fullText && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.fullText.message}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
            )}
            <Button
              type="submit"
              loading={createJobPosting.isPending}
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Stellenanzeige erstellen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
