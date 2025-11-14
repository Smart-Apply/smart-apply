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

/**
 * ProjectsManager Component
 * 
 * Manages project entries with add, edit, and delete functionality.
 * - Display list of existing projects (sorted by start date, most recent first)
 * - Add new project via dialog/modal
 * - Edit existing entries
 * - Delete entries with confirmation
 * - Technologies input as comma-separated values that become chips
 */
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

  // Sort projects by start date (most recent first)
  const sortedProjects = [...projects].sort((a, b) => {
    // Projects without start date go to the end
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
      technologies: project.technologies?.join(', ') || '', // Convert array to comma-separated string
      url: project.url || '',
      startDate: project.startDate ? project.startDate.split('T')[0] : '', // Convert ISO to YYYY-MM-DD
      endDate: project.endDate ? project.endDate.split('T')[0] : '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: ProjectFormValues) => {
    // Parse technologies from comma-separated string to array
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
      // Update existing project - PRESERVE THE ID!
      const existingProject = projects[editingIndex];
      updatedProjects = [...projects];
      updatedProjects[editingIndex] = {
        ...newProject,
        ...(existingProject.id && { id: existingProject.id }), // Keep existing ID
      };
      toast.success('Projekt aktualisiert');
    } else {
      // Add new project (no ID yet - backend will assign one)
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
    <div className="space-y-4">
      <div>
        <Label className="text-base">Projekte</Label>
        <p className="text-sm text-gray-500 mb-4">
          Zeige deine persönlichen und beruflichen Projekte
        </p>

        <Button
          type="button"
          onClick={openAddDialog}
          disabled={disabled}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Projekt hinzufügen
        </Button>
      </div>

      {/* Projects List */}
      {sortedProjects.length > 0 ? (
        <div className="space-y-3">
          {sortedProjects.map((project, displayIndex) => {
            // Find the original index for editing/deleting
            const originalIndex = projects.findIndex(
              p => p.name === project.name && p.startDate === project.startDate
            );
            
            return (
              <Card key={displayIndex} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <FolderGit2 className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900">{project.name}</h3>
                            {project.url && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="sr-only">Projektlink öffnen</span>
                              </a>
                            )}
                          </div>
                          
                          {project.description && (
                            <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                              {project.description}
                            </p>
                          )}

                          {project.technologies && project.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {project.technologies.map((tech, techIndex) => (
                                <Badge key={techIndex} variant="secondary" className="text-xs">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {(project.startDate || project.endDate) && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>
                                {project.startDate ? formatDate(project.startDate) : '?'} -{' '}
                                {project.endDate ? formatDate(project.endDate) : 'Heute'}
                              </span>
                            </div>
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
            Noch keine Projekte hinzugefügt. Zeige deine persönlichen und beruflichen Projekte.
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
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
              {/* Project Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projektname *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. E-Commerce Platform"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
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
                        placeholder="Beschreibe dein Projekt, deine Rolle und die Ergebnisse..."
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Technologies */}
              <FormField
                control={form.control}
                name="technologies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verwendete Technologien</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. TypeScript, React, Node.js (durch Komma trennen)"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      Technologien durch Komma trennen
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Project URL */}
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

              {/* Date Range */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startdatum</FormLabel>
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
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        Leer lassen falls noch laufend
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
            <DialogTitle>Projekt löschen</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du dieses Projekt löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.
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
