'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApplications } from '@/hooks/use-applications';
import { Loader2 } from 'lucide-react';
import type { StartInterviewDto, InterviewType, InterviewDifficulty, Application } from '@/types';

interface StartInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (data: StartInterviewDto) => void;
  isLoading?: boolean;
}

const interviewTypes: { value: InterviewType; label: string; description: string }[] = [
  { value: 'MIXED', label: 'Gemischt', description: 'Kombination aller Fragetypen' },
  { value: 'BEHAVIORAL', label: 'Verhaltensbezogen', description: 'STAR-Methode, Situationsfragen' },
  { value: 'TECHNICAL', label: 'Technisch', description: 'Fachliche & technische Fragen' },
  { value: 'CASE_STUDY', label: 'Fallstudie', description: 'Problemlösung & Analyse' },
];

const difficultyLevels: { value: InterviewDifficulty; label: string; description: string }[] = [
  { value: 'EASY', label: 'Einsteiger', description: 'Grundlegende Fragen' },
  { value: 'MEDIUM', label: 'Standard', description: 'Mittlerer Schwierigkeitsgrad' },
  { value: 'HARD', label: 'Experte', description: 'Komplexe & herausfordernde Fragen' },
];

const industries = [
  'IT / Software',
  'Finanzen / Banking',
  'Gesundheitswesen',
  'Vertrieb / Sales',
  'Marketing',
  'Beratung / Consulting',
  'Produktion / Fertigung',
  'Logistik',
  'Personalwesen / HR',
  'Sonstiges',
];

export function StartInterviewDialog({
  open,
  onOpenChange,
  onStart,
  isLoading,
}: StartInterviewDialogProps) {
  const [mode, setMode] = useState<'application' | 'custom'>('custom');
  const [formData, setFormData] = useState<StartInterviewDto>({
    type: 'MIXED',
    difficulty: 'MEDIUM',
    language: 'de',
    maxQuestions: 10,
  });

  const { data: applications = [] } = useApplications({ includeJobPosting: true });
  const readyApplications = applications.filter((app: Application) => app.status === 'READY');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean up the data: remove empty strings and undefined values
    // Backend expects UUID or undefined, not empty string
    const cleanedData: StartInterviewDto = {
      ...formData,
    };
    
    // Remove applicationId if not in application mode or if empty
    if (mode !== 'application' || !formData.applicationId) {
      delete cleanedData.applicationId;
    }
    
    // Remove empty string fields (jobTitle, company, industry)
    if (!cleanedData.jobTitle) delete cleanedData.jobTitle;
    if (!cleanedData.company) delete cleanedData.company;
    if (!cleanedData.industry) delete cleanedData.industry;
    
    onStart(cleanedData);
  };

  const updateField = <K extends keyof StartInterviewDto>(
    key: K,
    value: StartInterviewDto[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neues Interview starten</DialogTitle>
            <DialogDescription>
              Konfigurieren Sie Ihre Interview-Übung. Die KI passt die Fragen an Ihre Einstellungen an.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'application' | 'custom')} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="custom">Freies Interview</TabsTrigger>
              <TabsTrigger value="application" disabled={readyApplications.length === 0}>
                Basierend auf Bewerbung
              </TabsTrigger>
            </TabsList>

            <TabsContent value="application" className="space-y-4 mt-4">
              {readyApplications.length > 0 ? (
                <div className="space-y-2">
                  <Label>Bewerbung auswählen</Label>
                  <Select
                    value={formData.applicationId || ''}
                    onValueChange={(v) => updateField('applicationId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wählen Sie eine Bewerbung" />
                    </SelectTrigger>
                    <SelectContent>
                      {readyApplications.map((app: Application) => (
                        <SelectItem key={app.id} value={app.id}>
                          {app.title || app.jobPosting?.title || 'Unbenannte Bewerbung'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Die Fragen werden basierend auf der Stellenbeschreibung generiert.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Keine fertigen Bewerbungen verfügbar. Erstellen Sie zuerst eine Bewerbung.
                </p>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Position</Label>
                  <Input
                    id="jobTitle"
                    placeholder="z.B. Software Engineer"
                    value={formData.jobTitle || ''}
                    onChange={(e) => updateField('jobTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Unternehmen</Label>
                  <Input
                    id="company"
                    placeholder="z.B. Google"
                    value={formData.company || ''}
                    onChange={(e) => updateField('company', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Branche</Label>
                <Select
                  value={formData.industry || ''}
                  onValueChange={(v) => updateField('industry', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional: Branche wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobDescription">Stellenbeschreibung (optional)</Label>
                <Textarea
                  id="jobDescription"
                  placeholder="Fügen Sie die Stellenbeschreibung ein, um spezifischere Fragen zu erhalten..."
                  value={formData.jobDescription || ''}
                  onChange={(e) => updateField('jobDescription', e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Common Settings */}
          <div className="space-y-4 mt-6 pt-4 border-t">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Interview-Typ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => updateField('type', v as InterviewType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {interviewTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <span>{t.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {t.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Schwierigkeit</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(v) => updateField('difficulty', v as InterviewDifficulty)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {difficultyLevels.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Anzahl Fragen</Label>
                <Select
                  value={String(formData.maxQuestions || 10)}
                  onValueChange={(v) => updateField('maxQuestions', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Fragen</SelectItem>
                    <SelectItem value="10">10 Fragen</SelectItem>
                    <SelectItem value="15">15 Fragen</SelectItem>
                    <SelectItem value="20">20 Fragen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sprache</Label>
                <Select
                  value={formData.language || 'de'}
                  onValueChange={(v) => updateField('language', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Interview starten
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
