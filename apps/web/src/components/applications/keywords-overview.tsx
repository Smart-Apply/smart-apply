'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  XCircle,
  Code2,
  Heart,
  Target,
  Wrench,
  Building2,
  Award,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ATSKeywords, KeywordMatch, KeywordCategory } from '@/types';
import { cn } from '@/lib/utils';

interface KeywordsOverviewProps {
  keywords: ATSKeywords;
  matchedKeywords: KeywordMatch[];
  missingKeywords: KeywordMatch[];
  className?: string;
}

const categoryConfig: Record<
  KeywordCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  core: { label: 'Kernkompetenzen', icon: Code2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  soft: { label: 'Soft Skills', icon: Heart, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  responsibility: { label: 'Aufgaben', icon: Target, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  requirement: { label: 'Anforderungen', icon: Award, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  methodology: { label: 'Methoden & Tools', icon: Wrench, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  industry: { label: 'Branche', icon: Building2, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  seniority: { label: 'Level', icon: Award, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  misc: { label: 'Sonstiges', icon: Tag, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

interface KeywordBadgeProps {
  keyword: KeywordMatch;
  showUsedIn?: boolean;
}

function KeywordBadge({ keyword, showUsedIn = false }: KeywordBadgeProps) {
  const config = categoryConfig[keyword.category] ?? categoryConfig.misc;
  const Icon = config.icon;

  return (
    <div className="group relative">
      <Badge
        variant="outline"
        className={cn(
          'flex items-center gap-1 py-1 px-2 transition-all',
          keyword.found
            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
            : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
        )}
      >
        {keyword.found ? (
          <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
        )}
        <span className="text-xs">{keyword.keyword}</span>
        <Icon className="h-3 w-3 ml-1 opacity-50" />
      </Badge>
      
      {showUsedIn && keyword.usedIn && keyword.usedIn.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
          <div className="bg-popover text-popover-foreground text-xs rounded-md shadow-lg p-2 border">
            <p className="font-medium mb-1">Gefunden in:</p>
            <ul className="space-y-0.5">
              {keyword.usedIn.map((location, idx) => (
                <li key={idx} className="text-muted-foreground">{location}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function KeywordsOverview({
  matchedKeywords,
  missingKeywords,
  className,
}: KeywordsOverviewProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllMissing, setShowAllMissing] = useState(false);

  const allKeywords = [...matchedKeywords, ...missingKeywords];
  const matchRate = allKeywords.length > 0
    ? Math.round((matchedKeywords.length / allKeywords.length) * 100)
    : 0;

  // Group keywords by category
  const groupedKeywords = allKeywords.reduce<Record<string, KeywordMatch[]>>((acc, kw) => {
    if (!acc[kw.category]) acc[kw.category] = [];
    acc[kw.category].push(kw);
    return acc;
  }, {});

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="h-5 w-5" />
            Schlüsselbegriffe
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {matchedKeywords.length}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-600" />
              {missingKeywords.length}
            </Badge>
            <Badge variant="outline">{matchRate}% Match</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Alle ({allKeywords.length})</TabsTrigger>
            <TabsTrigger value="matched" className="text-green-600">
              Gefunden ({matchedKeywords.length})
            </TabsTrigger>
            <TabsTrigger value="missing" className="text-red-600">
              Fehlend ({missingKeywords.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {Object.entries(groupedKeywords).map(([category, keywords]) => {
              const config = categoryConfig[category as KeywordCategory];
              if (!config) return null;
              const Icon = config.icon;
              const isExpanded = expandedCategory === category;
              const displayKeywords = isExpanded ? keywords : keywords.slice(0, 6);

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {keywords.filter((k) => k.found).length}/{keywords.length}
                      </span>
                    </div>
                    {keywords.length > 6 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      >
                        {isExpanded ? (
                          <>
                            Weniger <ChevronUp className="h-3 w-3 ml-1" />
                          </>
                        ) : (
                          <>
                            +{keywords.length - 6} mehr <ChevronDown className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayKeywords.map((kw, idx) => (
                      <KeywordBadge key={`${kw.keyword}-${idx}`} keyword={kw} showUsedIn />
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="matched" className="mt-4">
            <div className="flex flex-wrap gap-2">
              {matchedKeywords.map((kw, idx) => (
                <KeywordBadge key={`${kw.keyword}-${idx}`} keyword={kw} showUsedIn />
              ))}
              {matchedKeywords.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine übereinstimmenden Keywords gefunden.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="missing" className="mt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(showAllMissing ? missingKeywords : missingKeywords.slice(0, 12)).map((kw, idx) => (
                  <KeywordBadge key={`${kw.keyword}-${idx}`} keyword={kw} />
                ))}
              </div>
              {missingKeywords.length > 12 && !showAllMissing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllMissing(true)}
                  className="w-full"
                >
                  Alle {missingKeywords.length} fehlenden Keywords anzeigen
                </Button>
              )}
              {missingKeywords.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Alle relevanten Keywords sind in deinem Profil vorhanden! 🎉
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
