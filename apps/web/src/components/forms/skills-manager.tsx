'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Code } from 'lucide-react';
import { toast } from 'sonner';
import type { Skill } from '@/types';

interface SkillsManagerProps {
  skills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
  disabled?: boolean;
}

export function SkillsManager({ skills, onSkillsChange, disabled = false }: SkillsManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addSkill = () => {
    const skillName = inputValue.trim();
    if (!skillName) return;

    if (skills.some((s) => s.name.toLowerCase() === skillName.toLowerCase())) {
      toast.error('Dieser Skill existiert bereits');
      return;
    }

    const updated = [...skills, { name: skillName }].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    onSkillsChange(updated);
    setInputValue('');
    inputRef.current?.focus();
    toast.success(`Skill "${skillName}" hinzugefügt`);
  };

  const removeSkill = (skillName: string) => {
    onSkillsChange(skills.filter((s) => s.name !== skillName));
    toast.success(`Skill "${skillName}" entfernt`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Fähigkeiten</h3>
          <p className="text-sm text-muted-foreground">
            Deine technischen und fachlichen Kompetenzen
          </p>
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="z.B. Projektmanagement, SAP, Excel …"
            className="flex-1"
          />
          <Button
            type="button"
            onClick={addSkill}
            disabled={disabled || !inputValue.trim()}
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
              setInputValue('');
            }}
          >
            Fertig
          </Button>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            Deine Skills ({skills.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <span
                key={`${skill.name}-${index}`}
                className="group relative inline-flex items-center rounded-md border border-primary bg-primary/10 py-1.5 pl-3 pr-7 text-xs font-medium text-primary transition-all duration-300 ease-in-out hover:bg-primary hover:text-primary-foreground"
              >
                {skill.name}
                <button
                  type="button"
                  onClick={() => removeSkill(skill.name)}
                  disabled={disabled}
                  className="absolute right-1.5 shrink-0 rounded-full p-0.5 opacity-0 transition-all duration-300 ease-in-out group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${skill.name} entfernen`}
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
            <Code className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground">Keine Fähigkeiten</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Füge deine Fähigkeiten hinzu, um dein Profil zu stärken.
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
              Ersten Skill hinzufügen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
