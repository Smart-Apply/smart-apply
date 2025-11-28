'use client';

import { useState, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus, Code } from 'lucide-react';
import { toast } from 'sonner';
import type { Skill } from '@/types';

interface SkillsManagerProps {
  skills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
  disabled?: boolean;
}

/**
 * SkillsManager Component
 * 
 * Reusable component for managing skills (add, remove).
 * - Display existing skills as chips/badges
 * - Add skill on Enter key or button click
 * - Remove skill on chip close button
 * - Validate skill name (non-empty, unique)
 */
export function SkillsManager({ skills, onSkillsChange, disabled = false }: SkillsManagerProps) {
  const [inputValue, setInputValue] = useState('');

  const addSkill = () => {
    const skillName = inputValue.trim();

    // Validate: non-empty
    if (!skillName) {
      toast.error('Skill-Name darf nicht leer sein');
      return;
    }

    // Validate: unique (case-insensitive)
    const isDuplicate = skills.some(
      (skill) => skill.name.toLowerCase() === skillName.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Dieser Skill existiert bereits');
      return;
    }

    // Add new skill
    const newSkill: Skill = { name: skillName };
    const updatedSkills = [...skills, newSkill].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    onSkillsChange(updatedSkills);
    setInputValue('');
    toast.success(`Skill "${skillName}" hinzugefügt`);
  };

  const removeSkill = (skillName: string) => {
    const updatedSkills = skills.filter((skill) => skill.name !== skillName);
    onSkillsChange(updatedSkills);
    toast.success(`Skill "${skillName}" entfernt`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="skill-input" className="text-base">Fähigkeiten</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Füge deine technischen und fachlichen Kompetenzen hinzu
        </p>

        <div className="flex gap-2">
          <Input
            id="skill-input"
            type="text"
            placeholder="z.B. JavaScript, React, TypeScript..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={addSkill}
            disabled={disabled || !inputValue.trim()}
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Skills Display */}
      {skills.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Deine Skills ({skills.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <Badge
                key={`${skill.name}-${index}`}
                variant="secondary"
                className="text-sm pl-3 pr-2 py-1.5 gap-1.5 hover:bg-secondary/80 transition-colors"
              >
                <span>{skill.name}</span>
                {skill.level && (
                  <span className="text-xs opacity-70">({skill.level})</span>
                )}
                <button
                  type="button"
                  onClick={() => removeSkill(skill.name)}
                  disabled={disabled}
                  className="ml-1 rounded-full hover:bg-foreground/10 p-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Remove ${skill.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Code className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Noch keine Skills hinzugefügt. Beginne mit dem Hinzufügen deiner Fähigkeiten oben.
          </p>
        </div>
      )}
    </div>
  );
}
