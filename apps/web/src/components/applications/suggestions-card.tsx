'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  ArrowRight,
  Plus,
  Pencil,
  GraduationCap,
  Briefcase,
  Award,
  Code2,
} from 'lucide-react';
import type { KeywordMatch, KeywordCategory } from '@/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SuggestionsCardProps {
  suggestions: string[];
  missingKeywords: KeywordMatch[];
  className?: string;
  onNavigateToProfile?: () => void;
}

// Map keyword categories to profile sections
const categoryToSection: Record<KeywordCategory, { section: string; label: string; icon: React.ElementType }> = {
  technical: { section: 'skills', label: 'Skills hinzufügen', icon: Code2 },
  tool: { section: 'skills', label: 'Tools hinzufügen', icon: Code2 },
  soft: { section: 'skills', label: 'Skills hinzufügen', icon: Code2 }, // Legacy, no longer extracted
  responsibility: { section: 'experiences', label: 'Aufgaben ergänzen', icon: Briefcase },
  seniority: { section: 'experiences', label: 'Erfahrung aktualisieren', icon: Briefcase },
  industry: { section: 'experiences', label: 'Branchenerfahrung', icon: Briefcase },
  requirement: { section: 'education', label: 'Qualifikation ergänzen', icon: GraduationCap },
  misc: { section: 'skills', label: 'Profil ergänzen', icon: Award },
};

interface SuggestionItemProps {
  suggestion: string;
  type: 'general' | 'keyword';
  category?: KeywordCategory;
  keywords?: string[];
}

function SuggestionItem({ suggestion, category, keywords }: SuggestionItemProps) {
  const config = category ? categoryToSection[category] : null;
  const Icon = config?.icon || Lightbulb;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{suggestion}</p>
        {keywords && keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.slice(0, 5).map((kw, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
            {keywords.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{keywords.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>
      {config && (
        <Link href={`/profile?section=${config.section}`}>
          <Button variant="ghost" size="sm" className="shrink-0">
            <Pencil className="h-3 w-3 mr-1" />
            {config.label}
          </Button>
        </Link>
      )}
    </div>
  );
}

export function SuggestionsCard({
  suggestions,
  missingKeywords,
  className,
}: SuggestionsCardProps) {
  // Group missing keywords by category for actionable suggestions
  const groupedMissing = missingKeywords.reduce<Record<string, string[]>>((acc, kw) => {
    if (!acc[kw.category]) acc[kw.category] = [];
    acc[kw.category].push(kw.keyword);
    return acc;
  }, {});

  // Create category-based suggestions
  const categoryActions = Object.entries(groupedMissing).map(([category, keywords]) => {
    const config = categoryToSection[category as KeywordCategory];
    let suggestion = '';
    
    switch (category) {
      case 'technical':
      case 'tool':
        suggestion = `Füge diese technischen Skills zu deinem Profil hinzu`;
        break;
      case 'experience':
      case 'responsibility':
        suggestion = `Beschreibe diese Aufgaben in deinen Berufserfahrungen`;
        break;
      case 'seniority':
        suggestion = `Zeige dein Erfahrungsniveau deutlicher`;
        break;
      case 'industry':
        suggestion = `Hebe deine Branchenerfahrung hervor`;
        break;
      case 'requirement':
        suggestion = `Prüfe, ob du diese Anforderungen erfüllst`;
        break;
      default:
        suggestion = `Berücksichtige diese Keywords in deinem Profil`;
    }

    return {
      category: category as KeywordCategory,
      suggestion,
      keywords,
      section: config?.section || 'skills',
    };
  });

  // Get top priority categories (technical first)
  const priorityOrder: KeywordCategory[] = ['technical', 'tool', 'responsibility', 'requirement', 'industry', 'seniority', 'misc'];
  const sortedActions = [...categoryActions].sort(
    (a, b) => priorityOrder.indexOf(a.category) - priorityOrder.indexOf(b.category)
  );

  const hasNoSuggestions = suggestions.length === 0 && sortedActions.length === 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Verbesserungsvorschläge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNoSuggestions ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mb-3">
              <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium text-green-600 dark:text-green-400">Perfekt!</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Dein Profil passt hervorragend zu dieser Stelle.
            </p>
          </div>
        ) : (
          <>
            {/* AI-generated suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  KI-Empfehlungen
                </h4>
                {suggestions.map((suggestion, idx) => (
                  <SuggestionItem
                    key={idx}
                    suggestion={suggestion}
                    type="general"
                  />
                ))}
              </div>
            )}

            {/* Category-based actions */}
            {sortedActions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Fehlende Keywords ergänzen
                </h4>
                {sortedActions.slice(0, 4).map((action, idx) => (
                  <SuggestionItem
                    key={idx}
                    suggestion={action.suggestion}
                    type="keyword"
                    category={action.category}
                    keywords={action.keywords}
                  />
                ))}
              </div>
            )}

            {/* Quick action button */}
            <div className="pt-2 border-t">
              <Link href="/profile">
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Profil bearbeiten
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
