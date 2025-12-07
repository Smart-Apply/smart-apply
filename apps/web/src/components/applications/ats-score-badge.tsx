'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ATSScoreBadgeProps {
  score: number;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const getScoreInfo = (score: number) => {
  if (score >= 80) {
    return {
      label: 'Ausgezeichnet',
      color: 'text-[#16A34A]',
      bg: 'bg-[#D1FADF]',
      border: 'border-[#16A34A]',
      icon: CheckCircle2,
    };
  }
  if (score >= 60) {
    return {
      label: 'Gut',
      color: 'text-[#EAB308]',
      bg: 'bg-[#FEF3C7]',
      border: 'border-[#EAB308]',
      icon: TrendingUp,
    };
  }
  if (score >= 40) {
    return {
      label: 'Ausbaufähig',
      color: 'text-[#EAB308]',
      bg: 'bg-[#FEF3C7]',
      border: 'border-[#EAB308]',
      icon: AlertCircle,
    };
  }
  return {
    label: 'Niedrig',
    color: 'text-[#DC2626]',
    bg: 'bg-[#FEE2E2]',
    border: 'border-[#DC2626]',
    icon: AlertCircle,
  };
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 h-5',
  md: 'text-sm px-2.5 py-0.5 h-6',
  lg: 'text-base px-3 py-1 h-7',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

/**
 * Reusable ATS Score Badge component
 * Displays application ATS score with consistent styling and brand colors
 * 
 * @example
 * <ATSScoreBadge score={85} showIcon showLabel />
 * <ATSScoreBadge score={65} size="sm" />
 */
export function ATSScoreBadge({
  score,
  showIcon = false,
  showLabel = false,
  size = 'md',
  className,
}: ATSScoreBadgeProps) {
  const scoreInfo = getScoreInfo(score);
  const Icon = scoreInfo.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium whitespace-nowrap',
        scoreInfo.color,
        scoreInfo.bg,
        scoreInfo.border,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn('mr-1', iconSizeClasses[size])} />}
      {Math.round(score)}%
      {showLabel && <span className="ml-1.5 opacity-90">{scoreInfo.label}</span>}
    </Badge>
  );
}
