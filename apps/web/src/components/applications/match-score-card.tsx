'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { CategoryScores } from '@/types';
import { cn } from '@/lib/utils';

// The card was simplified to display only the headline overall-match
// score. The richer props (categoryScores, strengths, weaknesses) are
// still accepted so callers don't have to be touched, but they're
// intentionally unused — the design moved the breakdown elsewhere.
interface MatchScoreCardProps {
  overallScore: number;
  categoryScores?: CategoryScores;
  strengths?: string[];
  weaknesses?: string[];
  className?: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-[#16A34A]';  // success
  if (score >= 60) return 'text-[#EAB308]';  // warning
  if (score >= 40) return 'text-[#EAB308]';  // warning
  return 'text-[#DC2626]';                   // error
};

export function MatchScoreCard({
  overallScore,
  className,
}: MatchScoreCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Profil-Match-Analyse
        </CardTitle>
      </CardHeader>
      <CardContent className="py-8">
        {/* Overall Score - Clean & Minimal */}
        <div className="text-center">
          <div className={cn('text-7xl font-bold mb-2', getScoreColor(overallScore))}>
            {Math.round(overallScore)}%
          </div>
          <p className="text-sm text-[#6B6969]">
            Profil-Übereinstimmung
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
