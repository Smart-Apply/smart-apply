'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { useCreateJobPosting } from '@/hooks/use-job-postings';

// Validation schema for manual job posting form
const jobPostingSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(200, 'Titel darf maximal 200 Zeichen lang sein'),
  company: z.string().min(1, 'Unternehmen ist erforderlich').max(200, 'Unternehmen darf maximal 200 Zeichen lang sein'),
  location: z.string().max(200, 'Standort darf maximal 200 Zeichen lang sein').optional().or(z.literal('')),
  url: z.string().url('Bitte gebe eine gültige URL ein').optional().or(z.literal('')),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  niceToHave: z.string().optional(),
  salary: z.string().max(100, 'Gehalt darf maximal 100 Zeichen lang sein').optional().or(z.literal('')),
  employmentType: z.string().max(50, 'Beschäftigungsart darf maximal 50 Zeichen lang sein').optional().or(z.literal('')),
});

type JobPostingFormValues = z.infer<typeof jobPostingSchema>;

interface JobPostingFormProps {
  onSave?: () => void;
  onCancel?: () => void;
}

/**
 * JobPostingForm Component
 * 
 * Manual job posting form with all fields for creating job postings
 * - Title, Company, Location (required/optional)
 * - URL, Salary, Employment Type (optional)
 * - Description (required)
 * - Requirements, Responsibilities, Nice to Have (optional, one per line)
 * - Validation with Zod
 * - Error handling and user feedback
 */
export function JobPostingForm({ onSave, onCancel }: JobPostingFormProps) {
  const createJobPosting = useCreateJobPosting();

  const form = useForm<JobPostingFormValues>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: {
      title: '',
      company: '',
      location: '',
      url: '',
      description: '',
      requirements: '',
      responsibilities: '',
      niceToHave: '',
      salary: '',
      employmentType: '',
    },
  });

  const handleSubmit = async (data: JobPostingFormValues) => {
    try {
      // Convert text fields to arrays (split by newline)
      const payload = {
        title: data.title,
        company: data.company,
        location: data.location || undefined,
        url: data.url || undefined,
        description: data.description,
        requirements: data.requirements
          ? data.requirements
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
          : undefined,
        responsibilities: data.responsibilities
          ? data.responsibilities
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
          : undefined,
        niceToHave: data.niceToHave
          ? data.niceToHave
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
          : undefined,
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
                  placeholder="z.B. Senior Frontend Developer"
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
                  placeholder="z.B. Tech Corp GmbH"
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

          {/* Description Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Stellenbeschreibung</h3>
            
            <div>
              <Label htmlFor="description">
                Beschreibung <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Allgemeine Beschreibung der Stelle und des Unternehmens
              </p>
              <Textarea
                id="description"
                rows={6}
                placeholder="Beschreibe die Stelle, das Team und was das Unternehmen ausmacht..."
                {...form.register('description')}
                className={form.formState.errors.description ? 'border-red-500' : ''}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Details</h3>
            
            <div>
              <Label htmlFor="requirements">Anforderungen</Label>
              <p className="text-sm text-gray-500 mb-2">
                Eine Anforderung pro Zeile (z.B. &quot;5+ Jahre React Erfahrung&quot;)
              </p>
              <Textarea
                id="requirements"
                rows={6}
                placeholder="5+ Jahre React Erfahrung&#10;Sehr gute TypeScript Kenntnisse&#10;Erfahrung mit Next.js"
                {...form.register('requirements')}
                className={form.formState.errors.requirements ? 'border-red-500' : ''}
              />
              {form.formState.errors.requirements && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.requirements.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="responsibilities">Verantwortlichkeiten</Label>
              <p className="text-sm text-gray-500 mb-2">
                Eine Verantwortlichkeit pro Zeile (z.B. &quot;Entwicklung von Web-Apps&quot;)
              </p>
              <Textarea
                id="responsibilities"
                rows={6}
                placeholder="Entwicklung von skalierbaren Web-Anwendungen&#10;Mentoring von Junior-Entwicklern&#10;Code Reviews durchführen"
                {...form.register('responsibilities')}
                className={form.formState.errors.responsibilities ? 'border-red-500' : ''}
              />
              {form.formState.errors.responsibilities && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.responsibilities.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="niceToHave">Nice-to-Have</Label>
              <p className="text-sm text-gray-500 mb-2">
                Optionale Qualifikationen, eine pro Zeile
              </p>
              <Textarea
                id="niceToHave"
                rows={4}
                placeholder="Erfahrung mit GraphQL&#10;Beiträge zu Open Source Projekten&#10;UI/UX Design Kenntnisse"
                {...form.register('niceToHave')}
                className={form.formState.errors.niceToHave ? 'border-red-500' : ''}
              />
              {form.formState.errors.niceToHave && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.niceToHave.message}
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
