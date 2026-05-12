'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Plus, Edit, Trash2, Calendar, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import type { Education } from '@/types';

interface EducationManagerProps {
  education: Education[];
  onEducationChange: (education: Education[]) => void;
  disabled?: boolean;
}

export function EducationManager({
  education,
  onEducationChange,
  disabled = false,
}: EducationManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  /* form state */
  const [institution, setInstitution] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [gpa, setGpa] = useState('');
  const [description, setDescription] = useState('');

  const institutionRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setInstitution('');
    setDegree('');
    setFieldOfStudy('');
    setStartYear('');
    setEndYear('');
    setGpa('');
    setDescription('');
  };

  const sortedEducation = [...education].sort((a, b) => (b.startYear || 0) - (a.startYear || 0));

  const openAddDialog = () => {
    setEditingIndex(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    const edu = education[index];
    setEditingIndex(index);
    setInstitution(edu.institution);
    setDegree(edu.degree);
    setFieldOfStudy(edu.fieldOfStudy || '');
    setStartYear(edu.startYear ? String(edu.startYear) : '');
    setEndYear(edu.endYear ? String(edu.endYear) : '');
    setGpa(edu.gpa || '');
    setDescription(edu.description || '');
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (isDialogOpen) {
      const t = setTimeout(() => institutionRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isDialogOpen]);

  const canSubmit = institution.trim() && degree.trim();

  const handleSubmit = () => {
    if (!institution.trim()) {
      toast.error('Bitte gib eine Institution ein');
      institutionRef.current?.focus();
      return;
    }
    if (!degree.trim()) {
      toast.error('Bitte gib einen Abschluss ein');
      return;
    }
    const sy = startYear ? parseInt(startYear, 10) : undefined;
    const ey = endYear ? parseInt(endYear, 10) : null;
    if (sy && ey && ey < sy) {
      toast.error('Endjahr muss nach dem Startjahr liegen');
      return;
    }

    const newEdu: Education = {
      institution: institution.trim(),
      degree: degree.trim(),
      fieldOfStudy: fieldOfStudy.trim() || undefined,
      startYear: sy,
      endYear: ey,
      gpa: gpa.trim() || undefined,
      description: description.trim() || undefined,
    };

    let updated: Education[];
    if (editingIndex !== null) {
      const existing = education[editingIndex];
      updated = [...education];
      updated[editingIndex] = { ...newEdu, ...(existing.id && { id: existing.id }) };
      toast.success('Bildung aktualisiert');
    } else {
      updated = [...education, newEdu];
      toast.success('Bildung hinzugefügt');
    }

    onEducationChange(updated);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (index: number) => {
    onEducationChange(education.filter((_, i) => i !== index));
    setDeleteConfirmIndex(null);
    toast.success('Bildung entfernt');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Bildung</h3>
          <p className="text-sm text-muted-foreground">Deine akademische Ausbildung</p>
        </div>
        <Button type="button" onClick={openAddDialog} disabled={disabled} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Hinzufügen
        </Button>
      </div>

      {sortedEducation.length > 0 ? (
        <div className="space-y-4">
          {sortedEducation.map((edu, displayIndex) => {
            const originalIndex = education.findIndex(
              (e) =>
                e.degree === edu.degree &&
                e.institution === edu.institution &&
                e.startYear === edu.startYear,
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
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-foreground">
                            {edu.institution}
                          </h4>
                          <p className="truncate text-sm text-foreground/80">{edu.degree}</p>
                          {edu.fieldOfStudy && (
                            <p className="truncate text-sm text-muted-foreground">
                              {edu.fieldOfStudy}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {edu.startYear || '?'} –{' '}
                              {edu.endYear ? (
                                edu.endYear
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="h-5 px-1.5 py-0 text-[10px]"
                                >
                                  Heute
                                </Badge>
                              )}
                            </span>
                          </div>
                          {edu.gpa && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Note: {edu.gpa}
                            </p>
                          )}
                          {edu.description && (
                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                              {edu.description.replace(/<[^>]*>/g, '')}
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <GraduationCap className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Bildung</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Füge deine akademische Ausbildung hinzu, um dein Profil zu vervollständigen.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            disabled={disabled}
            className="mt-4"
          >
            <Plus className="mr-2 h-4 w-4" />
            Erste Bildung hinzufügen
          </Button>
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingIndex !== null ? 'Bildung bearbeiten' : 'Neue Bildung'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6 pt-2">
            {/* Institution */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Institution <span className="text-destructive">*</span>
              </label>
              <Input
                ref={institutionRef}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="z.B. Technische Universität München"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Degree */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Abschluss <span className="text-destructive">*</span>
              </label>
              <Input
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="z.B. Bachelor of Science"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Field of study */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Studiengang{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <Input
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="z.B. Informatik, BWL"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Years */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Von{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  placeholder="z.B. 2020"
                  min="1900"
                  max={new Date().getFullYear() + 10}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Bis{' '}
                  <span className="font-normal text-muted-foreground">– optional</span>
                </label>
                <Input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  placeholder="z.B. 2024"
                  min="1900"
                  max={new Date().getFullYear() + 10}
                />
                <p className="text-xs text-muted-foreground">Leer = noch laufend</p>
              </div>
            </div>

            {/* GPA */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Note{' '}
                <span className="font-normal text-muted-foreground">– optional</span>
              </label>
              <Input
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="z.B. 1.5"
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
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
                placeholder="Relevante Kurse, Projekte oder Auszeichnungen …"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
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
            <DialogTitle>Bildung löschen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchtest du diesen Eintrag wirklich löschen? Das kann nicht rückgängig gemacht
            werden.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmIndex(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmIndex !== null && handleDelete(deleteConfirmIndex)
              }
            >
              Löschen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
