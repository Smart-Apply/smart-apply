'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useKeywordsAnalysis, useAnalyzeKeywords } from '@/hooks/use-applications';
import { cn } from '@/lib/utils';
import type { KeywordMatch } from '@/types';

interface ATSScoreSidebarProps {
  applicationId: string;
  className?: string;
  /** Called when analysis is updated/refreshed */
  onAnalysisUpdate?: () => void;
  /** Trigger refresh when this value changes (e.g., after saving) */
  refreshTrigger?: number;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

interface KeywordChipProps {
  keyword: KeywordMatch;
}

function KeywordChip({ keyword }: KeywordChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs py-0.5 px-1.5',
        keyword.found
          ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300'
          : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
      )}
    >
      {keyword.found ? (
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
      ) : (
        <XCircle className="h-2.5 w-2.5 mr-0.5" />
      )}
      {keyword.keyword}
    </Badge>
  );
}

/**
 * Compact ATS Score Sidebar for Edit Mode
 * Shows score, missing keywords, and suggestions
 */
export function ATSScoreSidebar({
  applicationId,
  className,
  onAnalysisUpdate,
  refreshTrigger,
}: ATSScoreSidebarProps) {
  const {
    data: analysis,
    isLoading,
    error,
    refetch,
  } = useKeywordsAnalysis(applicationId);

  const analyzeKeywords = useAnalyzeKeywords(applicationId);

  // Refresh analysis when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refetch().then(() => {
        onAnalysisUpdate?.();
      });
    }
  }, [refreshTrigger, refetch, onAnalysisUpdate]);

  const handleRefresh = async () => {
    await analyzeKeywords.mutateAsync();
    await refetch();
    onAnalysisUpdate?.();
  };

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="py-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-2">ATS-Analyse starten</p>
          <p className="text-xs text-muted-foreground mb-4">
            Finde heraus, welche Keywords fehlen
          </p>
          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={analyzeKeywords.isPending}
          >
            {analyzeKeywords.isPending ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Analysieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score = analysis.matchAnalysis.overallScore;
  const topMissing = analysis.missingKeywords
    .filter((k) => k.category === 'technical' || k.category === 'tool')
    .slice(0, 8);
  const otherMissing = analysis.missingKeywords
    .filter((k) => k.category !== 'technical' && k.category !== 'tool')
    .slice(0, 4);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            ATS-Score
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={analyzeKeywords.isPending}
          >
            <RefreshCw className={cn('h-3 w-3', analyzeKeywords.isPending && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className={cn('rounded-lg p-4 text-center', getScoreBg(score))}>
          <div className={cn('text-4xl font-bold', getScoreColor(score))}>
            {Math.round(score)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Übereinstimmung mit Stelle
          </p>
        </div>

        {/* Category Breakdown - Compact */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Tech</span>
            <span className={cn('font-medium', getScoreColor(analysis.matchAnalysis.categoryScores.technical))}>
              {Math.round(analysis.matchAnalysis.categoryScores.technical)}%
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Soft</span>
            <span className={cn('font-medium', getScoreColor(analysis.matchAnalysis.categoryScores.soft))}>
              {Math.round(analysis.matchAnalysis.categoryScores.soft)}%
            </span>
          </div>
        </div>

        {/* All Keywords Grid - Organized by Category */}
        <div className="space-y-4">
          {/* Matched Keywords */}
          {analysis.matchedKeywords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Gefundene Keywords ({analysis.matchedKeywords.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {analysis.matchedKeywords.map((kw, idx) => (
                  <KeywordChip key={`matched-${kw.keyword}-${idx}`} keyword={kw} />
                ))}
              </div>
            </div>
          )}

          {/* Missing Keywords by Category */}
          {analysis.missingKeywords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Fehlende Keywords ({analysis.missingKeywords.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {analysis.missingKeywords.map((kw, idx) => (
                  <KeywordChip key={`missing-${kw.keyword}-${idx}`} keyword={kw} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Füge diese Keywords in deinen Lebenslauf ein, um den ATS-Score zu erhöhen
              </p>
            </div>
          )}
        </div>

        {/* Matched Count */}
        <div className="flex items-center justify-between text-xs pt-2 border-t">
          <span className="text-muted-foreground">Gefundene Keywords</span>
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
            {analysis.matchedKeywords.length} / {analysis.matchedKeywords.length + analysis.missingKeywords.length}
          </Badge>
        </div>

        {/* Low Score Warning */}
        {score < 50 && (
          <div className="text-xs p-2 rounded bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Niedriger Score. Ergänze die fehlenden Keywords in Skills oder Erfahrungen.
            </span>
          </div>
        )}

        {/* All Good Message */}
        {score >= 80 && (
          <div className="text-xs p-2 rounded bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Ausgezeichnete Übereinstimmung! Dein Profil passt sehr gut.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
