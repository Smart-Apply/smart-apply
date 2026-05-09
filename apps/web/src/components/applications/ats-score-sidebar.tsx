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
  if (score >= 80) return 'text-[#16A34A]';  // success
  if (score >= 60) return 'text-[#EAB308]';  // warning
  if (score >= 40) return 'text-[#EAB308]';  // warning
  return 'text-[#DC2626]';                   // error
};

const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-[#D1FADF]';  // successSoft
  if (score >= 60) return 'bg-[#FEF3C7]';  // warningSoft
  if (score >= 40) return 'bg-[#FEF3C7]';  // warningSoft
  return 'bg-[#FEE2E2]';                   // errorSoft
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
          ? 'border-[#16A34A] bg-[#D1FADF] text-[#16A34A]'
          : 'border-[#DC2626] bg-[#FEE2E2] text-[#DC2626]'
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
      refetch({ cancelRefetch: true }).then(() => {
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
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-[#E5E9F2]">
            <span className="text-[#6B6969]">Kern (Hard Skills)</span>
            <span className={cn('font-medium', getScoreColor(analysis.matchAnalysis.categoryScores.core))}>
              {Math.round(analysis.matchAnalysis.categoryScores.core)}%
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
                Füge diese Schlüsselbegriffe in deinen Lebenslauf ein, um deine Bewertung zu verbessern
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
          <div className="text-xs p-2 rounded bg-[#FEF3C7] text-[#EAB308] flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Ausbaufähiger Score. Ergänze die fehlenden Keywords in deinem Profil.
            </span>
          </div>
        )}

        {/* All Good Message */}
        {score >= 80 && (
          <div className="text-xs p-2 rounded bg-[#D1FADF] text-[#16A34A] flex items-start gap-2">
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
