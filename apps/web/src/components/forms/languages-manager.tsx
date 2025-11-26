'use client';

import { useState, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus, Languages } from 'lucide-react';
import { toast } from 'sonner';
import type { Language } from '@/types';

interface LanguagesManagerProps {
  languages: Language[];
  onLanguagesChange: (languages: Language[]) => void;
  disabled?: boolean;
}

const LANGUAGE_LEVELS = [
  { value: 'Muttersprache', label: 'Muttersprache' },
  { value: 'Fließend', label: 'Fließend (C2)' },
  { value: 'Verhandlungssicher', label: 'Verhandlungssicher (C1)' },
  { value: 'Fortgeschritten', label: 'Fortgeschritten (B2)' },
  { value: 'Gute Kenntnisse', label: 'Gute Kenntnisse (B1)' },
  { value: 'Grundkenntnisse', label: 'Grundkenntnisse (A2)' },
  { value: 'Anfänger', label: 'Anfänger (A1)' },
];

/**
 * LanguagesManager Component
 * 
 * Reusable component for managing languages (add, remove).
 * - Display existing languages as badges with level
 * - Add language with name and proficiency level
 * - Remove language on badge close button
 * - Validate language name (non-empty, unique)
 */
export function LanguagesManager({ 
  languages, 
  onLanguagesChange, 
  disabled = false 
}: LanguagesManagerProps) {
  const [languageName, setLanguageName] = useState('');
  const [languageLevel, setLanguageLevel] = useState('Fließend');

  const addLanguage = () => {
    const name = languageName.trim();

    // Validate: non-empty
    if (!name) {
      toast.error('Sprachname darf nicht leer sein');
      return;
    }

    // Validate: unique (case-insensitive)
    const isDuplicate = languages.some(
      (lang) => lang.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Diese Sprache existiert bereits');
      return;
    }

    // Add new language
    const newLanguage: Language = { name, level: languageLevel };
    const updatedLanguages = [...languages, newLanguage].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    onLanguagesChange(updatedLanguages);
    setLanguageName('');
    toast.success(`Sprache "${name}" hinzugefügt`);
  };

  const removeLanguage = (langName: string) => {
    const updatedLanguages = languages.filter((lang) => lang.name !== langName);
    onLanguagesChange(updatedLanguages);
    toast.success(`Sprache "${langName}" entfernt`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLanguage();
    }
  };

  const getLevelBadgeColor = (level?: string) => {
    switch (level) {
      case 'Muttersprache':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Fließend':
      case 'Verhandlungssicher':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Fortgeschritten':
      case 'Gute Kenntnisse':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="language-input" className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          Sprachen
        </Label>
        <p className="text-sm text-gray-500 mb-2">
          Füge deine Sprachkenntnisse hinzu
        </p>
        
        <div className="flex gap-2">
          <Input
            id="language-input"
            type="text"
            placeholder="z.B. Deutsch, Englisch, Französisch..."
            value={languageName}
            onChange={(e) => setLanguageName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="flex-1"
          />
          <Select
            value={languageLevel}
            onValueChange={setLanguageLevel}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={addLanguage}
            disabled={disabled || !languageName.trim()}
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Languages Display */}
      {languages.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Deine Sprachen ({languages.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang, index) => (
              <Badge
                key={`${lang.name}-${index}`}
                variant="outline"
                className={`text-sm pl-3 pr-2 py-1.5 gap-1.5 ${getLevelBadgeColor(lang.level)}`}
              >
                <span className="font-medium">{lang.name}</span>
                {lang.level && (
                  <span className="text-xs opacity-80">• {lang.level}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.name)}
                  disabled={disabled}
                  className="ml-1 rounded-full hover:bg-black/10 p-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Remove ${lang.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            Noch keine Sprachen hinzugefügt. Beginne mit dem Hinzufügen deiner Sprachkenntnisse oben.
          </p>
        </div>
      )}
    </div>
  );
}
