'use client';

import { useState, useCallback } from 'react';
import { Globe, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useApplicationTranslation } from '@/hooks/use-translation';
import type { ResumeData } from '@/types';

interface LanguageOption {
  value: string;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
];

interface LanguageSelectorProps {
  applicationId: string;
  value: string;
  onChange: (language: string) => void;
  onContentTranslated?: (content: { resume: ResumeData; coverLetter: string }) => void;
  currentContent?: { resume: ResumeData; coverLetter: string };
  disabled?: boolean;
}

/**
 * Language Selector with translation support and cache badges
 * 
 * Features:
 * - Cache status badges (✓ for cached languages)
 * - Translation overlay during processing
 * - Retry dialog on failure
 * - Smart translate (skips source language, uses cache)
 */
export function LanguageSelector({
  applicationId,
  value,
  onChange,
  onContentTranslated,
  currentContent,
  disabled = false,
}: LanguageSelectorProps) {
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [showRetryDialog, setShowRetryDialog] = useState(false);

  const {
    cachedLanguages,
    sourceLanguage,
    isLoadingCacheStatus,
    translate,
    isTranslating,
    retryCount,
    maxRetries,
    lastError,
    canRetry,
    retryManually,
    isSourceLanguage,
  } = useApplicationTranslation(applicationId);

  const handleLanguageChange = useCallback(
    async (newLanguage: string) => {
      // If same language, do nothing
      if (newLanguage === value) return;

      // If source language, just change without translation
      if (isSourceLanguage(newLanguage)) {
        onChange(newLanguage);
        return;
      }

      // Store pending language for retry purposes
      setPendingLanguage(newLanguage);

      // If we have content handlers, translate
      if (onContentTranslated && currentContent) {
        const result = await translate(newLanguage);
        
        if (result) {
          // Translation successful
          onContentTranslated({
            resume: result.resumeText,
            coverLetter: result.coverLetterText,
          });
          onChange(newLanguage);
          setPendingLanguage(null);
        } else {
          // Translation failed - show retry dialog
          setShowRetryDialog(true);
        }
      } else {
        // No content handler - just change language
        onChange(newLanguage);
        setPendingLanguage(null);
      }
    },
    [value, translate, onChange, onContentTranslated, currentContent, isSourceLanguage]
  );

  const handleRetry = useCallback(async () => {
    if (!pendingLanguage || !onContentTranslated) return;

    setShowRetryDialog(false);
    const result = await retryManually(pendingLanguage);

    if (result) {
      onContentTranslated({
        resume: result.resumeText,
        coverLetter: result.coverLetterText,
      });
      onChange(pendingLanguage);
      setPendingLanguage(null);
    } else {
      // Still failed - show dialog again
      setShowRetryDialog(true);
    }
  }, [pendingLanguage, retryManually, onContentTranslated, onChange]);

  const handleCancel = useCallback(() => {
    setShowRetryDialog(false);
    setPendingLanguage(null);
  }, []);

  const isCached = useCallback(
    (lang: string) => cachedLanguages.includes(lang),
    [cachedLanguages]
  );

  return (
    <>
      {/* Translation Overlay */}
      {isTranslating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="font-semibold mb-2">Übersetze Inhalte...</h3>
            <p className="text-sm text-muted-foreground">
              {pendingLanguage && `Übersetzung nach ${LANGUAGES.find(l => l.value === pendingLanguage)?.label || pendingLanguage}`}
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Versuch {retryCount + 1} von {maxRetries}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Language Selector */}
      <Select
        value={value}
        onValueChange={handleLanguageChange}
        disabled={disabled || isTranslating}
      >
        <SelectTrigger className="w-[100px] h-8 text-xs border-border/50">
          <SelectValue>
            {isLoadingCacheStatus ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5">
                {LANGUAGES.find(l => l.value === value)?.flag}
                <span className="uppercase">{value}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              <span className="flex items-center justify-between w-full gap-2">
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </span>
                {/* Cache status badge */}
                {isCached(lang.value) && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 px-1.5 text-[10px] ml-2",
                      lang.value === sourceLanguage
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        : "bg-green-500/10 text-green-600 border-green-500/20"
                    )}
                  >
                    {lang.value === sourceLanguage ? (
                      <Globe className="h-2.5 w-2.5" />
                    ) : (
                      <Check className="h-2.5 w-2.5" />
                    )}
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Retry Dialog */}
      <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Übersetzung fehlgeschlagen
            </DialogTitle>
            <DialogDescription>
              Die Übersetzung nach {LANGUAGES.find(l => l.value === pendingLanguage)?.label || pendingLanguage} konnte nicht durchgeführt werden.
              {lastError && (
                <span className="block mt-2 text-xs text-destructive">
                  Fehler: {lastError.message}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
            {canRetry && (
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Erneut versuchen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
