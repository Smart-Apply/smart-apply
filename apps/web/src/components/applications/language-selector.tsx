'use client';

import { Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  /** Current language code (e.g., 'de', 'en') */
  value: string;
  /** Optional: Application ID (not used anymore, kept for API compatibility) */
  applicationId?: string;
}

/**
 * Language Display Badge (Read-only)
 *
 * Shows the language the application was created in.
 * Language is set at creation time and cannot be changed afterwards.
 * To get a different language, create a new application.
 */
export function LanguageSelector({ value }: LanguageSelectorProps) {
  const language = LANGUAGES.find((l) => l.value === value);

  return (
    <Badge
      variant="outline"
      className="h-8 px-3 text-xs border-border/50 bg-muted/30 gap-1.5"
    >
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{language?.flag}</span>
      <span className="uppercase font-medium">{value}</span>
    </Badge>
  );
}
