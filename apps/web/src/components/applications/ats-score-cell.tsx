'use client';

import { useKeywordsAnalysis } from '@/hooks/use-applications';
import { ATSScoreBadge } from './ats-score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ATSScoreCellProps {
  applicationId: string;
  status: string;
}

/**
 * Table cell component that fetches and displays ATS score for an application
 * Shows loading skeleton while fetching, error state if analysis unavailable
 */
export function ATSScoreCell({ applicationId, status }: ATSScoreCellProps) {
  const { data: analysis, isLoading, error } = useKeywordsAnalysis(applicationId);

  // Only show ATS score if application is READY (PDFs generated)
  if (status !== 'READY') {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground">
        -
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-6 w-16 mx-auto" />;
  }

  if (error || !analysis) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center cursor-help">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Bewerbungscheck nicht verfügbar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const score = analysis.matchAnalysis.overallScore;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center">
            <ATSScoreBadge score={score} size="sm" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div className="font-medium mb-1">Kategorie-Scores:</div>
            <div>Kern (Hard Skills): {Math.round(analysis.matchAnalysis.categoryScores.core)}%</div>
            <div>Erfahrung: {Math.round(analysis.matchAnalysis.categoryScores.experience)}%</div>
            <div>Branche: {Math.round(analysis.matchAnalysis.categoryScores.industry)}%</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
