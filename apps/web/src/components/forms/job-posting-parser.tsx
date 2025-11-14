'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link as LinkIcon, FileText, Check, AlertCircle } from 'lucide-react';
import { useParseJobPosting } from '@/hooks/use-job-postings';
import { toast } from 'sonner';
import type { JobPosting } from '@/types';

// Validation schema for URL input
const urlSchema = z.object({
  url: z.string().url('Bitte gebe eine gültige URL ein'),
});

// Validation schema for text input
const textSchema = z.object({
  text: z.string().min(10, 'Der Text muss mindestens 10 Zeichen lang sein'),
});

// Validation schema for editing parsed data
const editSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich'),
  company: z.string().min(1, 'Unternehmen ist erforderlich'),
  location: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  salary: z.string().optional(),
});

type UrlFormData = z.infer<typeof urlSchema>;
type TextFormData = z.infer<typeof textSchema>;
type EditFormData = z.infer<typeof editSchema>;

interface JobPostingParserProps {
  onSave?: (jobPosting: JobPosting) => void;
}

/**
 * JobPostingParser Component
 * 
 * Allows users to parse job postings from URLs or manual text input.
 * - URL input with validation
 * - Manual text input fallback
 * - Display parsed job data
 * - Edit capability before saving
 * - Error handling and user feedback
 */
export function JobPostingParser({ onSave }: JobPostingParserProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('url');
  const [parsedData, setParsedData] = useState<JobPosting | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const parseJobPosting = useParseJobPosting();

  // Form for URL input
  const urlForm = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: '',
    },
  });

  // Form for text input
  const textForm = useForm<TextFormData>({
    resolver: zodResolver(textSchema),
    defaultValues: {
      text: '',
    },
  });

  // Form for editing parsed data
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

  // Handle URL parsing
  const handleUrlParse = async (data: UrlFormData) => {
    try {
      const result = await parseJobPosting.mutateAsync({ url: data.url });
      setParsedData(result);
      setIsEditing(false);
      
      // Populate edit form with parsed data
      editForm.reset({
        title: result.title,
        company: result.company,
        location: result.location || '',
        description: result.description || '',
        requirements: result.requirements || '',
        salary: result.salary || '',
      });
    } catch (error) {
      // Error toast is handled by the hook
      console.error('Parse error:', error);
    }
  };

  // Handle text parsing
  const handleTextParse = async (data: TextFormData) => {
    try {
      const result = await parseJobPosting.mutateAsync({ text: data.text });
      setParsedData(result);
      setIsEditing(false);
      
      // Populate edit form with parsed data
      editForm.reset({
        title: result.title,
        company: result.company,
        location: result.location || '',
        description: result.description || '',
        requirements: result.requirements || '',
        salary: result.salary || '',
      });
    } catch (error) {
      // Error toast is handled by the hook
      console.error('Parse error:', error);
    }
  };

  // Handle saving edited data
  const handleSave = (data: EditFormData) => {
    if (!parsedData) return;

    const updatedJobPosting: JobPosting = {
      ...parsedData,
      title: data.title,
      company: data.company,
      location: data.location,
      description: data.description,
      requirements: data.requirements,
      salary: data.salary,
    };

    setParsedData(updatedJobPosting);
    setIsEditing(false);
    toast.success('Änderungen gespeichert');
    
    if (onSave) {
      onSave(updatedJobPosting);
    }
  };

  // Handle reset
  const handleReset = () => {
    setParsedData(null);
    setIsEditing(false);
    urlForm.reset();
    textForm.reset();
    editForm.reset();
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      {!parsedData && (
        <Card>
          <CardHeader>
            <CardTitle>Stellenanzeige erfassen</CardTitle>
            <CardDescription>
              Füge eine Stellenanzeige per URL oder Textinput hinzu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'url' | 'text')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="text">
                  <FileText className="mr-2 h-4 w-4" />
                  Text
                </TabsTrigger>
              </TabsList>

              {/* URL Input Tab */}
              <TabsContent value="url" className="space-y-4">
                <form onSubmit={urlForm.handleSubmit(handleUrlParse)} className="space-y-4">
                  <div>
                    <Label htmlFor="url">URL der Stellenanzeige</Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Unterstützt werden LinkedIn, Indeed und weitere Jobportale
                    </p>
                    <Input
                      id="url"
                      type="text"
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      {...urlForm.register('url')}
                      className={urlForm.formState.errors.url ? 'border-red-500' : ''}
                    />
                    {urlForm.formState.errors.url && (
                      <p className="text-sm text-red-500 mt-1">
                        {urlForm.formState.errors.url.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    loading={parseJobPosting.isPending}
                    className="w-full"
                  >
                    Stellenanzeige parsen
                  </Button>
                </form>
              </TabsContent>

              {/* Text Input Tab */}
              <TabsContent value="text" className="space-y-4">
                <form onSubmit={textForm.handleSubmit(handleTextParse)} className="space-y-4">
                  <div>
                    <Label htmlFor="text">Stellenbeschreibung</Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Kopiere die Stellenbeschreibung direkt hier hinein
                    </p>
                    <Textarea
                      id="text"
                      placeholder="Senior Software Engineer bei Firma XYZ..."
                      rows={10}
                      {...textForm.register('text')}
                      className={textForm.formState.errors.text ? 'border-red-500' : ''}
                    />
                    {textForm.formState.errors.text && (
                      <p className="text-sm text-red-500 mt-1">
                        {textForm.formState.errors.text.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    loading={parseJobPosting.isPending}
                    className="w-full"
                  >
                    Stellenanzeige parsen
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Parsed Data Display */}
      {parsedData && !isEditing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Geparste Stellenanzeige</CardTitle>
                <CardDescription>
                  Überprüfe die extrahierten Informationen
                </CardDescription>
              </div>
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                Erfolgreich geparst
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Titel</Label>
                <p className="text-lg font-semibold">{parsedData.title}</p>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Unternehmen</Label>
                <p className="text-base">{parsedData.company}</p>
              </div>

              {parsedData.location && (
                <div>
                  <Label className="text-xs text-gray-500">Standort</Label>
                  <p className="text-base">{parsedData.location}</p>
                </div>
              )}

              {parsedData.salary && (
                <div>
                  <Label className="text-xs text-gray-500">Gehalt</Label>
                  <p className="text-base">{parsedData.salary}</p>
                </div>
              )}

              {parsedData.description && (
                <div>
                  <Label className="text-xs text-gray-500">Beschreibung</Label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {parsedData.description.length > 300
                      ? `${parsedData.description.substring(0, 300)}...`
                      : parsedData.description}
                  </p>
                </div>
              )}

              {parsedData.requirements && (
                <div>
                  <Label className="text-xs text-gray-500">Anforderungen</Label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {parsedData.requirements.length > 200
                      ? `${parsedData.requirements.substring(0, 200)}...`
                      : parsedData.requirements}
                  </p>
                </div>
              )}

              {parsedData.url && (
                <div>
                  <Label className="text-xs text-gray-500">Original-URL</Label>
                  <a
                    href={parsedData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {parsedData.url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={() => setIsEditing(true)} variant="outline" className="flex-1">
                Bearbeiten
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Neu parsen
              </Button>
              {onSave && (
                <Button onClick={() => onSave(parsedData)} className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  Speichern
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form */}
      {parsedData && isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Stellenanzeige bearbeiten</CardTitle>
            <CardDescription>
              Passe die Informationen an, falls nötig
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={editForm.handleSubmit(handleSave)} className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Titel *</Label>
                <Input
                  id="edit-title"
                  type="text"
                  {...editForm.register('title')}
                  className={editForm.formState.errors.title ? 'border-red-500' : ''}
                />
                {editForm.formState.errors.title && (
                  <p className="text-sm text-red-500 mt-1">
                    {editForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="edit-company">Unternehmen *</Label>
                <Input
                  id="edit-company"
                  type="text"
                  {...editForm.register('company')}
                  className={editForm.formState.errors.company ? 'border-red-500' : ''}
                />
                {editForm.formState.errors.company && (
                  <p className="text-sm text-red-500 mt-1">
                    {editForm.formState.errors.company.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="edit-location">Standort</Label>
                <Input
                  id="edit-location"
                  type="text"
                  {...editForm.register('location')}
                />
              </div>

              <div>
                <Label htmlFor="edit-salary">Gehalt</Label>
                <Input
                  id="edit-salary"
                  type="text"
                  placeholder="z.B. 60.000 - 80.000 €"
                  {...editForm.register('salary')}
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Textarea
                  id="edit-description"
                  rows={6}
                  {...editForm.register('description')}
                />
              </div>

              <div>
                <Label htmlFor="edit-requirements">Anforderungen</Label>
                <Textarea
                  id="edit-requirements"
                  rows={6}
                  {...editForm.register('requirements')}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button type="submit" className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  Änderungen speichern
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {!parsedData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Unterstützte Plattformen
                </p>
                <p className="text-sm text-blue-700">
                  Du kannst Stellenanzeigen von LinkedIn, Indeed und anderen Jobportalen 
                  importieren. Falls das Parsen fehlschlägt, kannst du die Informationen 
                  auch manuell eingeben.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
