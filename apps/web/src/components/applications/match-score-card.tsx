'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Brain,
  Users,
  Briefcase,
  Building2,
} from 'lucide-react';
import type { CategoryScores } from '@/types';
import { cn } from '@/lib/utils';

interface MatchScoreCardProps {
  overallScore: number;
  categoryScores: CategoryScores;
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

const getProgressColor = (score: number): string => {
  if (score >= 80) return 'bg-[#16A34A]';  // success
  if (score >= 60) return 'bg-[#EAB308]';  // warning
  if (score >= 40) return 'bg-[#EAB308]';  // warning
  return 'bg-[#DC2626]';                   // error
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Ausgezeichnet';
  if (score >= 60) return 'Gut';
  if (score >= 40) return 'Ausbaufähig';
  return 'Niedrig';
};

const categoryConfig = {
  core: {
    label: 'Kernkompetenzen (Hard Skills)',
    icon: Briefcase,
    description: 'Fachliche Qualifikationen und Expertise',
  },
  experience: {
    label: 'Erfahrung',
    icon: Building2,
    description: 'Berufserfahrung und Seniorität',
  },
  industry: {
    label: 'Branche',
    icon: TrendingUp,
    description: 'Branchenwissen und Domänenexpertise',
  },
};

export function MatchScoreCard({
  overallScore,
  categoryScores,
  strengths = [],
  weaknesses = [],
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
