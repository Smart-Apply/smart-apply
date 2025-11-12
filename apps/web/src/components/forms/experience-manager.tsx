'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Edit, Trash2, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import type { Experience } from '@/types';

interface ExperienceManagerProps {
  experiences: Experience[];
  onExperiencesChange: (experiences: Experience[]) => void;
  disabled?: boolean;
}

// Validation schema for experience form
const experienceSchema = z.object({
  title: z.string().min(1, 'Jobtitel ist erforderlich'),
  company: z.string().min(1, 'Firma ist erforderlich'),
  location: z.string().optional(),
  startDate: z.string().min(1, 'Startdatum ist erforderlich'),
  endDate: z.string().optional(),
  current: z.boolean(),
  description: z.string().optional(),
});

type ExperienceFormValues = z.infer<typeof experienceSchema>;

/**
 * ExperienceManager Component
 * 
 * Manages work experience entries with add, edit, and delete functionality.
 * - Display list of existing experiences (sorted by start date)
 * - Add new experience via dialog/modal
 * - Edit existing entries
 * - Delete entries with confirmation
 * - "Currently working" checkbox clears end date
 */
export function ExperienceManager({
  experiences,
  onExperiencesChange,
  disabled = false,
}: ExperienceManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const form = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    },
  });

  // Watch the "current" field to manage end date visibility
  const isCurrentlyWorking = form.watch('current');

  // Sort experiences by start date (most recent first)
  const sortedExperiences = [...experiences].sort((a, b) => {
    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    return dateB.getTime() - dateA.getTime();
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    form.reset({
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const experience = experiences[index];
    setEditingIndex(index);
    form.reset({
      title: experience.title,
      company: experience.company,
      location: experience.location || '',
      startDate: experience.startDate.split('T')[0], // Convert ISO to YYYY-MM-DD
      endDate: experience.endDate ? experience.endDate.split('T')[0] : '',
      current: !experience.endDate,
      description: experience.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: ExperienceFormValues) => {
    const newExperience: Experience = {
      title: data.title,
      company: data.company,
      location: data.location || undefined,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.current || !data.endDate ? null : new Date(data.endDate).toISOString(),
      description: data.description || undefined,
      current: data.current,
    };

    let updatedExperiences: Experience[];

    if (editingIndex !== null) {
      // Update existing experience
      updatedExperiences = [...experiences];
      updatedExperiences[editingIndex] = newExperience;
      toast.success('Erfahrung aktualisiert');
    } else {
      // Add new experience
      updatedExperiences = [...experiences, newExperience];
      toast.success('Erfahrung hinzugefügt');
    }

    onExperiencesChange(updatedExperiences);
    setIsDialogOpen(false);
    form.reset();
  };

  const handleDelete = (index: number) => {
    const updatedExperiences = experiences.filter((_, i) => i !== index);
    onExperiencesChange(updatedExperiences);
    setDeleteConfirmIndex(null);
    toast.success('Erfahrung entfernt');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Berufserfahrung</Label>
        <p className="text-sm text-gray-500 mb-4">
          Füge deine Arbeitsstellen und beruflichen Erfahrungen hinzu
        </p>

        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Erfahrung hinzufügen
        </Button>
      </div>

      {/* Experience List */}
      {sortedExperiences.length > 0 ? (
        <div className="space-y-3">
          {sortedExperiences.map((exp, displayIndex) => {
            // Find the original index for editing/deleting
            const originalIndex = experiences.findIndex(
              e => e.title === exp.title && e.company === exp.company && e.startDate === exp.startDate
            );
            
            return (
              <Card key={displayIndex} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <Briefcase className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{exp.title}</h3>
                          <p className="text-sm text-gray-700 truncate">{exp.company}</p>
                          {exp.location && (
                            <p className="text-sm text-gray-500 truncate">{exp.location}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>
                              {formatDate(exp.startDate)} -{' '}
                              {exp.endDate ? formatDate(exp.endDate) : (
                                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                                  Heute
                                </Badge>
                              )}
                            </span>
                          </div>
                          {exp.description && (
                            <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                              {exp.description}
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
            Noch keine Berufserfahrung hinzugefügt. Beginne mit dem Hinzufügen deiner Arbeitsstellen.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Erfahrung bearbeiten' : 'Erfahrung hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Füge Details zu deiner beruflichen Erfahrung hinzu
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Job Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jobtitel *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Senior Software Engineer"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company */}
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firma *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Tech GmbH"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standort</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Berlin, Deutschland"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Range */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startdatum *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enddatum</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          disabled={isCurrentlyWorking}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Currently Working Checkbox */}
              <FormField
                control={form.control}
                name="current"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue('endDate', '');
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">
                        Ich arbeite derzeit in dieser Position
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschreibe deine Aufgaben, Erfolge und Verantwortlichkeiten..."
                        className="min-h-[120px] resize-none"
                        {...field}
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
            <DialogTitle>Erfahrung löschen</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du diese Erfahrung löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
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
