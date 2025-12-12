import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Reusable empty state component for list pages
 * 
 * @param icon - Lucide icon component to display
 * @param title - Main heading text
 * @param description - Descriptive text explaining the empty state
 * @param action - Optional CTA button with label and onClick handler
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={FileText}
 *   title="Noch keine Bewerbungen"
 *   description="Erstelle deine erste Bewerbung in nur 3 Schritten."
 *   action={{
 *     label: 'Erste Bewerbung erstellen',
 *     onClick: () => router.push('/applications/new'),
 *   }}
 * />
 * ```
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
