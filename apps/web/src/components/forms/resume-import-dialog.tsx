'use client';

import * as React from 'react';
import { Upload, FileText, Loader2, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useParseResume,
  getSectionLabel,
  sectionHasData,
  getSectionCount,
  type ImportableSection,
} from '@/hooks/use-parse-resume';
import type { ExtractedProfile } from '@/types';
import { cn } from '@/lib/utils';

interface ResumeImportDialogProps {
  onImport: (data: ExtractedProfile, sections: ImportableSection[]) => void;
  trigger?: React.ReactNode;
}

const ALL_SECTIONS: ImportableSection[] = [
  'personal',
  'summary',
  'skills',
  'experiences',
  'education',
  'certificates',
  'projects',
  'languages',
];

export function ResumeImportDialog({ onImport, trigger }: ResumeImportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'upload' | 'preview'>('upload');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedSections, setSelectedSections] = React.useState<Set<ImportableSection>>(
    new Set(ALL_SECTIONS)
  );

  const parseResume = useParseResume();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    parseResume.reset();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const result = await parseResume.mutateAsync(selectedFile);
      console.log('Resume parse result:', result);
      console.log('Skills:', result?.skills);
      console.log('Experiences:', result?.experiences);
      setStep('preview');
    } catch (error) {
      // Error is handled by the hook
      console.error('Resume parse error:', error);
    }
  };

  const handleSectionToggle = (section: ImportableSection) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (parseResume.data) {
      const sectionsWithData = ALL_SECTIONS.filter((s) =>
        sectionHasData(s, parseResume.data)
      );
      setSelectedSections(new Set(sectionsWithData));
    }
  };

  const handleSelectNone = () => {
    setSelectedSections(new Set());
  };

  const handleImport = () => {
    if (parseResume.data && selectedSections.size > 0) {
      onImport(parseResume.data, Array.from(selectedSections));
      handleClose();
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep('upload');
      setSelectedFile(null);
      setSelectedSections(new Set(ALL_SECTIONS));
      parseResume.reset();
    }, 200);
  };

  const sectionsWithData = parseResume.data
    ? ALL_SECTIONS.filter((s) => sectionHasData(s, parseResume.data))
    : [];

  const selectedCount = Array.from(selectedSections).filter((s) =>
    sectionHasData(s, parseResume.data)
  ).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Lebenslauf importieren
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === 'upload' ? 'Lebenslauf importieren' : 'Daten auswählen'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Lade deinen Lebenslauf hoch, um dein Profil automatisch auszufüllen.'
              : 'Wähle aus, welche Daten importiert werden sollen.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4 py-4">
            <FileUpload
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              isUploading={parseResume.isPending}
              error={(parseResume.error as Error | null)?.message}
              hint="PDF oder DOCX, max. 10 MB"
            />

            {parseResume.isPending && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Lebenslauf wird analysiert...</p>
                  <p className="text-xs text-muted-foreground">
                    Dies kann einige Sekunden dauern.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Section selection */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {sectionsWithData.length} Abschnitte erkannt
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-xs"
                >
                  Alle auswählen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectNone}
                  className="h-7 text-xs"
                >
                  Keine
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {ALL_SECTIONS.map((section) => {
                  const hasData = sectionHasData(section, parseResume.data);
                  const count = getSectionCount(section, parseResume.data);
                  const isSelected = selectedSections.has(section);

                  return (
                    <div
                      key={section}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3 transition-colors',
                        hasData
                          ? 'cursor-pointer hover:bg-muted/50'
                          : 'cursor-not-allowed opacity-50',
                        isSelected && hasData && 'border-primary/50 bg-primary/5'
                      )}
                      onClick={() => hasData && handleSectionToggle(section)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected && hasData}
                          disabled={!hasData}
                          onCheckedChange={() => handleSectionToggle(section)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <Label
                            className={cn(
                              'text-sm font-medium',
                              !hasData && 'text-muted-foreground'
                            )}
                          >
                            {getSectionLabel(section)}
                          </Label>
                          {!hasData && (
                            <p className="text-xs text-muted-foreground">
                              Keine Daten gefunden
                            </p>
                          )}
                        </div>
                      </div>
                      {count !== null && count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {count} {count === 1 ? 'Eintrag' : 'Einträge'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {selectedCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span>
                  {selectedCount} {selectedCount === 1 ? 'Abschnitt' : 'Abschnitte'} werden
                  importiert
                </span>
              </div>
            )}

            {selectedCount === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>Wähle mindestens einen Abschnitt zum Importieren aus</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'upload' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || parseResume.isPending}
              >
                {parseResume.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analysieren
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Zurück
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                <Check className="mr-2 h-4 w-4" />
                Importieren
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
