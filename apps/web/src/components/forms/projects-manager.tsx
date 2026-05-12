'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, FolderGit2, ExternalLink, X, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types';

interface ProjectsManagerProps {
  projects: Project[];
  onProjectsChange: (projects: Project[]) => void;
  disabled?: boolean;
}

/* ── Technology tag input ── */
function TechTagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        toast.error('Bereits vorhanden');
        return;
      }
      onChange([...tags, trimmed]);
      setInput('');
    },
    [tags, onChange],
  );

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1"
    >
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
            className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
          } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags.length - 1);
          }
        }}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={tags.length === 0 ? 'z.B. React, Python, Scrum …' : ''}
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/* ── Main component ── */
export function ProjectsManager({
  projects,
  onProjectsChange,
  disabled = false,
}: ProjectsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  /* form state */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [urlError, setUrlError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTechnologies([]);
    setUrl('');
    setStartDate('');
    setEndDate('');
    setUrlError('');
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const project = projects[index];
    setEditingIndex(index);
    setName(project.name);
    setDescription(project.description || '');
    setTechnologies(project.technologies || []);
    setUrl(project.url || '');
    setStartDate(project.startDate ? project.startDate.split('T')[0] : '');
    setEndDate(project.endDate ? project.endDate.split('T')[0] : '');
    setUrlError('');
    setIsDialogOpen(true);
  };

  /* Focus name field when dialog opens */
  useEffect(() => {
    if (isDialogOpen) {
      // small delay so dialog animation finishes
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isDialogOpen]);

  const validate = (): boolean => {
    if (!name.trim()) {
      toast.error('Bitte gib einen Projektnamen ein');
      nameRef.current?.focus();
      return false;
    }
    if (url.trim()) {
      try {
        new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
      } catch {
        setUrlError('Bitte gib eine gültige URL ein');
        return false;
      }
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error('Enddatum muss nach dem Startdatum liegen');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    let finalUrl = url.trim() || undefined;
    if (finalUrl && !finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }

    const newProject: Project = {
      name: name.trim(),
      description: description.trim() || undefined,
      technologies: technologies.length > 0 ? technologies : undefined,
      url: finalUrl,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
    };

    let updatedProjects: Project[];

    if (editingIndex !== null) {
      const existing = projects[editingIndex];
      updatedProjects = [...projects];
      updatedProjects[editingIndex] = {
        ...newProject,
        ...(existing.id && { id: existing.id }),
      };
      toast.success('Projekt aktualisiert');
    } else {
      updatedProjects = [...projects, newProject];
      toast.success('Projekt hinzugefügt');
    }

    onProjectsChange(updatedProjects);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (index: number) => {
    onProjectsChange(projects.filter((_, i) => i !== index));
    setDeleteConfirmIndex(null);
    toast.success('Projekt entfernt');
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Projekte</h3>
          <p className="text-sm text-muted-foreground">
            Deine persönlichen und beruflichen Projekte
          </p>
        </div>
        <Button type="button" onClick={openAddDialog} disabled={disabled} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Hinzufügen
        </Button>
      </div>

      {sortedProjects.length > 0 ? (
        <div className="space-y-4">
          {sortedProjects.map((project, displayIndex) => {
            const originalIndex = projects.findIndex(
              (p) => p.name === project.name && p.startDate === project.startDate,
            );

            return (
              <Card
                key={displayIndex}
                className="border-border/50 shadow-sm transition-all hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FolderGit2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-foreground">{project.name}</h4>
                            {project.url && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-full bg-primary/5 px-2 py-0.5 text-xs text-primary transition-colors hover:text-primary/80"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Link</span>
                              </a>
                            )}
                          </div>

                          {project.description && (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                              {project.description}
                            </p>
                          )}

                          {project.technologies && project.technologies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {project.technologies.map((tech, techIndex) => (
                                <Badge
                                  key={techIndex}
                                  variant="secondary"
                                  className="h-5 bg-secondary/50 px-1.5 py-0 text-[10px] hover:bg-secondary"
                                >
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {(project.startDate || project.endDate) && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {project.startDate ? fmtDate(project.startDate) : '?'} –{' '}
                                {project.endDate ? fmtDate(project.endDate) : 'Heute'}
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FolderGit2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Projekte</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Zeige deine persönlichen und beruflichen Projekte, um dein Profil zu stärken.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Erstes Projekt hinzufügen
          </Button>
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingIndex !== null ? 'Projekt bearbeiten' : 'Neues Projekt'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Projektname <span className="text-destructive">*</span>
              </label>
              <Input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. E-Commerce Platform"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Beschreibung{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Was hast du gemacht? Was war deine Rolle?"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Technologies */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Technologien & Methoden{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <TechTagInput tags={technologies} onChange={setTechnologies} />
              <p className="text-xs text-muted-foreground">
                Eingabe mit Enter bestätigen
              </p>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Link{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setUrlError('');
                  }}
                  placeholder="github.com/user/project"
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                />
              </div>
              {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Von{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Bis{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leer = noch laufend</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={!name.trim()}>
                {editingIndex !== null ? 'Speichern' : 'Hinzufügen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog
        open={deleteConfirmIndex !== null}
        onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Projekt löschen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchtest du dieses Projekt wirklich löschen? Das kann nicht rückgängig gemacht
            werden.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)}
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
