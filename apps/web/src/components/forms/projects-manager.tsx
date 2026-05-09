'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
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
import { Plus, Edit, Trash2, Calendar, FolderGit2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types';

interface ProjectsManagerProps {
  projects: Project[];
  onProjectsChange: (projects: Project[]) => void;
  disabled?: boolean;
}

// Validation schema for project form
const projectSchema = z.object({
  name: z.string().min(1, 'Projektname ist erforderlich'),
  description: z.string().optional(),
  technologies: z.string().optional(), // Comma-separated string in UI, will convert to array
  url: z.string().url('Ungültige URL').optional().or(z.literal('')),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine((data) => {
  // If both dates are provided, end date must be after start date
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: 'Enddatum muss nach oder gleich dem Startdatum sein',
  path: ['endDate'],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectsManager({
  projects,
  onProjectsChange,
  disabled = false,
}: ProjectsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      technologies: '',
      url: '',
      startDate: '',
      endDate: '',
    },
  });

  const sortedProjects = [...projects].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;

    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    return dateB.getTime() - dateA.getTime();
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    form.reset({
      name: '',
      description: '',
      technologies: '',
      url: '',
      startDate: '',
      endDate: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const project = projects[index];
    setEditingIndex(index);
    form.reset({
      name: project.name,
      description: project.description || '',
      technologies: project.technologies?.join(', ') || '',
      url: project.url || '',
      startDate: project.startDate ? project.startDate.split('T')[0] : '',
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: ProjectFormValues) => {
    const technologiesArray = data.technologies
      ?.split(',')
      .map(tech => tech.trim())
      .filter(tech => tech.length > 0);

    const newProject: Project = {
      name: data.name,
      description: data.description?.trim() || undefined,
      technologies: technologiesArray && technologiesArray.length > 0 ? technologiesArray : undefined,
      url: data.url?.trim() || undefined,
      startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
      endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
    };

    let updatedProjects: Project[];

    if (editingIndex !== null) {
      const existingProject = projects[editingIndex];
      updatedProjects = [...projects];
      updatedProjects[editingIndex] = {
        ...newProject,
        ...(existingProject.id && { id: existingProject.id }),
      };
      toast.success('Projekt aktualisiert');
    } else {
      updatedProjects = [...projects, newProject];
      toast.success('Projekt hinzugefügt');
    }

    onProjectsChange(updatedProjects);
    setIsDialogOpen(false);
    form.reset();
  };

  const handleDelete = (index: number) => {
    const updatedProjects = projects.filter((_, i) => i !== index);
    onProjectsChange(updatedProjects);
    setDeleteConfirmIndex(null);
    toast.success('Projekt entfernt');
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
          <h3 className="text-lg font-medium">Projekte</h3>
          <p className="text-sm text-muted-foreground">
            Deine persönlichen und beruflichen Projekte
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

      {sortedProjects.length > 0 ? (
        <div className="space-y-4">
          {sortedProjects.map((project, displayIndex) => {
            const originalIndex = projects.findIndex(
              p => p.name === project.name && p.startDate === project.startDate
            );

            return (
              <Card key={displayIndex} className="border-border/50 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FolderGit2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground">{project.name}</h4>
                            {project.url && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs bg-primary/5 px-2 py-0.5 rounded-full transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Link</span>
                              </a>
                            )}
                          </div>

                          {project.description && (
                            <div 
                              className="mt-3 text-sm text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: project.description }}
                            />
                          )}

                          {project.technologies && project.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {project.technologies.map((tech, techIndex) => (
                                <Badge key={techIndex} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-secondary/50 hover:bg-secondary">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {(project.startDate || project.endDate) && (
                            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {project.startDate ? formatDate(project.startDate) : '?'} -{' '}
                                {project.endDate ? formatDate(project.endDate) : 'Heute'}
                              </span>
                            </div>
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
            <FolderGit2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Projekte</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Zeige deine persönlichen und beruflichen Projekte, um dein Profil zu stärken.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Erstes Projekt hinzufügen
          </Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? 'Projekt bearbeiten' : 'Projekt hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              Füge Details zu deinem Projekt hinzu
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projektname *</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. E-Commerce Platform" {...field} />
                    </FormControl>
                    <FormMessage />
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
                      <RichTextEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Beschreibe dein Projekt, deine Rolle und die Ergebnisse..."
                        minHeight="120px"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }/>

              <FormField
                control={form.control}
                name="technologies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verwendete Technologien / Methoden</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. Projektmanagement, Budgetplanung, SAP, Scrum (durch Komma trennen)"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Relevante Methoden oder Tools durch Komma trennen
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projekt-URL</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://github.com/username/project"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startdatum</FormLabel>
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
                        <Input type="date" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leer lassen falls noch laufend
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
            <DialogTitle>Projekt löschen</DialogTitle>
            <DialogDescription>
              Möchtest du dieses Projekt wirklich löschen?
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
