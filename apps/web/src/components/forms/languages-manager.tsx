'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { getLanguageLevelLabel } from '@/lib/translations';
import type { Language } from '@/types';

interface LanguagesManagerProps {
  languages: Language[];
  onLanguagesChange: (languages: Language[]) => void;
  disabled?: boolean;
}

const LANGUAGE_LEVELS = [
  { value: 'NATIVE', label: 'Muttersprache' },
  { value: 'FLUENT', label: 'Fließend (C2)' },
  { value: 'ADVANCED', label: 'Fortgeschritten (B2/C1)' },
  { value: 'INTERMEDIATE', label: 'Gute Kenntnisse (B1)' },
  { value: 'BASIC', label: 'Grundkenntnisse (A1/A2)' },
];

export function LanguagesManager({
  languages,
  onLanguagesChange,
  disabled = false,
}: LanguagesManagerProps) {
  const [showInput, setShowInput] = useState(false);
  const [languageName, setLanguageName] = useState('');
  const [languageLevel, setLanguageLevel] = useState('FLUENT');
  const inputRef = useRef<HTMLInputElement>(null);

  const addLanguage = () => {
    const name = languageName.trim();
    if (!name) return;

    if (languages.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Diese Sprache existiert bereits');
      return;
    }

    const updated = [...languages, { name, level: languageLevel }].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    onLanguagesChange(updated);
    setLanguageName('');
    inputRef.current?.focus();
    toast.success(`Sprache "${name}" hinzugefügt`);
  };

  const removeLanguage = (langName: string) => {
    onLanguagesChange(languages.filter((l) => l.name !== langName));
    toast.success(`Sprache "${langName}" entfernt`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLanguage();
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setLanguageName('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Sprachen</h3>
          <p className="text-sm text-muted-foreground">Deine Sprachkenntnisse</p>
        </div>
        {!showInput && (
          <Button
            type="button"
            onClick={() => {
              setShowInput(true);
              setTimeout(() => inputRef.current?.focus(), 80);
            }}
            disabled={disabled}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Hinzufügen
          </Button>
        )}
      </div>

      {/* Input */}
      {showInput && (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={languageName}
            onChange={(e) => setLanguageName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="z.B. Deutsch, Englisch …"
            className="flex-1"
          />
          <Select value={languageLevel} onValueChange={setLanguageLevel} disabled={disabled}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={addLanguage}
            disabled={disabled || !languageName.trim()}
            size="sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Hinzufügen
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInput(false);
              setLanguageName('');
            }}
          >
            Fertig
          </Button>
        </div>
      )}

      {/* Languages */}
      {languages.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            Deine Sprachen ({languages.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang, index) => (
              <span
                key={`${lang.name}-${index}`}
                className="group relative inline-flex items-center rounded-md border border-primary bg-primary/10 py-1.5 pl-3 pr-7 text-xs font-medium text-primary transition-all duration-300 ease-in-out hover:bg-primary hover:text-primary-foreground"
              >
                {lang.name}
                {lang.level && (
                  <span className="ml-1.5 opacity-70 group-hover:opacity-90">
                    · {getLanguageLevelLabel(lang.level)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.name)}
                  disabled={disabled}
                  className="absolute right-1.5 shrink-0 rounded-full p-0.5 opacity-0 transition-all duration-300 ease-in-out group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${lang.name} entfernen`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Languages className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Sprachen</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Füge deine Sprachkenntnisse hinzu, um dein Profil zu vervollständigen.
          </p>
          {!showInput && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowInput(true);
                setTimeout(() => inputRef.current?.focus(), 80);
              }}
              disabled={disabled}
              className="mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Erste Sprache hinzufügen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
