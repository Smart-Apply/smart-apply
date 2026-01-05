'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { MatchScoreCard } from './match-score-card';
import { KeywordsOverview } from './keywords-overview';
import { SuggestionsCard } from './suggestions-card';
import { useKeywordsAnalysis, useAnalyzeKeywords } from '@/hooks/use-applications';
import { cn } from '@/lib/utils';

interface ATSAnalysisPanelProps {
  applicationId: string;
  className?: string;
  onAnalysisComplete?: () => void;
}

/**
 * Main panel combining all ATS analysis components
 * Shows match score, keywords, and improvement suggestions
 */
export function ATSAnalysisPanel({
  applicationId,
  className,
  onAnalysisComplete,
}: ATSAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const {
    data: analysis,
    isLoading,
    error,
    refetch,
  } = useKeywordsAnalysis(applicationId);
  
  const analyzeKeywords = useAnalyzeKeywords(applicationId);

  const handleRefreshAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeKeywords.mutateAsync();
      await refetch();
      onAnalysisComplete?.();
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">ATS-Analyse starten</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Lass die KI deine Bewerbung analysieren und erhalte personalisierte
            Verbesserungsvorschläge basierend auf der Stellenausschreibung.
          </p>
          <Button
            onClick={handleRefreshAnalysis}
            disabled={isAnalyzing || analyzeKeywords.isPending}
          >
            {isAnalyzing || analyzeKeywords.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Jetzt analysieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            ATS-Analyse
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    ATS (Applicant Tracking System) = Bewerbermanagementsystem.
                    Viele Unternehmen filtern Bewerbungen automatisch nach Schlüsselbegriffen.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h2>
          <p className="text-sm text-muted-foreground">
            Analysiert am {new Date(analysis.analyzedAt).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAnalysis}
          disabled={isAnalyzing || analyzeKeywords.isPending}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', (isAnalyzing || analyzeKeywords.isPending) && 'animate-spin')} />
          Neu analysieren
        </Button>
      </div>

      {/* Match Score */}
      <MatchScoreCard
        overallScore={analysis.matchAnalysis.overallScore}
        categoryScores={analysis.matchAnalysis.categoryScores}
        strengths={analysis.matchAnalysis.strengths}
        weaknesses={analysis.matchAnalysis.weaknesses}
      />

      {/* Keywords Overview */}
      <KeywordsOverview
        keywords={analysis.keywords}
        matchedKeywords={analysis.matchedKeywords}
        missingKeywords={analysis.missingKeywords}
      />

      {/* Suggestions */}
      <SuggestionsCard
        suggestions={analysis.matchAnalysis.suggestions}
        missingKeywords={analysis.missingKeywords}
      />

      {/* Low score warning */}
      {analysis.matchAnalysis.overallScore < 40 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-800 dark:text-orange-200">
                  Niedrige Übereinstimmung
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Dein Profil passt möglicherweise nicht optimal zu dieser Stelle. 
                  Überprüfe die fehlenden Keywords und aktualisiere dein Profil, 
                  um deine Chancen zu verbessern.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
