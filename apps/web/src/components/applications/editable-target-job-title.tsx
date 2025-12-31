'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

const TARGET_JOB_TITLE_MIN_LENGTH = 2;
const TARGET_JOB_TITLE_MAX_LENGTH = 100;

interface EditableTargetJobTitleProps {
  applicationId: string;
  initialTargetJobTitle?: string;
  fallbackTitle: string; // Job posting title as default
}

export function EditableTargetJobTitle({
  applicationId,
  initialTargetJobTitle,
  fallbackTitle,
}: EditableTargetJobTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Always use fallbackTitle if initialTargetJobTitle is not set
  const effectiveTitle = initialTargetJobTitle || fallbackTitle;
  const [targetJobTitle, setTargetJobTitle] = useState(effectiveTitle);
  const queryClient = useQueryClient();

  // Sync state when props change (e.g., after successful save)
  useEffect(() => {
    if (!isEditing) {
      setTargetJobTitle(initialTargetJobTitle || fallbackTitle);
    }
  }, [initialTargetJobTitle, fallbackTitle, isEditing]);

  // Display value: always show the current editing value or the effective title
  const displayValue = targetJobTitle || fallbackTitle;

  const updateTargetJobTitleMutation = useMutation({
    mutationFn: (newTargetJobTitle: string) =>
      api.applications.updateTargetJobTitle(applicationId, newTargetJobTitle),
    onSuccess: (updatedApp) => {
      // Update local state immediately
      const newTitle = updatedApp.targetJobTitle || fallbackTitle;
      setTargetJobTitle(newTitle);
      // Update cache immediately for better UX
      queryClient.setQueryData(['applications', applicationId], updatedApp);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsEditing(false);
      toast.success('Ziel-Jobtitel aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const handleSave = () => {
    const trimmedTitle = targetJobTitle.trim();
    
    if (trimmedTitle.length < TARGET_JOB_TITLE_MIN_LENGTH) {
      toast.error(`Jobtitel muss mindestens ${TARGET_JOB_TITLE_MIN_LENGTH} Zeichen lang sein`);
      return;
    }

    if (trimmedTitle.length > TARGET_JOB_TITLE_MAX_LENGTH) {
      toast.error(`Jobtitel darf maximal ${TARGET_JOB_TITLE_MAX_LENGTH} Zeichen lang sein`);
      return;
    }

    updateTargetJobTitleMutation.mutate(trimmedTitle);
  };

  const handleCancel = () => {
    // Reset to the effective title (initial or fallback)
    setTargetJobTitle(initialTargetJobTitle || fallbackTitle);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
        <Input
          value={targetJobTitle}
          onChange={(e) => setTargetJobTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={TARGET_JOB_TITLE_MAX_LENGTH}
          className="h-7 text-sm flex-1 min-w-[200px]"
          placeholder="z.B. Senior Software Engineer"
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleSave}
          disabled={updateTargetJobTitleMutation.isPending}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleCancel}
          disabled={updateTargetJobTitleMutation.isPending}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0 group">
      <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-medium text-sm truncate">{displayValue}</span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => setIsEditing(true)}
        aria-label="Ziel-Jobtitel bearbeiten"
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}
