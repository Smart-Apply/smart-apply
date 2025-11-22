'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  APPLICATION_TITLE_MIN_LENGTH,
  APPLICATION_TITLE_MAX_LENGTH,
  APPLICATION_ID_DISPLAY_LENGTH,
} from '@/lib/constants';

interface EditableTitleProps {
  applicationId: string;
  initialTitle?: string;
  fallbackId: string; // Show this if no title
}

export function EditableTitle({
  applicationId,
  initialTitle,
  fallbackId,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle || '');
  const queryClient = useQueryClient();

  const updateTitleMutation = useMutation({
    mutationFn: (newTitle: string) =>
      api.applications.updateTitle(applicationId, newTitle),
    onSuccess: (updatedApp) => {
      // Update cache immediately for better UX
      queryClient.setQueryData(['applications', applicationId], updatedApp);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsEditing(false);
      toast.success('Titel aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const handleSave = () => {
    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length < APPLICATION_TITLE_MIN_LENGTH) {
      toast.error(`Titel muss mindestens ${APPLICATION_TITLE_MIN_LENGTH} Zeichen lang sein`);
      return;
    }

    if (trimmedTitle.length > APPLICATION_TITLE_MAX_LENGTH) {
      toast.error(`Titel darf maximal ${APPLICATION_TITLE_MAX_LENGTH} Zeichen lang sein`);
      return;
    }

    updateTitleMutation.mutate(trimmedTitle);
  };

  const handleCancel = () => {
    setTitle(initialTitle || '');
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
      <div className="flex items-center gap-2 w-full">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={APPLICATION_TITLE_MAX_LENGTH}
          className="flex-1"
          placeholder="z.B. Senior Frontend Developer @ Google"
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateTitleMutation.isPending}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={updateTitleMutation.isPending}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold">
        {title || `Bewerbung #${fallbackId.substring(0, APPLICATION_ID_DISPLAY_LENGTH)}`}
      </h1>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        aria-label="Titel bearbeiten"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
