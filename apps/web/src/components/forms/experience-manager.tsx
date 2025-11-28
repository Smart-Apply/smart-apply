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

  const isCurrentlyWorking = form.watch('current');

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
      startDate: experience.startDate.split('T')[0],
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
      location: data.location?.trim() || undefined,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.current || !data.endDate ? null : new Date(data.endDate).toISOString(),
      description: data.description?.trim() || null,
      current: data.current,
    };

    let updatedExperiences: Experience[];

    if (editingIndex !== null) {
      const existingExperience = experiences[editingIndex];
      updatedExperiences = [...experiences];
      updatedExperiences[editingIndex] = {
        ...newExperience,
        ...(existingExperience.id && { id: existingExperience.id }),
      };
      toast.success('Erfahrung aktualisiert');
    } else {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Berufserfahrung</h3>
          <p className="text-sm text-muted-foreground">
            Deine bisherigen Arbeitsstellen
          </p>
        </div>
        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </div>

      {sortedExperiences.length > 0 ? (
        <div className="space-y-4">
          {sortedExperiences.map((exp, displayIndex) => {
            const originalIndex = experiences.findIndex(
              e => e.title === exp.title && e.company === exp.company && e.startDate === exp.startDate
            );

            return (
              <Card key={displayIndex} className="border-border/50 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{exp.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground/80">{exp.company}</span>
                            {exp.location && (
                              <>
                                <span>•</span>
                                <span>{exp.location}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDate(exp.startDate)} -{' '}
                              {exp.endDate ? formatDate(exp.endDate) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                  Aktuell
                                </Badge>
                              )}
                            </span>
                          </div>

                          {exp.description && (
                            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmIndex(originalIndex)}
                        disabled={disabled}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Berufserfahrung</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Füge deine bisherigen Arbeitsstellen hinzu, um dein Profil zu vervollständigen.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Erste Erfahrung hinzufügen
          </Button>
        </div>
      )}

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
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jobtitel *</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Senior Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firma *</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Tech GmbH" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standort</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Berlin, Deutschland" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startdatum *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                        <Input type="date" disabled={isCurrentlyWorking} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="current"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue('endDate', '');
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Ich arbeite derzeit hier</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Beschreibe deine Aufgaben und Erfolge..."
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">
                  {editingIndex !== null ? 'Speichern' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmIndex !== null} onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erfahrung löschen</DialogTitle>
            <DialogDescription>
              Möchtest du diesen Eintrag wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
