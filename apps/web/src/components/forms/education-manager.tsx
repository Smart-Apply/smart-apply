'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import type { Education } from '@/types';

interface EducationManagerProps {
  education: Education[];
  onEducationChange: (education: Education[]) => void;
  disabled?: boolean;
}

// Validation schema for education form
const educationSchema = z.object({
  degree: z.string().min(1, 'Abschluss ist erforderlich'),
  institution: z.string().min(1, 'Institution ist erforderlich'),
  fieldOfStudy: z.string().optional(),
  startYear: z.number().min(1900, 'Ungültiges Jahr').max(new Date().getFullYear() + 10, 'Ungültiges Jahr').optional(),
  endYear: z.number().min(1900, 'Ungültiges Jahr').max(new Date().getFullYear() + 10, 'Ungültiges Jahr').optional().nullable(),
  gpa: z.string().optional(),
  description: z.string().optional(),
}).refine((data) => {
  // If both years are provided, endYear must be >= startYear
  if (data.startYear && data.endYear) {
    return data.endYear >= data.startYear;
  }
  return true;
}, {
  message: 'Endjahr muss nach oder gleich dem Startjahr sein',
  path: ['endYear'],
});

type EducationFormValues = z.infer<typeof educationSchema>;

/**
 * EducationManager Component
 * 
 * Manages education entries with add, edit, and delete functionality.
 * - Display list of existing education (sorted by start year, most recent first)
 * - Add new education via dialog/modal
 * - Edit existing entries
 * - Delete entries with confirmation
 * - Optional end year for ongoing education
 */
export function EducationManager({
  education,
  onEducationChange,
  disabled = false,
}: EducationManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const form = useForm<EducationFormValues>({
    resolver: zodResolver(educationSchema),
    mode: 'onChange',
    defaultValues: {
      degree: '',
      institution: '',
      fieldOfStudy: '',
      startYear: undefined,
      endYear: undefined,
      gpa: '',
      description: '',
    },
  });

  // Sort education by start year (most recent first)
  const sortedEducation = [...education].sort((a, b) => {
    const yearA = a.startYear || 0;
    const yearB = b.startYear || 0;
    return yearB - yearA;
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    form.reset({
      degree: '',
      institution: '',
      fieldOfStudy: '',
      startYear: undefined,
      endYear: undefined,
      gpa: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const edu = education[index];
    setEditingIndex(index);
    form.reset({
      degree: edu.degree,
      institution: edu.institution,
      fieldOfStudy: edu.fieldOfStudy || '',
      startYear: edu.startYear || undefined,
      endYear: edu.endYear || undefined,
      gpa: edu.gpa || '',
      description: edu.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: EducationFormValues) => {
    const newEducation: Education = {
      degree: data.degree,
      institution: data.institution,
      fieldOfStudy: data.fieldOfStudy?.trim() || undefined,
      startYear: data.startYear || undefined,
      endYear: data.endYear || null,
      gpa: data.gpa?.trim() || undefined,
      description: data.description?.trim() || undefined,
    };

    let updatedEducation: Education[];

    if (editingIndex !== null) {
      // Update existing education - PRESERVE THE ID!
      const existingEducation = education[editingIndex];
      updatedEducation = [...education];
      updatedEducation[editingIndex] = {
        ...newEducation,
        ...(existingEducation.id && { id: existingEducation.id }), // Keep existing ID
      };
      toast.success('Bildung aktualisiert');
    } else {
      // Add new education (no ID yet - backend will assign one)
      updatedEducation = [...education, newEducation];
      toast.success('Bildung hinzugefügt');
    }

    onEducationChange(updatedEducation);
    setIsDialogOpen(false);
    form.reset();
  };

  const handleDelete = (index: number) => {
    const updatedEducation = education.filter((_, i) => i !== index);
    onEducationChange(updatedEducation);
    setDeleteConfirmIndex(null);
    toast.success('Bildung entfernt');
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Bildung</Label>
        <p className="text-sm text-gray-500 mb-4">
          Füge deine akademische Ausbildung hinzu
        </p>

        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Bildung hinzufügen
        </Button>
      </div>

      {/* Education List */}
      {sortedEducation.length > 0 ? (
        <div className="space-y-3">
          {sortedEducation.map((edu, displayIndex) => {
            // Find the original index for editing/deleting
            const originalIndex = education.findIndex(
              e => e.degree === edu.degree && e.institution === edu.institution && e.startYear === edu.startYear
            );
            
            return (
              <Card key={displayIndex} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <GraduationCap className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{edu.degree}</h3>
                          <p className="text-sm text-gray-700 truncate">{edu.institution}</p>
                          {edu.fieldOfStudy && (
                            <p className="text-sm text-gray-600 truncate">{edu.fieldOfStudy}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>
                              {edu.startYear || 'N/A'} -{' '}
                              {edu.endYear ? edu.endYear : (
                                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                                  Heute
                                </Badge>
                              )}
                            </span>
                          </div>
                          {edu.gpa && (
                            <p className="mt-1 text-sm text-gray-600">GPA: {edu.gpa}</p>
                          )}
                          {edu.description && (
                            <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                              {edu.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Bearbeiten</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmIndex(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Löschen</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Noch keine Bildung hinzugefügt. Beginne mit dem Hinzufügen deiner akademischen Ausbildung.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Bildung bearbeiten' : 'Bildung hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Füge Details zu deiner akademischen Ausbildung hinzu
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Degree */}
              <FormField<EducationFormValues>
                control={form.control}
                name="degree"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abschluss *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Bachelor of Science, Master of Arts"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Institution */}
              <FormField<EducationFormValues>
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Technische Universität München"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Field of Study */}
              <FormField<EducationFormValues>
                control={form.control}
                name="fieldOfStudy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Studiengang</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Informatik, Betriebswirtschaftslehre"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Year Range */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField<EducationFormValues>
                  control={form.control}
                  name="startYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startjahr</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="z.B. 2020"
                          min="1900"
                          max={new Date().getFullYear() + 10}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value, 10) : undefined);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<EducationFormValues>
                  control={form.control}
                  name="endYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endjahr</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="z.B. 2024 (leer für laufend)"
                          min="1900"
                          max={new Date().getFullYear() + 10}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value, 10) : null);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* GPA */}
              <FormField<EducationFormValues>
                control={form.control}
                name="gpa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPA / Note</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. 1.5, 3.8/4.0"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField<EducationFormValues>
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Relevante Kurse, Projekte oder Auszeichnungen..."
                        className="min-h-[120px] resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit">
                  {editingIndex !== null ? 'Aktualisieren' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bildung löschen</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du diesen Bildungseintrag löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmIndex(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
