'use client';

import { useMemo } from 'react';
import type { InterviewStats } from '@/types';

interface InterviewProgressChartProps {
  stats: InterviewStats;
}

export function InterviewProgressChart({ stats }: InterviewProgressChartProps) {
  // Category scores data for the bar chart
  const categoryData = useMemo(() => {
    const { averageCategoryScores } = stats;
    const categories = [
      { name: 'Kommunikation', score: averageCategoryScores.communication, color: 'bg-blue-500' },
      { name: 'Präsentation', score: averageCategoryScores.presentation, color: 'bg-green-500' },
    ];

    if (averageCategoryScores.technical !== undefined && averageCategoryScores.technical > 0) {
      categories.push({
        name: 'Fachkompetenz',
        score: averageCategoryScores.technical,
        color: 'bg-purple-500',
      });
    }

    if (
      averageCategoryScores.problemSolving !== undefined &&
      averageCategoryScores.problemSolving > 0
    ) {
      categories.push({
        name: 'Problemlösung',
        score: averageCategoryScores.problemSolving,
        color: 'bg-orange-500',
      });
    }

    if (averageCategoryScores.cultureFit !== undefined && averageCategoryScores.cultureFit > 0) {
      categories.push({
        name: 'Kulturfit',
        score: averageCategoryScores.cultureFit,
        color: 'bg-pink-500',
      });
    }

    return categories;
  }, [stats]);

  // Session type distribution
  const typeDistribution = useMemo(() => {
    const { sessionsByType } = stats;
    const types = [
      { name: 'Verhalten', count: sessionsByType.BEHAVIORAL, color: 'bg-blue-400' },
      { name: 'Technisch', count: sessionsByType.TECHNICAL, color: 'bg-purple-400' },
      { name: 'Fallstudie', count: sessionsByType.CASE_STUDY, color: 'bg-orange-400' },
      { name: 'Gemischt', count: sessionsByType.MIXED, color: 'bg-green-400' },
    ].filter((t) => t.count > 0);

    const total = types.reduce((sum, t) => sum + t.count, 0);
    return types.map((t) => ({
      ...t,
      percentage: total > 0 ? Math.round((t.count / total) * 100) : 0,
    }));
  }, [stats]);

  if (stats.completedSessions === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        Schließen Sie mindestens ein Interview ab, um Statistiken zu sehen.
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Category Scores */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">
          Durchschnittliche Kategorie-Scores
        </h4>
        <div className="space-y-3">
          {categoryData.map((category) => (
            <div key={category.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{category.name}</span>
                <span className="font-medium">{category.score}/100</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${category.color} transition-all duration-500`}
                  style={{ width: `${category.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interview Type Distribution */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Interview-Typen</h4>
        <div className="space-y-3">
          {typeDistribution.map((type) => (
            <div key={type.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{type.name}</span>
                <span className="font-medium">
                  {type.count} ({type.percentage}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${type.color} transition-all duration-500`}
                  style={{ width: `${type.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Meist geübter Typ:</span>
            <span className="font-medium">
              {stats.mostPracticedType === 'BEHAVIORAL' && 'Verhaltensbezogen'}
              {stats.mostPracticedType === 'TECHNICAL' && 'Technisch'}
              {stats.mostPracticedType === 'CASE_STUDY' && 'Fallstudie'}
              {stats.mostPracticedType === 'MIXED' && 'Gemischt'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
