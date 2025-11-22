'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { ResumeData } from '@/types';

interface ResumeFormEditorProps {
  value: ResumeData;
  onChange: (resume: ResumeData) => void;
  disabled?: boolean;
}

export function ResumeFormEditor({ value, onChange, disabled }: ResumeFormEditorProps) {
  const updateField = <K extends keyof ResumeData>(field: K, newValue: ResumeData[K]) => {
    onChange({ ...value, [field]: newValue });
  };

  const addSkillCategory = () => {
    onChange({
      ...value,
      skillCategories: [...value.skillCategories, { type: '', skills: [], _key: Date.now().toString() }],
    });
  };

  const updateSkillCategory = (index: number, type: string, skills: string[]) => {
    const updated = [...value.skillCategories];
    updated[index] = { type, skills };
    onChange({ ...value, skillCategories: updated });
  };

  const removeSkillCategory = (index: number) => {
    onChange({
      ...value,
      skillCategories: value.skillCategories.filter((_, i) => i !== index),
    });
  };

  const addExperience = () => {
    onChange({
      ...value,
      experiences: [
        ...value.experiences,
        { title: '', company: '', location: '', dateRange: '', achievements: [] },
      ],
    });
  };

  const updateExperience = (index: number, field: string, newValue: string | string[]) => {
    const updated = [...value.experiences];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange({ ...value, experiences: updated });
  };

  const removeExperience = (index: number) => {
    onChange({
      ...value,
      experiences: value.experiences.filter((_, i) => i !== index),
    });
  };

  const addProject = () => {
    onChange({
      ...value,
      projects: [...(value.projects || []), { name: '', description: '', date: '', highlights: [] }],
    });
  };

  const updateProject = (index: number, field: string, newValue: string | string[]) => {
    const updated = [...(value.projects || [])];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange({ ...value, projects: updated });
  };

  const removeProject = (index: number) => {
    onChange({
      ...value,
      projects: (value.projects || []).filter((_, i) => i !== index),
    });
  };

  const addEducation = () => {
    onChange({
      ...value,
      education: [
        ...(value.education || []),
        { degree: '', institution: '', year: '', fieldOfStudy: '', gpa: '', description: '' },
      ],
    });
  };

  const updateEducation = (index: number, field: string, newValue: string) => {
    const updated = [...(value.education || [])];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange({ ...value, education: updated });
  };

  const removeEducation = (index: number) => {
    onChange({
      ...value,
      education: (value.education || []).filter((_, i) => i !== index),
    });
  };

  const addCertification = () => {
    onChange({
      ...value,
      certifications: [...(value.certifications || []), { name: '', issuer: '', date: '' }],
    });
  };

  const updateCertification = (index: number, field: string, newValue: string) => {
    const updated = [...(value.certifications || [])];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange({ ...value, certifications: updated });
  };

  const removeCertification = (index: number) => {
    onChange({
      ...value,
      certifications: (value.certifications || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Persönliche Daten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="candidateName">Name *</Label>
              <Input
                id="candidateName"
                value={value.candidateName}
                onChange={(e) => updateField('candidateName', e.target.value)}
                disabled={disabled}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={value.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={disabled}
                placeholder="deine@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={value.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                disabled={disabled}
                placeholder="+49 123 456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Standort</Label>
              <Input
                id="location"
                value={value.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                disabled={disabled}
                placeholder="Stadt, Land"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={value.linkedin || ''}
                onChange={(e) => updateField('linkedin', e.target.value)}
                disabled={disabled}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github">GitHub</Label>
              <Input
                id="github"
                value={value.github || ''}
                onChange={(e) => updateField('github', e.target.value)}
                disabled={disabled}
                placeholder="https://github.com/..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Zusammenfassung</Label>
            <Textarea
              id="summary"
              value={value.summary || ''}
              onChange={(e) => updateField('summary', e.target.value)}
              disabled={disabled}
              placeholder="Kurze Zusammenfassung deiner Qualifikationen..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fähigkeiten</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSkillCategory}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Kategorie hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.skillCategories.map((category, index) => (
            <div key={category._key || `skill-${index}`} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <Input
                    value={category.type}
                    onChange={(e) =>
                      updateSkillCategory(index, e.target.value, category.skills)
                    }
                    disabled={disabled}
                    placeholder="Kategorie (z.B. Programming Language, Framework)"
                  />
                  <Textarea
                    value={category.skills.join(', ')}
                    onChange={(e) =>
                      updateSkillCategory(
                        index,
                        category.type,
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    disabled={disabled}
                    placeholder="Skills durch Komma trennen (z.B. TypeScript, React, Node.js)"
                    rows={2}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSkillCategory(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {value.skillCategories.length === 0 && (
            <p className="text-sm text-gray-500">Noch keine Fähigkeiten hinzugefügt</p>
          )}
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Berufserfahrung</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExperience}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Erfahrung hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.experiences.map((exp, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={exp.title}
                      onChange={(e) => updateExperience(index, 'title', e.target.value)}
                      disabled={disabled}
                      placeholder="Position *"
                    />
                    <Input
                      value={exp.company}
                      onChange={(e) => updateExperience(index, 'company', e.target.value)}
                      disabled={disabled}
                      placeholder="Unternehmen *"
                    />
                    <Input
                      value={exp.location || ''}
                      onChange={(e) => updateExperience(index, 'location', e.target.value)}
                      disabled={disabled}
                      placeholder="Standort"
                    />
                    <Input
                      value={exp.dateRange}
                      onChange={(e) => updateExperience(index, 'dateRange', e.target.value)}
                      disabled={disabled}
                      placeholder="Zeitraum (z.B. Jan 2020 - Dez 2023)"
                    />
                  </div>
                  <Textarea
                    value={(exp.achievements || []).join('\n')}
                    onChange={(e) =>
                      updateExperience(
                        index,
                        'achievements',
                        e.target.value.split('\n').filter(Boolean)
                      )
                    }
                    disabled={disabled}
                    placeholder="Erfolge & Aufgaben (eine pro Zeile)"
                    rows={4}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExperience(index)}
                  disabled={disabled}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {value.experiences.length === 0 && (
            <p className="text-sm text-gray-500">Noch keine Berufserfahrung hinzugefügt</p>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Projekte</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProject}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Projekt hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(value.projects || []).map((project, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={project.name}
                      onChange={(e) => updateProject(index, 'name', e.target.value)}
                      disabled={disabled}
                      placeholder="Projektname *"
                    />
                    <Input
                      value={project.date || ''}
                      onChange={(e) => updateProject(index, 'date', e.target.value)}
                      disabled={disabled}
                      placeholder="Zeitraum"
                    />
                  </div>
                  <Textarea
                    value={project.description || ''}
                    onChange={(e) => updateProject(index, 'description', e.target.value)}
                    disabled={disabled}
                    placeholder="Beschreibung"
                    rows={2}
                  />
                  <Textarea
                    value={(project.highlights || []).join('\n')}
                    onChange={(e) =>
                      updateProject(
                        index,
                        'highlights',
                        e.target.value.split('\n').filter(Boolean)
                      )
                    }
                    disabled={disabled}
                    placeholder="Highlights (eine pro Zeile)"
                    rows={3}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProject(index)}
                  disabled={disabled}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {(!value.projects || value.projects.length === 0) && (
            <p className="text-sm text-gray-500">Noch keine Projekte hinzugefügt</p>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ausbildung</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEducation}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ausbildung hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(value.education || []).map((edu, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={edu.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      disabled={disabled}
                      placeholder="Abschluss *"
                    />
                    <Input
                      value={edu.institution}
                      onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                      disabled={disabled}
                      placeholder="Institution *"
                    />
                    <Input
                      value={edu.year}
                      onChange={(e) => updateEducation(index, 'year', e.target.value)}
                      disabled={disabled}
                      placeholder="Jahr *"
                    />
                    <Input
                      value={edu.fieldOfStudy || ''}
                      onChange={(e) => updateEducation(index, 'fieldOfStudy', e.target.value)}
                      disabled={disabled}
                      placeholder="Studienrichtung"
                    />
                  </div>
                  <Input
                    value={edu.gpa || ''}
                    onChange={(e) => updateEducation(index, 'gpa', e.target.value)}
                    disabled={disabled}
                    placeholder="Note/GPA"
                  />
                  <Textarea
                    value={edu.description || ''}
                    onChange={(e) => updateEducation(index, 'description', e.target.value)}
                    disabled={disabled}
                    placeholder="Beschreibung"
                    rows={2}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEducation(index)}
                  disabled={disabled}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
          {(!value.education || value.education.length === 0) && (
            <p className="text-sm text-gray-500">Noch keine Ausbildung hinzugefügt</p>
          )}
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Zertifikate</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCertification}
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Zertifikat hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(value.certifications || []).map((cert, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex-1 grid gap-3 md:grid-cols-3">
                <Input
                  value={cert.name}
                  onChange={(e) => updateCertification(index, 'name', e.target.value)}
                  disabled={disabled}
                  placeholder="Zertifikat *"
                />
                <Input
                  value={cert.issuer}
                  onChange={(e) => updateCertification(index, 'issuer', e.target.value)}
                  disabled={disabled}
                  placeholder="Aussteller *"
                />
                <Input
                  value={cert.date || ''}
                  onChange={(e) => updateCertification(index, 'date', e.target.value)}
                  disabled={disabled}
                  placeholder="Datum"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCertification(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
          {(!value.certifications || value.certifications.length === 0) && (
            <p className="text-sm text-gray-500">Noch keine Zertifikate hinzugefügt</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
